import { supabase } from './supabase';
import { formatNameWithMiddleInitial, normalizeName } from './validation/name';
import { getActiveSession } from './auth';
import {
  CapturedMedia,
  randomUuid,
  validateCapturedMedia,
} from './reportMedia';
import { enqueueReport, getPendingReports, type QueuedMedia } from './reportQueue';
import { flushReportQueue, notifyReportQueueChange } from './reportQueueFlush';
import type { GpsPosition } from './location';
import { fetchMyProfile } from './profile';
import { isIncidentType, type IncidentType } from './incidentTypes';
import { isProfilePhotoSchemaMissing } from './schemaCompatibility';
import { resolveSignedMediaUrls } from './mediaUrlCache';
import { colors } from '../styles/theme';

export type ReportMediaAttachment = {
  id: string;
  type: 'photo' | 'video';
  /** Detail URL: display image for photos, original file for videos. */
  url: string;
  /** Small list/card image. Null gives legacy videos a lightweight placeholder. */
  thumbnailUrl?: string | null;
  storagePath?: string | null;
  thumbnailStoragePath?: string | null;
  displayStoragePath?: string | null;
  durationSeconds: number | null;
  width?: number | null;
  height?: number | null;
  bucket?: 'report-media' | 'announcement-media';
  detailUrlResolved?: boolean;
};

export type MapReportReporter = {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  avatarPath: string | null;
};

export type MapReportMarker = {
  id: string;
  title: string;
  description: string;
  /** Null for legacy reports created before incident classification. */
  incidentType: IncidentType | null;
  incidentTypeOther: string | null;
  status: string;
  latitude: number;
  longitude: number;
  addressText: string | null;
  barangay_id: string | null;
  created_at: string;
  /** Creation or the newest qualifying status/official-comment activity. */
  latestActivityAt?: string;
  /** Most recent status transition, excluding comments and the initial report creation. */
  latestStatusUpdateAt?: string;
  reporter: MapReportReporter;
  media: ReportMediaAttachment[];
  /** Populated when private attachment rows or signed URLs cannot be read. */
  mediaError?: string | null;
  /** True only after the single-report detail query resolved full media. */
  mediaDetailLoaded?: boolean;
  // Denormalized engagement totals from public.reports (trigger-maintained).
  upvoteCount: number;
  commentCount: number;
  /** True while the report is still only in the local offline queue. */
  isPending?: boolean;
};

export type ReportStatusPresentation = {
  label: string;
  color: string;
  backgroundColor: string;
  activeStep: number;
  nextAction: string;
};

/** Shared resident-facing colors and copy for each report workflow status. */
export function getReportStatusPresentation(status: string): ReportStatusPresentation {
  const normalizedStatus = status.trim().toLocaleLowerCase();

  if (normalizedStatus === 'resolved') {
    return {
      label: 'Resolved',
      color: '#426F65',
      backgroundColor: '#E7F3EF',
      activeStep: 3,
      nextAction: 'Report closed by the response team',
    };
  }

  if (normalizedStatus === 'escalated') {
    return {
      label: 'Municipal review',
      color: colors.escalated,
      backgroundColor: '#FFF0E8',
      activeStep: 2,
      nextAction: 'Municipal response team assessment',
    };
  }

  if (normalizedStatus === 'verified') {
    return {
      label: 'Confirmed',
      color: '#356E66',
      backgroundColor: '#E9F5F1',
      activeStep: 1,
      nextAction: 'Barangay response team assessment',
    };
  }

  return {
    label: 'Under review',
    color: '#B33443',
    backgroundColor: '#FFF0F1',
    activeStep: 0,
    nextAction: 'Barangay verification',
  };
}

export type SubmitReportInput = {
  title: string;
  description: string;
  position: GpsPosition;
  /** Immutable device GPS fix captured before the incident pin can move. */
  devicePosition: GpsPosition;
  incidentType: IncidentType;
  incidentTypeOther?: string;
  /** Reverse-geocoded barangay label for the pin. */
  addressText?: string;
  /** Optional user-provided location detail (landmark, floor, etc.). */
  locationNote?: string;
  /** Resident-confirmed barangay used for BDRRMO routing. */
  barangayId: string;
  media: CapturedMedia[];
};

