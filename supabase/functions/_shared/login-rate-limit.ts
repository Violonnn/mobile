import { SupabaseClient } from "@supabase/supabase-js";

/** After this many wrong PINs, the phone number is temporarily locked. */
export const MAX_FAILED_PIN_ATTEMPTS = 5;

/** How long a lockout lasts after too many failed PIN attempts. */
export const LOCKOUT_MINUTES = 15;

/**
 * Returns true when the phone is locked out.
 * WHY: Slow down brute-force PIN guessing even if the app UI looks fine.
 */
export async function isPhoneLockedOut(
  adminClient: SupabaseClient,
  phone: string,
): Promise<boolean> {
  const { data } = await adminClient
    .from("login_attempts")
    .select("locked_until")
    .eq("phone", phone)
    .maybeSingle();

  if (!data?.locked_until) return false;

  return new Date(data.locked_until) > new Date();
}

/** Record a failed PIN attempt and lock the phone when the limit is reached. */
export async function recordFailedPinAttempt(
  adminClient: SupabaseClient,
  phone: string,
): Promise<void> {
  const { data: existing } = await adminClient
    .from("login_attempts")
    .select("failed_count")
    .eq("phone", phone)
    .maybeSingle();

  const nextCount = (existing?.failed_count ?? 0) + 1;
  const lockedUntil =
    nextCount >= MAX_FAILED_PIN_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
      : null;

  await adminClient.from("login_attempts").upsert(
    {
      phone,
      failed_count: nextCount,
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "phone" },
  );
}

/** Clear counters after a successful PIN login. */
export async function clearLoginAttempts(
  adminClient: SupabaseClient,
  phone: string,
): Promise<void> {
  await adminClient.from("login_attempts").delete().eq("phone", phone);
}
