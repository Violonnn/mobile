import { supabase } from './supabase';
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

export type ReportMediaAttachment = {
  id: string;
  type: 'photo' | 'video';
  url: string;
  durationSeconds: number | null;
};

export type MapReportReporter = {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
};

export type MapReportMarker = {
  id: string;
  title: string;
  description: string;
  status: string;
  latitude: number;
  longitude: number;
  addressText: string | null;
  barangay_id: string | null;
  created_at: string;
  reporter: MapReportReporter;
  media: ReportMediaAttachment[];
  // Denormalized engagement totals from public.reports (trigger-maintained).
  upvoteCount: number;
  commentCount: number;
  /** True while the report is still only in the local offline queue. */
  isPending?: boolean;
};

export type SubmitReportInput = {
  title: string;
  description: string;
  position: GpsPosition;
  /** Reverse-geocoded barangay label for the pin. */
  addressText?: string;
  /** Optional user-provided location detail (landmark, floor, etc.). */
  locationNote?: string;
  media: CapturedMedia[];
};

const REPORT_MEDIA_BUCKET = 'report-media';

/** Build a display name; middle name is abbreviated to its initial only. */
export function formatReporterName(reporter: MapReportReporter): string {
  const middle = reporter.middleName?.trim();
  const middleInitial = middle ? `${middle.charAt(0).toUpperCase()}.` : null;
  const parts = [reporter.firstName, middleInitial, reporter.lastName].filter(
    (part) => part && part.trim(),
  );
  return parts.join(' ').trim() || 'Resident';
}

/** First initial for avatar fallback (no profile photo stored yet). */
export function reporterInitial(reporter: MapReportReporter): string {
  return reporter.firstName.trim().charAt(0).toUpperCase() || 'R';
}

/** Human-readable location label for a map report. */
export function formatReportLocation(report: MapReportMarker): string {
  if (report.addressText?.trim()) return report.addressText.trim();
  return `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`;
}