const REPORT_MEDIA_BUCKET = 'report-media';
const REPORT_PAGE_SIZE = 200;
const REPORT_MEDIA_BATCH_SIZE = 100;
const REPORT_ACTIVITY_BATCH_SIZE = 100;
const REPORT_ACTIVITY_PAGE_SIZE = 1_000;
const REPORTS_MAP_LEGACY_SELECT =
  'id, title, description, incident_type, incident_type_other, status, latitude, longitude, barangay_id, created_at, address_text, upvote_count, comment_count, reporter_id, reporter_first_name, reporter_last_name, reporter_middle_name';
const REPORTS_MAP_SELECT = `${REPORTS_MAP_LEGACY_SELECT}, reporter_avatar_path`;

function chunkItems<Item>(items: Item[], batchSize: number): Item[][] {
  const batches: Item[][] = [];
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += batchSize) {
    batches.push(items.slice(itemIndex, itemIndex + batchSize));
  }
  return batches;
}

type ReportActivityRow = {
  report_id: unknown;
  created_at: unknown;
  from_status?: unknown;
};

function recordNewestActivity(
  latestActivityByReport: Map<string, string>,
  rows: ReportActivityRow[],
): void {
  for (const row of rows) {
    const reportId = String(row.report_id ?? '');
    const createdAt = String(row.created_at ?? '');
    const createdAtTime = Date.parse(createdAt);
    if (!reportId || !Number.isFinite(createdAtTime)) continue;

    const currentTime = Date.parse(latestActivityByReport.get(reportId) ?? '');
    if (!Number.isFinite(currentTime) || createdAtTime > currentTime) {
      latestActivityByReport.set(reportId, createdAt);
    }
  }
}

export async function fetchLatestReportActivity(reportIds: string[]): Promise<{
  latestActivityByReport: Map<string, string>;
  latestStatusUpdateByReport: Map<string, string>;
  error: string | null;
}> {
  const latestActivityByReport = new Map<string, string>();
  const latestStatusUpdateByReport = new Map<string, string>();

  const fetchStatusChanges = async () => {
    for (const reportIdBatch of chunkItems(reportIds, REPORT_ACTIVITY_BATCH_SIZE)) {
      let pageStart = 0;
      while (true) {
        const result = await supabase
          .from('report_status_history')
          .select('report_id, created_at, from_status')
          .in('report_id', reportIdBatch)
          .eq('event_type', 'status_change')
          .order('created_at', { ascending: false })
          .range(pageStart, pageStart + REPORT_ACTIVITY_PAGE_SIZE - 1);
        if (result.error) return result.error.message;

        const rows = (result.data ?? []) as ReportActivityRow[];
        if (rows.length === 0) break;
        recordNewestActivity(latestActivityByReport, rows);
        // The initial history row has no previous status, so it is not an update.
        recordNewestActivity(
          latestStatusUpdateByReport,
          rows.filter((row) => row.from_status != null),
        );
        pageStart += rows.length;
      }
    }
    return null;
  };

  const fetchOfficialComments = async () => {
    for (const reportIdBatch of chunkItems(reportIds, REPORT_ACTIVITY_BATCH_SIZE)) {
      let pageStart = 0;
      while (true) {
        const result = await supabase
          .from('report_comments')
          .select('report_id, created_at')
          .in('report_id', reportIdBatch)
          .in('author_role', ['officer', 'mayor'])
          .eq('is_hidden', false)
          .order('created_at', { ascending: false })
          .range(pageStart, pageStart + REPORT_ACTIVITY_PAGE_SIZE - 1);
        if (result.error) return result.error.message;

        const rows = (result.data ?? []) as ReportActivityRow[];
        if (rows.length === 0) break;
        recordNewestActivity(latestActivityByReport, rows);
        pageStart += rows.length;
      }
    }
    return null;
  };

  // BDRRMO and MDRRMO accounts both use the officer role; mayor is separate.
  const [statusError, commentError] = await Promise.all([
    fetchStatusChanges(),
    fetchOfficialComments(),
  ]);

  return {
    latestActivityByReport,
    latestStatusUpdateByReport,
    error: statusError ?? commentError,
  };
}

/** Build a display name; middle name is abbreviated to its initial only. */
export function formatReporterName(reporter: MapReportReporter): string {
  return (
    formatNameWithMiddleInitial(reporter.firstName, reporter.middleName, reporter.lastName) ||
    'Resident'
  );
}

