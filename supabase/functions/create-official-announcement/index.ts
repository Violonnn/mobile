// Official announcement creation with server-side role, scope, and media checks.

import { createClient } from "@supabase/supabase-js";
import { GENERIC_SERVER_ERROR, jsonResponse } from "../_shared/http.ts";
import { rejectExtraKeys, trimText } from "../_shared/validation.ts";
import { verifyPrivateMedia } from "../_shared/private-media.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DESCRIPTION = 4000;

type MediaItem = {
  id?: string;
  type?: string;
  storagePath?: string;
  displayStoragePath?: string | null;
  thumbnailStoragePath?: string | null;
  durationSeconds?: number | null;
  fileSizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
};
type Payload = {
  announcementId?: string;
  description?: string;
  media?: MediaItem[];
};

function validateMedia(media: MediaItem[], userId: string, announcementId: string): string | null {
  if (!Array.isArray(media)) return "Invalid media list.";
  let photos = 0;
  let videos = 0;
  let videoSeconds = 0;
  const ids = new Set<string>();
  for (const item of media) {
    if (!item || typeof item !== "object") return "Invalid media item.";
    if (rejectExtraKeys(item as Record<string, unknown>, ["id", "type", "storagePath", "displayStoragePath", "thumbnailStoragePath", "durationSeconds", "fileSizeBytes", "width", "height"])) return "Invalid media fields.";
    const id = trimText(item?.id);
    const type = trimText(item?.type);
    const storagePath = trimText(item?.storagePath);
    if (!id || !UUID.test(id) || ids.has(id) || !storagePath) return "Invalid media item.";
    ids.add(id);
    if (!storagePath.startsWith(`${userId}/${announcementId}/`)) return "Invalid media storage path.";
    if (type === "photo") {
      photos += 1;
      if (item.durationSeconds != null) return "Photos cannot include a duration.";
    } else if (type === "video") {
      videos += 1;
      const seconds = Number(item.durationSeconds);
      if (!Number.isFinite(seconds) || seconds <= 0) return "Videos need a valid duration.";
      videoSeconds += seconds;
    } else return "Invalid media type.";
    if (item.width != null && (!Number.isFinite(Number(item.width)) || Number(item.width) <= 0 || Number(item.width) > 20000)) return "Invalid media width.";
    if (item.height != null && (!Number.isFinite(Number(item.height)) || Number(item.height) <= 0 || Number(item.height) > 20000)) return "Invalid media height.";
  }
  if (photos > 3) return "You can add up to 3 photos.";
  if (videos > 1) return "You can add one video.";
  if (videoSeconds > 30) return "Videos must stay within 30 seconds total.";
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonResponse({ error: "Sign in to publish." }, 401);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: "Sign in to publish." }, 401);
  let payload: unknown;
  try { payload = await req.json(); } catch { return jsonResponse({ error: "Invalid request body." }, 400); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }
  // Accept the legacy key during rollout, but ignore it so no role can pin.
  if (rejectExtraKeys(payload as Record<string, unknown>, ["announcementId", "description", "media", "isPinned"])) return jsonResponse({ error: "Invalid request fields." }, 400);
  const request = payload as Payload;
  const announcementId = trimText(request.announcementId);
  const description = trimText(request.description);
  const media = Array.isArray(request.media) ? request.media : [];
  if (!UUID.test(announcementId) || !description || description.length > MAX_DESCRIPTION) return jsonResponse({ error: "Enter a description (max 4000 characters)." }, 400);
  const mediaError = validateMedia(media, userData.user.id, announcementId);
  if (mediaError) return jsonResponse({ error: mediaError }, 400);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin
    .from("app_profiles")
    .select("role, status, barangay_id")
    .eq("id", userData.user.id)
    .maybeSingle();
  const isActiveOfficer = profile?.status === "active" && profile.role === "officer";
  const isActiveMayor = profile?.status === "active" && profile.role === "mayor" && !profile.barangay_id;
  if (!isActiveOfficer && !isActiveMayor) {
    return jsonResponse({ error: "Only active BDRRMO, MDRRMO, or Mayor accounts can publish announcements." }, 403);
  }

  // Scope and title are always derived from the authenticated public profile.
  // BDRRMO clients never submit a barangay or a scope to this endpoint.
  const isBarangayOfficer = isActiveOfficer && Boolean(profile?.barangay_id);
  const scope = isBarangayOfficer ? "barangay" : "municipal";
  const barangayId = isBarangayOfficer ? profile?.barangay_id : null;
  const title = isBarangayOfficer
    ? "BDRRMO Announcement"
    : isActiveMayor
      ? "Mayor Announcement"
      : "MDRRMO Announcement";
  const mediaVerification = await verifyPrivateMedia({
    admin,
    bucket: "announcement-media",
    userId: userData.user.id,
    parentId: announcementId,
    media,
    // Keep already-installed clients working while the derivative-aware build rolls out.
    allowLegacyPath: true,
  });
  if (mediaVerification.error) return jsonResponse({ error: mediaVerification.error }, 400);
  const { error: announcementError } = await admin.from("announcements").insert({
    id: announcementId,
    author_id: userData.user.id,
    scope,
    barangay_id: barangayId,
    title,
    body: description,
    // Pinning is temporarily disabled across every official role.
    is_pinned: false,
  });
  if (announcementError) {
    console.error("create-official-announcement insert:", announcementError.message);
    return jsonResponse({ error: "Could not publish this announcement." }, 400);
  }
  if (media.length > 0) {
    const { error: mediaInsertError } = await admin.from("announcement_media").insert(media.map((item, position) => ({
      id: trimText(item.id),
      announcement_id: announcementId,
      type: trimText(item.type),
      storage_path: trimText(item.storagePath),
      thumbnail_storage_path: trimText(item.thumbnailStoragePath) || null,
      display_storage_path: trimText(item.displayStoragePath) || null,
      duration_seconds: item.type === "video" ? Number(item.durationSeconds) : null,
      file_size_bytes: mediaVerification.verified.find((verified) => verified.id === trimText(item.id))?.fileSizeBytes ?? null,
      width: item.width == null ? null : Number(item.width),
      height: item.height == null ? null : Number(item.height),
      position,
    })));
    if (mediaInsertError) {
      console.error("create-official-announcement media insert:", mediaInsertError.message);
      await admin.from("announcements").delete().eq("id", announcementId);
      return jsonResponse({ error: "Could not publish this announcement." }, 400);
    }
  }
  return jsonResponse({ announcementId }, 200);
});
