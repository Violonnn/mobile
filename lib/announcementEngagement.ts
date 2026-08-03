// lib/announcementEngagement.ts — announcement upvotes (one per user).
// Counts live on public.announcements (trigger-maintained); this module only
// reads/writes the current user's vote row.
import { supabase } from './supabase';
import { getActiveSession } from './auth';

const UNIQUE_VIOLATION = '23505';

/** Which of the given announcements the signed-in user has already upvoted. */
export async function fetchMyUpvotedAnnouncementIds(
  announcementIds: string[],
): Promise<Set<string>> {
  if (announcementIds.length === 0) return new Set();

  const session = await getActiveSession();
  const userId = session?.user?.id;
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from('announcement_upvotes')
    .select('announcement_id')
    .eq('user_id', userId)
    .in('announcement_id', announcementIds);

  if (error || !data) return new Set();
  return new Set(data.map((row) => String(row.announcement_id)));
}

/** Add or remove the current user's upvote. Duplicate inserts count as success. */
export async function toggleAnnouncementUpvote(
  announcementId: string,
  upvote: boolean,
): Promise<{ error: string | null }> {
  const session = await getActiveSession();
  const userId = session?.user?.id;
  if (!userId) return { error: 'Sign in to upvote.' };

  if (upvote) {
    const { error } = await supabase
      .from('announcement_upvotes')
      .insert({ announcement_id: announcementId, user_id: userId });

    if (error && error.code !== UNIQUE_VIOLATION) {
      return { error: error.message };
    }
    return { error: null };
  }

  const { error } = await supabase
    .from('announcement_upvotes')
    .delete()
    .eq('announcement_id', announcementId)
    .eq('user_id', userId);

  if (error) return { error: error.message };
  return { error: null };
}