/** First initial for avatar fallback (no profile photo stored yet). */
export function reporterInitial(reporter: MapReportReporter): string {
  return normalizeName(reporter.firstName).charAt(0).toLocaleUpperCase() || 'R';
}

/** Human-readable location label for a map report. */
export function formatReportLocation(report: MapReportMarker): string {
  if (report.addressText?.trim()) return report.addressText.trim();
  return `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`;
}

/** Fetch pins for the interactive map (includes reporter, location, media). */
export async function fetchMapReports(options?: {
  barangayId?: string | null;
  includePending?: boolean;
  /** Read every RLS-authorized page. Intended for virtualized list screens. */
  loadAll?: boolean;
  /** Add status-change and official-comment timestamps for resident feed sorting. */
  includeLatestActivity?: boolean;
  /** List screens request thumbnails; maps leave this false to load no media. */
  includeMediaSummaries?: boolean;
  /** Server-side row cap for the current page. */
  limit?: number;
  offset?: number;
}): Promise<{
  reports: MapReportMarker[];
  error: string | null;
}> {
  const fetchRows = async (selectFields: string) => {
    const rows: Record<string, unknown>[] = [];
    let pageStart = 0;

    while (true) {
      let reportQuery = supabase
        .from('reports_map')
        .select(selectFields)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true });

      if (options?.barangayId) {
        reportQuery = reportQuery.eq('barangay_id', options.barangayId);
      }

      const requestedLimit = Math.max(
        1,
        Math.min(options?.limit ?? REPORT_PAGE_SIZE, REPORT_PAGE_SIZE),
      );
      reportQuery = options?.loadAll
        ? reportQuery.range(pageStart, pageStart + REPORT_PAGE_SIZE - 1)
        : reportQuery.range(
            options?.offset ?? 0,
            (options?.offset ?? 0) + requestedLimit - 1,
          );

      const pageResult = await reportQuery;
      if (pageResult.error) {
        return { data: null, error: pageResult.error };
      }

      const pageRows = (pageResult.data ?? []) as unknown as Record<string, unknown>[];
      rows.push(...pageRows);

      if (!options?.loadAll || pageRows.length === 0) break;

      // Advance by the rows actually returned because the server may enforce a
      // lower maximum page size than the client requested.
      pageStart += pageRows.length;
    }

    return { data: rows, error: null };
  };

  let result = await fetchRows(REPORTS_MAP_SELECT);
  if (result.error && isProfilePhotoSchemaMissing(result.error.message)) {
    result = await fetchRows(REPORTS_MAP_LEGACY_SELECT);
  }
  const { data, error } = result;

  if (error) {
    return { reports: [], error: error.message };
  }

  const baseRows = ((data ?? []) as unknown as Record<string, unknown>[]).filter(
    (row) =>
      Number.isFinite(Number(row.latitude)) &&
      Number.isFinite(Number(row.longitude)),
  );

  const reportIds = baseRows.map((row) => String(row.id));
  const activityPromise = options?.includeLatestActivity
    ? fetchLatestReportActivity(reportIds)
    : Promise.resolve({
        latestActivityByReport: new Map<string, string>(),
        latestStatusUpdateByReport: new Map<string, string>(),
        error: null,
      });
  const mediaByReport = new Map<string, ReportMediaAttachment[]>();
  let mediaLoadError: string | null = null;

  // Media is optional for pins — never wipe the whole map if signing fails.
  if (options?.includeMediaSummaries && reportIds.length > 0) {
    const mediaRows: {
      id: unknown;
      report_id: unknown;
      type: unknown;
      storage_path: unknown;
      thumbnail_storage_path?: unknown;
      display_storage_path?: unknown;
      width?: unknown;
      height?: unknown;
      duration_seconds: unknown;
    }[] = [];

    // Keep each PostgREST URL bounded when a community has many reports.
    for (const reportIdBatch of chunkItems(reportIds, REPORT_MEDIA_BATCH_SIZE)) {
      let mediaResult = await supabase
        .from('report_media')
        .select('id, report_id, type, storage_path, thumbnail_storage_path, display_storage_path, duration_seconds, width, height, position')
        .in('report_id', reportIdBatch)
        .order('position', { ascending: true });

      if (
        mediaResult.error &&
        /thumbnail_storage_path|display_storage_path|width|height/i.test(
          mediaResult.error.message,
        )
      ) {
        mediaResult = await supabase
          .from('report_media')
          .select('id, report_id, type, storage_path, duration_seconds, position')
          .in('report_id', reportIdBatch)
          .order('position', { ascending: true }) as unknown as typeof mediaResult;
      }
      const { data: mediaBatch, error: mediaQueryError } = mediaResult;

      if (mediaQueryError) {
        mediaLoadError = `Could not load some report attachments: ${mediaQueryError.message}`;
        continue;
      }

      mediaRows.push(...(mediaBatch ?? []));
    }

    const paths = mediaRows
      .map((row) => String(row.thumbnail_storage_path ?? ''))
      .filter(Boolean);
    const signedResult = await resolveSignedMediaUrls({
      bucket: REPORT_MEDIA_BUCKET,
      storagePaths: paths,
      variant: 'thumbnail',
    });
    if (signedResult.error) {
      mediaLoadError = `Could not open some report thumbnails: ${signedResult.error}`;
    }

    for (const row of mediaRows) {
      const reportId = String(row.report_id);
      const storagePath = String(row.storage_path);
      const thumbnailStoragePath = row.thumbnail_storage_path
        ? String(row.thumbnail_storage_path)
        : null;
      const thumbnailUrl = thumbnailStoragePath
        ? signedResult.urls.get(thumbnailStoragePath) ?? null
        : null;

      const list = mediaByReport.get(reportId) ?? [];
      list.push({
        id: String(row.id),
        type: row.type === 'video' ? 'video' : 'photo',
        url: thumbnailUrl ?? '',
        thumbnailUrl,
        storagePath,
        thumbnailStoragePath,
        displayStoragePath: row.display_storage_path
          ? String(row.display_storage_path)
          : null,
        durationSeconds:
          row.duration_seconds == null ? null : Number(row.duration_seconds),
        width: row.width == null ? null : Number(row.width),
        height: row.height == null ? null : Number(row.height),
        detailUrlResolved: false,
      });
      mediaByReport.set(reportId, list);
    }
  }

  const activityResult = await activityPromise;
  if (activityResult.error) {
    return {
      reports: [],
      error: `Could not load report activity: ${activityResult.error}`,
    };
  }

  const serverReports: MapReportMarker[] = baseRows.map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    incidentType: isIncidentType(row.incident_type) ? row.incident_type : null,
    incidentTypeOther: row.incident_type_other
      ? String(row.incident_type_other)
      : null,
    status: String(row.status ?? 'unverified'),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    addressText: row.address_text ? String(row.address_text) : null,
    barangay_id: row.barangay_id ? String(row.barangay_id) : null,
    created_at: String(row.created_at ?? ''),
      latestActivityAt:
        activityResult.latestActivityByReport.get(String(row.id)) ??
      String(row.created_at ?? ''),
    latestStatusUpdateAt: activityResult.latestStatusUpdateByReport.get(String(row.id)),
    reporter: {
      id: String(row.reporter_id ?? ''),
      firstName: String(row.reporter_first_name ?? ''),
      lastName: String(row.reporter_last_name ?? ''),
      middleName: row.reporter_middle_name ? String(row.reporter_middle_name) : null,
      avatarPath: row.reporter_avatar_path ? String(row.reporter_avatar_path) : null,
    },
    media: mediaByReport.get(String(row.id)) ?? [],
    mediaError: mediaLoadError,
    mediaDetailLoaded: false,
    upvoteCount: Number(row.upvote_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
  }));

  let pendingMarkers: MapReportMarker[] = [];
  if (options?.includePending !== false) {
    // Only resident-facing maps use the device-local upload queue. Official
    // maps show database-authorized records exclusively.
    const pending = await getPendingReports();
    const serverIds = new Set(serverReports.map((r) => r.id));
    const { profile } = await fetchMyProfile();
    pendingMarkers = pending
      .filter((queued) => !serverIds.has(queued.id))
      .filter(
        (queued) =>
          !options?.barangayId || queued.barangayId === options.barangayId,
      )
      .map((queued) => ({
        id: queued.id,
        title: queued.title,
        description: queued.description,
        incidentType: queued.incidentType ?? null,
        incidentTypeOther: queued.incidentTypeOther ?? null,
        status: 'unverified',
        latitude: queued.position.latitude,
        longitude: queued.position.longitude,
        addressText: queued.addressText ?? null,
        barangay_id: queued.barangayId ?? null,
        created_at: queued.createdAt,
        latestActivityAt: queued.createdAt,
        reporter: {
          id: profile?.id ?? '',
          firstName: profile?.first_name?.trim() || 'Resident',
          lastName: profile?.last_name?.trim() || '',
          middleName: profile?.middle_name?.trim() || null,
          avatarPath: profile?.avatar_path ?? null,
        },
        media: queued.media.map((item) => ({
          id: item.id,
          type: item.type,
          url:
            item.type === 'photo'
              ? item.displayLocalUri ?? item.localUri
              : item.localUri,
          thumbnailUrl:
            item.thumbnailLocalUri ??
            (item.type === 'photo' ? item.localUri : null),
          storagePath: null,
          thumbnailStoragePath: null,
          displayStoragePath: null,
          durationSeconds: item.durationSeconds,
          width: item.width ?? null,
          height: item.height ?? null,
          detailUrlResolved: true,
        })),
        upvoteCount: 0,
        commentCount: 0,
        isPending: true,
        mediaDetailLoaded: true,
      }));
  }

  const reports = [...pendingMarkers, ...serverReports].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return { reports, error: null };
}