/** Fetch pins for the interactive map (includes reporter, location, media). */
export async function fetchMapReports(): Promise<{
  reports: MapReportMarker[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('reports_map')
    .select(
      'id, title, description, status, latitude, longitude, barangay_id, created_at, address_text, upvote_count, comment_count, reporter_id, reporter_first_name, reporter_last_name, reporter_middle_name',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return { reports: [], error: error.message };
  }

  const baseRows = (data ?? []).filter(
    (row) =>
      Number.isFinite(Number(row.latitude)) &&
      Number.isFinite(Number(row.longitude)),
  );

  const reportIds = baseRows.map((row) => String(row.id));
  const mediaByReport = new Map<string, ReportMediaAttachment[]>();

  // Media is optional for pins — never wipe the whole map if signing fails.
  if (reportIds.length > 0) {
    const { data: mediaRows } = await supabase
      .from('report_media')
      .select('id, report_id, type, storage_path, duration_seconds, position')
      .in('report_id', reportIds)
      .order('position', { ascending: true });

    const paths = (mediaRows ?? []).map((row) => String(row.storage_path));
    const signedUrlByPath = new Map<string, string>();

    if (paths.length > 0) {
      const { data: signedRows } = await supabase.storage
        .from(REPORT_MEDIA_BUCKET)
        .createSignedUrls(paths, 3600);

      (signedRows ?? []).forEach((row, index) => {
        if (row.signedUrl) {
          signedUrlByPath.set(paths[index], row.signedUrl);
        }
      });
    }

    for (const row of mediaRows ?? []) {
      const reportId = String(row.report_id);
      const storagePath = String(row.storage_path);
      const url = signedUrlByPath.get(storagePath);
      if (!url) continue;

      const list = mediaByReport.get(reportId) ?? [];
      list.push({
        id: String(row.id),
        type: row.type === 'video' ? 'video' : 'photo',
        url,
        durationSeconds:
          row.duration_seconds == null ? null : Number(row.duration_seconds),
      });
      mediaByReport.set(reportId, list);
    }
  }

  const serverReports: MapReportMarker[] = baseRows.map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    status: String(row.status ?? 'unverified'),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    addressText: row.address_text ? String(row.address_text) : null,
    barangay_id: row.barangay_id ? String(row.barangay_id) : null,
    created_at: String(row.created_at ?? ''),
    reporter: {
      id: String(row.reporter_id ?? ''),
      firstName: String(row.reporter_first_name ?? ''),
      lastName: String(row.reporter_last_name ?? ''),
      middleName: row.reporter_middle_name ? String(row.reporter_middle_name) : null,
    },
    media: mediaByReport.get(String(row.id)) ?? [],
    upvoteCount: Number(row.upvote_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
  }));

  // Include still-uploading local reports so new pins appear before sync finishes.
  const pending = await getPendingReports();
  const serverIds = new Set(serverReports.map((r) => r.id));
  const { profile } = await fetchMyProfile();
  const pendingMarkers: MapReportMarker[] = pending
    .filter((queued) => !serverIds.has(queued.id))
    .map((queued) => ({
      id: queued.id,
      title: queued.title,
      description: queued.description,
      status: 'unverified',
      latitude: queued.position.latitude,
      longitude: queued.position.longitude,
      addressText: queued.addressText ?? null,
      barangay_id: null,
      created_at: queued.createdAt,
      reporter: {
        id: profile?.id ?? '',
        firstName: profile?.first_name?.trim() || 'Resident',
        lastName: profile?.last_name?.trim() || '',
        middleName: profile?.middle_name?.trim() || null,
      },
      media: queued.media.map((item) => ({
        id: item.id,
        type: item.type,
        url: item.localUri,
        durationSeconds: item.durationSeconds,
      })),
      upvoteCount: 0,
      commentCount: 0,
      isPending: true,
    }));

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
  const { data: row, error } = await supabase
    .from('reports_map')
    .select(
      'id, title, description, status, latitude, longitude, barangay_id, created_at, address_text, upvote_count, comment_count, reporter_id, reporter_first_name, reporter_last_name, reporter_middle_name',
    )
    .eq('id', reportId)
    .maybeSingle();

  if (error) return { report: null, error: error.message };
  if (!row) return { report: null, error: 'This report is no longer available.' };

  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { report: null, error: 'This report has an invalid location.' };
  }

  const media: ReportMediaAttachment[] = [];
  const { data: mediaRows } = await supabase
    .from('report_media')
    .select('id, type, storage_path, duration_seconds, position')
    .eq('report_id', reportId)
    .order('position', { ascending: true });

  const paths = (mediaRows ?? []).map((mediaRow) => String(mediaRow.storage_path));
  if (paths.length > 0) {
    const { data: signedRows } = await supabase.storage
      .from(REPORT_MEDIA_BUCKET)
      .createSignedUrls(paths, 3600);

    (mediaRows ?? []).forEach((mediaRow, index) => {
      const url = signedRows?.[index]?.signedUrl;
      if (!url) return;
      media.push({
        id: String(mediaRow.id),
        type: mediaRow.type === 'video' ? 'video' : 'photo',
        url,
        durationSeconds:
          mediaRow.duration_seconds == null
            ? null
            : Number(mediaRow.duration_seconds),
      });
    });
  }

  return {
    report: {
      id: String(row.id),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      status: String(row.status ?? 'unverified'),
      latitude,
      longitude,
      addressText: row.address_text ? String(row.address_text) : null,
      barangay_id: row.barangay_id ? String(row.barangay_id) : null,
      created_at: String(row.created_at ?? ''),
      reporter: {
        id: String(row.reporter_id ?? ''),
        firstName: String(row.reporter_first_name ?? ''),
        lastName: String(row.reporter_last_name ?? ''),
        middleName: row.reporter_middle_name
          ? String(row.reporter_middle_name)
          : null,
      },
      media,
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

  if (!title) {
    return { reportId: null, error: 'Title is required.' };
  }
  if (!description) {
    return { reportId: null, error: 'Description of the report is required.' };
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
      addressText,
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
