export const MAX_MEDIA_VIDEO_BYTES = 20 * 1024 * 1024;
export const MAX_MEDIA_DISPLAY_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_MEDIA_THUMBNAIL_BYTES = 300 * 1024;

export function buildMediaCacheKey(
  bucket: string,
  storagePath: string,
  variant: string,
): string {
  return `${bucket}:${variant}:${storagePath}`;
}

export function buildReportOriginalStoragePath(params: {
  userId: string;
  reportId: string;
  mediaId: string;
  extension: string;
}): string {
  return `${params.userId}/${params.reportId}/${params.mediaId}/original.${params.extension}`;
}

export function buildReportDerivativeStoragePath(params: {
  userId: string;
  reportId: string;
  mediaId: string;
  variant: 'display' | 'thumbnail';
}): string {
  return `${params.userId}/${params.reportId}/${params.mediaId}/${params.variant}.jpg`;
}

