import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { GENERIC_SERVER_ERROR, jsonResponse } from "../_shared/http.ts";
import { loginEmailForUserId } from "../_shared/login-email.ts";
import {
  isValidBirthMonth,
  isValidBirthYear,
  isValidE164Phone,
  isValidPin,
  MAX_BARANGAY_LENGTH,
  MAX_NAME_LENGTH,
  normalizePhilippinePhone,
  rejectExtraKeys,
  trimText,
} from "../_shared/validation.ts";

const BCRYPT_ROUNDS = 12;

/** Shown to the app — never include internal DB/auth details. */
const GENERIC_VALIDATION_ERROR =
  "Please check your registration details and try again.";

const PHONE_SESSION_ERROR =
  "Your verified phone does not match. Please restart registration.";

const PROFILE_EXISTS_ERROR =
  "This phone number is already registered. Try logging in instead.";

type RegistrationPayload = {
  phone?: string;
  details?: Record<string, unknown>;
  pin?: string;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    console.error("complete-registration: missing Supabase env vars");
    return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const accessToken = authHeader.replace(/^Bearer\s+/i, "");

  let rawPayload: RegistrationPayload;
  try {
    rawPayload = await req.json();
  } catch {
    return jsonResponse({ error: GENERIC_VALIDATION_ERROR }, 400);
  }

  // Block surprise fields — only accept the exact shape we expect.
  const topLevelError = rejectExtraKeys(
    rawPayload as Record<string, unknown>,
    ["phone", "details", "pin"],
  );
  if (topLevelError) {
    return jsonResponse({ error: GENERIC_VALIDATION_ERROR }, 400);
  }

  const phone = trimText(rawPayload.phone);
  const pin = typeof rawPayload.pin === "string" ? rawPayload.pin : "";
  const details = rawPayload.details;

  if (!phone || !details || !pin) {
    return jsonResponse({ error: GENERIC_VALIDATION_ERROR }, 400);
  }

  if (!isValidE164Phone(phone) || !isValidPin(pin)) {
    return jsonResponse({ error: GENERIC_VALIDATION_ERROR }, 400);
  }

  const detailsError = rejectExtraKeys(details, [
    "lastName",
    "firstName",
    "middleName",
    "birthYear",
    "birthMonth",
    "barangay",
    "agreedToTerms",
  ]);
  if (detailsError) {
    return jsonResponse({ error: GENERIC_VALIDATION_ERROR }, 400);
  }

  if (details.agreedToTerms !== true) {
    return jsonResponse({ error: GENERIC_VALIDATION_ERROR }, 400);
  }

  const lastName = trimText(details.lastName);
  const firstName = trimText(details.firstName);
  const middleName = trimText(details.middleName);
  const birthYear = trimText(details.birthYear);
  const birthMonth =
    typeof details.birthMonth === "number" ? details.birthMonth : null;
  const barangay = trimText(details.barangay);

  if (
    !lastName ||
    !firstName ||
    !birthYear ||
    birthMonth === null ||
    !barangay
  ) {
    return jsonResponse({ error: GENERIC_VALIDATION_ERROR }, 400);
  }

  if (
    lastName.length > MAX_NAME_LENGTH ||
    firstName.length > MAX_NAME_LENGTH ||
    middleName.length > MAX_NAME_LENGTH ||
    barangay.length > MAX_BARANGAY_LENGTH
  ) {
    return jsonResponse({ error: GENERIC_VALIDATION_ERROR }, 400);
  }

  if (!isValidBirthYear(birthYear) || !isValidBirthMonth(birthMonth)) {
    return jsonResponse({ error: GENERIC_VALIDATION_ERROR }, 400);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(accessToken);

  if (userError || !user) {
    console.error(
      "complete-registration: getUser failed",
      userError?.message ?? "no user returned",
    );
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // Phone in the body must match the OTP-verified auth user (prevents account mix-ups).
  const authPhone = user.phone ? normalizePhilippinePhone(user.phone) : "";
  const bodyPhone = normalizePhilippinePhone(phone);
  if (!authPhone || authPhone !== bodyPhone) {
    console.warn("complete-registration: phone mismatch for user", user.id, {
      authPhone,
      bodyPhone,
    });
    return jsonResponse({ error: PHONE_SESSION_ERROR }, 403);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    return jsonResponse({ error: PROFILE_EXISTS_ERROR }, 409);
  }

  const { data: phoneTaken } = await adminClient
    .from("profiles")
    .select("id")
    .eq("phone", bodyPhone)
    .maybeSingle();

  if (phoneTaken) {
    return jsonResponse({ error: PROFILE_EXISTS_ERROR }, 409);
  }

  const pinHash = bcrypt.hashSync(pin, BCRYPT_ROUNDS);

  const { error: insertError } = await adminClient.from("profiles").insert({
    id: user.id,
    phone: bodyPhone,
    last_name: lastName,
    first_name: firstName,
    middle_name: middleName,
    birth_year: birthYear,
    birth_month: birthMonth,
    barangay,
    pin_hash: pinHash,
  });

  if (insertError) {
    console.error("complete-registration: profile insert failed", insertError.message);
    if (insertError.code === "23505") {
      return jsonResponse({ error: PROFILE_EXISTS_ERROR }, 409);
    }
    return jsonResponse({ error: GENERIC_SERVER_ERROR }, 500);
  }

  // Phone users need a synthetic email so admin generateLink can mint a session token.
  // Users never see this address — it is only for server-side login after PIN check.
  const loginEmail = loginEmailForUserId(user.id);
  const { error: emailError } = await adminClient.auth.admin.updateUserById(user.id, {
    email: loginEmail,
    email_confirm: true,
  });

  if (emailError) {
    // Profile is saved; verify-login retries login email setup on first PIN login.
    console.error("complete-registration: login email setup failed", emailError.message);
  }

  return jsonResponse({ success: true }, 200);
});
