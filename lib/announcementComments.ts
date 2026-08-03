// lib/announcementComments.ts — read/write comment threads for one announcement.
import { supabase } from './supabase';
import { getActiveSession } from './auth';
import type { MapReportReporter } from './reports';

export type AnnouncementComment = {
  id: string;
  announcementId: string;
  body: string;
  parentCommentId: string | null;
  createdAt: string;
  replyCount: number;
  isHidden: boolean;
  author: MapReportReporter;
};

export type AnnouncementCommentPage = {
  comments: AnnouncementComment[];
  total: number;
  error: string | null;
};

function mapCommentRow(row: Record<string, unknown>): AnnouncementComment {
  return {
    id: String(row.id),
    announcementId: String(row.announcement_id),
    body: String(row.body ?? ''),
    parentCommentId: row.parent_comment_id
      ? String(row.parent_comment_id)
      : null,
    createdAt: String(row.created_at ?? ''),
    replyCount: Number(row.reply_count ?? 0),
    isHidden: Boolean(row.is_hidden),
    author: {
      id: String(row.user_id ?? ''),
      firstName: String(row.author_first_name ?? ''),
      lastName: String(row.author_last_name ?? ''),
      middleName: row.author_middle_name
        ? String(row.author_middle_name)
        : null,
    },
  };
}

const COMMENT_SELECT =
  'id, announcement_id, user_id, body, parent_comment_id, is_hidden, created_at, reply_count, author_first_name, author_last_name, author_middle_name';

export async function fetchTopLevelAnnouncementComments(
  announcementId: string,
  limit: number,
  includeHidden = false,
): Promise<AnnouncementCommentPage> {
  let query = supabase
    .from('announcement_comments_view')
    .select(COMMENT_SELECT, { count: 'exact' })
    .eq('announcement_id', announcementId)
    .is('parent_comment_id', null)
    .order('created_at', { ascending: false })
    .range(0, Math.max(0, limit - 1));
  if (!includeHidden) query = query.eq('is_hidden', false);
  const { data, error, count } = await query;

  if (error) return { comments: [], total: 0, error: error.message };
  return {
    comments: (data ?? []).map((row) =>
      mapCommentRow(row as Record<string, unknown>),
    ),
    total: count ?? 0,
    error: null,
  };
}

export async function fetchAnnouncementCommentReplies(
  announcementId: string,
  parentCommentId: string,
  limit: number,
  includeHidden = false,
): Promise<AnnouncementCommentPage> {
  let query = supabase
    .from('announcement_comments_view')
    .select(COMMENT_SELECT, { count: 'exact' })
    .eq('announcement_id', announcementId)
    .eq('parent_comment_id', parentCommentId)
    .order('created_at', { ascending: true })
    .range(0, Math.max(0, limit - 1));
  if (!includeHidden) query = query.eq('is_hidden', false);
  const { data, error, count } = await query;

  if (error) return { comments: [], total: 0, error: error.message };
  return {
    comments: (data ?? []).map((row) =>
      mapCommentRow(row as Record<string, unknown>),
    ),
    total: count ?? 0,
    error: null,
  };
}

export async function addAnnouncementComment(
  announcementId: string,
  body: string,
  parentCommentId: string | null = null,
): Promise<{ error: string | null }> {
  const trimmed = body.trim();
  if (!trimmed) return { error: 'Write a comment first.' };

  const session = await getActiveSession();
  const userId = session?.user?.id;
  if (!userId) return { error: 'Sign in to comment.' };

  const { error } = await supabase.from('announcement_comments').insert({
    announcement_id: announcementId,
    user_id: userId,
    body: trimmed,
    parent_comment_id: parentCommentId,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function hideAnnouncementComment(
  commentId: string,
): Promise<{ error: string | null }> {
  const session = await getActiveSession();
  if (!session?.user?.id) return { error: 'Sign in to moderate comments.' };

  const { error } = await supabase
    .from('announcement_comments')
    .update({
      is_hidden: true,
      hidden_by: session.user.id,
      hidden_at: new Date().toISOString(),
    })
    .eq('id', commentId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function unhideAnnouncementComment(
  commentId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('announcement_comments')
    .update({
      is_hidden: false,
      hidden_by: null,
      hidden_at: null,
    })
    .eq('id', commentId);

  if (error) return { error: error.message };
  return { error: null };
}
