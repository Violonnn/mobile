// supabase/functions/create-official-report/index.ts
// Secure create path for active officers (BDRRMO / MDRRMO) logging verified
// field incidents. Mayor cannot create. Media is optional.

import { createClient } from "@supabase/supabase-js";
import { GENERIC_SERVER_ERROR, jsonResponse } from "../_shared/http.ts";
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

type CreateOfficialReportPayload = {
  reportId?: string;
  title?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  addressText?: string;
  barangayId?: string;
  media?: MediaItem[];
};

type OfficerProfile = {
  id: string;
  role: string;
  status: string;
  barangay_id: string | null;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function isMissingRpcError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("could not find the function") ||
    lower.includes("function public.create_official_report_with_media") ||
    lower.includes("schema cache") ||
    lower.includes("pgrst202")
  );
}

/** Official media is optional; when present, enforce live-capture limits. */
function validateOptionalMedia(media: MediaItem[]): string | null {
  if (!Array.isArray(media)) {
    return "Invalid media list.";
  }
  if (media.length === 0) {
    return null;
  }

  let photos = 0;
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
      const duration = Number(item.durationSeconds);
      if (!Number.isFinite(duration) || duration <= 0) {
        return "Videos need a positive duration in seconds.";
      }
      videoDuration += duration;
    }
  }

  if (photos > 3) {
    return "Official reports allow at most 3 photos.";
  }
  if (videoDuration > 30) {
    return "Combined video duration must not exceed 30 seconds.";
  }

  return null;
}

function toMediaJson(media: MediaItem[]) {
  return media.map((item) => ({
    id: trimText(item.id),
    type: trimText(item.type),
    storagePath: trimText(item.storagePath),
    durationSeconds: item.type === "video" ? Number(item.durationSeconds) : null,
  }));
}

async function insertOfficialReportDirect(
  // deno-lint-ignore no-explicit-any
  adminClient: any,
  params: {
    reporterId: string;
    reportId: string | null;
    title: string;
    description: string;
    latitude: number;
    longitude: number;
    addressText: string;
    barangayId: string | null;
    media: MediaItem[];
  },
): Promise<{ reportId: string | null; error: string | null }> {
  const reportId = params.reportId || crypto.randomUUID();
  const locationWkt =
    `SRID=4326;POINT(${params.longitude} ${params.latitude})`;

  const { error: insertError } = await adminClient.from("reports").insert({
    id: reportId,
    reporter_id: params.reporterId,
    title: params.title,
    description: params.description,
    location: locationWkt,
    address_text: params.addressText || null,
    barangay_id: params.barangayId,
  });

  if (insertError) {
    console.error("create-official-report insert:", insertError.message);
    return { reportId: null, error: insertError.message };
  }

  if (params.media.length > 0) {
    const mediaRows = params.media.map((item, index) => ({
      id: trimText(item.id),
      report_id: reportId,
      type: trimText(item.type),
      storage_path: trimText(item.storagePath),
      duration_seconds:
        item.type === "video" ? Number(item.durationSeconds) : null,
      position: index,
    }));

    const { error: mediaError } = await adminClient
      .from("report_media")
      .insert(mediaRows);

    if (mediaError) {
      console.error("create-official-report media:", mediaError.message);
      // Best-effort cleanup so a half-written report does not linger.
      await adminClient.from("reports").delete().eq("id", reportId);
      return { reportId: null, error: mediaError.message };
    }
  }

  return { reportId, error: null };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("create-official-report: missing Supabase env vars");
    return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Sign in to log an incident." }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: "Sign in to log an incident." }, 401);
  }

  const reporterId = userData.user.id;

  let rawPayload: CreateOfficialReportPayload;
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

  // Title is optional for officials; description and GPS remain required.
  if (title.length > MAX_TITLE) {
    return jsonResponse({ error: "Title must be 120 characters or fewer." }, 400);
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

  const mediaError = validateOptionalMedia(media);
  if (mediaError) {
    return jsonResponse({ error: mediaError }, 400);
  }

  for (const item of media) {
    const path = trimText(item.storagePath);
    if (!path.startsWith(`${reporterId}/`)) {
      return jsonResponse({ error: "Invalid media storage path." }, 400);
    }
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("app_profiles")
    .select("id, role, status, barangay_id")
    .eq("id", reporterId)
    .maybeSingle();

  if (profileError || !profile) {
    return jsonResponse({ error: "Profile not found." }, 403);
  }

  const officer = profile as OfficerProfile;

  // Mayor and residents cannot use this privileged create path.
  if (officer.role !== "officer" || officer.status !== "active") {
    return jsonResponse({
      error: "Only active BDRRMO or MDRRMO officers can log verified incidents.",
    }, 403);
  }

  const isBdrrmo = Boolean(officer.barangay_id);
  let validatedBarangayId: string | null = null;

  if (isBdrrmo) {
    // BDRRMO may only create inside their own barangay.
    if (barangayIdRaw && barangayIdRaw !== officer.barangay_id) {
      return jsonResponse({
        error: "BDRRMO can only log incidents for their own barangay.",
      }, 403);
    }
    validatedBarangayId = officer.barangay_id;
  } else if (barangayIdRaw) {
    const { data: barangayRow, error: barangayError } = await adminClient
      .from("barangays")
      .select("id")
      .eq("id", barangayIdRaw)
      .maybeSingle();

    if (barangayError) {
      console.error("create-official-report barangay:", barangayError.message);
      return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
    }
    if (!barangayRow) {
      return jsonResponse({
        error:
          "The selected barangay is no longer available. Please refresh and select it again.",
      }, 400);
    }
    validatedBarangayId = barangayIdRaw;
  } else {
    // MDRRMO without an explicit barangay: resolve from GPS centroid.
    const { data: resolvedId, error: resolveError } = await adminClient.rpc(
      "resolve_barangay_id",
      { p_latitude: latitude, p_longitude: longitude },
    );
    if (resolveError) {
      console.error("create-official-report resolve:", resolveError.message);
      return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
    }
    validatedBarangayId = resolvedId ? String(resolvedId) : null;
  }

  const mediaJson = toMediaJson(media);

  // Prefer the migration RPC when present; otherwise insert with service role.
  const { data: createdId, error: rpcError } = await adminClient.rpc(
    "create_official_report_with_media",
    {
      p_reporter_id: reporterId,
      p_report_id: reportId || null,
      p_title: title,
      p_description: description,
      p_latitude: latitude,
      p_longitude: longitude,
      p_address_text: addressText || null,
      p_media: mediaJson,
      p_barangay_id: validatedBarangayId,
    },
  );

  if (!rpcError) {
    return jsonResponse({ reportId: createdId }, 200);
  }

  if (!isMissingRpcError(rpcError.message)) {
    console.error("create-official-report rpc:", rpcError.message);
    const hint = rpcError.message.includes("barangay") ||
        rpcError.message.includes("media") ||
        rpcError.message.includes("photo") ||
        rpcError.message.includes("video")
      ? rpcError.message
      : "Could not save the official report.";
    return jsonResponse({ error: hint }, 400);
  }

  const direct = await insertOfficialReportDirect(adminClient, {
    reporterId,
    reportId: reportId || null,
    title,
    description,
    latitude,
    longitude,
    addressText,
    barangayId: validatedBarangayId,
    media,
  });

  if (direct.error || !direct.reportId) {
    return jsonResponse({
      error: direct.error || "Could not save the official report.",
    }, 400);
  }

  return jsonResponse({ reportId: direct.reportId }, 200);
});
