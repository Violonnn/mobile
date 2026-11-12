import { createClient } from "@supabase/supabase-js";
import { GENERIC_SERVER_ERROR, jsonResponse } from "../_shared/http.ts";
import {
  checkReportCreateAllowed,
  recordSuccessfulReportCreate,
  REPORT_WINDOW_MINUTES,
} from "../_shared/report-rate-limit.ts";
import { rejectExtraKeys, trimText } from "../_shared/validation.ts";
import { intakeJurisdiction, isInsideReportCoverage } from "../_shared/report-coverage.ts";

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;
const MAX_ADDRESS = 300;
const MAX_INCIDENT_TYPE_OTHER = 80;
const INCIDENT_TYPES = ["fire", "flood", "road_crash", "medical", "other"];
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const MAX_DISPLAY_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 300 * 1024;

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

type CreateReportPayload = {
  reportId?: string;
  title?: string;
  description?: string;
  incidentType?: string;
  incidentTypeOther?: string;
  latitude?: number;
  longitude?: number;
  deviceLatitude?: number;
  deviceLongitude?: number;
  gpsAccuracyMeters?: number;
  addressText?: string;
  /** Resident-selected barangay; optional for legacy offline queue rows. */
  barangayId?: string;
  showReporterName?: boolean;
  showReporterAvatar?: boolean;
  allowExactLocation?: boolean;
  media?: MediaItem[];
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function validateMedia(media: MediaItem[]): string | null {
  if (!Array.isArray(media) || media.length < 1) {
    return "Add at least one clear photo or video.";
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
    const thumbnailStoragePath = trimText(item.thumbnailStoragePath);
    const displayStoragePath = trimText(item.displayStoragePath);

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
      if (thumbnailStoragePath && !displayStoragePath) {
        return "Prepared photos need a display image.";
      }
    } else {
      const duration = Number(item.durationSeconds);
      if (!Number.isFinite(duration) || duration <= 0) {
        return "Videos need a positive duration in seconds.";
      }
      videoDuration += duration;
      if (displayStoragePath) return "Videos cannot include a display image.";
    }

    if (thumbnailStoragePath && thumbnailStoragePath === storagePath) {
      return "Media thumbnails must be separate objects.";
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
    return "Resident reports allow at most 3 photos.";
  }
  if (videoDuration > 30) {
    return "Combined video duration must not exceed 30 seconds.";
  }

  return null;
}

type VerifiedMedia = {
  id: string;
  fileSizeBytes: number;
  mimeType: string;
};

function metadataValue(object: Record<string, unknown>, key: string): unknown {
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  return (metadata as Record<string, unknown>)[key];
}

async function inspectObject(
  adminClient: ReturnType<typeof createClient>,
  path: string,
): Promise<{ size: number; mimeType: string } | null> {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash <= 0 || lastSlash === path.length - 1) return null;
  const folder = path.slice(0, lastSlash);
  const fileName = path.slice(lastSlash + 1);
  const { data, error } = await adminClient.storage
    .from("report-media")
    .list(folder, { limit: 20, search: fileName });
  if (error) return null;
  const object = (data ?? []).find((candidate) =>
    candidate.name === fileName
  ) as
    | Record<string, unknown>
    | undefined;
  if (!object) return null;
  return {
    size: Number(metadataValue(object, "size") ?? 0),
    mimeType: String(metadataValue(object, "mimetype") ?? "").toLowerCase(),
  };
}

