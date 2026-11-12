// supabase/functions/create-official-report/index.ts
// Active officers may record a hotline account or their own field observation.
// The database confirms only field observations. Media is optional.

import { createClient } from "@supabase/supabase-js";
import { GENERIC_SERVER_ERROR, jsonResponse } from "../_shared/http.ts";
import { rejectExtraKeys, trimText } from "../_shared/validation.ts";
import { verifyPrivateMedia } from "../_shared/private-media.ts";
import { processPublicPhotoDerivatives } from "../_shared/public-photo-processing.ts";

/** Rough Minglanilla / metro Cebu bounding box for GPS sanity checks. */
const LAT_MIN = 10.15;
const LAT_MAX = 10.35;
const LNG_MIN = 123.70;
const LNG_MAX = 123.90;

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;
const MAX_ADDRESS = 300;
const MAX_INCIDENT_TYPE_OTHER = 80;
const INCIDENT_TYPES = ["fire", "flood", "road_crash", "medical", "other"];

function officialSourceTitleForType(incidentType: string): string {
  switch (incidentType) {
    case "fire": return "Fire";
    case "flood": return "Flood";
    case "road_crash": return "Road crash";
    case "medical": return "Medical emergency";
    case "other": return "Other incident";
    default: return "Incident";
  }
}

type MediaItem = {
  id?: string;
  type?: string;
  storagePath?: string;
  durationSeconds?: number | null;
  displayStoragePath?: string | null;
  thumbnailStoragePath?: string | null;
  fileSizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
};

