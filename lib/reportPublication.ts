import { isIncidentType, type IncidentType } from './incidentTypes';
import { clearSignedMediaUrlCache, resolveSignedMediaUrls } from './mediaUrlCache';
import { supabase } from './supabase';
import { mapPublicPhotoUrlPairs, type PublicPhotoUrlPair } from './publicPhotoPairs';
import { readEdgeFunctionErrorMessage } from './edgeFunctionErrors';

export type ReportPublicationPreferences = {
  showReporterName: boolean;
  showReporterAvatar: boolean;
  allowExactLocation: boolean;
  hasPublicPost: boolean;
  exactLocationApproved: boolean;
};

export type PublicResidentReport = {
  reportId: string;
  incidentCaseId: string;
  publicTitle: string;
  publicDescription: string;
  incidentType: IncidentType | null;
  publicTypeLabel: string;
  barangayName: string;
  publicLocationMode: 'barangay_only' | 'approximate_area' | 'exact_shared';
  approximateArea: { latitude: number; longitude: number } | null;
  exactLocation: { latitude: number; longitude: number } | null;
  reporterName: string | null;
  reporterAvatarPath: string | null;
  reporterAvatarUrl: string | null;
  createdAt: string;
  publicStatus: string;
  confirmedAt: string | null;
  latestPublicUpdateAt: string | null;
  latestPublicUpdate: string | null;
  publicSummary: string | null;
  publicCorrection: string | null;
  publicPhotos: PublicPhotoUrlPair[];
  photoError: string | null;
  engagement: { upvoteCount: number; commentCount: number; hasUpvoted: boolean };
};

export type PublicResidentReportUpdate = {
  occurredAt: string;
  entryType: string;
  publicText: string;
};

export type OfficialReportPublicationReview = {
  reportId: string;
  incidentCaseId: string | null;
  sourceTitle: string;
  sourceDescription: string;
  showReporterName: boolean;
  showReporterAvatar: boolean;
  allowExactLocation: boolean;
  isPublished: boolean;
  reporterNameApproved: boolean;
  reporterAvatarApproved: boolean;
  exactLocationApproved: boolean;
  isSensitive: boolean;
  canPublish: boolean;
  media: {
    mediaId: string;
    type: 'photo' | 'video';
    isPublicApproved: boolean;
    safeCopyVerified: boolean;
    safeDisplayPath: string | null;
    safeThumbnailPath: string | null;
    safeDisplayUrl: string | null;
    safeThumbnailUrl: string | null;
    privateDisplayUrl: string | null;
    privateThumbnailUrl: string | null;
  }[];
  photoError: string | null;
  reporterName: string | null;
  reporterAvatarPath: string | null;
  reporterAvatarUrl: string | null;
  sourceLatitude: number | null;
  sourceLongitude: number | null;
};

const publicationChangeListeners = new Set<() => void>();

/** Lets open public views drop stale disclosure after an owner or official edit. */
export function subscribeToReportPublicationChanges(listener: () => void): () => void {
  publicationChangeListeners.add(listener);
  return () => publicationChangeListeners.delete(listener);
}

export function notifyReportPublicationChanged(): void {
  clearSignedMediaUrlCache();
  publicationChangeListeners.forEach((listener) => listener());
}

