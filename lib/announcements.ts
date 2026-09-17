// lib/announcements.ts
// Ranked announcement queries + scoped create/update helpers.
// Ordering: author_rank asc, created_at desc.

import { supabase } from './supabase';
import { getActiveSession } from './auth';
import { readEdgeFunctionErrorMessage } from './edgeFunctionErrors';
import { randomUuid } from './reportMedia';
import { deletePreparedAnnouncementMedia, uploadAnnouncementMedia, validateAnnouncementMedia, type AnnouncementDraftMedia } from './announcementMedia';
import { normalizeName } from './validation/name';
import { isProfilePhotoSchemaMissing } from './schemaCompatibility';
import { resolveSignedMediaUrls } from './mediaUrlCache';

export type AnnouncementScope = 'barangay' | 'municipal';

export type AnnouncementAuthor = {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  avatarPath: string | null;
  /** Display label beside the author name (e.g. MDRRMO, Mayor, BDRRMO). */
  roleLabel: string;
};

export type AnnouncementRecord = {
  id: string;
  authorId: string;
  author: AnnouncementAuthor;
  scope: AnnouncementScope;
  barangayId: string | null;
  barangayName: string | null;
  title: string;
  body: string;
  authorRank: number;
  createdAt: string;
  updatedAt: string;
  media: AnnouncementMediaAttachment[];
  mediaCount: number;
  mediaDetailLoaded: boolean;
  upvoteCount: number;
  commentCount: number;
};

export type AnnouncementMediaAttachment = {
  id: string;
  type: 'photo' | 'video';
  url: string;
  thumbnailUrl?: string | null;
  storagePath?: string | null;
  thumbnailStoragePath?: string | null;
  displayStoragePath?: string | null;
  durationSeconds: number | null;
  width?: number | null;
  height?: number | null;
  detailUrlResolved?: boolean;
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
    .map((part) => normalizeName(part!));
  return parts.join(' ') || 'Official';
}

/** Use the posting office's scope, never the viewer's barangay, for attribution. */
export function formatAnnouncementOfficeLabel(
  announcement: AnnouncementRecord,
  municipality?: string,
): string {
  if (announcement.author.roleLabel === 'BDRRMO') {
    const barangayName = announcement.barangayName?.trim();
    return barangayName ? `Brgy. ${barangayName}` : 'BDRRMO';
  }
  if (announcement.author.roleLabel === 'MDRRMO' && municipality?.trim()) {
    return `MDRRMO ${municipality.trim()}`;
  }
  return announcement.author.roleLabel;
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
    avatarPath: null,
    roleLabel: roleLabelFromProfile('', null, authorRank),
  };
}

