// Official announcement attachment selection and private upload helpers.
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { randomUuid } from './reportMedia';

export type AnnouncementDraftMedia = {
  id: string;
  type: 'photo' | 'video';
  localUri: string;
  mimeType: string;
  extension: string;
  durationSeconds: number | null;
};

const BUCKET = 'announcement-media';
export const MAX_ANNOUNCEMENT_PHOTOS = 3;
export const MAX_ANNOUNCEMENT_VIDEO_SECONDS = 30;

function extensionForMime(mime: string, fallback: string) {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('mp4')) return 'mp4';
  return fallback;
}

function normalizeDuration(value: number | null | undefined) {
  const raw = value ?? 0;
  return raw > 1000 ? raw / 1000 : raw;
}

function assetToMedia(asset: ImagePicker.ImagePickerAsset): AnnouncementDraftMedia | null {
  const type = asset.type === 'video' ? 'video' : 'photo';
  const durationSeconds = type === 'video' ? normalizeDuration(asset.duration) : null;
  if (type === 'video' && (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0)) return null;
  const mimeType = asset.mimeType ?? (type === 'video' ? 'video/mp4' : 'image/jpeg');
  return {
    id: randomUuid(),
    type,
    localUri: asset.uri,
    mimeType,
    extension: extensionForMime(mimeType, type === 'video' ? 'mp4' : 'jpg'),
    durationSeconds,
  };
}

export function validateAnnouncementMedia(items: AnnouncementDraftMedia[]): string | null {
  const photos = items.filter((item) => item.type === 'photo').length;
  const videos = items.filter((item) => item.type === 'video');
  const seconds = videos.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0);
  if (photos > MAX_ANNOUNCEMENT_PHOTOS) return `You can add up to ${MAX_ANNOUNCEMENT_PHOTOS} photos.`;
  if (videos.length > 1) return 'You can add one video.';
  if (seconds > MAX_ANNOUNCEMENT_VIDEO_SECONDS) return `Videos must stay within ${MAX_ANNOUNCEMENT_VIDEO_SECONDS} seconds total.`;
  return null;
}

// Gallery-only selection — live camera/video capture is not offered for announcements.
export async function pickAnnouncementMedia(kind: 'photo' | 'video'): Promise<{ media: AnnouncementDraftMedia[]; error: string | null }> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { media: [], error: 'Gallery permission is required to select attachments.' };
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kind === 'video' ? ['videos'] as ImagePicker.MediaType[] : ['images'] as ImagePicker.MediaType[],
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: kind === 'photo' ? MAX_ANNOUNCEMENT_PHOTOS : 1,
    videoMaxDuration: MAX_ANNOUNCEMENT_VIDEO_SECONDS,
  });
  if (result.canceled) return { media: [], error: null };
  const media = result.assets.map(assetToMedia).filter((item): item is AnnouncementDraftMedia => Boolean(item));
  if (media.length !== result.assets.length) return { media: [], error: 'Could not read the selected video duration.' };
  return { media, error: validateAnnouncementMedia(media) };
}

export async function uploadAnnouncementMedia(userId: string, announcementId: string, media: AnnouncementDraftMedia): Promise<{ storagePath: string | null; error: string | null }> {
  const storagePath = `${userId}/${announcementId}/${media.id}.${media.extension}`;
  try {
    const base64 = await FileSystem.readAsStringAsync(media.localUri, { encoding: FileSystem.EncodingType.Base64 });
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, decode(base64), { contentType: media.mimeType, upsert: true });
    return error ? { storagePath: null, error: `Upload failed: ${error.message}` } : { storagePath, error: null };
  } catch {
    return { storagePath: null, error: 'Could not read or upload this attachment.' };
  }
}
