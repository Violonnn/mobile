import { createClient } from "@supabase/supabase-js";
import { GENERIC_SERVER_ERROR, jsonResponse } from "../_shared/http.ts";
import {
  checkReportCreateAllowed,
  recordSuccessfulReportCreate,
  REPORT_WINDOW_MINUTES,
} from "../_shared/report-rate-limit.ts";
import { rejectExtraKeys, trimText } from "../_shared/validation.ts";

/** Rough Minglanilla / metro Cebu bounding box for GPS sanity checks. */
const LAT_MIN = 10.15;
const LAT_MAX = 10.35;
const LNG_MIN = 123.70;
const LNG_MAX = 123.90;

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;
const MAX_ADDRESS = 300;

type MediaItem = {
  id?: string;
  type?: string;
  storagePath?: string;
  durationSeconds?: number | null;
};

type CreateReportPayload = {
  reportId?: string;
  title?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  addressText?: string;
  media?: MediaItem[];
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function validateMedia(media: MediaItem[]): string | null {
  if (!Array.isArray(media) || media.length < 1) {
    return "Add at least one photo and one video.";
  }

  let photos = 0;
  let videos = 0;
  let videoDuration = 0;

  for (const item of media) {
    if (!item || typeof item !== "object") {
      return "Invalid media item.";
    }
    const id = trimText(item.id);
    const type = trimText(item.type);
    const storagePath = trimText(item.storagePath);

    if (!id || !isUuid(id) || !storagePath) {
      return "Each media item needs a valid id and storage path.";
    }
    if (type !== "photo" && type !== "video") {
      return "Media type must be photo or video.";
    }

    if (type === "photo") {
      photos += 1;
      if (item.durationSeconds != null) {
        return "Photos must not include duration.";
      }
    } else {
      videos += 1;
      const duration = Number(item.durationSeconds);
      if (!Number.isFinite(duration) || duration <= 0) {
        return "Videos need a positive duration in seconds.";
      }
      videoDuration += duration;
    }
  }

  if (photos < 1 || photos > 3) {
    return "Resident reports require 1 to 3 photos.";
  }
  if (videos < 1) {
    return "Resident reports require at least 1 video.";
  }
  if (videoDuration > 30) {
    return "Combined video duration must not exceed 30 seconds.";
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("create-report: missing Supabase env vars");
    return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Sign in to submit a report." }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: "Sign in to submit a report." }, 401);
  }

  const reporterId = userData.user.id;

  let rawPayload: CreateReportPayload;
  try {
    rawPayload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const extraFieldsError = rejectExtraKeys(rawPayload as Record<string, unknown>, [
    "reportId",
    "title",
    "description",
    "latitude",
    "longitude",
    "addressText",
    "media",
  ]);
  if (extraFieldsError) {
    return jsonResponse({ error: "Invalid request fields." }, 400);
  }

  const title = trimText(rawPayload.title);
  const description = trimText(rawPayload.description);
  const addressText = trimText(rawPayload.addressText);
  const latitude = Number(rawPayload.latitude);
  const longitude = Number(rawPayload.longitude);
  const reportId = trimText(rawPayload.reportId);
  const media = Array.isArray(rawPayload.media) ? rawPayload.media : [];

  if (!title || title.length > MAX_TITLE) {
    return jsonResponse({ error: "Enter a title (max 120 characters)." }, 400);
  }
  if (!description || description.length > MAX_DESCRIPTION) {
    return jsonResponse({ error: "Enter a description (max 2000 characters)." }, 400);
  }
  if (addressText.length > MAX_ADDRESS) {
    return jsonResponse({ error: "Address is too long." }, 400);
  }
  if (reportId && !isUuid(reportId)) {
    return jsonResponse({ error: "Invalid report id." }, 400);
  }
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < LAT_MIN ||
    latitude > LAT_MAX ||
    longitude < LNG_MIN ||
    longitude > LNG_MAX
  ) {
    return jsonResponse({
      error: "Location must be inside Minglanilla / nearby Cebu.",
    }, 400);
  }

  const mediaError = validateMedia(media);
  if (mediaError) {
    return jsonResponse({ error: mediaError }, 400);
  }

  // Path must stay under the caller's folder: {reporterId}/{reportId}/{mediaId}.ext
  for (const item of media) {
    const path = trimText(item.storagePath);
    const expectedPrefix = `${reporterId}/`;
    if (!path.startsWith(expectedPrefix)) {
      return jsonResponse({ error: "Invalid media storage path." }, 400);
    }
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("app_profiles")
    .select("id, role")
    .eq("id", reporterId)
    .maybeSingle();

  if (profileError || !profile) {
    return jsonResponse({ error: "Profile not found. Complete registration first." }, 403);
  }

  if (profile.role !== "resident") {
    return jsonResponse({ error: "Only residents can submit from this flow." }, 403);
  }

  const limit = await checkReportCreateAllowed(adminClient, reporterId);
  if (!limit.ok) {
    return jsonResponse({
      error: `Too many reports. Try again in about ${limit.retryAfterMinutes} minute(s).`,
      retryAfterMinutes: limit.retryAfterMinutes,
      windowMinutes: REPORT_WINDOW_MINUTES,
    }, 429);
  }

  const mediaJson = media.map((item) => ({
    id: trimText(item.id),
    type: trimText(item.type),
    storagePath: trimText(item.storagePath),
    durationSeconds: item.type === "video" ? Number(item.durationSeconds) : null,
  }));

  const { data: createdId, error: rpcError } = await adminClient.rpc(
    "create_report_with_media",
    {
      p_reporter_id: reporterId,
      p_report_id: reportId || null,
      p_title: title,
      p_description: description,
      p_latitude: latitude,
      p_longitude: longitude,
      p_address_text: addressText || null,
      p_media: mediaJson,
    },
  );

  if (rpcError) {
    console.error("create-report rpc:", rpcError.message);
    const hint = rpcError.message.includes("photos") ||
        rpcError.message.includes("video") ||
        rpcError.message.includes("duration")
      ? rpcError.message
      : "Could not save your report. Check media and try again.";
    return jsonResponse({ error: hint }, 400);
  }

  await recordSuccessfulReportCreate(adminClient, reporterId);

  return jsonResponse({ reportId: createdId }, 200);
});
