import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { GENERIC_SERVER_ERROR, jsonResponse } from "../_shared/http.ts";
import {
  checkAndRecordOtpSend,
  getOtpLimitStatus,
  OTP_COOLDOWN_SECONDS,
  OTP_MAX_SENDS_PER_WINDOW,
} from "../_shared/registration-otp-limit.ts";
import {
  isSupportedCarrier,
  isValidE164Phone,
  rejectExtraKeys,
  trimText,
} from "../_shared/validation.ts";

const PROFILE_EXISTS_ERROR = 'This phone number is already registered.';

// One OTP sender serves both flows. `purpose` decides the existence rules while
// rate limiting, SMS content, and verification stay shared (no duplicate OTP system).
type OtpPurpose = "registration" | "password_reset";

type Payload = {
  phone?: string;
  statusOnly?: boolean;
  purpose?: string;
};

type AllowedSend = { sendCount: number };

function isOtpPurpose(value: unknown): value is OtpPurpose {
  return value === "registration" || value === "password_reset";
}

/** Identical success body for real sends AND silently-skipped reset sends. */
function otpSendSuccess(sendCount: number) {
  return jsonResponse(
    {
      success: true,
      sendCount,
      maxSends: OTP_MAX_SENDS_PER_WINDOW,
      cooldownSeconds: OTP_COOLDOWN_SECONDS,
      limitReached: sendCount >= OTP_MAX_SENDS_PER_WINDOW,
    },
    200,
  );
}

function otpLimitExceeded(limitResult: {
  error: string;
  sendCount: number;
  cooldownSeconds: number;
  limitReached: boolean;
}) {
  return jsonResponse(
    {
      error: limitResult.error,
      sendCount: limitResult.sendCount,
      maxSends: OTP_MAX_SENDS_PER_WINDOW,
      cooldownSeconds: limitResult.cooldownSeconds,
      limitReached: limitResult.limitReached,
    },
    429,
  );
}

/**
 * Trigger Supabase's phone OTP (which fans out to the shared SMS hook).
 * On failure we roll back the just-recorded send so the user isn't penalized
 * for a delivery error they didn't cause.
 */
async function sendOtpSms(
  adminClient: SupabaseClient,
  phone: string,
  shouldCreateUser: boolean,
  limitResult: AllowedSend,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  console.log("attempting signInWithOtp for phone:", phone.slice(0, 6) + "****");

  const { error: otpError } = await adminClient.auth.signInWithOtp({
    phone,
    options: {
      channel: "sms",
      shouldCreateUser,
    },
  });

  if (!otpError) {
    return { ok: true };
  }

  console.error("request-registration-otp: signInWithOtp failed", {
    message: otpError.message,
    status: otpError.status,
    name: otpError.name,
  });

  if (limitResult.sendCount > 0) {
    const { data: record } = await adminClient
      .from("registration_otp_sends")
      .select("window_started_at")
      .eq("phone", phone)
      .maybeSingle();

    await adminClient.from("registration_otp_sends").upsert(
      {
        phone,
        send_count: limitResult.sendCount - 1,
        window_started_at: record?.window_started_at ?? new Date().toISOString(),
        last_sent_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone" },
    );
  }

  return {
    ok: false,
    response: jsonResponse({ error: "Unable to send OTP. Please try again." }, 502),
  };
}

/**
 * Registration: existing numbers are told up front they're already registered
 * (expected during sign-up), so the existence check runs before any send.
 */
async function handleRegistrationOtp(
  adminClient: SupabaseClient,
  phone: string,
  statusOnly: boolean,
): Promise<Response> {
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existingProfile) {
    return jsonResponse({ error: PROFILE_EXISTS_ERROR }, 409);
  }

  if (statusOnly) {
    const status = await getOtpLimitStatus(adminClient, phone);
    return jsonResponse({ success: true, ...status }, 200);
  }

  const limitResult = await checkAndRecordOtpSend(adminClient, phone);
  if (!limitResult.allowed) {
    return otpLimitExceeded(limitResult);
  }

  const sent = await sendOtpSms(adminClient, phone, true, limitResult);
  if (!sent.ok) return sent.response;

  return otpSendSuccess(limitResult.sendCount);
}

/**
 * Password reset: never reveal whether an account exists. Rate limiting runs
 * for every request, and the response is identical whether we send an SMS
 * (registered number) or silently skip it (unknown number).
 */
async function handlePasswordResetOtp(
  adminClient: SupabaseClient,
  phone: string,
  statusOnly: boolean,
): Promise<Response> {
  if (statusOnly) {
    const status = await getOtpLimitStatus(adminClient, phone);
    return jsonResponse({ success: true, ...status }, 200);
  }

  const limitResult = await checkAndRecordOtpSend(adminClient, phone);
  if (!limitResult.allowed) {
    return otpLimitExceeded(limitResult);
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  // Unknown number: skip the SMS but return the same payload as a real send.
  if (!profile) {
    return otpSendSuccess(limitResult.sendCount);
  }

  // Never create a new auth user during reset — only real accounts get a code.
  const sent = await sendOtpSms(adminClient, phone, false, limitResult);
  if (!sent.ok) return sent.response;

  return otpSendSuccess(limitResult.sendCount);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("request-registration-otp: missing Supabase env vars");
    return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  }

  let rawPayload: Payload;
  try {
    rawPayload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400);
  }

  const extraFieldsError = rejectExtraKeys(rawPayload as Record<string, unknown>, [
    "phone",
    "statusOnly",
    "purpose",
  ]);
  if (extraFieldsError) {
    return jsonResponse({ error: "Invalid request." }, 400);
  }

  // Omitted purpose defaults to registration so existing callers keep working.
  if (rawPayload.purpose !== undefined && !isOtpPurpose(rawPayload.purpose)) {
    return jsonResponse({ error: "Invalid request." }, 400);
  }
  const purpose: OtpPurpose = isOtpPurpose(rawPayload.purpose)
    ? rawPayload.purpose
    : "registration";

  const phone = trimText(rawPayload.phone);
  const statusOnly = rawPayload.statusOnly === true;

  if (!phone || !isValidE164Phone(phone)) {
    return jsonResponse({ error: "Enter a valid Philippine mobile number." }, 400);
  }

  // API constraint: IPROG's shared sender only reaches Globe/TM and DITO for now.
  // Mirrors the client-side carrier gate so it can't be bypassed via the API.
  if (!isSupportedCarrier(phone)) {
    return jsonResponse({ error: "Not supported yet. Try Globe, TM, or DITO" }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (purpose === "password_reset") {
    return await handlePasswordResetOtp(adminClient, phone, statusOnly);
  }

  return await handleRegistrationOtp(adminClient, phone, statusOnly);
});
