import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { promptOpenSettings } from './permissions';

export type CapturedMedia = {
  id: string;
  type: 'photo' | 'video';
  localUri: string;
  mimeType: string;
  extension: string;
  /** Required for videos; null for photos. */
  durationSeconds: number | null;
};

const REPORT_BUCKET = 'report-media';
const MAX_PHOTOS = 3;
const MAX_VIDEO_SECONDS = 30;

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function extensionForMime(mime: string, fallback: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('quicktime')) return 'mov';
  return fallback;
}

/**
 * Ask for camera access every time it is missing. Once granted the OS
 * remembers it, so the dialog only ever shows while access is denied. If the
 * OS has stopped showing the dialog (permanent denial), guide the user to
 * the app settings — otherwise tapping the button would silently do nothing.
 */
async function ensureCameraPermission(
  usage: 'photos' | 'video',
): Promise<string | null> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return null;

  if (current.canAskAgain) {
    const requested = await ImagePicker.requestCameraPermissionsAsync();
    if (requested.granted) return null;
    if (!requested.canAskAgain) {
      promptOpenSettings(
        'Camera access needed',
        'DisasterLink needs the camera to capture live report evidence. Enable camera access in your device settings.',
      );
    }
    return `Camera permission is required for ${usage}.`;
  }

  promptOpenSettings(
    'Camera access needed',
    'DisasterLink needs the camera to capture live report evidence. Enable camera access in your device settings.',
  );
  return `Camera permission is required for ${usage}.`;
}

/** Live-capture a photo (camera only — no gallery). */
export async function captureReportPhoto(): Promise<{
  media: CapturedMedia | null;
  error: string | null;
}> {
  const permissionError = await ensureCameraPermission('photos');
  if (permissionError) {
    return { media: null, error: permissionError };
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: false,
    exif: false,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { media: null, error: null };
  }

  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? 'image/jpeg';

  return {
    media: {
      id: randomUuid(),
      type: 'photo',
      localUri: asset.uri,
      mimeType,
      extension: extensionForMime(mimeType, 'jpg'),
      durationSeconds: null,
    },
    error: null,
  };
}

/** Live-capture a short video (camera only — no gallery). */
export async function captureReportVideo(): Promise<{
  media: CapturedMedia | null;
  error: string | null;
}> {
  const permissionError = await ensureCameraPermission('video');
  if (permissionError) {
    return { media: null, error: permissionError };
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['videos'],
    videoMaxDuration: MAX_VIDEO_SECONDS,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { media: null, error: null };
  }

  const asset = result.assets[0];
  const durationRaw = asset.duration ?? 0;
  // iOS often returns seconds; Android may return ms. Normalize to seconds.
  const durationSeconds =
    durationRaw > 1000 ? durationRaw / 1000 : durationRaw;

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { media: null, error: 'Could not read video duration.' };
  }
  if (durationSeconds > MAX_VIDEO_SECONDS) {
    return {
      media: null,
      error: `Video must be ${MAX_VIDEO_SECONDS} seconds or less.`,
    };
  }

  const mimeType = asset.mimeType ?? 'video/mp4';

  return {
    media: {
      id: randomUuid(),
      type: 'video',
      localUri: asset.uri,
      mimeType,
      extension: extensionForMime(mimeType, 'mp4'),
      durationSeconds,
    },
    error: null,
  };
}

/** Combined duration (seconds) of all video items in the list. */
export function totalVideoSeconds(items: CapturedMedia[]): number {
  return items
    .filter((m) => m.type === 'video')
    .reduce((sum, v) => sum + (v.durationSeconds ?? 0), 0);
}

export function validateCapturedMedia(items: CapturedMedia[]): string | null {
  const photos = items.filter((m) => m.type === 'photo');
  const videos = items.filter((m) => m.type === 'video');
  const videoDuration = videos.reduce(
    (sum, v) => sum + (v.durationSeconds ?? 0),
    0,
  );

  if (photos.length < 1 || photos.length > MAX_PHOTOS) {
    return 'Add 1 to 3 photos taken with the camera.';
  }
  if (videos.length < 1) {
    return 'Add at least one short video taken with the camera.';
  }
  if (videoDuration > MAX_VIDEO_SECONDS) {
    return `Combined video must be ${MAX_VIDEO_SECONDS} seconds or less.`;
  }
  return null;
}

export function buildStoragePath(
  userId: string,
  reportId: string,
  media: CapturedMedia,
): string {
  return `${userId}/${reportId}/${media.id}.${media.extension}`;
}

/** Upload one captured file to the private report-media bucket. */
export async function uploadReportMedia(params: {
  userId: string;
  reportId: string;
  media: CapturedMedia;
}): Promise<{ storagePath: string | null; error: string | null }> {
  const storagePath = buildStoragePath(
    params.userId,
    params.reportId,
    params.media,
  );

  try {
    // RN cannot reliably fetch(file://).blob() — that surfaces as
    // "Network request failed". Read bytes via FileSystem instead.
    const base64 = await FileSystem.readAsStringAsync(params.media.localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // upsert so retries are idempotent: if an earlier attempt uploaded the
    // file but crashed before recording it, re-uploading the same path must
    // succeed instead of failing forever with "resource already exists".
    const { error } = await supabase.storage
      .from(REPORT_BUCKET)
      .upload(storagePath, decode(base64), {
        contentType: params.media.mimeType,
        upsert: true,
      });

    if (error) {
      return { storagePath: null, error: `Upload failed: ${error.message}` };
    }

    return { storagePath, error: null };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown error';
    return {
      storagePath: null,
      error: `Could not read/upload media (${detail}).`,
    };
  }
}

export { MAX_PHOTOS, MAX_VIDEO_SECONDS, randomUuid };
