// Official announcement attachment selection and private upload helpers.
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';

import { supabase } from './supabase';
import {
  MAX_DISPLAY_IMAGE_BYTES,
  MAX_THUMBNAIL_BYTES,
  MAX_VIDEO_BYTES,
  randomUuid,
} from './reportMedia';

export type AnnouncementDraftMedia = {
  id: string;
  type: 'photo' | 'video';
  localUri: string;
  mimeType: string;
  extension: string;
  durationSeconds: number | null;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  displayLocalUri?: string;
  thumbnailLocalUri: string;
};

export type UploadedAnnouncementMedia = {
  storagePath: string;
  displayStoragePath: string | null;
  thumbnailStoragePath: string;
};

const BUCKET = 'announcement-media';
const DRAFT_DIRECTORY = 'announcement-media-drafts';
const DISPLAY_LONG_EDGE = 1600;
const THUMBNAIL_LONG_EDGE = 480;
export const MAX_ANNOUNCEMENT_PHOTOS = 3;
export const MAX_ANNOUNCEMENT_VIDEO_SECONDS = 30;

function extensionForMime(mime: string, fallback: string) {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('mp4')) return 'mp4';
  return fallback;
}

function isHeicImage(asset: ImagePicker.ImagePickerAsset): boolean {
  const identity = `${asset.mimeType ?? ''} ${asset.fileName ?? ''} ${asset.uri}`.toLowerCase();
  return identity.includes('heic') || identity.includes('heif');
}

function normalizeDuration(value: number | null | undefined) {
  const raw = value ?? 0;
  return raw > 1000 ? raw / 1000 : raw;
}

function draftDirectory(): Directory {
  return new Directory(Paths.document, DRAFT_DIRECTORY);
}

async function persistDraft(
  sourceUri: string,
  fileName: string,
): Promise<{ uri: string; size: number }> {
  const directory = draftDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const source = new File(sourceUri);
  if (!source.exists) throw new Error('The selected attachment is unavailable.');
  const destination = new File(directory, fileName);
  await source.copy(destination, { overwrite: true });
  if (!destination.exists || destination.size <= 0) {
    throw new Error('The selected attachment could not be prepared.');
  }
  return { uri: destination.uri, size: destination.size };
}

function resizeAction(width: number, height: number, longEdge: number) {
  if (Math.max(width, height) <= longEdge) return [];
  return width >= height
    ? [{ resize: { width: longEdge } }]
    : [{ resize: { height: longEdge } }];
}

async function prepareImage(
  sourceUri: string,
  width: number,
  height: number,
  longEdge: number,
  compress: number,
  maximumBytes: number,
  fileName: string,
) {
  const result = await manipulateAsync(
    sourceUri,
    resizeAction(width, height, longEdge),
    { compress, format: SaveFormat.JPEG },
  );
  const file = await persistDraft(result.uri, fileName);
  if (file.size > maximumBytes) {
    throw new Error('The prepared image is too large. Choose a smaller image.');
  }
  return { ...file, width: result.width, height: result.height };
}

async function assetToMedia(
  asset: ImagePicker.ImagePickerAsset,
): Promise<AnnouncementDraftMedia> {
  const type = asset.type === 'video' ? 'video' : 'photo';
  const durationSeconds = type === 'video' ? normalizeDuration(asset.duration) : null;
  if (
    type === 'video' &&
    (!Number.isFinite(durationSeconds) || (durationSeconds ?? 0) <= 0)
  ) {
    throw new Error('Could not read the selected video duration.');
  }
  if (!asset.width || !asset.height) {
    throw new Error('Could not read the selected media dimensions.');
  }

  const id = randomUuid();
  const mimeType = asset.mimeType ?? (type === 'video' ? 'video/mp4' : 'image/jpeg');
  const extension = extensionForMime(mimeType, type === 'video' ? 'mp4' : 'jpg');

  if (type === 'video') {
    const original = await persistDraft(asset.uri, `${id}-original.${extension}`);
    if (original.size > MAX_VIDEO_BYTES) {
      throw new Error('Attachments must be 20 MB or smaller. Choose a smaller file.');
    }

    // Posters are generated locally. Feed rendering never reads the remote video.
    const frame = await VideoThumbnails.getThumbnailAsync(original.uri, {
      time: 500,
      quality: 0.7,
    });
    const thumbnail = await prepareImage(
      frame.uri,
      frame.width,
      frame.height,
      THUMBNAIL_LONG_EDGE,
      0.72,
      MAX_THUMBNAIL_BYTES,
      `${id}-thumbnail.jpg`,
    );
    return {
      id,
      type,
      localUri: original.uri,
      mimeType,
      extension,
      durationSeconds,
      fileSizeBytes: original.size,
      width: asset.width,
      height: asset.height,
      thumbnailLocalUri: thumbnail.uri,
    };
  }

  // iOS commonly returns HEIC photos, but the private media bucket intentionally
  // accepts web-safe formats only. Convert HEIC/HEIF while preserving supported
  // JPEG, PNG, and WebP originals.
  const convertOriginalToJpeg = isHeicImage(asset);
  const original = convertOriginalToJpeg
    ? await prepareImage(
        asset.uri,
        asset.width,
        asset.height,
        Math.max(asset.width, asset.height),
        0.9,
        MAX_VIDEO_BYTES,
        `${id}-original.jpg`,
      )
    : await persistDraft(asset.uri, `${id}-original.${extension}`);
  if (original.size > MAX_VIDEO_BYTES) {
    throw new Error('Attachments must be 20 MB or smaller. Choose a smaller file.');
  }
  const display = await prepareImage(
    original.uri,
    asset.width,
    asset.height,
    DISPLAY_LONG_EDGE,
    0.82,
    MAX_DISPLAY_IMAGE_BYTES,
    `${id}-display.jpg`,
  );
  const thumbnail = await prepareImage(
    original.uri,
    asset.width,
    asset.height,
    THUMBNAIL_LONG_EDGE,
    0.72,
    MAX_THUMBNAIL_BYTES,
    `${id}-thumbnail.jpg`,
  );
  return {
    id,
    type,
    localUri: original.uri,
    mimeType: convertOriginalToJpeg ? 'image/jpeg' : mimeType,
    extension: convertOriginalToJpeg ? 'jpg' : extension,
    durationSeconds: null,
    fileSizeBytes: original.size,
    width: display.width,
    height: display.height,
    displayLocalUri: display.uri,
    thumbnailLocalUri: thumbnail.uri,
  };
}