/**
 * Refresh one opened report without reloading the feed or every map marker.
 * This is intentionally separate from fetchMapReports: detail pull-to-refresh
 * should only query and re-sign media for the report the user is viewing.
 */
export async function fetchMapReportById(
  reportId: string,
): Promise<{ report: MapReportMarker | null; error: string | null }> {
  const fetchReport = (selectFields: string) =>
    supabase
      .from('reports_map')
      .select(selectFields)
      .eq('id', reportId)
      .maybeSingle();

  let reportResult = await fetchReport(REPORTS_MAP_SELECT);
  if (reportResult.error && isProfilePhotoSchemaMissing(reportResult.error.message)) {
    reportResult = await fetchReport(REPORTS_MAP_LEGACY_SELECT);
  }
  const { error } = reportResult;
  const row = reportResult.data as unknown as Record<string, unknown> | null;

  if (error) return { report: null, error: error.message };
  if (!row) return { report: null, error: 'This report is no longer available.' };

  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { report: null, error: 'This report has an invalid location.' };
  }

  const activityPromise = fetchLatestReportActivity([reportId]);
  const media: ReportMediaAttachment[] = [];
  let mediaResult = await supabase
    .from('report_media')
    .select('id, type, storage_path, thumbnail_storage_path, display_storage_path, duration_seconds, file_size_bytes, width, height, position')
    .eq('report_id', reportId)
    .order('position', { ascending: true });

  if (
    mediaResult.error &&
    /thumbnail_storage_path|display_storage_path|file_size_bytes|width|height/i.test(
      mediaResult.error.message,
    )
  ) {
    mediaResult = await supabase
      .from('report_media')
      .select('id, type, storage_path, duration_seconds, position')
      .eq('report_id', reportId)
      .order('position', { ascending: true }) as unknown as typeof mediaResult;
  }
  const { data: mediaRows, error: mediaQueryError } = mediaResult;

  let mediaError: string | null = mediaQueryError
    ? `Could not load report attachments: ${mediaQueryError.message}`
    : null;
  const detailPaths = (mediaRows ?? []).map((mediaRow) => {
    const isVideo = mediaRow.type === 'video';
    return isVideo
      ? String(mediaRow.storage_path)
      : String(mediaRow.display_storage_path ?? mediaRow.storage_path);
  });
  const thumbnailPaths = (mediaRows ?? [])
    .map((mediaRow) => String(mediaRow.thumbnail_storage_path ?? ''))
    .filter(Boolean);
  if (detailPaths.length > 0) {
    const [detailResult, thumbnailResult] = await Promise.all([
      resolveSignedMediaUrls({
        bucket: REPORT_MEDIA_BUCKET,
        storagePaths: detailPaths,
        variant: 'detail',
      }),
      resolveSignedMediaUrls({
        bucket: REPORT_MEDIA_BUCKET,
        storagePaths: thumbnailPaths,
        variant: 'thumbnail',
      }),
    ]);

    if (detailResult.error) {
      mediaError = `Could not open report attachments: ${detailResult.error}`;
    }

    (mediaRows ?? []).forEach((mediaRow) => {
      const storagePath = String(mediaRow.storage_path);
      const displayStoragePath = mediaRow.display_storage_path
        ? String(mediaRow.display_storage_path)
        : null;
      const thumbnailStoragePath = mediaRow.thumbnail_storage_path
        ? String(mediaRow.thumbnail_storage_path)
        : null;
      const detailPath = mediaRow.type === 'video'
        ? storagePath
        : displayStoragePath ?? storagePath;
      const url = detailResult.urls.get(detailPath);
      if (!url) return;
      media.push({
        id: String(mediaRow.id),
        type: mediaRow.type === 'video' ? 'video' : 'photo',
        url,
        thumbnailUrl: thumbnailStoragePath
          ? thumbnailResult.urls.get(thumbnailStoragePath) ?? null
          : null,
        storagePath,
        thumbnailStoragePath,
        displayStoragePath,
        durationSeconds:
          mediaRow.duration_seconds == null
            ? null
            : Number(mediaRow.duration_seconds),
        width: mediaRow.width == null ? null : Number(mediaRow.width),
        height: mediaRow.height == null ? null : Number(mediaRow.height),
        detailUrlResolved: true,
      });
    });
  }

  const activityResult = await activityPromise;

  return {
    report: {
      id: String(row.id),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      incidentType: isIncidentType(row.incident_type) ? row.incident_type : null,
      incidentTypeOther: row.incident_type_other
        ? String(row.incident_type_other)
        : null,
      status: String(row.status ?? 'unverified'),
      latitude,
      longitude,
      addressText: row.address_text ? String(row.address_text) : null,
      barangay_id: row.barangay_id ? String(row.barangay_id) : null,
      created_at: String(row.created_at ?? ''),
      latestStatusUpdateAt: activityResult.error
        ? undefined
        : activityResult.latestStatusUpdateByReport.get(reportId),
      reporter: {
        id: String(row.reporter_id ?? ''),
        firstName: String(row.reporter_first_name ?? ''),
        lastName: String(row.reporter_last_name ?? ''),
        middleName: row.reporter_middle_name
          ? String(row.reporter_middle_name)
          : null,
        avatarPath: row.reporter_avatar_path ? String(row.reporter_avatar_path) : null,
      },
      media,
      mediaError,
      mediaDetailLoaded: true,
      upvoteCount: Number(row.upvote_count ?? 0),
      commentCount: Number(row.comment_count ?? 0),
    },
    error: null,
  };
}

