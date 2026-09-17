import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { supabase } from './supabase';
import { promptOpenSettings } from './permissions';
import {
  buildReportDerivativeStoragePath,
  buildReportOriginalStoragePath,
  MAX_MEDIA_DISPLAY_IMAGE_BYTES,
  MAX_MEDIA_THUMBNAIL_BYTES,
  MAX_MEDIA_VIDEO_BYTES,
} from './mediaPolicy';

export type CapturedMedia = {
  id: string;
  type: 'photo' | 'video';
  localUri: string;
  mimeType: string;
  extension: string;
  fileSizeBytes?: number;
  width?: number;
  height?: number;
  /** Prepared, purpose-sized image used only in detail views. */
  displayLocalUri?: string;
  displayFileSizeBytes?: number;
  /** Prepared feed thumbnail or video poster. */
  thumbnailLocalUri?: string;
  thumbnailFileSizeBytes?: number;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  /** Required for videos; null for photos. */
  durationSeconds: number | null;
};

const REPORT_BUCKET = 'report-media';
const MAX_PHOTOS = 3;
const MAX_VIDEO_SECONDS = 30;
const MAX_VIDEO_BYTES = MAX_MEDIA_VIDEO_BYTES;
const MAX_DISPLAY_IMAGE_BYTES = MAX_MEDIA_DISPLAY_IMAGE_BYTES;
const MAX_THUMBNAIL_BYTES = MAX_MEDIA_THUMBNAIL_BYTES;
const DISPLAY_LONG_EDGE = 1600;
const THUMBNAIL_LONG_EDGE = 480;
const MEDIA_UPLOAD_ATTEMPTS = 2;
const MEDIA_RETRY_DELAY_MS = 700;
const REPORT_MEDIA_DRAFT_DIRECTORY = 'report-media-drafts';

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

function getErrorDetail(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected media error';
}

function getDraftMediaDirectory(): Directory {
  return new Directory(Paths.document, REPORT_MEDIA_DRAFT_DIRECTORY);
}

/** Copy camera output out of the temporary picker cache for reliable retries. */
async function persistCapturedMedia(
  sourceUri: string,
  mediaId: string,
  extension: string,
  variant = 'original',
): Promise<{ uri: string; size: number }> {
  const draftDirectory = getDraftMediaDirectory();
  draftDirectory.create({ idempotent: true, intermediates: true });

  const sourceFile = new File(sourceUri);
  if (!sourceFile.exists) {
    throw new Error('The captured file is not available.');
  }

  const destinationFile = new File(
    draftDirectory,
    `${mediaId}-${variant}.${extension}`,
  );
  await sourceFile.copy(destinationFile, { overwrite: true });

  if (!destinationFile.exists || destinationFile.size <= 0) {
    throw new Error('The captured file could not be prepared.');
  }

  return { uri: destinationFile.uri, size: destinationFile.size };
}

function resizeForLongEdge(width: number, height: number, longEdge: number) {
  if (Math.max(width, height) <= longEdge) return [];
  return width >= height
    ? [{ resize: { width: longEdge } }]
    : [{ resize: { height: longEdge } }];
}

async function prepareJpegVariant(params: {
  sourceUri: string;
  mediaId: string;
  variant: 'display' | 'thumbnail';
  sourceWidth: number;
  sourceHeight: number;
  longEdge: number;
  compress: number;
  maximumBytes: number;
}): Promise<{ uri: string; size: number; width: number; height: number }> {
  const result = await manipulateAsync(
    params.sourceUri,
    resizeForLongEdge(params.sourceWidth, params.sourceHeight, params.longEdge),
    { compress: params.compress, format: SaveFormat.JPEG },
  );
  const persisted = await persistCapturedMedia(
    result.uri,
    params.mediaId,
    'jpg',
    params.variant,
  );
  if (persisted.size > params.maximumBytes) {
    throw new Error(
      params.variant === 'thumbnail'
        ? 'The prepared thumbnail is too large. Retake the photo at a lower resolution.'
        : 'The prepared photo is too large. Retake the photo at a lower resolution.',
    );
  }
  return { ...persisted, width: result.width, height: result.height };
}

/** Only remove files created in DisasterLink's own report-draft directory. */
export function deletePersistedReportMedia(media: CapturedMedia): void {
  const draftDirectory = getDraftMediaDirectory();
  const localUris = [
    media.localUri,
    media.displayLocalUri,
    media.thumbnailLocalUri,
  ].filter((uri): uri is string => Boolean(uri));

  for (const localUri of localUris) {
    if (!localUri.startsWith(draftDirectory.uri)) continue;
    try {
      const mediaFile = new File(localUri);
      if (mediaFile.exists) mediaFile.delete();
    } catch {
      // Cleanup must never block a successful report or media removal.
    }
  }
}

export function isTransientMediaUploadError(message: string): boolean {
  const normalizedMessage = message.toLocaleLowerCase();
  return (
    normalizedMessage.includes('fetch failed') ||
    normalizedMessage.includes('network request failed') ||
    normalizedMessage.includes('network connection was lost') ||
    normalizedMessage.includes('unexpectedexception') ||
    normalizedMessage.includes('timed out') ||
    normalizedMessage.includes('timeout') ||
    normalizedMessage.includes('load failed')
  );
}