type CreateOfficialReportPayload = {
  intakeChannel?: string;
  operationId?: string;
  reportId?: string;
  title?: string;
  description?: string;
  incidentType?: string;
  incidentTypeOther?: string;
  latitude?: number;
  longitude?: number;
  addressText?: string;
  barangayId?: string;
  media?: MediaItem[];
  publicTitle?: string;
  publicDescription?: string;
  publishPublicPost?: boolean;
  publicationAcknowledged?: boolean;
  publicPhotoMediaIds?: string[];
  markIncidentSensitive?: boolean;
  sensitivityReason?: string;
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
    if (
      rejectExtraKeys(item as Record<string, unknown>, [
        "id",
        "type",
        "storagePath",
        "displayStoragePath",
        "thumbnailStoragePath",
        "durationSeconds",
        "fileSizeBytes",
        "width",
        "height",
      ])
    ) {
      return "Invalid media fields.";
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
    if (
      item.width != null &&
      (!Number.isFinite(Number(item.width)) || Number(item.width) <= 0 ||
        Number(item.width) > 20000)
    ) {
      return "Invalid media width.";
    }
    if (
      item.height != null &&
      (!Number.isFinite(Number(item.height)) || Number(item.height) <= 0 ||
        Number(item.height) > 20000)
    ) {
      return "Invalid media height.";
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
    durationSeconds: item.type === "video"
      ? Number(item.durationSeconds)
      : null,
    displayStoragePath: trimText(item.displayStoragePath) || null,
    thumbnailStoragePath: trimText(item.thumbnailStoragePath) || null,
    fileSizeBytes: item.fileSizeBytes == null
      ? null
      : Number(item.fileSizeBytes),
    width: item.width == null ? null : Number(item.width),
    height: item.height == null ? null : Number(item.height),
  }));
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

  const extraFieldsError = rejectExtraKeys(
    rawPayload as Record<string, unknown>,
    [
      "operationId",
      "reportId",
      "intakeChannel",
      "title",
      "description",
      "incidentType",
      "incidentTypeOther",
      "latitude",
      "longitude",
      "addressText",
      "barangayId",
      "media",
      "publicTitle",
      "publicDescription",
      "publishPublicPost",
      "publicationAcknowledged",
      "publicPhotoMediaIds",
      "markIncidentSensitive",
      "sensitivityReason",
    ],
  );
  if (extraFieldsError) {
    return jsonResponse({ error: "Invalid request fields." }, 400);
  }

  const title = trimText(rawPayload.title);
  const intakeChannel = rawPayload.intakeChannel === undefined
    ? "official_field"
    : trimText(rawPayload.intakeChannel);
  if (intakeChannel !== "official_field" && intakeChannel !== "hotline_call") {
    return jsonResponse({ error: "Select a valid official intake channel." }, 400);
  }
  const description = trimText(rawPayload.description);
  const incidentType = trimText(rawPayload.incidentType);
  const incidentTypeOther = trimText(rawPayload.incidentTypeOther);
  const addressText = trimText(rawPayload.addressText);
  const barangayIdRaw = trimText(rawPayload.barangayId);
  const latitude = Number(rawPayload.latitude);
  const longitude = Number(rawPayload.longitude);
  const reportId = trimText(rawPayload.reportId);
  const operationId = trimText(rawPayload.operationId);
  const media = Array.isArray(rawPayload.media) ? rawPayload.media : [];
  const publicTitle = trimText(rawPayload.publicTitle);
  const publicDescription = trimText(rawPayload.publicDescription);
  const publishPublicPost = rawPayload.publishPublicPost === true;
  const publicationAcknowledged = rawPayload.publicationAcknowledged === true;
  const markIncidentSensitive = rawPayload.markIncidentSensitive === true;
  const sensitivityReason = trimText(rawPayload.sensitivityReason);
  const publicPhotoMediaIds = Array.isArray(rawPayload.publicPhotoMediaIds)
    ? rawPayload.publicPhotoMediaIds.map((value) => trimText(value))
    : [];
  const usesPublicationFlow = rawPayload.operationId !== undefined ||
    rawPayload.publicationAcknowledged !== undefined || rawPayload.publishPublicPost !== undefined ||
    rawPayload.publicPhotoMediaIds !== undefined || rawPayload.markIncidentSensitive !== undefined;
  // Field observations with no typed title use the same category label as the
  // public projection. The derived title is stored on the source, so retries
  // hash the same value and the publication still mirrors its source exactly.
  const sourceTitle = usesPublicationFlow && intakeChannel === "official_field" && !title
    ? officialSourceTitleForType(incidentType)
    : title;

  // Title is optional for officials; description and GPS remain required.
  if (title.length > MAX_TITLE) {
    return jsonResponse(
      { error: "Title must be 120 characters or fewer." },
      400,
    );
  }
  if (!description || description.length > MAX_DESCRIPTION) {
    return jsonResponse(
      { error: "Enter a description (max 2000 characters)." },
      400,
    );
  }
  if (incidentType && !INCIDENT_TYPES.includes(incidentType)) {
    return jsonResponse({ error: "Select a valid incident type." }, 400);
  }
  if (incidentType === "other" && !incidentTypeOther) {
    return jsonResponse({ error: "Specify the incident type." }, 400);
  }
  if (incidentTypeOther.length > MAX_INCIDENT_TYPE_OTHER) {
    return jsonResponse({ error: "Incident type is too long." }, 400);
  }
  if (addressText.length > MAX_ADDRESS) {
    return jsonResponse({ error: "Address is too long." }, 400);
  }
  if (reportId && !isUuid(reportId)) {
    return jsonResponse({ error: "Invalid report id." }, 400);
  }
  if (usesPublicationFlow && (!isUuid(reportId) || !isUuid(operationId))) {
    return jsonResponse({ error: "Keep a valid report and operation id for safe retries." }, 400);
  }
  if (rawPayload.publicPhotoMediaIds !== undefined &&
    (!Array.isArray(rawPayload.publicPhotoMediaIds) || publicPhotoMediaIds.some((id) => !isUuid(id)))) {
    return jsonResponse({ error: "Select valid report photos for publication." }, 400);
  }
  if (rawPayload.publishPublicPost !== undefined && typeof rawPayload.publishPublicPost !== "boolean") {
    return jsonResponse({ error: "Choose whether to publish the screened post." }, 400);
  }
  if (rawPayload.markIncidentSensitive !== undefined && typeof rawPayload.markIncidentSensitive !== "boolean") {
    return jsonResponse({ error: "Choose whether the incident is sensitive." }, 400);
  }
  if (usesPublicationFlow && intakeChannel === "official_field" &&
    ((!publishPublicPost && !markIncidentSensitive) || (publishPublicPost && !publicationAcknowledged))) {
    return jsonResponse({ error: "Publish the screened field post or mark it sensitive for safety." }, 400);
  }
  if (publishPublicPost && intakeChannel !== "official_field") {
    return jsonResponse({ error: "Only on-site official reports can publish from intake." }, 400);
  }
  if (publicTitle.length > MAX_TITLE || publicDescription.length > MAX_DESCRIPTION) {
    return jsonResponse({ error: "Public title and description must fit the source report limits." }, 400);
  }
  if (markIncidentSensitive && (!sensitivityReason || sensitivityReason.length > 280)) {
    return jsonResponse({ error: "Give a short reason for marking this incident sensitive." }, 400);
  }
  if ((publishPublicPost && markIncidentSensitive) || (markIncidentSensitive && publicPhotoMediaIds.length > 0) ||
    (!publishPublicPost && publicPhotoMediaIds.length > 0)) {
    return jsonResponse({ error: "Sensitive or private reports cannot include public photos." }, 400);
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
    if (!path.startsWith(`${reporterId}/${reportId}/`)) {
      return jsonResponse({ error: "Invalid media storage path." }, 400);
    }
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const mediaVerification = await verifyPrivateMedia({
    admin: adminClient,
    bucket: "report-media",
    userId: reporterId,
    parentId: reportId,
    media,
    allowLegacyPath: true,
  });
  if (mediaVerification.error) {
    return jsonResponse({ error: mediaVerification.error }, 400);
  }
  for (const item of media) {
    item.fileSizeBytes = mediaVerification.verified.find(
      (verified) => verified.id === trimText(item.id),
    )?.fileSizeBytes ?? null;
  }

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
      error:
        "Only active BDRRMO or MDRRMO officers can log incidents.",
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

  if (usesPublicationFlow) {
    if (new Set(publicPhotoMediaIds).size !== publicPhotoMediaIds.length) {
      return jsonResponse({ error: "Each public photo can be selected only once." }, 400);
    }
    const selectedPhotos = publicPhotoMediaIds.map((mediaId) => {
      const match = media.find((item) => trimText(item.id) === mediaId && trimText(item.type) === "photo");
      return match ? { mediaId, item: match } : null;
    });
    if (selectedPhotos.some((selection) => selection === null)) {
      return jsonResponse({ error: "A selected photo is no longer attached to this report." }, 400);
    }

    const photoProofs = [];
    for (const selection of selectedPhotos) {
      if (!selection) continue;
      const { mediaId, item } = selection;
      const processed = await processPublicPhotoDerivatives(adminClient, {
        reporterId,
        reportId,
        mediaId,
        sourceStoragePath: trimText(item.storagePath),
        displaySourcePath: trimText(item.displayStoragePath),
        thumbnailSourcePath: trimText(item.thumbnailStoragePath),
      });
      if (!processed.processed) {
        return jsonResponse({ error: processed.error ?? "Could not prepare this photo for publication." }, 400);
      }
      photoProofs.push({ mediaId, ...processed.processed });
    }

    const { data: result, error: publicationError } = await adminClient.rpc(
      "create_official_report_with_publication",
      {
        p_operation_id: operationId,
        p_reporter_id: reporterId,
        p_report_id: reportId,
        p_title: sourceTitle,
        p_description: description,
        p_latitude: latitude,
        p_longitude: longitude,
        p_address_text: addressText || null,
        p_media: mediaJson,
        p_barangay_id: validatedBarangayId,
        p_incident_type: incidentType || null,
        p_incident_type_other: incidentType === "other" ? incidentTypeOther : null,
        p_intake_channel: intakeChannel,
        p_public_title: publishPublicPost && publicTitle ? publicTitle : null,
        p_public_description: publishPublicPost && publicDescription ? publicDescription : null,
        p_publish: publishPublicPost,
        p_publication_acknowledged: publicationAcknowledged,
        p_photo_proofs: photoProofs,
        p_mark_incident_sensitive: markIncidentSensitive,
        p_sensitivity_reason: markIncidentSensitive ? sensitivityReason : null,
      },
    );
    if (!publicationError && result && typeof result === "object") {
      return jsonResponse(result as Record<string, unknown>, 200);
    }
    console.error("create-official-report publication rpc:", publicationError?.message ?? "No result");
    return jsonResponse({ error: "Could not save the official report. Please try again." }, 400);
  }

  // Older clients omit the channel and retain the field-observation default.
  const { data: createdId, error: rpcError } = await adminClient.rpc(
    "create_official_report_with_media",
    {
      p_reporter_id: reporterId,
      p_intake_channel: intakeChannel,
      p_report_id: reportId || null,
      p_title: title,
      p_description: description,
      p_incident_type: incidentType || null,
      p_incident_type_other: incidentType === "other"
        ? incidentTypeOther
        : null,
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

  // Keep report, incident, and media creation atomic; a missing migration must
  // never fall back to a differently classified or half-written report.
  console.error("create-official-report rpc:", rpcError.message);
  return jsonResponse({ error: "Could not save the official report. Please try again." }, 400);
});