/**
 * Persist a report to the local offline queue, then kick off a background flush.
 * The user's work is safe the moment this resolves; uploads + the create-report
 * Edge Function run afterwards and retry idempotently on reconnect. Title is
 * required; description is required.
 */
export async function enqueueResidentReport(
  input: SubmitReportInput,
): Promise<{ reportId: string | null; error: string | null }> {
  const title = input.title.trim();
  const description = input.description.trim();
  const incidentTypeOther = input.incidentTypeOther?.trim();

  if (!title) {
    return { reportId: null, error: 'Title is required.' };
  }
  if (!description) {
    return { reportId: null, error: 'Description of the report is required.' };
  }
  if (input.incidentType === 'other' && !incidentTypeOther) {
    return { reportId: null, error: 'Specify the incident type.' };
  }

  const barangayId = input.barangayId.trim();
  if (!barangayId) {
    return { reportId: null, error: 'Select a barangay before submitting.' };
  }

  const mediaError = validateCapturedMedia(input.media);
  if (mediaError) return { reportId: null, error: mediaError };

  const session = await getActiveSession();
  if (!session?.user?.id) {
    return { reportId: null, error: 'Sign in to submit a report.' };
  }

  // Fold the optional user location note into the stored address_text so it
  // lands in the reports table alongside the geocoded label.
  const label = input.addressText?.trim();
  const note = input.locationNote?.trim();
  const addressText = note
    ? label
      ? `${label} (${note})`
      : note
    : label || undefined;

  const reportId = randomUuid();
  const media: QueuedMedia[] = input.media.map((item) => ({
    ...item,
    uploadStatus: 'pending',
  }));

  try {
    await enqueueReport({
      id: reportId,
      title,
      description,
      position: input.position,
      devicePosition: input.devicePosition,
      incidentType: input.incidentType,
      incidentTypeOther:
        input.incidentType === 'other' ? incidentTypeOther : undefined,
      addressText,
      barangayId,
      media,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  } catch {
    return { reportId: null, error: 'Could not save your report locally.' };
  }

  // Let the map show a pending pin immediately, then upload in the background.
  notifyReportQueueChange();
  void flushReportQueue();

  return { reportId, error: null };
}