function waitBeforeUploadRetry(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, MEDIA_RETRY_DELAY_MS);
  });
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

  try {
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
    const mediaId = randomUuid();
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const extension = extensionForMime(mimeType, 'jpg');
    if (!asset.width || !asset.height) {
      return { media: null, error: 'Could not read photo dimensions.' };
    }
    const persistedFile = await persistCapturedMedia(
      asset.uri,
      mediaId,
      extension,
    );
    const display = await prepareJpegVariant({
      sourceUri: persistedFile.uri,
      mediaId,
      variant: 'display',
      sourceWidth: asset.width,
      sourceHeight: asset.height,
      longEdge: DISPLAY_LONG_EDGE,
      compress: 0.82,
      maximumBytes: MAX_DISPLAY_IMAGE_BYTES,
    });
    const thumbnail = await prepareJpegVariant({
      sourceUri: persistedFile.uri,
      mediaId,
      variant: 'thumbnail',
      sourceWidth: asset.width,
      sourceHeight: asset.height,
      longEdge: THUMBNAIL_LONG_EDGE,
      compress: 0.72,
      maximumBytes: MAX_THUMBNAIL_BYTES,
    });

    return {
      media: {
        id: mediaId,
        type: 'photo',
        localUri: persistedFile.uri,
        mimeType,
        extension,
        fileSizeBytes: persistedFile.size,
        width: display.width,
        height: display.height,
        displayLocalUri: display.uri,
        displayFileSizeBytes: display.size,
        thumbnailLocalUri: thumbnail.uri,
        thumbnailFileSizeBytes: thumbnail.size,
        thumbnailWidth: thumbnail.width,
        thumbnailHeight: thumbnail.height,
        durationSeconds: null,
      },
      error: null,
    };
  } catch (error) {
    return {
      media: null,
      error: `Could not prepare the captured photo. ${getErrorDetail(error)}`,
    };
  }
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

  try {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: MAX_VIDEO_SECONDS,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return { media: null, error: null };
    }

    const asset = result.assets[0];
    // Expo ImagePicker reports video duration in milliseconds.
    const durationSeconds = (asset.duration ?? 0) / 1000;

    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return { media: null, error: 'Could not read video duration.' };
    }
    if (durationSeconds > MAX_VIDEO_SECONDS) {
      return {
        media: null,
        error: `Video must be ${MAX_VIDEO_SECONDS} seconds or less.`,
      };
    }

    const mediaId = randomUuid();
    const mimeType = asset.mimeType ?? 'video/mp4';
    const extension = extensionForMime(mimeType, 'mp4');
    const persistedFile = await persistCapturedMedia(
      asset.uri,
      mediaId,
      extension,
    );
    if (persistedFile.size > MAX_VIDEO_BYTES) {
      deletePersistedReportMedia({
        id: mediaId,
        type: 'video',
        localUri: persistedFile.uri,
        mimeType,
        extension,
        durationSeconds,
      });
      return {
        media: null,
        error: 'Video must be 20 MB or smaller. Retake it at a lower quality.',
      };
    }

    // Generate the poster from the local file so feed rendering never touches
    // the remote original video.
    const posterFrame = await VideoThumbnails.getThumbnailAsync(
      persistedFile.uri,
      { time: 500, quality: 0.7 },
    );
    const poster = await prepareJpegVariant({
      sourceUri: posterFrame.uri,
      mediaId,
      variant: 'thumbnail',
      sourceWidth: posterFrame.width,
      sourceHeight: posterFrame.height,
      longEdge: THUMBNAIL_LONG_EDGE,
      compress: 0.72,
      maximumBytes: MAX_THUMBNAIL_BYTES,
    });

    return {
      media: {
        id: mediaId,
        type: 'video',
        localUri: persistedFile.uri,
        mimeType,
        extension,
        fileSizeBytes: persistedFile.size,
        width: asset.width || undefined,
        height: asset.height || undefined,
        thumbnailLocalUri: poster.uri,
        thumbnailFileSizeBytes: poster.size,
        thumbnailWidth: poster.width,
        thumbnailHeight: poster.height,
        durationSeconds,
      },
      error: null,
    };
  } catch (error) {
    return {
      media: null,
      error: `Could not prepare the captured video. ${getErrorDetail(error)}`,
    };
  }
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

  if (items.length < 1) {
    return 'Add at least one clear photo or video.';
  }
  if (photos.length > MAX_PHOTOS) {
    return `Add no more than ${MAX_PHOTOS} photos.`;
  }
  if (videoDuration > MAX_VIDEO_SECONDS) {
    return `Combined video must be ${MAX_VIDEO_SECONDS} seconds or less.`;
  }
  if (items.some((item) => (item.fileSizeBytes ?? 0) > MAX_VIDEO_BYTES)) {
    return 'Each original attachment must be 20 MB or smaller.';
  }
  if (items.some((item) => (item.thumbnailFileSizeBytes ?? 0) > MAX_THUMBNAIL_BYTES)) {
    return 'Each prepared thumbnail must be 300 KB or smaller.';
  }
  if (photos.some((photo) => (photo.displayFileSizeBytes ?? 0) > MAX_DISPLAY_IMAGE_BYTES)) {
    return 'Each prepared photo must be 2 MB or smaller.';
  }
  return null;
}

