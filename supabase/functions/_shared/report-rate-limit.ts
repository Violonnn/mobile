/** Sliding-window rate limit for resident report creation. */

import { SupabaseClient } from "@supabase/supabase-js";

/** Max successful creates per reporter inside one window. */
export const MAX_REPORTS_PER_WINDOW = 5;

/** Window length in minutes. */
export const REPORT_WINDOW_MINUTES = 15;

type AttemptRow = {
  window_started_at: string;
  attempt_count: number;
};

function windowExpired(windowStartedAt: string, now: number): boolean {
  const windowMs = REPORT_WINDOW_MINUTES * 60 * 1000;
  return now - new Date(windowStartedAt).getTime() >= windowMs;
}

/** Returns whether the reporter may create another report right now. */
export async function checkReportCreateAllowed(
  adminClient: SupabaseClient,
  reporterId: string,
): Promise<{ ok: true } | { ok: false; retryAfterMinutes: number }> {
  const { data: existing } = await adminClient
    .from("report_create_attempts")
    .select("window_started_at, attempt_count")
    .eq("reporter_id", reporterId)
    .maybeSingle();

  const now = Date.now();
  const row = existing as AttemptRow | null;

  if (!row || windowExpired(row.window_started_at, now)) {
    return { ok: true };
  }

  if ((row.attempt_count ?? 0) >= MAX_REPORTS_PER_WINDOW) {
    const windowMs = REPORT_WINDOW_MINUTES * 60 * 1000;
    const remainingMs = windowMs - (now - new Date(row.window_started_at).getTime());
    return {
      ok: false,
      retryAfterMinutes: Math.max(1, Math.ceil(remainingMs / 60000)),
    };
  }

  return { ok: true };
}

/** Call only after a successful report insert. */
export async function recordSuccessfulReportCreate(
  adminClient: SupabaseClient,
  reporterId: string,
): Promise<void> {
  const now = Date.now();
  const { data: existing } = await adminClient
    .from("report_create_attempts")
    .select("window_started_at, attempt_count")
    .eq("reporter_id", reporterId)
    .maybeSingle();

  const row = existing as AttemptRow | null;

  if (!row || windowExpired(row.window_started_at, now)) {
    await adminClient.from("report_create_attempts").upsert({
      reporter_id: reporterId,
      window_started_at: new Date(now).toISOString(),
      attempt_count: 1,
      updated_at: new Date(now).toISOString(),
    });
    return;
  }

  await adminClient
    .from("report_create_attempts")
    .update({
      attempt_count: (row.attempt_count ?? 0) + 1,
      updated_at: new Date(now).toISOString(),
    })
    .eq("reporter_id", reporterId);
}
