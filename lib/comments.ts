// lib/comments.ts — read/write comment threads for a single report.
// Reads go through the report_comments view (comment + author name); writes go
// to the base comments table so RLS and the comment_count trigger apply.
import { supabase } from './supabase';
import { getActiveSession } from './auth';
import type { MapReportReporter } from './reports';
import { isProfilePhotoSchemaMissing } from './schemaCompatibility';

export type ReportComment = {
  id: string;
  reportId: string;
  body: string;
  parentCommentId: string | null;
  createdAt: string;
  replyCount: number;
  isHidden: boolean;
  authorRole: 'resident' | 'officer' | 'mayor' | 'admin';
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
    authorRole:
      row.author_role === 'officer' ||
      row.author_role === 'mayor' ||
      row.author_role === 'admin'
        ? row.author_role
        : 'resident',
    author: {
      id: String(row.user_id ?? ''),
      firstName: String(row.author_first_name ?? ''),
      lastName: String(row.author_last_name ?? ''),
      middleName: row.author_middle_name
        ? String(row.author_middle_name)
        : null,
      avatarPath: row.author_avatar_path ? String(row.author_avatar_path) : null,
    },
  };
}

const LEGACY_COMMENT_SELECT =
  'id, report_id, user_id, body, parent_comment_id, is_hidden, created_at, reply_count, author_first_name, author_last_name, author_middle_name';
const COMMENT_SELECT = `${LEGACY_COMMENT_SELECT}, author_role, author_avatar_path`;

const PRIORITIZED_COMMENT_COUNT = 3;

function isMissingCommentProjectionField(errorMessage: string | undefined): boolean {
  const normalizedMessage = (errorMessage ?? '').toLocaleLowerCase();
  return (
    normalizedMessage.includes('author_role') ||
    isProfilePhotoSchemaMissing(normalizedMessage)
  );
}

/**
 * Return three map-safe comment highlights: newest official responses first,
 * then the latest resident comments to fill the remaining positions.
 */
export async function fetchPrioritizedReportComments(
  reportId: string,
): Promise<{ comments: ReportComment[]; error: string | null }> {
  const baseQuery = () =>
    supabase
      .from('report_comments')
      .select(COMMENT_SELECT)
      .eq('report_id', reportId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(PRIORITIZED_COMMENT_COUNT);

  const [officialResult, latestResult] = await Promise.all([
    baseQuery().in('author_role', ['officer', 'mayor', 'admin']),
    baseQuery(),
  ]);

  if (officialResult.error || latestResult.error) {
    const roleColumnMissing =
      isMissingCommentProjectionField(officialResult.error?.message) ||
      isMissingCommentProjectionField(latestResult.error?.message);
    if (roleColumnMissing) {
      // During a rolling migration, load the legacy view immediately instead
      // of breaking every comment thread. Roles default safely to resident.
      const legacyResult = await supabase
        .from('report_comments')
        .select(LEGACY_COMMENT_SELECT)
        .eq('report_id', reportId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(PRIORITIZED_COMMENT_COUNT);
      return {
        comments: (legacyResult.data ?? []).map((row) =>
          mapCommentRow(row as Record<string, unknown>),
        ),
        error: legacyResult.error?.message ?? null,
      };
    }
    return {
      comments: [],
      error: officialResult.error?.message ?? latestResult.error?.message ?? 'Could not load comments.',
    };
  }

  const officialComments = (officialResult.data ?? []).map((row) =>
    mapCommentRow(row as Record<string, unknown>),
  );
  const officialIds = new Set(officialComments.map((comment) => comment.id));
  const latestResidentComments = (latestResult.data ?? [])
    .map((row) => mapCommentRow(row as Record<string, unknown>))
    .filter((comment) => !officialIds.has(comment.id));

  return {
    comments: [...officialComments, ...latestResidentComments].slice(
      0,
      PRIORITIZED_COMMENT_COUNT,
    ),
    error: null,
  };
}

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

  if (error && isMissingCommentProjectionField(error.message)) {
    let legacyQuery = supabase
      .from('report_comments')
      .select(LEGACY_COMMENT_SELECT, { count: 'exact' })
      .eq('report_id', reportId)
      .is('parent_comment_id', null)
      .order('created_at', { ascending: false })
      .range(0, Math.max(0, limit - 1));
    if (!includeHidden) legacyQuery = legacyQuery.eq('is_hidden', false);
    const legacyResult = await legacyQuery;
    return {
      comments: (legacyResult.data ?? []).map((row) =>
        mapCommentRow(row as Record<string, unknown>),
      ),
      total: legacyResult.count ?? 0,
      error: legacyResult.error?.message ?? null,
    };
  }

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

  if (error && isMissingCommentProjectionField(error.message)) {
    let legacyQuery = supabase
      .from('report_comments')
      .select(LEGACY_COMMENT_SELECT, { count: 'exact' })
      .eq('report_id', reportId)
      .eq('parent_comment_id', parentCommentId)
      .order('created_at', { ascending: true })
      .range(0, Math.max(0, limit - 1));
    if (!includeHidden) legacyQuery = legacyQuery.eq('is_hidden', false);
    const legacyResult = await legacyQuery;
    return {
      comments: (legacyResult.data ?? []).map((row) =>
        mapCommentRow(row as Record<string, unknown>),
      ),
      total: legacyResult.count ?? 0,
      error: legacyResult.error?.message ?? null,
    };
  }

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
