// lib/announcements.ts
// Ranked announcement queries + scoped create/update helpers.
// Ordering: is_pinned desc, author_rank asc, created_at desc.

import { supabase } from './supabase';
import { getActiveSession } from './auth';
import { readEdgeFunctionErrorMessage } from './edgeFunctionErrors';
import { randomUuid } from './reportMedia';
import { uploadAnnouncementMedia, validateAnnouncementMedia, type AnnouncementDraftMedia } from './announcementMedia';

export type AnnouncementScope = 'barangay' | 'municipal';

export type AnnouncementAuthor = {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  /** Display label beside the author name (e.g. MDRRMO, Mayor, BDRRMO). */
  roleLabel: string;
};

export type AnnouncementRecord = {
  id: string;
  authorId: string;
  author: AnnouncementAuthor;
  scope: AnnouncementScope;
  barangayId: string | null;
  title: string;
  body: string;
  isPinned: boolean;
  authorRank: number;
  createdAt: string;
  updatedAt: string;
  media: AnnouncementMediaAttachment[];
  upvoteCount: number;
  commentCount: number;
};

export type AnnouncementMediaAttachment = {
  id: string;
  type: 'photo' | 'video';
  url: string;
  durationSeconds: number | null;
};

const MAX_TITLE = 120;
const MAX_BODY = 4000;

function asScope(value: unknown): AnnouncementScope {
  return value === 'barangay' ? 'barangay' : 'municipal';
}

/** Full legal-style name for announcement attribution (middle name kept intact). */
export function formatAnnouncementAuthorName(author: AnnouncementAuthor): string {
  const parts = [author.firstName, author.middleName, author.lastName]
    .filter((part) => part?.trim())
    .map((part) => part!.trim());
  return parts.join(' ') || 'Official';
}

function roleLabelFromProfile(
  role: string,
  barangayId: string | null,
  authorRank: number,
): string {
  if (role === 'mayor') return 'Mayor';
  if (role === 'officer') return barangayId ? 'BDRRMO' : 'MDRRMO';
  // Fallback when the profile row is missing: author_rank from announcements_ranked.
  if (authorRank === 1) return 'Mayor';
  if (authorRank === 2) return 'MDRRMO';
  if (authorRank === 3) return 'BDRRMO';
  return 'Official';
}

function fallbackAuthor(authorId: string, authorRank: number): AnnouncementAuthor {
  return {
    id: authorId,
    firstName: 'Official',
    lastName: '',
    middleName: null,
    roleLabel: roleLabelFromProfile('', null, authorRank),
  };
}

function mapAnnouncement(
  row: Record<string, unknown>,
  media: AnnouncementMediaAttachment[] = [],
  author?: AnnouncementAuthor | null,
): AnnouncementRecord {
  const authorId = String(row.author_id ?? '');
  const authorRank = Number(row.author_rank ?? 4);
  return {
    id: String(row.id),
    authorId,
    author: author ?? fallbackAuthor(authorId, authorRank),
    scope: asScope(row.scope),
    barangayId: row.barangay_id ? String(row.barangay_id) : null,
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    isPinned: Boolean(row.is_pinned),
    authorRank,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    media,
    upvoteCount: Number(row.upvote_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
  };
}

async function loadAnnouncementMedia(announcementIds: string[]) {
  if (announcementIds.length === 0) return new Map<string, AnnouncementMediaAttachment[]>();
  const { data } = await supabase.from('announcement_media').select('id, announcement_id, type, storage_path, duration_seconds, position').in('announcement_id', announcementIds).order('position', { ascending: true });
  const rows = data ?? [];
  const paths = rows.map((row) => String(row.storage_path));
  const { data: signed } = paths.length ? await supabase.storage.from('announcement-media').createSignedUrls(paths, 3600) : { data: [] };
  const urls = new Map(paths.map((path, index) => [path, signed?.[index]?.signedUrl ?? '']));
  const byAnnouncement = new Map<string, AnnouncementMediaAttachment[]>();
  rows.forEach((row) => {
    const url = urls.get(String(row.storage_path));
    if (!url) return;
    const key = String(row.announcement_id);
    const current = byAnnouncement.get(key) ?? [];
    current.push({ id: String(row.id), type: row.type === 'video' ? 'video' : 'photo', url, durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds) });
    byAnnouncement.set(key, current);
  });
  return byAnnouncement;
}