export async function processPublicReportPhoto(reportId: string, mediaId: string): Promise<{ error: string | null }> {
  try {
    const { error, response } = await supabase.functions.invoke('process-public-report-photo', {
      body: { reportId, mediaId },
    });
    if (!error) return { error: null };
    return { error: await readEdgeFunctionErrorMessage(error, response, 'Could not prepare this photo for public review.') };
  } catch {
    return { error: 'Could not prepare this photo for public review. Check your connection and try again.' };
  }
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mapPublicReport(row: Record<string, unknown>): PublicResidentReport {
  const mode = row.public_location_mode;
  const publicLocationMode = mode === 'exact_shared' ? 'exact_shared'
    : mode === 'approximate_area' ? 'approximate_area' : 'barangay_only';
  const approximateArea = publicLocationMode === 'approximate_area'
      && row.approx_latitude != null && row.approx_longitude != null
    ? { latitude: Number(row.approx_latitude), longitude: Number(row.approx_longitude) } : null;
  const exactLocation = publicLocationMode === 'exact_shared'
      && row.exact_latitude != null && row.exact_longitude != null
    ? { latitude: Number(row.exact_latitude), longitude: Number(row.exact_longitude) } : null;

  return {
    reportId: String(row.report_id),
    incidentCaseId: String(row.incident_case_id),
    publicTitle: String(row.public_title ?? 'Resident report'),
    publicDescription: String(row.public_description ?? ''),
    incidentType: isIncidentType(row.incident_type) ? row.incident_type : null,
    publicTypeLabel: String(row.public_type_label ?? 'Incident'),
    barangayName: String(row.barangay_name ?? 'Municipality'),
    publicLocationMode, approximateArea, exactLocation,
    reporterName: nullableText(row.reporter_name),
    reporterAvatarPath: nullableText(row.reporter_avatar_path),
    reporterAvatarUrl: null,
    createdAt: String(row.created_at ?? ''),
    publicStatus: String(row.public_status ?? 'confirmed'),
    confirmedAt: nullableText(row.confirmed_at),
    latestPublicUpdateAt: nullableText(row.latest_public_update_at),
    latestPublicUpdate: nullableText(row.latest_public_update),
    publicSummary: nullableText(row.public_summary),
    publicCorrection: nullableText(row.public_correction),
    publicPhotos: [],
    photoError: null,
    engagement: {
      upvoteCount: Number(row.support_count ?? 0),
      commentCount: Number(row.comment_count ?? 0),
      hasUpvoted: row.has_supported === true,
    },
  };
}

function mapPreferences(row: Record<string, unknown>): ReportPublicationPreferences {
  return {
    showReporterName: row.show_reporter_name === true,
    showReporterAvatar: row.show_reporter_avatar === true,
    allowExactLocation: row.allow_exact_location === true,
    hasPublicPost: row.has_public_post === true,
    exactLocationApproved: row.exact_location_approved === true,
  };
}

async function mapPublicReportRows(rows: Record<string, unknown>[]): Promise<PublicResidentReport[]> {
  const photoPaths = rows.flatMap((row) => [
    ...(Array.isArray(row.public_photo_display_paths) ? row.public_photo_display_paths : []),
    ...(Array.isArray(row.public_photo_thumbnail_paths) ? row.public_photo_thumbnail_paths : []),
  ]).filter((path): path is string => typeof path === 'string');
  const avatarPaths = rows.map((row) => nullableText(row.reporter_avatar_path))
    .filter((path): path is string => Boolean(path));
  const [signedPhotos, signedAvatars] = await Promise.all([
    photoPaths.length ? resolveSignedMediaUrls({
      bucket: 'report-media', storagePaths: [...new Set(photoPaths)], variant: 'public-photo',
    }) : Promise.resolve({ urls: new Map<string, string>(), error: null }),
    avatarPaths.length ? resolveSignedMediaUrls({
      bucket: 'profile-photos', storagePaths: [...new Set(avatarPaths)], variant: 'thumbnail',
    }) : Promise.resolve({ urls: new Map<string, string>(), error: null }),
  ]);

  return rows.map((row) => {
    const report = mapPublicReport(row);
    report.publicPhotos = mapPublicPhotoUrlPairs(
      row.public_photo_display_paths,
      row.public_photo_thumbnail_paths,
      signedPhotos.urls,
    );
    report.photoError = signedPhotos.error;
    report.reporterAvatarUrl = report.reporterAvatarPath
      ? signedAvatars.urls.get(report.reporterAvatarPath) ?? null
      : null;
    return report;
  });
}

export async function mapPublicResidentReportRecord(row: Record<string, unknown>): Promise<PublicResidentReport> {
  const [report] = await mapPublicReportRows([row]);
  return report;
}

export async function getReportPublicationPreferences(reportId: string): Promise<{
  preferences: ReportPublicationPreferences | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc('get_report_publication_preferences', { p_report_id: reportId });
    if (error) return { preferences: null, error: error.message };
    const row = (data?.[0] ?? null) as Record<string, unknown> | null;
    return { preferences: row ? mapPreferences(row) : null, error: null };
  } catch {
    return { preferences: null, error: 'Could not load your sharing choices. Try again.' };
  }
}

