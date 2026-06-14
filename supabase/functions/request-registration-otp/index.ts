import { createClient } from "@supabase/supabase-js";
import { GENERIC_SERVER_ERROR, jsonResponse } from "../_shared/http.ts";
import {
  checkAndRecordOtpSend,
  getOtpLimitStatus,
  OTP_COOLDOWN_SECONDS,
  OTP_MAX_SENDS_PER_WINDOW,
} from "../_shared/registration-otp-limit.ts";
import { isValidE164Phone, rejectExtraKeys, trimText } from "../_shared/validation.ts";

const PROFILE_EXISTS_ERROR = 'This phone number is already registered.';

type Payload = {
  phone?: string;
  statusOnly?: boolean;
};

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
  ]);
  if (extraFieldsError) {
    return jsonResponse({ error: "Invalid request." }, 400);
  }

  const phone = trimText(rawPayload.phone);
  const statusOnly = rawPayload.statusOnly === true;

  if (!phone || !isValidE164Phone(phone)) {
    return jsonResponse({ error: "Enter a valid Philippine mobile number." }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

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

  const { error: otpError } = await adminClient.auth.signInWithOtp({
    phone,
    options: {
      channel: "sms",
      shouldCreateUser: true,
    },
  });

  if (otpError) {
    console.error("request-registration-otp: signInWithOtp failed", otpError.message);

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

    return jsonResponse({ error: "Unable to send OTP. Please try again." }, 502);
  }

  return jsonResponse(
    {
      success: true,
      sendCount: limitResult.sendCount,
      maxSends: OTP_MAX_SENDS_PER_WINDOW,
      cooldownSeconds: OTP_COOLDOWN_SECONDS,
      limitReached: limitResult.sendCount >= OTP_MAX_SENDS_PER_WINDOW,
    },
    200,
  );
});
