// lib/comments.ts — read/write comment threads for a single report.
// Reads go through the report_comments view (comment + author name); writes go
// to the base comments table so RLS and the comment_count trigger apply.
import { supabase } from './supabase';
import { getActiveSession } from './auth';
import type { MapReportReporter } from './reports';

export type ReportComment = {
  id: string;
  reportId: string;
  body: string;
  parentCommentId: string | null;
  createdAt: string;
  replyCount: number;
  isHidden: boolean;
  author: MapReportReporter;
};

export type CommentPage = {
  comments: ReportComment[];
  total: number;
  error: string | null;
};

function mapCommentRow(row: Record<string, unknown>): ReportComment {
  return {
    id: String(row.id),
    reportId: String(row.report_id),
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
  'id, report_id, user_id, body, parent_comment_id, is_hidden, created_at, reply_count, author_first_name, author_last_name, author_middle_name';

/**
 * Fetch only the requested top-level page. Supabase's exact count lets the UI
 * decide whether "See more comments" is needed without downloading the rest.
 */
export async function fetchTopLevelComments(
  reportId: string,
  limit: number,
  includeHidden = false,
): Promise<CommentPage> {
  let query = supabase
    .from('report_comments')
    .select(COMMENT_SELECT, { count: 'exact' })
    .eq('report_id', reportId)
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

/**
 * Fetch one parent comment's visible replies only. Replies remain collapsed
 * until requested and then grow in five-row batches.
 */
export async function fetchCommentReplies(
  reportId: string,
  parentCommentId: string,
  limit: number,
  includeHidden = false,
): Promise<CommentPage> {
  let query = supabase
    .from('report_comments')
    .select(COMMENT_SELECT, { count: 'exact' })
    .eq('report_id', reportId)
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

/** Post a comment (or a reply when parentCommentId is set) as the current user. */
export async function addReportComment(
  reportId: string,
  body: string,
  parentCommentId: string | null = null,
): Promise<{ error: string | null }> {
  const trimmed = body.trim();
  if (!trimmed) return { error: 'Write a comment first.' };

  const session = await getActiveSession();
  const userId = session?.user?.id;
  if (!userId) return { error: 'Sign in to comment.' };

  const { error } = await supabase.from('comments').insert({
    report_id: reportId,
    user_id: userId,
    body: trimmed,
    parent_comment_id: parentCommentId,
  });

  if (error) return { error: error.message };
  return { error: null };
}
