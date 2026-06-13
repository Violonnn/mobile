import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { GENERIC_SERVER_ERROR, jsonResponse } from "../_shared/http.ts";
import {
  clearLoginAttempts,
  isPhoneLockedOut,
  LOCKOUT_MINUTES,
  recordFailedPinAttempt,
} from "../_shared/login-rate-limit.ts";
import { loginEmailForUserId } from "../_shared/login-email.ts";
import {
  isValidE164Phone,
  isValidPin,
  rejectExtraKeys,
  trimText,
} from "../_shared/validation.ts";

const BCRYPT_ROUNDS = 12;

/**
 * Same message for wrong phone, wrong PIN, or missing profile.
 * WHY: Do not tell attackers which phone numbers are registered.
 */
const GENERIC_LOGIN_ERROR = "Invalid phone number or PIN. Please try again.";

const LOCKOUT_ERROR = `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`;

// Dummy hash so bcrypt.compare runs even when no profile exists (similar timing).
const DUMMY_PIN_HASH = bcrypt.hashSync("__invalid__", BCRYPT_ROUNDS);

type LoginPayload = {
  phone?: string;
  pin?: string;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("verify-login: missing Supabase env vars");
    return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  }

  let rawPayload: LoginPayload;
  try {
    rawPayload = await req.json();
  } catch {
    return jsonResponse({ error: GENERIC_LOGIN_ERROR }, 400);
  }

  const extraFieldsError = rejectExtraKeys(rawPayload as Record<string, unknown>, [
    "phone",
    "pin",
  ]);
  if (extraFieldsError) {
    return jsonResponse({ error: GENERIC_LOGIN_ERROR }, 400);
  }

  const phone = trimText(rawPayload.phone);
  const pin = typeof rawPayload.pin === "string" ? rawPayload.pin : "";

  if (!phone || !pin || !isValidE164Phone(phone) || !isValidPin(pin)) {
    return jsonResponse({ error: GENERIC_LOGIN_ERROR }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (await isPhoneLockedOut(adminClient, phone)) {
    return jsonResponse({ error: LOCKOUT_ERROR }, 429);
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, pin_hash")
    .eq("phone", phone)
    .maybeSingle();

  const hashToCompare = profile?.pin_hash ?? DUMMY_PIN_HASH;
  const pinMatches = bcrypt.compareSync(pin, hashToCompare);

  if (!profile || !pinMatches) {
    await recordFailedPinAttempt(adminClient, phone);
    return jsonResponse({ error: GENERIC_LOGIN_ERROR }, 401);
  }

  await clearLoginAttempts(adminClient, phone);

  // Supabase generateLink is email-based. We set a hidden login email at registration.
  const loginEmail = loginEmailForUserId(profile.id);
  const { data: authUser } = await adminClient.auth.admin.getUserById(profile.id);

  if (!authUser.user?.email) {
    await adminClient.auth.admin.updateUserById(profile.id, {
      email: loginEmail,
      email_confirm: true,
    });
  }

  const emailForLink = authUser.user?.email ?? loginEmail;

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: emailForLink,
  });

  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("verify-login: generateLink failed", linkError?.message);
    return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  }

  return jsonResponse({ success: true, token_hash: tokenHash }, 200);
});