export async function setReportPublicationPreferences(reportId: string, input: Pick<ReportPublicationPreferences,
  'showReporterName' | 'showReporterAvatar' | 'allowExactLocation'>): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc('set_report_publication_preferences', {
      p_report_id: reportId, p_show_reporter_name: input.showReporterName,
      p_show_reporter_avatar: input.showReporterAvatar, p_allow_exact_location: input.allowExactLocation,
    });
    if (!error) notifyReportPublicationChanged();
    return { error: error?.message ?? null };
  } catch {
    return { error: 'Could not save your sharing choices. Check your connection and try again.' };
  }
}

export async function fetchPublicResidentReports(options?: { barangayId?: string | null; limit?: number; offset?: number }): Promise<{
  reports: PublicResidentReport[]; error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc('list_public_reports', {
      p_barangay_id: options?.barangayId ?? null,
      p_limit: Math.max(1, Math.min(options?.limit ?? 50, 100)),
      p_offset: Math.max(0, options?.offset ?? 0),
    });
    if (error) return { reports: [], error: error.message };
    const rows = (data ?? []) as Record<string, unknown>[];
    return { reports: await mapPublicReportRows(rows), error: null };
  } catch {
    return { reports: [], error: 'Could not load public reports. Check your connection and try again.' };
  }
}

export async function fetchPublicResidentReport(reportId: string): Promise<{
  report: PublicResidentReport | null; updates: PublicResidentReportUpdate[]; error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc('get_public_report', { p_report_id: reportId });
    if (error || !data?.report) return { report: null, updates: [], error: error?.message ?? 'This report is no longer publicly available.' };
    const updates = ((data.updates ?? []) as Record<string, unknown>[])
      .filter((row) => nullableText(row.public_text))
      .map((row) => ({ occurredAt: String(row.occurred_at), entryType: String(row.entry_type), publicText: String(row.public_text) }));
    const [report] = await mapPublicReportRows([data.report as Record<string, unknown>]);
    return { report, updates, error: null };
  } catch {
    return { report: null, updates: [], error: 'Could not load this report. Check your connection and try again.' };
  }
}

