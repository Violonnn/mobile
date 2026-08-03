// supabase/functions/update-official-report/index.ts
// Authoring officer may correct title, description, location, address, and
// barangay. Status / audit fields are never writable here. Mayor cannot edit.

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

type UpdateOfficialReportPayload = {
  reportId?: string;
  title?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  addressText?: string;
  barangayId?: string;
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
    lower.includes("function public.update_official_report_fields") ||
    lower.includes("schema cache") ||
    lower.includes("pgrst202")
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
    console.error("update-official-report: missing Supabase env vars");
    return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Sign in to update this incident." }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: "Sign in to update this incident." }, 401);
  }

  const callerId = userData.user.id;

  let rawPayload: UpdateOfficialReportPayload;
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
  ]);
  if (extraFieldsError) {
    return jsonResponse({ error: "Invalid request fields." }, 400);
  }

  const reportId = trimText(rawPayload.reportId);
  const title = trimText(rawPayload.title);
  const description = trimText(rawPayload.description);
  const addressText = trimText(rawPayload.addressText);
  const barangayIdRaw = trimText(rawPayload.barangayId);
  const latitude = Number(rawPayload.latitude);
  const longitude = Number(rawPayload.longitude);

  if (!reportId || !isUuid(reportId)) {
    return jsonResponse({ error: "Invalid report id." }, 400);
  }
  if (title.length > MAX_TITLE) {
    return jsonResponse({ error: "Title must be 120 characters or fewer." }, 400);
  }
  if (!description || description.length > MAX_DESCRIPTION) {
    return jsonResponse({ error: "Enter a description (max 2000 characters)." }, 400);
  }
  if (addressText.length > MAX_ADDRESS) {
    return jsonResponse({ error: "Address is too long." }, 400);
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

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("app_profiles")
    .select("id, role, status, barangay_id")
    .eq("id", callerId)
    .maybeSingle();

  if (profileError || !profile) {
    return jsonResponse({ error: "Profile not found." }, 403);
  }

  const officer = profile as OfficerProfile;
  if (officer.role !== "officer" || officer.status !== "active") {
    return jsonResponse({
      error: "Only the authoring active officer can edit this incident.",
    }, 403);
  }

  const isBdrrmo = Boolean(officer.barangay_id);
  let validatedBarangayId: string | null = null;

  if (isBdrrmo) {
    if (barangayIdRaw && barangayIdRaw !== officer.barangay_id) {
      return jsonResponse({
        error: "BDRRMO can only keep incidents in their own barangay.",
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
      console.error("update-official-report barangay:", barangayError.message);
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
    const { data: resolvedId, error: resolveError } = await adminClient.rpc(
      "resolve_barangay_id",
      { p_latitude: latitude, p_longitude: longitude },
    );
    if (resolveError) {
      console.error("update-official-report resolve:", resolveError.message);
      return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
    }
    validatedBarangayId = resolvedId ? String(resolvedId) : null;
  }

  // Prefer the migration RPC when present.
  const { data: rpcRow, error: rpcError } = await adminClient.rpc(
    "update_official_report_fields",
    {
      p_report_id: reportId,
      // Keep this key aligned with the SQL function signature. A mismatched
      // RPC argument name makes PostgREST miss the function entirely.
      p_actor_id: callerId,
      p_title: title,
      p_description: description,
      p_latitude: latitude,
      p_longitude: longitude,
      p_address_text: addressText || null,
      p_barangay_id: validatedBarangayId,
    },
  );

  if (!rpcError) {
    return jsonResponse({ reportId: rpcRow ?? reportId }, 200);
  }

  if (!isMissingRpcError(rpcError.message)) {
    console.error("update-official-report rpc:", rpcError.message);
    return jsonResponse({
      error: rpcError.message.includes("author")
        ? rpcError.message
        : "Could not update this incident.",
    }, 400);
  }

  // Fallback: only the authoring official may update content fields.
  const { data: existing, error: existingError } = await adminClient
    .from("reports")
    .select("id, reporter_id")
    .eq("id", reportId)
    .maybeSingle();

  if (existingError) {
    console.error("update-official-report load:", existingError.message);
    return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  }
  if (!existing) {
    return jsonResponse({ error: "Report not found." }, 404);
  }
  if (String(existing.reporter_id) !== callerId) {
    return jsonResponse({
      error: "Only the authoring official can edit this incident.",
    }, 403);
  }

  const locationWkt = `SRID=4326;POINT(${longitude} ${latitude})`;
  const { error: updateError } = await adminClient
    .from("reports")
    .update({
      title,
      description,
      location: locationWkt,
      address_text: addressText || null,
      barangay_id: validatedBarangayId,
    })
    .eq("id", reportId)
    .eq("reporter_id", callerId);

  if (updateError) {
    console.error("update-official-report update:", updateError.message);
    return jsonResponse({ error: "Could not update this incident." }, 400);
  }

  return jsonResponse({ reportId }, 200);
});
