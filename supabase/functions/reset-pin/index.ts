import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { GENERIC_SERVER_ERROR, jsonResponse } from "../_shared/http.ts";
import { clearLoginAttempts } from "../_shared/login-rate-limit.ts";
import {
  isValidE164Phone,
  isValidPin,
  normalizePhilippinePhone,
  rejectExtraKeys,
  trimText,
} from "../_shared/validation.ts";

const BCRYPT_ROUNDS = 12;

/** Shown to the app — never leak whether the account/session was the problem. */
const GENERIC_RESET_ERROR =
  "Could not reset your PIN. Please verify your phone again.";

const PHONE_SESSION_ERROR =
  "Your verified phone does not match. Please restart the reset.";

type ResetPinPayload = {
  phone?: string;
  pin?: string;
};

/**
 * Set a new PIN after a verified reset OTP.
 * WHY: The reset OTP proves phone ownership but must NOT log the user into the
 * app. This function is the only authorized path to overwrite pin_hash, and it
 * requires the short-lived session minted by verifyOtp as a Bearer token.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    console.error("reset-pin: missing Supabase env vars");
    return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const accessToken = authHeader.replace(/^Bearer\s+/i, "");

  let rawPayload: ResetPinPayload;
  try {
    rawPayload = await req.json();
  } catch {
    return jsonResponse({ error: GENERIC_RESET_ERROR }, 400);
  }

  const extraFieldsError = rejectExtraKeys(rawPayload as Record<string, unknown>, [
    "phone",
    "pin",
  ]);
  if (extraFieldsError) {
    return jsonResponse({ error: GENERIC_RESET_ERROR }, 400);
  }

  const phone = trimText(rawPayload.phone);
  const pin = typeof rawPayload.pin === "string" ? rawPayload.pin : "";

  if (!phone || !pin || !isValidE164Phone(phone) || !isValidPin(pin)) {
    return jsonResponse({ error: GENERIC_RESET_ERROR }, 400);
  }

  // Resolve the caller from the OTP-verified session token.
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(accessToken);

  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // The body phone must match the OTP-verified auth user (no resetting others).
  const authPhone = user.phone ? normalizePhilippinePhone(user.phone) : "";
  const bodyPhone = normalizePhilippinePhone(phone);
  if (!authPhone || authPhone !== bodyPhone) {
    console.warn("reset-pin: phone mismatch for user", user.id);
    return jsonResponse({ error: PHONE_SESSION_ERROR }, 403);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Only registered accounts have a profile row to update.
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return jsonResponse({ error: GENERIC_RESET_ERROR }, 400);
  }

  const pinHash = bcrypt.hashSync(pin, BCRYPT_ROUNDS);

  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ pin_hash: pinHash })
    .eq("id", user.id);

  if (updateError) {
    console.error("reset-pin: pin_hash update failed", updateError.message);
    return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  }

  // A successful reset should clear any prior lockout so the user can log in.
  await clearLoginAttempts(adminClient, bodyPhone);

  return jsonResponse({ success: true }, 200);
});
