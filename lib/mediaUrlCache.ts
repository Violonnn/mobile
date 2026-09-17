import { supabase } from './supabase';
import { buildMediaCacheKey } from './mediaPolicy';

const SIGNED_URL_LIFETIME_SECONDS = 60 * 60;
const REFRESH_BUFFER_MS = 60 * 1000;

type CachedSignedUrl = {
  url: string;
  expiresAt: number;
};

const signedUrlCache = new Map<string, CachedSignedUrl>();

export { buildMediaCacheKey } from './mediaPolicy';

function readCachedUrl(cacheKey: string, now: number): string | null {
  const cached = signedUrlCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt - REFRESH_BUFFER_MS <= now) {
    signedUrlCache.delete(cacheKey);
    return null;
  }
  return cached.url;
}

/** Resolve only missing paths and reuse their signed URLs until near expiry. */
export async function resolveSignedMediaUrls(params: {
  bucket: string;
  storagePaths: string[];
  variant: string;
}): Promise<{ urls: Map<string, string>; error: string | null }> {
  const uniquePaths = [...new Set(params.storagePaths.filter(Boolean))];
  const urls = new Map<string, string>();
  const missingPaths: string[] = [];
  const now = Date.now();

  for (const storagePath of uniquePaths) {
    const cacheKey = buildMediaCacheKey(
      params.bucket,
      storagePath,
      params.variant,
    );
    const cachedUrl = readCachedUrl(cacheKey, now);
    if (cachedUrl) {
      urls.set(storagePath, cachedUrl);
    } else {
      missingPaths.push(storagePath);
    }
  }

  if (missingPaths.length === 0) return { urls, error: null };

  const { data, error } = await supabase.storage
    .from(params.bucket)
    .createSignedUrls(missingPaths, SIGNED_URL_LIFETIME_SECONDS);

  if (error) return { urls, error: error.message };

  const expiresAt = now + SIGNED_URL_LIFETIME_SECONDS * 1000;
  (data ?? []).forEach((signedRow, index) => {
    const storagePath = missingPaths[index];
    if (!storagePath || !signedRow.signedUrl) return;

    signedUrlCache.set(
      buildMediaCacheKey(params.bucket, storagePath, params.variant),
      { url: signedRow.signedUrl, expiresAt },
    );
    urls.set(storagePath, signedRow.signedUrl);
  });

  return { urls, error: null };
}

/** Signed URLs are temporary credentials and must not survive sign-out. */
export function clearSignedMediaUrlCache(): void {
  signedUrlCache.clear();
}