export function buildStoragePath(
  userId: string,
  reportId: string,
  media: CapturedMedia,
): string {
  return buildReportOriginalStoragePath({
    userId,
    reportId,
    mediaId: media.id,
    extension: media.extension,
  });
}

export function buildDerivativeStoragePath(
  userId: string,
  reportId: string,
  mediaId: string,
  variant: 'display' | 'thumbnail',
): string {
  return buildReportDerivativeStoragePath({
    userId,
    reportId,
    mediaId,
    variant,
  });
}

/** Upload one captured file to the private report-media bucket. */
export async function uploadReportMedia(params: {
  userId: string;
  reportId: string;
  media: CapturedMedia;
}): Promise<{
  storagePath: string | null;
  displayStoragePath: string | null;
  thumbnailStoragePath: string | null;
  error: string | null;
  retryable: boolean;
}> {
  const storagePath = buildStoragePath(
    params.userId,
    params.reportId,
    params.media,
  );
  let mediaBytes: ArrayBuffer;

  try {
    const mediaFile = new File(params.media.localUri);
    if (!mediaFile.exists || mediaFile.size <= 0) {
      return {
        storagePath: null,
        displayStoragePath: null,
        thumbnailStoragePath: null,
        error: 'The captured media is no longer available on this device.',
        retryable: false,
      };
    }

    // ArrayBuffer avoids the extra memory used by converting a full video to Base64.
    mediaBytes = await mediaFile.arrayBuffer();
  } catch (error) {
    return {
      storagePath: null,
      displayStoragePath: null,
      thumbnailStoragePath: null,
      error: `Could not read the captured media. ${getErrorDetail(error)}`,
      retryable: false,
    };
  }

  let lastUploadError = 'Media upload failed.';

  for (let attempt = 1; attempt <= MEDIA_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      // Upsert keeps retries idempotent if Storage received the first request
      // but the app disconnected before receiving its response.
      const uploadItems = [
        {
          path: storagePath,
          uri: params.media.localUri,
          contentType: params.media.mimeType,
        },
        ...(params.media.displayLocalUri
          ? [{
              path: buildDerivativeStoragePath(
                params.userId,
                params.reportId,
                params.media.id,
                'display',
              ),
              uri: params.media.displayLocalUri,
              contentType: 'image/jpeg',
            }]
          : []),
        ...(params.media.thumbnailLocalUri
          ? [{
              path: buildDerivativeStoragePath(
                params.userId,
                params.reportId,
                params.media.id,
                'thumbnail',
              ),
              uri: params.media.thumbnailLocalUri,
              contentType: 'image/jpeg',
            }]
          : []),
      ];

      let uploadError: string | null = null;
      for (const uploadItem of uploadItems) {
        const uploadFile = new File(uploadItem.uri);
        const uploadBytes = uploadItem.uri === params.media.localUri
          ? mediaBytes
          : await uploadFile.arrayBuffer();
        const { error } = await supabase.storage
          .from(REPORT_BUCKET)
          .upload(uploadItem.path, uploadBytes, {
            contentType: uploadItem.contentType,
            cacheControl: '3600',
            upsert: true,
          });
        if (error) {
          uploadError = error.message;
          break;
        }
      }

      if (!uploadError) {
        return {
          storagePath,
          displayStoragePath: params.media.displayLocalUri
            ? buildDerivativeStoragePath(
                params.userId,
                params.reportId,
                params.media.id,
                'display',
              )
            : null,
          thumbnailStoragePath: params.media.thumbnailLocalUri
            ? buildDerivativeStoragePath(
                params.userId,
                params.reportId,
                params.media.id,
                'thumbnail',
              )
            : null,
          error: null,
          retryable: false,
        };
      }

      lastUploadError = uploadError;
    } catch (error) {
      lastUploadError = getErrorDetail(error);
    }

    const retryable = isTransientMediaUploadError(lastUploadError);
    if (!retryable || attempt === MEDIA_UPLOAD_ATTEMPTS) {
      return {
        storagePath: null,
        displayStoragePath: null,
        thumbnailStoragePath: null,
        error: retryable
          ? 'Media upload paused because the network connection was interrupted.'
          : `Upload failed: ${lastUploadError}`,
        retryable,
      };
    }

    await waitBeforeUploadRetry();
  }

  return {
    storagePath: null,
    displayStoragePath: null,
    thumbnailStoragePath: null,
    error: lastUploadError,
    retryable: false,
  };
}

export {
  MAX_DISPLAY_IMAGE_BYTES,
  MAX_PHOTOS,
  MAX_THUMBNAIL_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  randomUuid,
};
