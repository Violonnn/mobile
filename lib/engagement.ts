// lib/engagement.ts — report upvotes (one per user per report).
// Counts themselves live on public.reports (trigger-maintained) and are read via
// the reports_map view; this module only reads/writes the current user's vote.
import { supabase } from './supabase';
import { getActiveSession } from './auth';

// Postgres unique_violation — the user already has a row for this report.
const UNIQUE_VIOLATION = '23505';

/** Which of the given reports the signed-in user has already upvoted. */
export async function fetchMyUpvotedReportIds(
  reportIds: string[],
): Promise<Set<string>> {
  if (reportIds.length === 0) return new Set();

  const session = await getActiveSession();
  const userId = session?.user?.id;
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from('report_upvotes')
    .select('report_id')
    .eq('user_id', userId)
    .in('report_id', reportIds);

  if (error || !data) return new Set();
  return new Set(data.map((row) => String(row.report_id)));
}

/**
 * Add or remove the current user's upvote for a report. Idempotent: a duplicate
 * insert (already upvoted) is treated as success so optimistic UI never breaks.
 */
export async function toggleReportUpvote(
  reportId: string,
  upvote: boolean,
): Promise<{ error: string | null }> {
  const session = await getActiveSession();
  const userId = session?.user?.id;
  if (!userId) return { error: 'Sign in to upvote.' };

  if (upvote) {
    const { error } = await supabase
      .from('report_upvotes')
      .insert({ report_id: reportId, user_id: userId });

    if (error && error.code !== UNIQUE_VIOLATION) {
      return { error: error.message };
    }
    return { error: null };
  }

  const { error } = await supabase
    .from('report_upvotes')
    .delete()
    .eq('report_id', reportId)
    .eq('user_id', userId);

  if (error) return { error: error.message };
  return { error: null };
}
