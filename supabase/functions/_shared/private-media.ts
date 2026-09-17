import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
const MAX_DISPLAY_BYTES = 2 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 300 * 1024;

export type PrivateMediaInput = {
  id?: string;
  type?: string;
  storagePath?: string;
  displayStoragePath?: string | null;
  thumbnailStoragePath?: string | null;
};

export type VerifiedPrivateMedia = {
  id: string;
  fileSizeBytes: number;
};

function metadataValue(object: Record<string, unknown>, key: string): unknown {
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return (metadata as Record<string, unknown>)[key];
}

async function inspectObject(
  admin: SupabaseClient,
  bucket: string,
  path: string,
): Promise<{ size: number; mimeType: string } | null> {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash <= 0 || lastSlash === path.length - 1) return null;
  const folder = path.slice(0, lastSlash);
  const fileName = path.slice(lastSlash + 1);
  const { data, error } = await admin.storage
    .from(bucket)
    .list(folder, { limit: 20, search: fileName });
  if (error) return null;
  const object = (data ?? []).find((candidate) => candidate.name === fileName) as
    | Record<string, unknown>
    | undefined;
  if (!object) return null;
  return {
    size: Number(metadataValue(object, "size") ?? 0),
    mimeType: String(metadataValue(object, "mimetype") ?? "").toLowerCase(),
  };
}

/** Validate caller-owned paths and server-observed Storage size/MIME metadata. */
export async function verifyPrivateMedia(params: {
  admin: SupabaseClient;
  bucket: string;
  userId: string;
  parentId: string;
  media: PrivateMediaInput[];
  allowLegacyPath?: boolean;
}): Promise<{ verified: VerifiedPrivateMedia[]; error: string | null }> {
  const verified: VerifiedPrivateMedia[] = [];
  for (const item of params.media) {
    const id = item.id?.trim() ?? "";
    const type = item.type?.trim() ?? "";
    const storagePath = item.storagePath?.trim() ?? "";
    const thumbnailPath = item.thumbnailStoragePath?.trim() ?? "";
    const displayPath = item.displayStoragePath?.trim() ?? "";
    const submittedPaths = [storagePath, thumbnailPath, displayPath].filter(Boolean);
    if (submittedPaths.some((path) => path.includes("..") || path.includes("\\"))) {
      return { verified: [], error: "Invalid media storage path." };
    }
    const mediaFolder = `${params.userId}/${params.parentId}/${id}`;
    const isNewOriginal = storagePath.startsWith(`${mediaFolder}/original.`);
    const isLegacyOriginal = params.allowLegacyPath &&
      storagePath.startsWith(`${params.userId}/${params.parentId}/${id}.`);
    if (!id || (!isNewOriginal && !isLegacyOriginal)) {
      return { verified: [], error: "Invalid media storage path." };
    }
    if (isNewOriginal && (!thumbnailPath || (type === "photo" && !displayPath))) {
      return { verified: [], error: "Prepared media derivatives are required." };
    }
    if (
      (thumbnailPath && thumbnailPath !== `${mediaFolder}/thumbnail.jpg`) ||
      (displayPath && displayPath !== `${mediaFolder}/display.jpg`) ||
      (type === "video" && displayPath)
    ) {
      return { verified: [], error: "Invalid derivative storage path." };
    }

    const original = await inspectObject(params.admin, params.bucket, storagePath);
    const expectedPrefix = type === "video" ? "video/" : "image/";
    if (
      !original || original.size <= 0 || original.size > MAX_ORIGINAL_BYTES ||
      !original.mimeType.startsWith(expectedPrefix)
    ) {
      return { verified: [], error: "An uploaded original is missing, too large, or has an invalid type." };
    }
    if (thumbnailPath) {
      const thumbnail = await inspectObject(params.admin, params.bucket, thumbnailPath);
      if (!thumbnail || thumbnail.size <= 0 || thumbnail.size > MAX_THUMBNAIL_BYTES || thumbnail.mimeType !== "image/jpeg") {
        return { verified: [], error: "A thumbnail is missing, invalid, or larger than 300 KB." };
      }
    }
    if (displayPath) {
      const display = await inspectObject(params.admin, params.bucket, displayPath);
      if (!display || display.size <= 0 || display.size > MAX_DISPLAY_BYTES || display.mimeType !== "image/jpeg") {
        return { verified: [], error: "A display image is missing, invalid, or larger than 2 MB." };
      }
    }
    verified.push({ id, fileSizeBytes: original.size });
  }
  return { verified, error: null };
}