function mapAnnouncement(
  row: Record<string, unknown>,
  media: AnnouncementMediaAttachment[] = [],
  author?: AnnouncementAuthor | null,
  mediaCount = media.length,
  mediaDetailLoaded = false,
  barangayName: string | null = null,
): AnnouncementRecord {
  const authorId = String(row.author_id ?? '');
  const authorRank = Number(row.author_rank ?? 4);
  return {
    id: String(row.id),
    authorId,
    author: author ?? fallbackAuthor(authorId, authorRank),
    scope: asScope(row.scope),
    barangayId: row.barangay_id ? String(row.barangay_id) : null,
    barangayName,
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    authorRank,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    media,
    mediaCount,
    mediaDetailLoaded,
    upvoteCount: Number(row.upvote_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
  };
}

async function loadAnnouncementBarangayNames(
  barangayIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(barangayIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('barangays')
    .select('id, name')
    .in('id', uniqueIds);
  if (error) return new Map();

  return new Map(
    (data ?? []).map((row) => [String(row.id), String(row.name ?? '').trim()]),
  );
}

async function loadAnnouncementMedia(
  announcementIds: string[],
  detail = false,
): Promise<{
  mediaByAnnouncement: Map<string, AnnouncementMediaAttachment[]>;
  countByAnnouncement: Map<string, number>;
}> {
  if (announcementIds.length === 0) {
    return {
      mediaByAnnouncement: new Map(),
      countByAnnouncement: new Map(),
    };
  }
  let result = await supabase.from('announcement_media').select('id, announcement_id, type, storage_path, thumbnail_storage_path, display_storage_path, duration_seconds, width, height, position').in('announcement_id', announcementIds).order('position', { ascending: true });
  if (result.error && /thumbnail_storage_path|display_storage_path|width|height/i.test(result.error.message)) {
    result = await supabase.from('announcement_media').select('id, announcement_id, type, storage_path, duration_seconds, position').in('announcement_id', announcementIds).order('position', { ascending: true }) as unknown as typeof result;
  }
  const rows = result.data ?? [];
  const countByAnnouncement = new Map<string, number>();
  rows.forEach((row) => {
    const id = String(row.announcement_id);
    countByAnnouncement.set(id, (countByAnnouncement.get(id) ?? 0) + 1);
  });
  const selectedRows = detail
    ? rows
    : rows.filter((row, index) =>
        rows.findIndex((candidate) => candidate.announcement_id === row.announcement_id) === index,
      );
  const thumbnailPaths = selectedRows.map((row) => String(row.thumbnail_storage_path ?? '')).filter(Boolean);
  const detailPaths = detail
    ? selectedRows.map((row) => row.type === 'video'
        ? String(row.storage_path)
        : String(row.display_storage_path ?? row.storage_path))
    : [];
  const [thumbnailResult, detailResult] = await Promise.all([
    resolveSignedMediaUrls({ bucket: 'announcement-media', storagePaths: thumbnailPaths, variant: 'thumbnail' }),
    resolveSignedMediaUrls({ bucket: 'announcement-media', storagePaths: detailPaths, variant: 'detail' }),
  ]);
  // Only sign full-size originals when a photo has no usable thumbnail URL.
  // With the derivative-aware policy deployed, this list stays empty.
  const photoFallbackPaths = selectedRows
    .filter((row) => {
      if (row.type === 'video') return false;
      const thumbnailPath = String(row.thumbnail_storage_path ?? '');
      return !thumbnailPath || !thumbnailResult.urls.has(thumbnailPath);
    })
    .map((row) => String(row.storage_path ?? ''))
    .filter(Boolean);
  const photoOriginalResult = await resolveSignedMediaUrls({
    bucket: 'announcement-media',
    storagePaths: photoFallbackPaths,
    variant: 'preview-fallback',
  });
  const byAnnouncement = new Map<string, AnnouncementMediaAttachment[]>();
  selectedRows.forEach((row) => {
    const storagePath = String(row.storage_path);
    const thumbnailStoragePath = row.thumbnail_storage_path ? String(row.thumbnail_storage_path) : null;
    const displayStoragePath = row.display_storage_path ? String(row.display_storage_path) : null;
    const detailPath = row.type === 'video' ? storagePath : displayStoragePath ?? storagePath;
    // Legacy policies may allow the original but not a newer derivative path.
    // Keep photo cards usable while the derivative-aware policy is rolled out.
    const originalPreviewUrl = row.type === 'video'
      ? null
      : photoOriginalResult.urls.get(storagePath) ?? null;
    const thumbnailUrl = thumbnailStoragePath
      ? thumbnailResult.urls.get(thumbnailStoragePath) ?? originalPreviewUrl
      : originalPreviewUrl;
    const url = detail ? detailResult.urls.get(detailPath) ?? '' : thumbnailUrl ?? '';
    const key = String(row.announcement_id);
    const current = byAnnouncement.get(key) ?? [];
    current.push({
      id: String(row.id),
      type: row.type === 'video' ? 'video' : 'photo',
      url,
      thumbnailUrl,
      storagePath,
      thumbnailStoragePath,
      displayStoragePath,
      durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
      width: row.width == null ? null : Number(row.width),
      height: row.height == null ? null : Number(row.height),
      detailUrlResolved: detail,
    });
    byAnnouncement.set(key, current);
  });
  return { mediaByAnnouncement: byAnnouncement, countByAnnouncement };
}

/** Batch-load author identity for announcement cards (name + role label). */
async function loadAnnouncementAuthors(
  authorIds: string[],
  authorRankById: Map<string, number>,
): Promise<Map<string, AnnouncementAuthor>> {
  const uniqueIds = [...new Set(authorIds.filter((id) => id.trim()))];
  if (uniqueIds.length === 0) return new Map();

  const profileResult = await supabase
    .from('app_profiles_public')
    .select('id, role, first_name, last_name, middle_name, barangay_id, avatar_path')
    .in('id', uniqueIds);

  let profileRows = profileResult.data as unknown as Record<string, unknown>[] | null;
  let profileError = profileResult.error;
  if (profileResult.error && isProfilePhotoSchemaMissing(profileResult.error.message)) {
    const legacyResult = await supabase
      .from('app_profiles_public')
      .select('id, role, first_name, last_name, middle_name, barangay_id')
      .in('id', uniqueIds);
    profileRows = legacyResult.data as unknown as Record<string, unknown>[] | null;
    profileError = legacyResult.error;
  }

  if (profileError || !profileRows) return new Map();

  const authors = new Map<string, AnnouncementAuthor>();
  profileRows.forEach((row) => {
    const id = String(row.id);
    const rank = authorRankById.get(id) ?? 4;
    authors.set(id, {
      id,
      firstName: String(row.first_name ?? '').trim() || 'Official',
      lastName: String(row.last_name ?? '').trim(),
      middleName: row.middle_name ? String(row.middle_name).trim() || null : null,
      avatarPath: row.avatar_path ? String(row.avatar_path) : null,
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
  offset?: number;
}): Promise<{ announcements: AnnouncementRecord[]; error: string | null }> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  // Prefer engagement columns; fall back if the DB migration is not applied yet.
  const withCounts =
    'id, author_id, scope, barangay_id, title, body, author_rank, created_at, updated_at, upvote_count, comment_count';
  const withoutCounts =
    'id, author_id, scope, barangay_id, title, body, author_rank, created_at, updated_at';

  let query = supabase
    .from('announcements_ranked')
    .select(withCounts)
    .order('author_rank', { ascending: true })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const primaryResult = await query;
  let data = primaryResult.data as Record<string, unknown>[] | null;
  let error = primaryResult.error;

  // Older announcements_ranked views omit upvote/comment counts until recreated.
  if (error && /upvote_count|comment_count/i.test(error.message)) {
    const fallbackResult = await supabase
      .from('announcements_ranked')
      .select(withoutCounts)
      .order('author_rank', { ascending: true })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    data = fallbackResult.data as Record<string, unknown>[] | null;
    error = fallbackResult.error;
  }

  if (error) {
    return { announcements: [], error: error.message };
  }

  const rows = data ?? [];
  const authorRankById = new Map(
    rows.map((row) => [String(row.author_id ?? ''), Number(row.author_rank ?? 4)]),
  );
  const [mediaResult, authorsById, barangayNamesById] = await Promise.all([
    loadAnnouncementMedia(rows.map((row) => String(row.id))),
    loadAnnouncementAuthors(
      rows.map((row) => String(row.author_id ?? '')),
      authorRankById,
    ),
    loadAnnouncementBarangayNames(
      rows.map((row) => (row.barangay_id ? String(row.barangay_id) : '')),
    ),
  ]);

  return {
    announcements: rows.map((row) => {
      const authorId = String(row.author_id ?? '');
      return mapAnnouncement(
        row,
        mediaResult.mediaByAnnouncement.get(String(row.id)) ?? [],
        authorsById.get(authorId) ?? null,
        mediaResult.countByAnnouncement.get(String(row.id)) ?? 0,
        false,
        row.barangay_id
          ? barangayNamesById.get(String(row.barangay_id)) ?? null
          : null,
      );
    }),
    error: null,
  };
}

/** Load and sign every attachment only for one opened announcement. */
export async function fetchAnnouncementById(
  announcementId: string,
): Promise<{ announcement: AnnouncementRecord | null; error: string | null }> {
  const { data, error } = await supabase
    .from('announcements_ranked')
    .select('id, author_id, scope, barangay_id, title, body, author_rank, created_at, updated_at, upvote_count, comment_count')
    .eq('id', announcementId)
    .maybeSingle();
  if (error) return { announcement: null, error: error.message };
  if (!data) return { announcement: null, error: 'This announcement is no longer available.' };

  const row = data as Record<string, unknown>;
  const authorId = String(row.author_id ?? '');
  const authorRank = Number(row.author_rank ?? 4);
  const [mediaResult, authors, barangayNamesById] = await Promise.all([
    loadAnnouncementMedia([announcementId], true),
    loadAnnouncementAuthors([authorId], new Map([[authorId, authorRank]])),
    loadAnnouncementBarangayNames([
      row.barangay_id ? String(row.barangay_id) : '',
    ]),
  ]);
  return {
    announcement: mapAnnouncement(
      row,
      mediaResult.mediaByAnnouncement.get(announcementId) ?? [],
      authors.get(authorId) ?? null,
      mediaResult.countByAnnouncement.get(announcementId) ?? 0,
      true,
      row.barangay_id
        ? barangayNamesById.get(String(row.barangay_id)) ?? null
        : null,
    ),
    error: null,
  };
}

/** Upload official draft files, then let the Edge Function derive publish scope. */
export async function createOfficialAnnouncement(input: {
  description: string;
  media: AnnouncementDraftMedia[];
}): Promise<{ announcementId: string | null; error: string | null }> {
  const description = input.description.trim();
  if (!description || description.length > MAX_BODY) return { announcementId: null, error: 'Enter a description (max 4000 characters).' };
  const mediaError = validateAnnouncementMedia(input.media);
  if (mediaError) return { announcementId: null, error: mediaError };
  const session = await getActiveSession();
  if (!session?.user?.id) return { announcementId: null, error: 'Sign in to publish announcements.' };
  const announcementId = randomUuid();
  const uploaded = [] as {
    id: string;
    type: 'photo' | 'video';
    storagePath: string;
    displayStoragePath: string | null;
    thumbnailStoragePath: string;
    durationSeconds: number | null;
    fileSizeBytes: number;
    width: number | null;
    height: number | null;
  }[];
  for (const item of input.media) {
    const result = await uploadAnnouncementMedia(session.user.id, announcementId, item);
    if (result.error || !result.uploaded) return { announcementId: null, error: result.error ?? 'Media upload failed.' };
    uploaded.push({
      id: item.id,
      type: item.type,
      ...result.uploaded,
      durationSeconds: item.durationSeconds,
      fileSizeBytes: item.fileSizeBytes,
      width: item.width,
      height: item.height,
    });
  }
  const { data, error, response } = await supabase.functions.invoke(
    'create-official-announcement',
    {
      body: {
        announcementId,
        description,
        media: uploaded,
      },
    },
  );
  if (error) return { announcementId: null, error: await readEdgeFunctionErrorMessage(error, response, 'Could not publish this announcement. Please try again.') };
  const created = data && typeof data === 'object' && 'announcementId' in data ? String((data as { announcementId: unknown }).announcementId) : announcementId;
  input.media.forEach(deletePreparedAnnouncementMedia);
  return { announcementId: created, error: null };
}

export async function updateAnnouncement(
  id: string,
  patch: {
    title?: string;
    body?: string;
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
  if (Object.keys(updates).length === 0) {
    return { announcement: null, error: 'Nothing to update.' };
  }

  const { data, error } = await supabase
    .from('announcements')
    .update(updates)
    .eq('id', id)
    .select(
      'id, author_id, scope, barangay_id, title, body, created_at, updated_at',
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
