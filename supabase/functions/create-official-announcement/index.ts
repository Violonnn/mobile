// Official announcement creation with server-side role, scope, and media checks.

import { createClient } from "@supabase/supabase-js";
import { GENERIC_SERVER_ERROR, jsonResponse } from "../_shared/http.ts";
import { rejectExtraKeys, trimText } from "../_shared/validation.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DESCRIPTION = 4000;

type MediaItem = { id?: string; type?: string; storagePath?: string; durationSeconds?: number | null };
type Payload = {
  announcementId?: string;
  description?: string;
  media?: MediaItem[];
  isPinned?: boolean;
};

function validateMedia(media: MediaItem[], userId: string, announcementId: string): string | null {
  if (!Array.isArray(media)) return "Invalid media list.";
  let photos = 0;
  let videos = 0;
  let videoSeconds = 0;
  const ids = new Set<string>();
  for (const item of media) {
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
  }
  if (photos > 3) return "You can add up to 3 photos.";
  if (videos > 1) return "You can add one video.";
  if (videoSeconds > 30) return "Videos must stay within 30 seconds total.";
  return null;
}

async function verifyUploadedMedia(
  admin: ReturnType<typeof createClient>,
  userId: string,
  announcementId: string,
  paths: string[],
): Promise<boolean> {
  if (paths.length === 0) return true;

  const folder = `${userId}/${announcementId}`;
  const { data: objects, error } = await admin.storage
    .from("announcement-media")
    .list(folder, { limit: 10 });

  if (error) {
    console.error("create-official-announcement media verification:", error.message);
    return false;
  }

  const uploadedPaths = new Set(
    (objects ?? []).map((object) => `${folder}/${object.name}`),
  );

  // The client-side Storage policy permits inserts only in auth.uid()'s
  // folder. The validated prefix plus this existence check therefore proves
  // the caller uploaded each claimed object without depending on internal
  // owner_id metadata.
  return paths.every((path) => uploadedPaths.has(path));
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
  if (rejectExtraKeys(payload as Record<string, unknown>, ["announcementId", "description", "media", "isPinned"])) return jsonResponse({ error: "Invalid request fields." }, 400);
  const request = payload as Payload;
  const announcementId = trimText(request.announcementId);
  const description = trimText(request.description);
  const media = Array.isArray(request.media) ? request.media : [];
  const isPinned = request.isPinned ?? false;
  if (!UUID.test(announcementId) || !description || description.length > MAX_DESCRIPTION) return jsonResponse({ error: "Enter a description (max 4000 characters)." }, 400);
  if (typeof isPinned !== "boolean") return jsonResponse({ error: "Invalid pin setting." }, 400);
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
  const paths = media.map((item) => trimText(item.storagePath));
  if (!(await verifyUploadedMedia(admin, userData.user.id, announcementId, paths))) {
    return jsonResponse({ error: "One or more uploaded attachments could not be verified." }, 400);
  }
  const { error: announcementError } = await admin.from("announcements").insert({
    id: announcementId,
    author_id: userData.user.id,
    scope,
    barangay_id: barangayId,
    title,
    body: description,
    is_pinned: isPinned,
  });
  if (announcementError) {
    console.error("create-official-announcement insert:", announcementError.message);
    return jsonResponse({ error: "Could not publish this announcement." }, 400);
  }
  if (media.length > 0) {
    const { error: mediaInsertError } = await admin.from("announcement_media").insert(media.map((item, position) => ({ id: trimText(item.id), announcement_id: announcementId, type: trimText(item.type), storage_path: trimText(item.storagePath), duration_seconds: item.type === "video" ? Number(item.durationSeconds) : null, position })));
    if (mediaInsertError) {
      console.error("create-official-announcement media insert:", mediaInsertError.message);
      await admin.from("announcements").delete().eq("id", announcementId);
      return jsonResponse({ error: "Could not publish this announcement." }, 400);
    }
  }
  return jsonResponse({ announcementId }, 200);
});
