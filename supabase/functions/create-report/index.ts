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
  /** Resident-selected barangay; optional for legacy offline queue rows. */
  barangayId?: string;
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

function isMissingBarangayAwareReportRpc(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("create_report_with_media") &&
    (lower.includes("p_barangay_id") || lower.includes("does not exist"))
  );
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
    "barangayId",
    "media",
  ]);
  if (extraFieldsError) {
    return jsonResponse({ error: "Invalid request fields." }, 400);
  }

  const title = trimText(rawPayload.title);
  const description = trimText(rawPayload.description);
  const addressText = trimText(rawPayload.addressText);
  const barangayIdRaw = trimText(rawPayload.barangayId);
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
  // Never trust a barangay name/label from the client for routing — only a UUID.
  if (barangayIdRaw && !isUuid(barangayIdRaw)) {
    return jsonResponse({ error: "Invalid barangay id." }, 400);
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

  // Validate selected barangay against the live table before creating a report.
  let validatedBarangayId: string | null = null;
  if (barangayIdRaw) {
    const { data: barangayRow, error: barangayError } = await adminClient
      .from("barangays")
      .select("id")
      .eq("id", barangayIdRaw)
      .maybeSingle();

    if (barangayError) {
      console.error("create-report barangay lookup:", barangayError.message);
      return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
    }

    if (!barangayRow) {
      return jsonResponse({
        error:
          "The selected barangay is no longer available. Please refresh and select it again.",
      }, 400);
    }

    validatedBarangayId = barangayIdRaw;
  }

  const { data: profile, error: profileError } = await adminClient
    .from("app_profiles")
    .select("id, role, status")
    .eq("id", reporterId)
    .maybeSingle();

  if (profileError || !profile) {
    return jsonResponse({ error: "Profile not found. Complete registration first." }, 403);
  }

  if (profile.role !== "resident" || profile.status !== "active") {
    return jsonResponse({
      error: "Only active resident accounts can submit from this flow.",
    }, 403);
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

  let { data: createdId, error: rpcError } = await adminClient.rpc(
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
      // Nine-arg overload: explicit id when present, null for legacy centroid fallback.
      p_barangay_id: validatedBarangayId,
    },
  );

  // Older deployed databases may not yet have the nine-argument RPC.
  // Fall back to the established eight-argument version, which resolves the
  // barangay from the report location until the migration is applied.
  if (rpcError && isMissingBarangayAwareReportRpc(rpcError.message)) {
    const fallback = await adminClient.rpc("create_report_with_media", {
      p_reporter_id: reporterId,
      p_report_id: reportId || null,
      p_title: title,
      p_description: description,
      p_latitude: latitude,
      p_longitude: longitude,
      p_address_text: addressText || null,
      p_media: mediaJson,
    });
    createdId = fallback.data;
    rpcError = fallback.error;
  }

  if (rpcError) {
    console.error("create-report rpc:", rpcError.message);
    const hint = rpcError.message.includes("photos") ||
        rpcError.message.includes("video") ||
        rpcError.message.includes("duration") ||
        rpcError.message.includes("barangay")
      ? rpcError.message
      : "Could not save your report. Check media and try again.";
    return jsonResponse({ error: hint }, 400);
  }

  await recordSuccessfulReportCreate(adminClient, reporterId);

  return jsonResponse({ reportId: createdId }, 200);
});
