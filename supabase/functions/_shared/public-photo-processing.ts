import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizePublicJpeg } from './public-jpeg.ts';

const BUCKET = 'report-media';
const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
const MAX_DISPLAY_BYTES = 2 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 300 * 1024;
const DISPLAY_LONG_EDGE = 1600;
const THUMBNAIL_LONG_EDGE = 480;
export const PUBLIC_PHOTO_PROCESSOR_VERSION = 1;

type StorageObjectInfo = {
  id?: unknown;
  name?: unknown;
  metadata?: unknown;
};

type JsonRecord = Record<string, unknown>;

export type PublicPhotoInput = {
  reporterId: string;
  reportId: string;
  mediaId: string;
  sourceStoragePath: string;
  displaySourcePath: string;
  thumbnailSourcePath: string;
};

export type ProcessedPublicPhoto = {
  sourceStoragePath: string;
  sourceObjectId: string;
  displaySourcePath: string;
  displaySourceObjectId: string;
  thumbnailSourcePath: string;
  thumbnailSourceObjectId: string;
  displaySafePath: string;
  displaySafeObjectId: string;
  displaySha256: string;
  displaySize: number;
  displayWidth: number;
  displayHeight: number;
  thumbnailSafePath: string;
  thumbnailSafeObjectId: string;
  thumbnailSha256: string;
  thumbnailSize: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  processorVersion: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function metadataValue(object: StorageObjectInfo, key: string): unknown {
  if (!isRecord(object.metadata)) return null;
  return object.metadata[key];
}

function joinPath(...parts: string[]): string {
  return parts.map((part) => part.replace(/^\/+|\/+$/g, '')).join('/');
}

function splitStoragePath(path: string): { folder: string; fileName: string } | null {
  const slash = path.lastIndexOf('/');
  if (slash <= 0 || slash === path.length - 1 || path.includes('..') || path.includes('\\')) {
    return null;
  }
  return { folder: path.slice(0, slash), fileName: path.slice(slash + 1) };
}

function isExpectedOriginalPath(path: string, mediaFolder: string): boolean {
  const name = path.startsWith(`${mediaFolder}/`)
    ? path.slice(mediaFolder.length + 1)
    : path.startsWith(`${mediaFolder}.`)
    ? path.slice(mediaFolder.length + 1)
    : '';
  return /^(?:original\.)?(?:jpg|jpeg|png|webp|heic|heif)$/i.test(name);
}

async function findStorageObject(
  admin: SupabaseClient,
  path: string,
): Promise<{ id: string; size: number; mimeType: string } | null> {
  const location = splitStoragePath(path);
  if (!location) return null;
  const { data, error } = await admin.storage.from(BUCKET).list(location.folder, {
    limit: 100,
    search: location.fileName,
  });
  if (error) return null;
  const object = (data ?? []).find((entry) => entry.name === location.fileName) as
    | StorageObjectInfo
    | undefined;
  const id = typeof object?.id === 'string' ? object.id : '';
  const size = Number(metadataValue(object ?? {}, 'size') ?? 0);
  const mimeType = String(metadataValue(object ?? {}, 'mimetype') ?? '').toLowerCase();
  if (!id || !Number.isFinite(size) || size <= 0 || !mimeType) return null;
  return { id, size, mimeType };
}

async function downloadObject(
  admin: SupabaseClient,
  path: string,
  maxBytes: number,
  expectedMimePrefix: string,
): Promise<{ bytes: Uint8Array; objectId: string } | null> {
  const object = await findStorageObject(admin, path);
  if (!object || object.size > maxBytes || !object.mimeType.startsWith(expectedMimePrefix)) {
    return null;
  }
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.length <= 0 || bytes.length > maxBytes || bytes.length !== object.size) return null;
  return { bytes, objectId: object.id };
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const ownedBuffer = new Uint8Array(bytes).buffer;
  const digest = await crypto.subtle.digest('SHA-256', ownedBuffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function uploadImmutableJpeg(
  admin: SupabaseClient,
  path: string,
  bytes: Uint8Array,
  expectedHash: string,
): Promise<{ objectId: string; error: string | null }> {
  const ownedBuffer = new Uint8Array(bytes).buffer;
  const { error } = await admin.storage.from(BUCKET).upload(
    path,
    new Blob([ownedBuffer], { type: 'image/jpeg' }),
    { cacheControl: '60', contentType: 'image/jpeg', upsert: false },
  );

  if (error && !error.message.toLowerCase().includes('already exists') && !error.message.toLowerCase().includes('duplicate')) {
    return { objectId: '', error: 'Could not save the verified photo copy.' };
  }

  // A retry may reuse an immutable content path only if its stored bytes match.
  const readBack = await downloadObject(admin, path, MAX_DISPLAY_BYTES, 'image/jpeg');
  if (!readBack || await sha256(readBack.bytes) !== expectedHash) {
    return { objectId: '', error: 'The verified photo copy failed its read-back check.' };
  }
  return { objectId: readBack.objectId, error: null };
}

/** Strip metadata from the exact report derivatives, then create immutable safe copies. */
export async function processPublicPhotoDerivatives(
  admin: SupabaseClient,
  input: PublicPhotoInput,
): Promise<{ processed: ProcessedPublicPhoto | null; error: string | null }> {
  const mediaFolder = joinPath(input.reporterId, input.reportId, input.mediaId);
  if (
    !isExpectedOriginalPath(input.sourceStoragePath, mediaFolder) ||
    input.displaySourcePath !== joinPath(mediaFolder, 'display.jpg') ||
    input.thumbnailSourcePath !== joinPath(mediaFolder, 'thumbnail.jpg')
  ) {
    return { processed: null, error: 'This photo needs to be prepared again before publication.' };
  }

  const sourceObject = await findStorageObject(admin, input.sourceStoragePath);
  if (!sourceObject || sourceObject.size > MAX_ORIGINAL_BYTES || !sourceObject.mimeType.startsWith('image/')) {
    return { processed: null, error: 'The private original photo is missing or invalid.' };
  }
  const displayDownload = await downloadObject(admin, input.displaySourcePath, MAX_DISPLAY_BYTES, 'image/jpeg');
  const thumbnailDownload = await downloadObject(admin, input.thumbnailSourcePath, MAX_THUMBNAIL_BYTES, 'image/jpeg');
  if (!displayDownload || !thumbnailDownload) {
    return { processed: null, error: 'A JPEG display and thumbnail copy are required before publication.' };
  }

  let safeDisplay: ReturnType<typeof sanitizePublicJpeg>;
  let safeThumbnail: ReturnType<typeof sanitizePublicJpeg>;
  try {
    safeDisplay = sanitizePublicJpeg(displayDownload.bytes, MAX_DISPLAY_BYTES);
    safeThumbnail = sanitizePublicJpeg(thumbnailDownload.bytes, MAX_THUMBNAIL_BYTES);
  } catch {
    return { processed: null, error: 'The display photo or thumbnail is not a complete supported JPEG.' };
  }
  if (
    Math.max(safeDisplay.width, safeDisplay.height) > DISPLAY_LONG_EDGE ||
    Math.max(safeThumbnail.width, safeThumbnail.height) > THUMBNAIL_LONG_EDGE
  ) {
    return { processed: null, error: 'The prepared photo dimensions exceed the publication limits.' };
  }

  const displaySha256 = await sha256(safeDisplay.bytes);
  const thumbnailSha256 = await sha256(safeThumbnail.bytes);
  const displaySafePath = joinPath('public-safe', input.mediaId, displaySha256, 'display.jpg');
  const thumbnailSafePath = joinPath('public-safe', input.mediaId, thumbnailSha256, 'thumbnail.jpg');
  const displayUpload = await uploadImmutableJpeg(admin, displaySafePath, safeDisplay.bytes, displaySha256);
  if (displayUpload.error) return { processed: null, error: displayUpload.error };
  const thumbnailUpload = await uploadImmutableJpeg(admin, thumbnailSafePath, safeThumbnail.bytes, thumbnailSha256);
  if (thumbnailUpload.error) return { processed: null, error: thumbnailUpload.error };

  return {
    processed: {
      sourceStoragePath: input.sourceStoragePath,
      sourceObjectId: sourceObject.id,
      displaySourcePath: input.displaySourcePath,
      displaySourceObjectId: displayDownload.objectId,
      thumbnailSourcePath: input.thumbnailSourcePath,
      thumbnailSourceObjectId: thumbnailDownload.objectId,
      displaySafePath,
      displaySafeObjectId: displayUpload.objectId,
      displaySha256,
      displaySize: safeDisplay.bytes.length,
      displayWidth: safeDisplay.width,
      displayHeight: safeDisplay.height,
      thumbnailSafePath,
      thumbnailSafeObjectId: thumbnailUpload.objectId,
      thumbnailSha256,
      thumbnailSize: safeThumbnail.bytes.length,
      thumbnailWidth: safeThumbnail.width,
      thumbnailHeight: safeThumbnail.height,
      processorVersion: PUBLIC_PHOTO_PROCESSOR_VERSION,
    },
    error: null,
  };
}