export function validateAnnouncementMedia(items: AnnouncementDraftMedia[]): string | null {
  const photos = items.filter((item) => item.type === 'photo').length;
  const videos = items.filter((item) => item.type === 'video');
  const seconds = videos.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0);
  if (photos > MAX_ANNOUNCEMENT_PHOTOS) {
    return `You can add up to ${MAX_ANNOUNCEMENT_PHOTOS} photos.`;
  }
  if (videos.length > 1) return 'You can add one video.';
  if (seconds > MAX_ANNOUNCEMENT_VIDEO_SECONDS) {
    return `Videos must stay within ${MAX_ANNOUNCEMENT_VIDEO_SECONDS} seconds total.`;
  }
  if (videos.some((video) => video.fileSizeBytes > MAX_VIDEO_BYTES)) {
    return 'Video must be 20 MB or smaller.';
  }
  return null;
}

// Gallery-only selection — live camera/video capture is not offered here.
export async function pickAnnouncementMedia(
  kind: 'photo' | 'video',
): Promise<{ media: AnnouncementDraftMedia[]; error: string | null }> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { media: [], error: 'Gallery permission is required to select attachments.' };
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kind === 'video' ? ['videos'] : ['images'],
    allowsEditing: false,
    allowsMultipleSelection: kind === 'photo',
    selectionLimit: kind === 'photo' ? MAX_ANNOUNCEMENT_PHOTOS : 1,
    videoMaxDuration: MAX_ANNOUNCEMENT_VIDEO_SECONDS,
  });
  if (result.canceled) return { media: [], error: null };

  try {
    // Preparation is intentionally sequential to bound peak memory usage.
    const media: AnnouncementDraftMedia[] = [];
    for (const asset of result.assets) media.push(await assetToMedia(asset));
    return { media, error: validateAnnouncementMedia(media) };
  } catch (error) {
    return {
      media: [],
      error: error instanceof Error ? error.message : 'Could not prepare this attachment.',
    };
  }
}

function storagePaths(userId: string, announcementId: string, media: AnnouncementDraftMedia) {
  const folder = `${userId}/${announcementId}/${media.id}`;
  return {
    storagePath: `${folder}/original.${media.extension}`,
    displayStoragePath: media.displayLocalUri ? `${folder}/display.jpg` : null,
    thumbnailStoragePath: `${folder}/thumbnail.jpg`,
  };
}

export async function uploadAnnouncementMedia(
  userId: string,
  announcementId: string,
  media: AnnouncementDraftMedia,
): Promise<{ uploaded: UploadedAnnouncementMedia | null; error: string | null }> {
  const paths = storagePaths(userId, announcementId, media);
  const uploads = [
    { path: paths.storagePath, uri: media.localUri, contentType: media.mimeType },
    ...(media.displayLocalUri && paths.displayStoragePath
      ? [{ path: paths.displayStoragePath, uri: media.displayLocalUri, contentType: 'image/jpeg' }]
      : []),
    { path: paths.thumbnailStoragePath, uri: media.thumbnailLocalUri, contentType: 'image/jpeg' },
  ];

  try {
    for (const upload of uploads) {
      const file = new File(upload.uri);
      const bytes = await file.arrayBuffer();
      const { error } = await supabase.storage.from(BUCKET).upload(upload.path, bytes, {
        contentType: upload.contentType,
        cacheControl: '3600',
        upsert: true,
      });
      if (error) return { uploaded: null, error: `Upload failed: ${error.message}` };
    }
    return { uploaded: paths, error: null };
  } catch {
    return { uploaded: null, error: 'Could not read or upload this attachment.' };
  }
}

/** Delete only files created inside DisasterLink's announcement draft folder. */
export function deletePreparedAnnouncementMedia(media: AnnouncementDraftMedia): void {
  const directoryUri = draftDirectory().uri;
  const uris = [media.localUri, media.displayLocalUri, media.thumbnailLocalUri]
    .filter((uri): uri is string => Boolean(uri));
  for (const uri of uris) {
    if (!uri.startsWith(directoryUri)) continue;
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // Successful publishing must not be reversed by best-effort cleanup.
    }
  }
}
