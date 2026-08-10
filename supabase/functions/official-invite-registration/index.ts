/**
 * Official invite registration via SMS OTP (iProgSMS).
 *
 * Actions:
 *   send     — validate invite + send 6-digit SMS code
 *   verify   — verify code against hashed challenge
 *   register — create Auth user + app_profiles after verified SMS
 *
 * Does NOT reuse request-registration-otp (resident phone Auth identities).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildOtpMessage,
  e164ToPhilippineLocal,
  sendIprogSms,
} from "../_shared/iprogsms.ts";
import { GENERIC_SERVER_ERROR, jsonResponse } from "../_shared/http.ts";
import {
  isSupportedCarrier,
  isValidE164Phone,
  isValidName,
  normalizeName,
  normalizePhilippinePhone,
  rejectExtraKeys,
  trimText,
} from "../_shared/validation.ts";

const OTP_COOLDOWN_SECONDS = 60;
const OTP_MAX_SENDS_PER_WINDOW = 3;
const OTP_WINDOW_MS = 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_FAILED_ATTEMPTS = 5;
const OFFICIAL_PASSWORD_MIN_LENGTH = 12;

const GENERIC_INVITE_ERROR =
  "This invite is unavailable. It may be invalid, expired, used, or revoked.";
const GENERIC_OTP_ERROR = "Invalid or expired code. Please try again.";
const GENERIC_REGISTER_ERROR =
  "Registration could not be completed. Check your details and invite, then try again.";
const UNSUPPORTED_CARRIER = "Not supported yet. Try Globe, TM, or DITO";

type Action = "send" | "verify" | "register";

type Payload = {
  action?: string;
  token?: string;
  code?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  password?: string;
};

type InviteRow = {
  id: string;
  role: "mayor" | "officer";
  barangay_id: string | null;
  invited_email: string;
  invited_phone: string;
  revoked_at: string | null;
  used_at: string | null;
  reserved_at: string | null;
  expires_at: string;
};

function isAction(value: unknown): value is Action {
  return value === "send" || value === "verify" || value === "register";
}

function adminClient(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function generateSixDigitOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1_000_000).padStart(6, "0");
}

function isInviteActive(invite: InviteRow): boolean {
  if (invite.revoked_at || invite.used_at || invite.reserved_at) return false;
  return new Date(invite.expires_at).getTime() > Date.now();
}

async function loadInviteByToken(
  client: SupabaseClient,
  token: string,
): Promise<InviteRow | null> {
  const tokenHash = await sha256Hex(token.trim());
  const { data, error } = await client
    .from("invites")
    .select(
      "id, role, barangay_id, invited_email, invited_phone, revoked_at, used_at, reserved_at, expires_at",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) return null;
  return data as InviteRow;
}

type SendLimitResult =
  | { allowed: true; sendCount: number }
  | {
      allowed: false;
      error: string;
      sendCount: number;
      cooldownSeconds: number;
      limitReached: boolean;
    };

async function claimSmsSendSlot(
  client: SupabaseClient,
  inviteId: string,
): Promise<SendLimitResult> {
  const now = Date.now();
  const { data: existing } = await client
    .from("official_sms_otp_sends")
    .select("send_count, window_started_at, last_sent_at")
    .eq("invite_id", inviteId)
    .maybeSingle();

  if (!existing) {
    const { error } = await client.from("official_sms_otp_sends").insert({
      invite_id: inviteId,
      send_count: 1,
      window_started_at: new Date(now).toISOString(),
      last_sent_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    });
    if (error) {
      console.error("official-invite-registration: insert send row failed", error);
      return {
        allowed: false,
        error: "Unable to send verification code. Please try again.",
        sendCount: 0,
        cooldownSeconds: OTP_COOLDOWN_SECONDS,
        limitReached: false,
      };
    }
    return { allowed: true, sendCount: 1 };
  }

  const windowStarted = new Date(existing.window_started_at).getTime();
  let sendCount = existing.send_count as number;
  let windowStartedAt = existing.window_started_at as string;

  // Reset the rolling hour window when it has elapsed.
  if (windowStarted <= now - OTP_WINDOW_MS) {
    sendCount = 0;
    windowStartedAt = new Date(now).toISOString();
  }

  if (sendCount >= OTP_MAX_SENDS_PER_WINDOW) {
    return {
      allowed: false,
      error: "Unable to send verification code. Please try again later.",
      sendCount,
      cooldownSeconds: OTP_COOLDOWN_SECONDS,
      limitReached: true,
    };
  }

  if (existing.last_sent_at) {
    const lastSent = new Date(existing.last_sent_at).getTime();
    const elapsedMs = now - lastSent;
    if (elapsedMs < OTP_COOLDOWN_SECONDS * 1000) {
      const wait = Math.max(
        1,
        Math.ceil((OTP_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000),
      );
      return {
        allowed: false,
        error: "Unable to send verification code. Please try again.",
        sendCount,
        cooldownSeconds: wait,
        limitReached: false,
      };
    }
  }

  const nextCount = sendCount + 1;
  const { error } = await client.from("official_sms_otp_sends").upsert(
    {
      invite_id: inviteId,
      send_count: nextCount,
      window_started_at: windowStartedAt,
      last_sent_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    },
    { onConflict: "invite_id" },
  );

  if (error) {
    console.error("official-invite-registration: upsert send row failed", error);
    return {
      allowed: false,
      error: "Unable to send verification code. Please try again.",
      sendCount,
      cooldownSeconds: OTP_COOLDOWN_SECONDS,
      limitReached: false,
    };
  }

  return { allowed: true, sendCount: nextCount };
}

async function rollbackSmsSendSlot(
  client: SupabaseClient,
  inviteId: string,
  sendCount: number,
): Promise<void> {
  if (sendCount <= 0) return;

  const { data: record } = await client
    .from("official_sms_otp_sends")
    .select("window_started_at")
    .eq("invite_id", inviteId)
    .maybeSingle();

  await client.from("official_sms_otp_sends").upsert(
    {
      invite_id: inviteId,
      send_count: sendCount - 1,
      window_started_at: record?.window_started_at ?? new Date().toISOString(),
      last_sent_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "invite_id" },
  );
}

async function handleSend(
  client: SupabaseClient,
  token: string,
): Promise<Response> {
  const invite = await loadInviteByToken(client, token);
  if (!invite || !isInviteActive(invite)) {
    return jsonResponse({ error: GENERIC_INVITE_ERROR }, 400);
  }

  const phone = normalizePhilippinePhone(invite.invited_phone);
  if (!isValidE164Phone(phone)) {
    return jsonResponse({ error: GENERIC_INVITE_ERROR }, 400);
  }

  if (!isSupportedCarrier(phone)) {
    return jsonResponse({ error: UNSUPPORTED_CARRIER }, 400);
  }

  const limit = await claimSmsSendSlot(client, invite.id);
  if (!limit.allowed) {
    return jsonResponse(
      {
        error: limit.error,
        sendCount: limit.sendCount,
        maxSends: OTP_MAX_SENDS_PER_WINDOW,
        cooldownSeconds: limit.cooldownSeconds,
        limitReached: limit.limitReached,
      },
      429,
    );
  }

  const otp = generateSixDigitOtp();
  const otpHash = await sha256Hex(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  // Invalidate prior unverified challenges for this invite.
  await client
    .from("official_sms_challenges")
    .delete()
    .eq("invite_id", invite.id)
    .is("verified_at", null);

  const { error: insertError } = await client.from("official_sms_challenges").insert({
    invite_id: invite.id,
    phone,
    otp_hash: otpHash,
    expires_at: expiresAt,
    failed_attempts: 0,
  });

  if (insertError) {
    console.error("official-invite-registration: challenge insert failed", insertError);
    await rollbackSmsSendSlot(client, invite.id, limit.sendCount);
    return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  }

  const localPhone = e164ToPhilippineLocal(phone);
  if (!localPhone) {
    await rollbackSmsSendSlot(client, invite.id, limit.sendCount);
    return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  }

  const sent = await sendIprogSms({
    phoneNumber: localPhone,
    message: buildOtpMessage(otp),
  });

  if (!sent.ok) {
    console.error("official-invite-registration: IPROG send failed", sent.status, sent.body);
    await rollbackSmsSendSlot(client, invite.id, limit.sendCount);
    await client
      .from("official_sms_challenges")
      .delete()
      .eq("invite_id", invite.id)
      .is("verified_at", null);
    return jsonResponse(
      { error: "Unable to send verification code. Please try again." },
      502,
    );
  }

  return jsonResponse(
    {
      success: true,
      sendCount: limit.sendCount,
      maxSends: OTP_MAX_SENDS_PER_WINDOW,
      cooldownSeconds: OTP_COOLDOWN_SECONDS,
      limitReached: limit.sendCount >= OTP_MAX_SENDS_PER_WINDOW,
    },
    200,
  );
}

async function handleVerify(
  client: SupabaseClient,
  token: string,
  code: string,
): Promise<Response> {
  if (!/^\d{6}$/.test(code)) {
    return jsonResponse({ error: GENERIC_OTP_ERROR }, 400);
  }

  const invite = await loadInviteByToken(client, token);
  if (!invite || !isInviteActive(invite)) {
    return jsonResponse({ error: GENERIC_INVITE_ERROR }, 400);
  }

  const { data: challenge, error } = await client
    .from("official_sms_challenges")
    .select("id, otp_hash, expires_at, verified_at, failed_attempts, phone")
    .eq("invite_id", invite.id)
    .eq("phone", invite.invited_phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !challenge) {
    return jsonResponse({ error: GENERIC_OTP_ERROR }, 400);
  }

  if (challenge.verified_at) {
    return jsonResponse({ success: true, verified: true }, 200);
  }

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    return jsonResponse({ error: GENERIC_OTP_ERROR }, 400);
  }

  if ((challenge.failed_attempts as number) >= OTP_MAX_FAILED_ATTEMPTS) {
    return jsonResponse({ error: GENERIC_OTP_ERROR }, 400);
  }

  const codeHash = await sha256Hex(code);
  if (codeHash !== challenge.otp_hash) {
    const nextAttempts = (challenge.failed_attempts as number) + 1;
    await client
      .from("official_sms_challenges")
      .update({ failed_attempts: nextAttempts })
      .eq("id", challenge.id);
    return jsonResponse({ error: GENERIC_OTP_ERROR }, 400);
  }

  const { error: verifyError } = await client
    .from("official_sms_challenges")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", challenge.id);

  if (verifyError) {
    console.error("official-invite-registration: verify update failed", verifyError);
    return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  }

  return jsonResponse({ success: true, verified: true }, 200);
}

async function handleRegister(
  client: SupabaseClient,
  payload: {
    token: string;
    firstName: string;
    lastName: string;
    middleName: string;
    password: string;
  },
): Promise<Response> {
  const firstName = normalizeName(payload.firstName);
  const lastName = normalizeName(payload.lastName);
  const middleName = normalizeName(payload.middleName);
  const password = payload.password;

  if (!isValidName(firstName) || !isValidName(lastName)) {
    return jsonResponse({ error: GENERIC_REGISTER_ERROR }, 400);
  }
  if (middleName && !isValidName(middleName)) {
    return jsonResponse({ error: GENERIC_REGISTER_ERROR }, 400);
  }
  if (password.length < OFFICIAL_PASSWORD_MIN_LENGTH) {
    return jsonResponse({ error: GENERIC_REGISTER_ERROR }, 400);
  }

  const invite = await loadInviteByToken(client, payload.token);
  if (!invite || !isInviteActive(invite)) {
    return jsonResponse({ error: GENERIC_INVITE_ERROR }, 400);
  }

  if (invite.role !== "mayor" && invite.role !== "officer") {
    return jsonResponse({ error: GENERIC_REGISTER_ERROR }, 400);
  }

  const phone = normalizePhilippinePhone(invite.invited_phone);
  const email = invite.invited_email.trim().toLowerCase();

  // Require a live verified SMS challenge for this invite + phone.
  const { data: challenge } = await client
    .from("official_sms_challenges")
    .select("id, verified_at, expires_at")
    .eq("invite_id", invite.id)
    .eq("phone", phone)
    .not("verified_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challenge?.verified_at) {
    return jsonResponse(
      { error: "Verify your mobile number before creating the account." },
      400,
    );
  }

  // Re-check the same identity rules as create_official_invite (server-side).
  // Results are logged for developers; the recipient never sees which field conflicted.
  const { data: conflicts, error: conflictError } = await client.rpc(
    "check_official_invite_identities",
    {
      p_email: email,
      p_phone: phone,
      p_exclude_invite_id: invite.id,
    },
  );

  if (conflictError) {
    console.error(
      "official-invite-registration: identity check failed",
      conflictError,
    );
    return jsonResponse({ error: GENERIC_REGISTER_ERROR }, 500);
  }

  const identity = (conflicts ?? {}) as {
    email_in_auth?: boolean;
    email_has_active_official?: boolean;
    email_active_invite?: boolean;
    phone_active_invite?: boolean;
    phone_active_official?: boolean;
    requires_manual_review?: boolean;
  };

  if (identity.email_in_auth) {
    console.error("official-invite-registration: identity conflict", {
      reason: identity.email_has_active_official
        ? "email_active_official"
        : "email_in_auth_requires_manual_review",
      inviteId: invite.id,
      requiresManualReview: identity.requires_manual_review === true,
    });
    return jsonResponse({ error: GENERIC_REGISTER_ERROR }, 409);
  }

  if (identity.email_active_invite) {
    console.error("official-invite-registration: identity conflict", {
      reason: "email_active_invite",
      inviteId: invite.id,
    });
    return jsonResponse({ error: GENERIC_REGISTER_ERROR }, 409);
  }

  if (identity.phone_active_invite || identity.phone_active_official) {
    console.error("official-invite-registration: identity conflict", {
      reason: identity.phone_active_official
        ? "phone_active_official"
        : "phone_active_invite",
      inviteId: invite.id,
    });
    return jsonResponse({ error: GENERIC_REGISTER_ERROR }, 409);
  }

  // Create Auth user already confirmed so email/password sign-in works.
  // Confirm Email stays globally enabled for other flows; this is server-side.
  const { data: created, error: createError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      official_invite: "sms",
    },
  });

  if (createError || !created.user) {
    console.error("official-invite-registration: createUser failed", createError);
    // Generic — do not reveal whether email already exists.
    return jsonResponse({ error: GENERIC_REGISTER_ERROR }, 409);
  }

  const userId = created.user.id;
  const verifiedAt = challenge.verified_at;

  const { error: profileError } = await client.from("app_profiles").insert({
    id: userId,
    role: invite.role,
    first_name: firstName,
    last_name: lastName,
    middle_name: middleName || null,
    email,
    phone_number: phone,
    barangay_id: invite.barangay_id,
    status: "active",
    email_verified_at: null,
    phone_verified_at: verifiedAt,
  });

  if (profileError) {
    console.error("official-invite-registration: profile insert failed", profileError);
    // Compensate: remove the Auth user if profile creation fails.
    await client.auth.admin.deleteUser(userId);
    return jsonResponse({ error: GENERIC_REGISTER_ERROR }, 500);
  }

  // Atomic as far as the row update allows: only one register can mark used.
  const { data: markedInvite, error: inviteUpdateError } = await client
    .from("invites")
    .update({
      used_at: new Date().toISOString(),
      used_by: userId,
      reserved_at: null,
      reserved_by: null,
    })
    .eq("id", invite.id)
    .is("used_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (inviteUpdateError || !markedInvite) {
    console.error(
      "official-invite-registration: invite mark-used failed",
      inviteUpdateError ?? "already used/revoked",
    );
    await client.from("app_profiles").delete().eq("id", userId);
    await client.auth.admin.deleteUser(userId);
    return jsonResponse({ error: GENERIC_REGISTER_ERROR }, 409);
  }

  // Consume challenges and send counters for this invite.
  await client.from("official_sms_challenges").delete().eq("invite_id", invite.id);
  await client.from("official_sms_otp_sends").delete().eq("invite_id", invite.id);

  let barangayName: string | null = null;
  if (invite.barangay_id) {
    const { data: barangay } = await client
      .from("barangays")
      .select("name")
      .eq("id", invite.barangay_id)
      .maybeSingle();
    barangayName = barangay?.name ?? null;
  }

  return jsonResponse(
    {
      success: true,
      email,
      role: invite.role,
      barangay_id: invite.barangay_id,
      barangay_name: barangayName,
    },
    200,
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("official-invite-registration: missing Supabase env vars");
    return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  }

  let rawPayload: Payload;
  try {
    rawPayload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400);
  }

  const extraFieldsError = rejectExtraKeys(rawPayload as Record<string, unknown>, [
    "action",
    "token",
    "code",
    "firstName",
    "lastName",
    "middleName",
    "password",
  ]);
  if (extraFieldsError) {
    return jsonResponse({ error: "Invalid request." }, 400);
  }

  if (!isAction(rawPayload.action)) {
    return jsonResponse({ error: "Invalid request." }, 400);
  }

  const token = trimText(rawPayload.token);
  if (!token) {
    return jsonResponse({ error: GENERIC_INVITE_ERROR }, 400);
  }

  const client = adminClient(supabaseUrl, serviceRoleKey);

  if (rawPayload.action === "send") {
    return await handleSend(client, token);
  }

  if (rawPayload.action === "verify") {
    const code = trimText(rawPayload.code);
    return await handleVerify(client, token, code);
  }

  return await handleRegister(client, {
    token,
    firstName: trimText(rawPayload.firstName),
    lastName: trimText(rawPayload.lastName),
    middleName: trimText(rawPayload.middleName),
    password: typeof rawPayload.password === "string" ? rawPayload.password : "",
  });
});
