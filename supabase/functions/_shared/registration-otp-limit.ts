import { SupabaseClient } from "@supabase/supabase-js";

/** Minimum wait between OTP sends for the same phone. */
export const OTP_COOLDOWN_SECONDS = 60;

/** Max OTP sends allowed within one abuse window. */
export const OTP_MAX_SENDS_PER_WINDOW = 3;

/** After this long, send_count resets for the phone. */
export const OTP_WINDOW_HOURS = 1;

export type OtpLimitStatus = {
  sendCount: number;
  maxSends: number;
  cooldownSeconds: number;
  limitReached: boolean;
  hasPendingOtp: boolean;
};

type OtpRecord = {
  send_count: number;
  window_started_at: string;
  last_sent_at: string | null;
};

function windowExpired(windowStartedAt: string): boolean {
  const started = new Date(windowStartedAt).getTime();
  return Date.now() - started >= OTP_WINDOW_HOURS * 60 * 60 * 1000;
}

function cooldownSecondsRemaining(lastSentAt: string | null): number {
  if (!lastSentAt) return 0;
  const elapsed = (Date.now() - new Date(lastSentAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(OTP_COOLDOWN_SECONDS - elapsed));
}

async function fetchRecord(
  adminClient: SupabaseClient,
  phone: string,
): Promise<OtpRecord | null> {
  const { data } = await adminClient
    .from("registration_otp_sends")
    .select("send_count, window_started_at, last_sent_at")
    .eq("phone", phone)
    .maybeSingle();

  return data ?? null;
}

export async function getOtpLimitStatus(
  adminClient: SupabaseClient,
  phone: string,
): Promise<OtpLimitStatus> {
  const record = await fetchRecord(adminClient, phone);

  if (!record || windowExpired(record.window_started_at)) {
    return {
      sendCount: 0,
      maxSends: OTP_MAX_SENDS_PER_WINDOW,
      cooldownSeconds: 0,
      limitReached: false,
      hasPendingOtp: false,
    };
  }

  const sendCount = record.send_count;
  const cooldownSeconds = cooldownSecondsRemaining(record.last_sent_at);

  return {
    sendCount,
    maxSends: OTP_MAX_SENDS_PER_WINDOW,
    cooldownSeconds,
    limitReached: sendCount >= OTP_MAX_SENDS_PER_WINDOW,
    hasPendingOtp: sendCount > 0,
  };
}

export type OtpSendAttemptResult =
  | { allowed: true; sendCount: number; cooldownSeconds: number }
  | { allowed: false; error: string; sendCount: number; cooldownSeconds: number; limitReached: boolean };

export async function checkAndRecordOtpSend(
  adminClient: SupabaseClient,
  phone: string,
): Promise<OtpSendAttemptResult> {
  const now = new Date().toISOString();
  const record = await fetchRecord(adminClient, phone);

  let sendCount = 0;
  let windowStartedAt = now;
  let lastSentAt: string | null = null;

  if (record && !windowExpired(record.window_started_at)) {
    sendCount = record.send_count;
    windowStartedAt = record.window_started_at;
    lastSentAt = record.last_sent_at;
  }

  const cooldownSeconds = cooldownSecondsRemaining(lastSentAt);

  if (cooldownSeconds > 0) {
    return {
      allowed: false,
      error: `Please wait ${cooldownSeconds}s before requesting another OTP.`,
      sendCount,
      cooldownSeconds,
      limitReached: false,
    };
  }

  if (sendCount >= OTP_MAX_SENDS_PER_WINDOW) {
    return {
      allowed: false,
      error: "Too many OTP requests. Please try again later.",
      sendCount,
      cooldownSeconds: 0,
      limitReached: true,
    };
  }

  const nextCount = sendCount + 1;

  await adminClient.from("registration_otp_sends").upsert(
    {
      phone,
      send_count: nextCount,
      window_started_at: windowStartedAt,
      last_sent_at: now,
      updated_at: now,
    },
    { onConflict: "phone" },
  );

  return {
    allowed: true,
    sendCount: nextCount,
    cooldownSeconds: OTP_COOLDOWN_SECONDS,
  };
}