export async function getOfficialReportPublicationReview(reportId: string): Promise<{
  review: OfficialReportPublicationReview | null; error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc('get_report_publication_review', { p_report_id: reportId });
    if (error) return { review: null, error: error.message };
    const row = (data?.[0] ?? null) as Record<string, unknown> | null;
    if (!row) return { review: null, error: 'This report is no longer available for publication review.' };
    const mediaRows = Array.isArray(row.media) ? row.media as Record<string, unknown>[] : [];
    const safePaths = mediaRows.flatMap((media) => [media.safeDisplayPath, media.safeThumbnailPath])
      .filter((path): path is string => typeof path === 'string' && path.length > 0);
    const signedSafePhotos = safePaths.length ? await resolveSignedMediaUrls({
      bucket: 'report-media', storagePaths: [...new Set(safePaths)], variant: 'detail',
    }) : { urls: new Map<string, string>(), error: null };
    // RLS scopes this private derivative lookup to the same reviewed report; raw originals are never requested.
    const reviewedMediaIds = mediaRows.flatMap((media) => typeof media.mediaId === 'string' ? [media.mediaId] : []);
    const privateMediaRows = reviewedMediaIds.length
      ? await supabase.from('report_media').select('id,report_id,display_storage_path,thumbnail_storage_path')
        .eq('report_id', String(row.report_id)).in('id', reviewedMediaIds)
      : { data: [], error: null };
    const privatePaths = (privateMediaRows.data ?? []).flatMap((media) =>
      String(media.report_id) === String(row.report_id)
        ? [media.display_storage_path, media.thumbnail_storage_path]
          .filter((path): path is string => typeof path === 'string' && path.length > 0)
        : []
    );
    const signedPrivatePhotos = privatePaths.length ? await resolveSignedMediaUrls({
      bucket: 'report-media', storagePaths: [...new Set(privatePaths)], variant: 'detail',
    }) : { urls: new Map<string, string>(), error: null };
    const privateMediaById = new Map((privateMediaRows.data ?? [])
      .filter((media) => String(media.report_id) === String(row.report_id))
      .map((media) => [String(media.id), media]));
    const photoError = privateMediaRows.error || signedPrivatePhotos.error || signedSafePhotos.error
      ? 'Some photo previews could not be loaded. Refresh before approving any photo.'
      : null;
    const reporterAvatarPath = nullableText(row.reporter_avatar_path);
    const avatarResult = reporterAvatarPath ? await resolveSignedMediaUrls({
      bucket: 'profile-photos', storagePaths: [reporterAvatarPath], variant: 'thumbnail',
    }) : null;
    return { review: {
      reportId: String(row.report_id), incidentCaseId: nullableText(row.incident_case_id),
      sourceTitle: String(row.source_title ?? ''), sourceDescription: String(row.source_description ?? ''),
      showReporterName: row.show_reporter_name === true, showReporterAvatar: row.show_reporter_avatar === true,
      allowExactLocation: row.allow_exact_location === true, isPublished: row.is_published === true,
      reporterNameApproved: row.reporter_name_approved === true,
      reporterAvatarApproved: row.reporter_avatar_approved === true,
      exactLocationApproved: row.exact_location_approved === true,
      isSensitive: row.is_sensitive === true,
      canPublish: row.can_publish === true,
      media: mediaRows.flatMap((media) => {
        if (typeof media.mediaId !== 'string' || (media.type !== 'photo' && media.type !== 'video')) return [];
        return [{
          mediaId: media.mediaId,
          type: media.type,
          isPublicApproved: media.isPublicApproved === true,
          safeCopyVerified: media.safeCopyVerified === true,
          safeDisplayPath: nullableText(media.safeDisplayPath),
          safeThumbnailPath: nullableText(media.safeThumbnailPath),
          safeDisplayUrl: nullableText(media.safeDisplayPath)
            ? signedSafePhotos.urls.get(String(media.safeDisplayPath)) ?? null : null,
          safeThumbnailUrl: nullableText(media.safeThumbnailPath)
            ? signedSafePhotos.urls.get(String(media.safeThumbnailPath)) ?? null : null,
          privateDisplayUrl: (() => {
            const privateMedia = privateMediaById.get(String(media.mediaId));
            const path = nullableText(privateMedia?.display_storage_path);
            return path ? signedPrivatePhotos.urls.get(path) ?? null : null;
          })(),
          privateThumbnailUrl: (() => {
            const privateMedia = privateMediaById.get(String(media.mediaId));
            const path = nullableText(privateMedia?.thumbnail_storage_path);
            return path ? signedPrivatePhotos.urls.get(path) ?? null : null;
          })(),
        }];
      }),
      photoError,
      reporterName: nullableText(row.reporter_name),
      reporterAvatarPath,
      reporterAvatarUrl: reporterAvatarPath ? avatarResult?.urls.get(reporterAvatarPath) ?? null : null,
      sourceLatitude: row.source_latitude == null ? null : Number(row.source_latitude),
      sourceLongitude: row.source_longitude == null ? null : Number(row.source_longitude),
    }, error: null };
  } catch {
    return { review: null, error: 'Could not load the publication review. Try again.' };
  }
}

export async function setPublicResidentReport(input: {
  reportId: string; publish: boolean;
  approveReporterName: boolean; approveReporterAvatar: boolean; approveExactLocation: boolean;
}): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc('set_report_public_post', {
      p_report_id: input.reportId, p_public_title: null, p_public_description: null,
      p_publish: input.publish, p_approve_reporter_name: input.approveReporterName,
      p_approve_reporter_avatar: input.approveReporterAvatar,
      p_approve_exact_location: input.approveExactLocation,
    });
    if (!error) notifyReportPublicationChanged();
    return { error: error?.message ?? null };
  } catch {
    return { error: 'Could not save this public report. Try again.' };
  }
}