async function verifyUploadedMedia(
  adminClient: ReturnType<typeof createClient>,
  reporterId: string,
  reportId: string,
  media: MediaItem[],
): Promise<{ verified: VerifiedMedia[]; error: string | null }> {
  const verified: VerifiedMedia[] = [];
  for (const item of media) {
    const id = trimText(item.id);
    const type = trimText(item.type);
    const storagePath = trimText(item.storagePath);
    const thumbnailPath = trimText(item.thumbnailStoragePath);
    const displayPath = trimText(item.displayStoragePath);
    const submittedPaths = [storagePath, thumbnailPath, displayPath].filter(
      Boolean,
    );
    if (
      submittedPaths.some((path) => path.includes("..") || path.includes("\\"))
    ) {
      return { verified: [], error: "Invalid media storage path." };
    }
    const newFolder = `${reporterId}/${reportId}/${id}`;
    const legacyPrefix = `${reporterId}/${reportId}/${id}.`;
    const isNewPath = storagePath.startsWith(`${newFolder}/original.`);
    if (!isNewPath && !storagePath.startsWith(legacyPrefix)) {
      return { verified: [], error: "Invalid media storage path." };
    }
    if (isNewPath && (!thumbnailPath || (type === "photo" && !displayPath))) {
      return {
        verified: [],
        error: "Prepared media derivatives are required.",
      };
    }
    if (
      (thumbnailPath && thumbnailPath !== `${newFolder}/thumbnail.jpg`) ||
      (displayPath && displayPath !== `${newFolder}/display.jpg`)
    ) {
      return { verified: [], error: "Invalid derivative storage path." };
    }

    const original = await inspectObject(adminClient, storagePath);
    if (!original || original.size <= 0 || original.size > MAX_VIDEO_BYTES) {
      return {
        verified: [],
        error: "An uploaded original is missing or too large.",
      };
    }
    const expectedOriginalMime = type === "video" ? "video/" : "image/";
    if (!original.mimeType.startsWith(expectedOriginalMime)) {
      return {
        verified: [],
        error: "An uploaded original has an invalid media type.",
      };
    }

    if (thumbnailPath) {
      const thumbnail = await inspectObject(adminClient, thumbnailPath);
      if (
        !thumbnail || thumbnail.size <= 0 ||
        thumbnail.size > MAX_THUMBNAIL_BYTES ||
        thumbnail.mimeType !== "image/jpeg"
      ) {
        return {
          verified: [],
          error:
            "A media thumbnail is missing, invalid, or larger than 300 KB.",
        };
      }
    }
    if (displayPath) {
      const display = await inspectObject(adminClient, displayPath);
      if (
        !display || display.size <= 0 ||
        display.size > MAX_DISPLAY_IMAGE_BYTES ||
        display.mimeType !== "image/jpeg"
      ) {
        return {
          verified: [],
          error: "A display image is missing, invalid, or larger than 2 MB.",
        };
      }
    }
    verified.push({
      id,
      fileSizeBytes: original.size,
      mimeType: original.mimeType,
    });
  }
  return { verified, error: null };
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

  const extraFieldsError = rejectExtraKeys(
    rawPayload as Record<string, unknown>,
    [
      "reportId",
      "title",
      "description",
      "incidentType",
      "incidentTypeOther",
      "latitude",
      "longitude",
      "deviceLatitude",
      "deviceLongitude",
      "gpsAccuracyMeters",
      "addressText",
      "barangayId",
      "showReporterName",
      "showReporterAvatar",
      "allowExactLocation",
      "media",
    ],
  );
  if (extraFieldsError) {
    return jsonResponse({ error: "Invalid request fields." }, 400);
  }

  const title = trimText(rawPayload.title);
  const description = trimText(rawPayload.description);
  const incidentType = trimText(rawPayload.incidentType);
  const incidentTypeOther = trimText(rawPayload.incidentTypeOther);
  const addressText = trimText(rawPayload.addressText);
  const barangayIdRaw = trimText(rawPayload.barangayId);
  const latitude = Number(rawPayload.latitude);
  const longitude = Number(rawPayload.longitude);
  // Legacy offline rows have one coordinate; treating it as both points keeps
  // those already-saved reports syncable with a zero-meter adjustment.
  const deviceLatitude = rawPayload.deviceLatitude == null
    ? latitude
    : Number(rawPayload.deviceLatitude);
  const deviceLongitude = rawPayload.deviceLongitude == null
    ? longitude
    : Number(rawPayload.deviceLongitude);
  const gpsAccuracyMeters = rawPayload.gpsAccuracyMeters == null
    ? null
    : Number(rawPayload.gpsAccuracyMeters);
  const reportId = trimText(rawPayload.reportId);
  const publicationPreferences = {
    show_reporter_name: rawPayload.showReporterName === true,
    show_reporter_avatar: rawPayload.showReporterAvatar === true,
    allow_exact_location: rawPayload.allowExactLocation === true,
  };
  if ([rawPayload.showReporterName, rawPayload.showReporterAvatar, rawPayload.allowExactLocation]
    .some((value) => value !== undefined && typeof value !== "boolean")) {
    return jsonResponse({ error: "Invalid publication preferences." }, 400);
  }
  const media = Array.isArray(rawPayload.media) ? rawPayload.media : [];

  if (!title || title.length > MAX_TITLE) {
    return jsonResponse({ error: "Enter a title (max 120 characters)." }, 400);
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
  // Never trust a barangay name/label from the client for routing — only a UUID.
  if (barangayIdRaw && !isUuid(barangayIdRaw)) {
    return jsonResponse({ error: "Invalid barangay id." }, 400);
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return jsonResponse({ error: "Valid incident coordinates are required." }, 400);
  }
  if (!isInsideReportCoverage(latitude, longitude)) {
    return jsonResponse({
      code: "outside_coverage",
      error: "This location appears to be outside DisasterLink's coverage area. It was not sent to any office. Call 911 for urgent danger, or contact MDRRMO if you believe this is wrong.",
    }, 422);
  }
  if (
    !Number.isFinite(deviceLatitude) ||
    !Number.isFinite(deviceLongitude) ||
    !isInsideReportCoverage(deviceLatitude, deviceLongitude)
  ) {
    return jsonResponse({
      error:
        "Verified device location must be inside Minglanilla / nearby Cebu.",
    }, 400);
  }
  if (
    gpsAccuracyMeters !== null &&
    (!Number.isFinite(gpsAccuracyMeters) ||
      gpsAccuracyMeters < 0 ||
      gpsAccuracyMeters > 10000)
  ) {
    return jsonResponse({ error: "Invalid GPS accuracy." }, 400);
  }

  const mediaError = validateMedia(media);
  if (mediaError) {
    return jsonResponse({ error: mediaError }, 400);
  }

  // Paths are checked again against exact report/media folders after Storage inspection.
  for (const item of media) {
    const path = trimText(item.storagePath);
    const expectedPrefix = `${reporterId}/${reportId}/`;
    if (!path.startsWith(expectedPrefix)) {
      return jsonResponse({ error: "Invalid media storage path." }, 400);
    }
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const mediaVerification = await verifyUploadedMedia(
    adminClient,
    reporterId,
    reportId,
    media,
  );
  if (mediaVerification.error) {
    return jsonResponse({ error: mediaVerification.error }, 400);
  }

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
    return jsonResponse({
      error: "Profile not found. Complete registration first.",
    }, 403);
  }

  if (profile.role !== "resident" || profile.status !== "active") {
    return jsonResponse({
      error: "Only active resident accounts can submit from this flow.",
    }, 403);
  }

  if (reportId) {
    const { data: existingReport, error: existingReportError } = await adminClient
      .from("reports")
      .select("reporter_id")
      .eq("id", reportId)
      .maybeSingle();
    if (existingReportError) {
      console.error("create-report retry lookup:", existingReportError.message);
      return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
    }
    if (existingReport) {
      if (existingReport.reporter_id !== reporterId) {
        return jsonResponse({ error: "Report id is already in use." }, 400);
      }
      return jsonResponse({ reportId }, 200);
    }
  }

  const limit = await checkReportCreateAllowed(adminClient, reporterId);
  if (!limit.ok) {
    return jsonResponse({
      error:
        `Too many reports. Try again in about ${limit.retryAfterMinutes} minute(s).`,
      retryAfterMinutes: limit.retryAfterMinutes,
      windowMinutes: REPORT_WINDOW_MINUTES,
    }, 429);
  }

  const mediaJson = media.map((item) => ({
    id: trimText(item.id),
    type: trimText(item.type),
    storagePath: trimText(item.storagePath),
    durationSeconds: item.type === "video"
      ? Number(item.durationSeconds)
      : null,
    displayStoragePath: trimText(item.displayStoragePath) || null,
    thumbnailStoragePath: trimText(item.thumbnailStoragePath) || null,
    fileSizeBytes: mediaVerification.verified.find(
      (verifiedItem) => verifiedItem.id === trimText(item.id),
    )?.fileSizeBytes ?? null,
    width: item.width == null ? null : Number(item.width),
    height: item.height == null ? null : Number(item.height),
  }));

  const routingResult = await adminClient.rpc("get_report_intake_routing", {
    p_latitude: latitude, p_longitude: longitude, p_barangay_id: validatedBarangayId,
  });
  if (routingResult.error) {
    console.error("create-report coverage lookup:", routingResult.error.message);
    return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  }
  const routing = routingResult.data?.[0];
  const jurisdictionStatus = intakeJurisdiction({
    nearestDistanceMeters: routing?.nearest_distance_meters ?? null,
    selectedDistanceMeters: routing?.selected_distance_meters ?? null,
    nearestBarangayId: routing?.nearest_barangay_id ?? null,
    selectedBarangayId: validatedBarangayId,
  });

  const { data: createdId, error: rpcError } = await adminClient.rpc(
    "create_report_with_publication_preferences",
    {
      p_reporter_id: reporterId,
      p_report_id: reportId || null,
      p_title: title,
      p_description: description,
      p_incident_type: incidentType || null,
      p_incident_type_other: incidentType === "other"
        ? incidentTypeOther
        : null,
      p_latitude: latitude,
      p_longitude: longitude,
      p_device_latitude: deviceLatitude,
      p_device_longitude: deviceLongitude,
      p_gps_accuracy_meters: gpsAccuracyMeters,
      p_address_text: addressText || null,
      p_media: mediaJson,
      // Pass the validated barangay id; null keeps the existing centroid fallback.
      p_barangay_id: validatedBarangayId,
      p_jurisdiction_status: jurisdictionStatus,
      p_show_reporter_name: publicationPreferences.show_reporter_name,
      p_show_reporter_avatar: publicationPreferences.show_reporter_avatar,
      p_allow_exact_location: publicationPreferences.allow_exact_location,
    },
  );

  if (rpcError) {
    console.error("create-report rpc:", rpcError.message);
    const hint = rpcError.message.includes("photos") ||
        rpcError.message.includes("video") ||
        rpcError.message.includes("duration") ||
        rpcError.message.includes("barangay") ||
        rpcError.message.includes("incident") ||
        rpcError.message.includes("location")
      ? rpcError.message
      : "Could not save your report. Check media and try again.";
    return jsonResponse({ error: hint }, 400);
  }

  await recordSuccessfulReportCreate(adminClient, reporterId);

  return jsonResponse({ reportId: createdId }, 200);
});