/** Batch-load author identity for announcement cards (name + role label). */
async function loadAnnouncementAuthors(
  authorIds: string[],
  authorRankById: Map<string, number>,
): Promise<Map<string, AnnouncementAuthor>> {
  const uniqueIds = [...new Set(authorIds.filter((id) => id.trim()))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('app_profiles_public')
    .select('id, role, first_name, last_name, middle_name, barangay_id')
    .in('id', uniqueIds);

  if (error || !data) return new Map();

  const authors = new Map<string, AnnouncementAuthor>();
  data.forEach((row) => {
    const id = String(row.id);
    const rank = authorRankById.get(id) ?? 4;
    authors.set(id, {
      id,
      firstName: String(row.first_name ?? '').trim() || 'Official',
      lastName: String(row.last_name ?? '').trim(),
      middleName: row.middle_name ? String(row.middle_name).trim() || null : null,
      roleLabel: roleLabelFromProfile(
        String(row.role ?? ''),
        row.barangay_id ? String(row.barangay_id) : null,
        rank,
      ),
    });
  });
  return authors;
}

/** Fetch ranked announcements for home/feed/official community. */
export async function fetchRankedAnnouncements(options?: {
  limit?: number;
}): Promise<{ announcements: AnnouncementRecord[]; error: string | null }> {
  const limit = options?.limit ?? 50;

  // Prefer engagement columns; fall back if the DB migration is not applied yet.
  const withCounts =
    'id, author_id, scope, barangay_id, title, body, is_pinned, author_rank, created_at, updated_at, upvote_count, comment_count';
  const withoutCounts =
    'id, author_id, scope, barangay_id, title, body, is_pinned, author_rank, created_at, updated_at';

  let query = supabase
    .from('announcements_ranked')
    .select(withCounts)
    .order('is_pinned', { ascending: false })
    .order('author_rank', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit);

  const primaryResult = await query;
  let data = primaryResult.data as Record<string, unknown>[] | null;
  let error = primaryResult.error;

  // Older announcements_ranked views omit upvote/comment counts until recreated.
  if (error && /upvote_count|comment_count/i.test(error.message)) {
    const fallbackResult = await supabase
      .from('announcements_ranked')
      .select(withoutCounts)
      .order('is_pinned', { ascending: false })
      .order('author_rank', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(limit);

    data = fallbackResult.data as Record<string, unknown>[] | null;
    error = fallbackResult.error;
  }

  if (error) {
    return { announcements: [], error: error.message };
  }

  const rows = data ?? [];
  const mediaByAnnouncement = await loadAnnouncementMedia(rows.map((row) => String(row.id)));
  const authorRankById = new Map(
    rows.map((row) => [String(row.author_id ?? ''), Number(row.author_rank ?? 4)]),
  );
  const authorsById = await loadAnnouncementAuthors(
    rows.map((row) => String(row.author_id ?? '')),
    authorRankById,
  );

  return {
    announcements: rows.map((row) => {
      const authorId = String(row.author_id ?? '');
      return mapAnnouncement(
        row,
        mediaByAnnouncement.get(String(row.id)) ?? [],
        authorsById.get(authorId) ?? null,
      );
    }),
    error: null,
  };
}

/** Upload official draft files, then let the Edge Function derive publish scope. */
export async function createOfficialAnnouncement(input: {
  description: string;
  media: AnnouncementDraftMedia[];
  isPinned: boolean;
}): Promise<{ announcementId: string | null; error: string | null }> {
  const description = input.description.trim();
  if (!description || description.length > MAX_BODY) return { announcementId: null, error: 'Enter a description (max 4000 characters).' };
  const mediaError = validateAnnouncementMedia(input.media);
  if (mediaError) return { announcementId: null, error: mediaError };
  const session = await getActiveSession();
  if (!session?.user?.id) return { announcementId: null, error: 'Sign in to publish announcements.' };
  const announcementId = randomUuid();
  const uploaded = [] as { id: string; type: 'photo' | 'video'; storagePath: string; durationSeconds: number | null }[];
  for (const item of input.media) {
    const result = await uploadAnnouncementMedia(session.user.id, announcementId, item);
    if (result.error || !result.storagePath) return { announcementId: null, error: result.error ?? 'Media upload failed.' };
    uploaded.push({ id: item.id, type: item.type, storagePath: result.storagePath, durationSeconds: item.durationSeconds });
  }
  const { data, error, response } = await supabase.functions.invoke(
    'create-official-announcement',
    {
      body: {
        announcementId,
        description,
        media: uploaded,
        isPinned: input.isPinned,
      },
    },
  );
  if (error) return { announcementId: null, error: await readEdgeFunctionErrorMessage(error, response, 'Could not publish this announcement. Please try again.') };
  const created = data && typeof data === 'object' && 'announcementId' in data ? String((data as { announcementId: unknown }).announcementId) : announcementId;
  return { announcementId: created, error: null };
}

export async function updateAnnouncement(
  id: string,
  patch: {
    title?: string;
    body?: string;
    isPinned?: boolean;
  },
): Promise<{ announcement: AnnouncementRecord | null; error: string | null }> {
  const updates: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title || title.length > MAX_TITLE) {
      return {
        announcement: null,
        error: 'Enter a title (max 120 characters).',
      };
    }
    updates.title = title;
  }
  if (patch.body !== undefined) {
    const body = patch.body.trim();
    if (!body || body.length > MAX_BODY) {
      return {
        announcement: null,
        error: 'Enter announcement body (max 4000 characters).',
      };
    }
    updates.body = body;
  }
  if (patch.isPinned !== undefined) {
    updates.is_pinned = patch.isPinned;
  }

  if (Object.keys(updates).length === 0) {
    return { announcement: null, error: 'Nothing to update.' };
  }

  const { data, error } = await supabase
    .from('announcements')
    .update(updates)
    .eq('id', id)
    .select(
      'id, author_id, scope, barangay_id, title, body, is_pinned, created_at, updated_at',
    )
    .maybeSingle();

  if (error) {
    return { announcement: null, error: error.message };
  }
  if (!data) {
    return {
      announcement: null,
      error: 'Announcement not found or not permitted.',
    };
  }

  return {
    announcement: mapAnnouncement({
      ...(data as Record<string, unknown>),
      author_rank: 4,
    }),
    error: null,
  };
}

/** Soft-hide a comment (moderation). RLS enforces barangay/municipality scope. */
export async function hideComment(
  commentId: string,
): Promise<{ error: string | null }> {
  const session = await getActiveSession();
  if (!session?.user?.id) {
    return { error: 'Sign in to moderate comments.' };
  }

  const { error } = await supabase
    .from('comments')
    .update({
      is_hidden: true,
      hidden_by: session.user.id,
      hidden_at: new Date().toISOString(),
    })
    .eq('id', commentId);

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

/** Restore a previously hidden comment. */
export async function unhideComment(
  commentId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('comments')
    .update({
      is_hidden: false,
      hidden_by: null,
      hidden_at: null,
    })
    .eq('id', commentId);

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}
