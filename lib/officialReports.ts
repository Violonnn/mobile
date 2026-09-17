// lib/officialReports.ts
// Typed helpers for the official incident-operations workspace.
// Status changes and reporter contact go through secure RPCs only.

import { Linking } from 'react-native';
import { supabase } from './supabase';
import { getActiveSession } from './auth';
import {
  fetchLatestReportActivity,
  formatReporterName,
  reporterInitial,
  type MapReportReporter,
  type ReportMediaAttachment,
} from './reports';
import type { OfficialAccessScope } from './officialRegistration';
import { formatInviteKind } from './invites';
import { isIncidentType, type IncidentType } from './incidentTypes';
import { isProfilePhotoSchemaMissing } from './schemaCompatibility';
import { resolveSignedMediaUrls } from './mediaUrlCache';

const OFFICIAL_REPORT_QUEUE_LEGACY_SELECT =
  'id, title, description, incident_type, incident_type_other, status, barangay_id, address_text, created_at, latitude, longitude, reporter_id, reporter_first_name, reporter_last_name, reporter_middle_name, upvote_count, comment_count';
const OFFICIAL_REPORT_QUEUE_SELECT =
  `${OFFICIAL_REPORT_QUEUE_LEGACY_SELECT}, reporter_avatar_path`;
const REPORT_MAP_IDENTITY_LEGACY_SELECT =
  'latitude, longitude, reporter_id, reporter_first_name, reporter_last_name, reporter_middle_name';
const REPORT_MAP_IDENTITY_SELECT =
  `${REPORT_MAP_IDENTITY_LEGACY_SELECT}, reporter_avatar_path`;

export type ReportStatus =
  | 'unverified'
  | 'verified'
  | 'escalated'
  | 'resolved';

export type OfficialKind = 'Mayor' | 'BDRRMO' | 'MDRRMO';

export type OfficialStatusCounts = {
  unverified: number;
  verified: number;
  escalated: number;
  resolved: number;
  total: number;
};

export type OfficialReportQueueItem = {
  id: string;
  title: string;
  description: string;
  incidentType: IncidentType | null;
  incidentTypeOther: string | null;
  status: ReportStatus;
  barangayId: string | null;
  barangayName: string | null;
  addressText: string | null;
  createdAt: string;
  latestActivityAt: string;
  verifiedAt: string | null;
  verifiedByName: string | null;
  escalatedAt: string | null;
  escalatedByName: string | null;
  escalationNote: string | null;
  resolvedAt: string | null;
  reporterName: string;
  reporterInitial: string;
  reporter: MapReportReporter;
  latitude: number | null;
  longitude: number | null;
  firstPhotoUrl: string | null;
  /** Total photo + video attachments for dashboard badges. */
  mediaCount: number;
  /** Signed attachments for the resident-style official post adapter. */
  media: ReportMediaAttachment[];
  mediaError: string | null;
  upvoteCount: number;
  commentCount: number;
};

export type OfficialReportTimelineEvent = {
  id: string;
  eventType: string;
  fromStatus: ReportStatus | null;
  toStatus: ReportStatus | null;
  note: string | null;
  changedByName: string | null;
  createdAt: string;
};

export type OfficialAttribution = {
  name: string | null;
  at: string | null;
};

export type OfficialReportDetail = {
  id: string;
  title: string;
  description: string;
  incidentType: IncidentType | null;
  incidentTypeOther: string | null;
  status: ReportStatus;
  barangayId: string | null;
  addressText: string | null;
  latitude: number;
  longitude: number;
  deviceLatitude: number | null;
  deviceLongitude: number | null;
  gpsAccuracyMeters: number | null;
  locationAdjustmentMeters: number | null;
  createdAt: string;
  reporter: MapReportReporter;
  reporterName: string;
  media: ReportMediaAttachment[];
  mediaError: string | null;
  verified: OfficialAttribution;
  reverified: OfficialAttribution;
  escalated: OfficialAttribution;
  resolved: OfficialAttribution;
  escalatedAt: string | null;
  reverifiedAt: string | null;
  timeline: OfficialReportTimelineEvent[];
  /** True when role allows calling the reporter (MDRRMO: any status). */
  canContactReporter: boolean;
  /** Masked preview only — never the full number. */
  maskedPhone: string | null;
  /** Author-only content correction is available to the submitting officer. */
  canEditContent: boolean;
  /** Scoped response officers may correct the primary incident point. */
  canCorrectLocation: boolean;
  allowedTransitions: ReportStatus[];
};

export type TransitionReportResult = {
  report: { id: string; status: ReportStatus } | null;
  error: string | null;
};

export type ReporterContactResult = {
  phone: string | null;
  error: string | null;
};

const REPORT_MEDIA_BUCKET = 'report-media';
const NOTE_MAX_LENGTH = 500;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const GENERIC_CONTACT_ERROR = 'Reporter contact is unavailable.';
const GENERIC_TRANSITION_ERROR = 'Could not update report status.';

/** Validate a route report id before querying. */
export function isValidReportId(value: string | undefined | null): value is string {
  if (!value) return false;
  return UUID_PATTERN.test(value.trim());
}

/** Trim and cap optional status notes at 500 characters. */
export function normalizeStatusNote(note: string | null | undefined): {
  note: string | null;
  error: string | null;
} {
  const trimmed = (note ?? '').trim();
  if (!trimmed) {
    return { note: null, error: null };
  }
  if (trimmed.length > NOTE_MAX_LENGTH) {
    return {
      note: null,
      error: `Note must be ${NOTE_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { note: trimmed, error: null };
}

export function officialKindFromScope(scope: OfficialAccessScope): OfficialKind {
  const kind = formatInviteKind(scope.role, scope.barangay_id);
  if (kind === 'Mayor' || kind === 'BDRRMO' || kind === 'MDRRMO') {
    return kind;
  }
  return 'MDRRMO';
}

function asReportStatus(value: unknown): ReportStatus {
  if (
    value === 'verified' ||
    value === 'escalated' ||
    value === 'resolved' ||
    value === 'unverified'
  ) {
    return value;
  }
  return 'unverified';
}

function profileDisplayName(row: {
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
} | null | undefined): string | null {
  if (!row) return null;
  return (
    formatReporterName({
      id: '',
      firstName: String(row.first_name ?? ''),
      lastName: String(row.last_name ?? ''),
      middleName: row.middle_name ? String(row.middle_name) : null,
      avatarPath: null,
    }) || null
  );
}

/** Status transitions the current official may attempt for this report. */
export function allowedTransitionsForReport(
  scope: OfficialAccessScope,
  report: {
    status: ReportStatus;
    barangayId: string | null;
    escalatedAt: string | null;
    reverifiedAt: string | null;
  },
): ReportStatus[] {
  const kind = officialKindFromScope(scope);

  if (kind === 'Mayor') {
    return [];
  }

  if (kind === 'BDRRMO') {
    if (report.barangayId !== scope.barangay_id) {
      return [];
    }
    if (report.status === 'unverified') {
      return ['verified'];
    }
    if (report.status === 'verified' && !report.escalatedAt) {
      return ['resolved', 'escalated'];
    }
    return [];
  }

  // MDRRMO
  if (report.status === 'escalated') {
    return ['verified'];
  }
  if (
    report.status === 'verified' &&
    report.escalatedAt &&
    report.reverifiedAt
  ) {
    return ['resolved'];
  }
  return [];
}

function emptyCounts(): OfficialStatusCounts {
  return {
    unverified: 0,
    verified: 0,
    escalated: 0,
    resolved: 0,
    total: 0,
  };
}

function countStatuses(rows: { status: ReportStatus }[]): OfficialStatusCounts {
  const counts = emptyCounts();
  for (const row of rows) {
    counts.total += 1;
    if (row.status === 'verified') counts.verified += 1;
    else if (row.status === 'escalated') counts.escalated += 1;
    else if (row.status === 'resolved') counts.resolved += 1;
    else counts.unverified += 1;
  }
  return counts;
}

async function fetchProfileNamesById(
  ids: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const names = new Map<string, string>();
  if (uniqueIds.length === 0) return names;

  const { data } = await supabase
    .from('app_profiles_public')
    .select('id, first_name, last_name, middle_name')
    .in('id', uniqueIds);

  for (const row of data ?? []) {
    const name = profileDisplayName(row);
    if (name) {
      names.set(String(row.id), name);
    }
  }
  return names;
}

/** Load the scoped official queue plus status counts. */
export async function fetchOfficialReportQueue(
  scope: OfficialAccessScope,
  options?: { limit?: number; offset?: number },
): Promise<{
  reports: OfficialReportQueueItem[];
  counts: OfficialStatusCounts;
  error: string | null;
}> {
  const kind = officialKindFromScope(scope);
  const limit = Math.max(1, Math.min(options?.limit ?? 20, 50));
  const offset = Math.max(0, options?.offset ?? 0);

  if (kind === 'BDRRMO' && !scope.barangay_id) {
    return {
      reports: [],
      counts: emptyCounts(),
      error: 'Barangay scope is missing for this BDRRMO account.',
    };
  }

  // reports_map already includes reporter names without PII.
  const buildQueueQuery = (selectFields: string) => {
    let queueQuery = supabase
      .from('reports_map')
      .select(selectFields)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // BDRRMO only sees its barangay; MDRRMO and Mayor are municipality-wide.
    if (kind === 'BDRRMO' && scope.barangay_id) {
      queueQuery = queueQuery.eq('barangay_id', scope.barangay_id);
    }
    return queueQuery;
  };

  let queueResult = await buildQueueQuery(OFFICIAL_REPORT_QUEUE_SELECT);
  if (queueResult.error && isProfilePhotoSchemaMissing(queueResult.error.message)) {
    queueResult = await buildQueueQuery(OFFICIAL_REPORT_QUEUE_LEGACY_SELECT);
  }
  const { data, error } = queueResult;
  if (error) {
    return { reports: [], counts: emptyCounts(), error: error.message };
  }

  const reportRows = (data ?? []) as unknown as Record<string, unknown>[];
  const reportIds = reportRows.map((row) => String(row.id));
  const [
    firstMediaByReportId,
    mediaCountsByReportId,
    escalationMetaByReportId,
    activityResult,
  ] =
    await Promise.all([
      signFirstQueueThumbnails(reportIds),
      countQueueMedia(reportIds),
      fetchQueueEscalationMeta(reportIds),
      fetchLatestReportActivity(reportIds),
    ]);

  const reports: OfficialReportQueueItem[] = reportRows.map((row) => {
    const reporter = {
      id: String(row.reporter_id ?? ''),
      firstName: String(row.reporter_first_name ?? ''),
      lastName: String(row.reporter_last_name ?? ''),
      middleName: row.reporter_middle_name
        ? String(row.reporter_middle_name)
        : null,
      avatarPath: row.reporter_avatar_path ? String(row.reporter_avatar_path) : null,
    };
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    const reportId = String(row.id);
    const meta = escalationMetaByReportId.get(reportId);

    return {
      id: reportId,
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      incidentType: isIncidentType(row.incident_type) ? row.incident_type : null,
      incidentTypeOther: row.incident_type_other
        ? String(row.incident_type_other)
        : null,
      status: asReportStatus(row.status),
      barangayId: row.barangay_id ? String(row.barangay_id) : null,
      barangayName: meta?.barangayName ?? null,
      addressText: row.address_text ? String(row.address_text) : null,
      createdAt: String(row.created_at ?? ''),
      latestActivityAt:
        activityResult.latestActivityByReport.get(reportId) ?? String(row.created_at ?? ''),
      verifiedAt: meta?.verifiedAt ?? null,
      verifiedByName: meta?.verifiedByName ?? null,
      escalatedAt: meta?.escalatedAt ?? null,
      escalatedByName: meta?.escalatedByName ?? null,
      escalationNote: meta?.escalationNote ?? null,
      resolvedAt: meta?.resolvedAt ?? null,
      reporterName: formatReporterName(reporter) || 'Resident',
      reporterInitial: reporterInitial(reporter),
      reporter,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      firstPhotoUrl:
        firstMediaByReportId.get(reportId)?.type === 'photo'
          ? firstMediaByReportId.get(reportId)?.thumbnailUrl ?? null
          : null,
      mediaCount: mediaCountsByReportId.get(reportId) ?? 0,
      media: firstMediaByReportId.has(reportId)
        ? [firstMediaByReportId.get(reportId)!]
        : [],
      mediaError: null,
      upvoteCount: Number(row.upvote_count ?? 0),
      commentCount: Number(row.comment_count ?? 0),
    };
  });

  let statusQuery = supabase.from('reports_map').select('status');
  if (kind === 'BDRRMO' && scope.barangay_id) {
    statusQuery = statusQuery.eq('barangay_id', scope.barangay_id);
  }
  const statusResult = await statusQuery;
  const allStatusRows = (statusResult.data ?? []).map((row) => ({
    status: asReportStatus(row.status),
  }));

  return {
    reports,
    counts: statusResult.error ? countStatuses(reports) : countStatuses(allStatusRows),
    error: null,
  };
}

/** Sign only each report's first stored thumbnail/poster for queue cards. */
async function signFirstQueueThumbnails(
  reportIds: string[],
): Promise<Map<string, ReportMediaAttachment>> {
  if (reportIds.length === 0) return new Map();

  let result = await supabase
    .from('report_media')
    .select('id, report_id, type, storage_path, thumbnail_storage_path, display_storage_path, duration_seconds, width, height, position')
    .in('report_id', reportIds)
    .order('position', { ascending: true });
  if (result.error && /thumbnail_storage_path|display_storage_path|width|height/i.test(result.error.message)) {
    result = await supabase
      .from('report_media')
      .select('id, report_id, type, storage_path, duration_seconds, position')
      .in('report_id', reportIds)
      .order('position', { ascending: true }) as unknown as typeof result;
  }
  const mediaRows = result.data;

  const seenReportIds = new Set<string>();
  const firstRows = (mediaRows ?? []).filter((row) => {
    const reportId = String(row.report_id);
    if (seenReportIds.has(reportId)) return false;
    seenReportIds.add(reportId);
    return true;
  });
  if (firstRows.length === 0) return new Map();

  const paths = firstRows
    .map((row) => String(row.thumbnail_storage_path ?? ''))
    .filter(Boolean);
  const signedResult = await resolveSignedMediaUrls({
    bucket: REPORT_MEDIA_BUCKET,
    storagePaths: paths,
    variant: 'thumbnail',
  });

  const mediaByReportId = new Map<string, ReportMediaAttachment>();
  firstRows.forEach((row) => {
    const thumbnailStoragePath = row.thumbnail_storage_path
      ? String(row.thumbnail_storage_path)
      : null;
    const thumbnailUrl = thumbnailStoragePath
      ? signedResult.urls.get(thumbnailStoragePath) ?? null
      : null;
    mediaByReportId.set(String(row.report_id), {
      id: String(row.id),
      type: row.type === 'video' ? 'video' : 'photo',
      url: thumbnailUrl ?? '',
      thumbnailUrl,
      storagePath: String(row.storage_path),
      thumbnailStoragePath,
      displayStoragePath: row.display_storage_path ? String(row.display_storage_path) : null,
      durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
      width: row.width == null ? null : Number(row.width),
      height: row.height == null ? null : Number(row.height),
      detailUrlResolved: false,
    });
  });
  return mediaByReportId;
}

/** Count photo + video attachments per report for escalation card badges. */
async function countQueueMedia(reportIds: string[]): Promise<Map<string, number>> {
  if (reportIds.length === 0) return new Map();

  const { data: mediaRows } = await supabase
    .from('report_media')
    .select('report_id')
    .in('report_id', reportIds);

  const counts = new Map<string, number>();
  for (const row of mediaRows ?? []) {
    const reportId = String(row.report_id);
    counts.set(reportId, (counts.get(reportId) ?? 0) + 1);
  }
  return counts;
}

type QueueEscalationMeta = {
  verifiedAt: string | null;
  verifiedByName: string | null;
  escalatedAt: string | null;
  escalatedByName: string | null;
  escalationNote: string | null;
  resolvedAt: string | null;
  barangayName: string | null;
};

/** Load attribution and barangay context for MDRRMO escalation cards. */
async function fetchQueueEscalationMeta(
  reportIds: string[],
): Promise<Map<string, QueueEscalationMeta>> {
  if (reportIds.length === 0) return new Map();

  const [reportResult, escalationHistoryResult] = await Promise.all([
    supabase
      .from('reports')
      .select('id, verified_by, verified_at, escalated_by, escalated_at, resolved_at, barangay_id')
      .in('id', reportIds),
    supabase
      .from('report_status_history')
      .select('report_id, note, created_at')
      .in('report_id', reportIds)
      .eq('to_status', 'escalated')
      .order('created_at', { ascending: false }),
  ]);
  const reportRows = reportResult.data;
  const attributionNames = await fetchProfileNamesById(
    (reportRows ?? []).flatMap((row) => [
      row.verified_by ? String(row.verified_by) : '',
      row.escalated_by ? String(row.escalated_by) : '',
    ]),
  );

  const escalationNotesByReportId = new Map<string, string>();
  for (const historyRow of escalationHistoryResult.data ?? []) {
    const reportId = String(historyRow.report_id);
    const note = historyRow.note ? String(historyRow.note).trim() : '';
    if (note && !escalationNotesByReportId.has(reportId)) {
      escalationNotesByReportId.set(reportId, note);
    }
  }

  const barangayIds = Array.from(
    new Set(
      (reportRows ?? [])
        .map((row) => (row.barangay_id ? String(row.barangay_id) : null))
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const barangayNames = new Map<string, string>();
  if (barangayIds.length > 0) {
    const { data: barangayRows } = await supabase
      .from('barangays')
      .select('id, name')
      .in('id', barangayIds);
    for (const row of barangayRows ?? []) {
      barangayNames.set(String(row.id), String(row.name ?? ''));
    }
  }

  const meta = new Map<string, QueueEscalationMeta>();
  for (const row of reportRows ?? []) {
    const barangayId = row.barangay_id ? String(row.barangay_id) : null;
    meta.set(String(row.id), {
      verifiedAt: row.verified_at ? String(row.verified_at) : null,
      verifiedByName: row.verified_by
        ? attributionNames.get(String(row.verified_by)) ?? null
        : null,
      escalatedAt: row.escalated_at ? String(row.escalated_at) : null,
      escalatedByName: row.escalated_by
        ? attributionNames.get(String(row.escalated_by)) ?? null
        : null,
      escalationNote: escalationNotesByReportId.get(String(row.id)) ?? null,
      resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
      barangayName: barangayId ? barangayNames.get(barangayId) ?? null : null,
    });
  }
  return meta;
}

async function signReportMedia(
  reportId: string,
): Promise<{ media: ReportMediaAttachment[]; error: string | null }> {
  let mediaResult = await supabase
    .from('report_media')
    .select('id, report_id, type, storage_path, thumbnail_storage_path, display_storage_path, duration_seconds, width, height, position')
    .eq('report_id', reportId)
    .order('position', { ascending: true });
  if (mediaResult.error && /thumbnail_storage_path|display_storage_path|width|height/i.test(mediaResult.error.message)) {
    mediaResult = await supabase
      .from('report_media')
      .select('id, report_id, type, storage_path, duration_seconds, position')
      .eq('report_id', reportId)
      .order('position', { ascending: true }) as unknown as typeof mediaResult;
  }
  const { data: mediaRows, error: mediaQueryError } = mediaResult;

  if (mediaQueryError) {
    return {
      media: [],
      error: `Could not load report attachments: ${mediaQueryError.message}`,
    };
  }
  if (!mediaRows || mediaRows.length === 0) {
    return { media: [], error: null };
  }

  const detailPaths = mediaRows.map((row) => row.type === 'video'
    ? String(row.storage_path)
    : String(row.display_storage_path ?? row.storage_path));
  const thumbnailPaths = mediaRows
    .map((row) => String(row.thumbnail_storage_path ?? ''))
    .filter(Boolean);
  const [detailResult, thumbnailResult] = await Promise.all([
    resolveSignedMediaUrls({ bucket: REPORT_MEDIA_BUCKET, storagePaths: detailPaths, variant: 'detail' }),
    resolveSignedMediaUrls({ bucket: REPORT_MEDIA_BUCKET, storagePaths: thumbnailPaths, variant: 'thumbnail' }),
  ]);

  if (detailResult.error) {
    return {
      media: [],
      error: `Could not open report attachments: ${detailResult.error}`,
    };
  }

  const media: ReportMediaAttachment[] = [];
  for (const row of mediaRows) {
    const storagePath = String(row.storage_path);
    const thumbnailStoragePath = row.thumbnail_storage_path ? String(row.thumbnail_storage_path) : null;
    const displayStoragePath = row.display_storage_path ? String(row.display_storage_path) : null;
    const detailPath = row.type === 'video' ? storagePath : displayStoragePath ?? storagePath;
    const url = detailResult.urls.get(detailPath);
    if (!url) continue;
    media.push({
      id: String(row.id),
      type: row.type === 'video' ? 'video' : 'photo',
      url,
      thumbnailUrl: thumbnailStoragePath ? thumbnailResult.urls.get(thumbnailStoragePath) ?? null : null,
      storagePath,
      thumbnailStoragePath,
      displayStoragePath,
      durationSeconds:
        row.duration_seconds == null ? null : Number(row.duration_seconds),
      width: row.width == null ? null : Number(row.width),
      height: row.height == null ? null : Number(row.height),
      detailUrlResolved: true,
    });
  }
  return { media, error: null };
}

/** Load one scoped report with media, timeline, attribution, and contact preview. */
export async function fetchOfficialReportDetail(
  reportId: string,
  scope: OfficialAccessScope,
): Promise<{ detail: OfficialReportDetail | null; error: string | null }> {
  if (!isValidReportId(reportId)) {
    return { detail: null, error: 'Invalid report id.' };
  }

  const kind = officialKindFromScope(scope);
  const id = reportId.trim();

  let reportQuery = supabase
    .from('reports')
    .select(
      `
      id,
      title,
      description,
      incident_type,
      incident_type_other,
      status,
      barangay_id,
      address_text,
      created_at,
      verified_by,
      verified_at,
      reverified_by,
      reverified_at,
      escalated_by,
      escalated_at,
      resolved_by,
      resolved_at,
      reporter_id
    `,
    )
    .eq('id', id);

  if (kind === 'BDRRMO') {
    if (!scope.barangay_id) {
      return { detail: null, error: 'Barangay scope is missing for this account.' };
    }
    reportQuery = reportQuery.eq('barangay_id', scope.barangay_id);
  }

  const { data: row, error } = await reportQuery.maybeSingle();
  if (error) {
    return { detail: null, error: error.message };
  }
  if (!row) {
    return { detail: null, error: 'Report not found in your scope.' };
  }

  const fetchMapIdentity = async () => {
    let identityResult = await supabase
      .from('reports_map')
      .select(REPORT_MAP_IDENTITY_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (identityResult.error && isProfilePhotoSchemaMissing(identityResult.error.message)) {
      identityResult = await supabase
        .from('reports_map')
        .select(REPORT_MAP_IDENTITY_LEGACY_SELECT)
        .eq('id', id)
        .maybeSingle();
    }
    return identityResult;
  };

  const [
    mapResult,
    mediaResult,
    historyResult,
    contactPreview,
    locationVerificationResult,
  ] = await Promise.all([
    fetchMapIdentity(),
    signReportMedia(id),
    supabase
      .from('report_status_history')
      .select(
        'id, event_type, from_status, to_status, note, created_at, changed_by',
      )
      .eq('report_id', id)
      .order('created_at', { ascending: true }),
    supabase.rpc('preview_reporter_contact', {
      p_report_id: id,
    }),
    supabase.rpc('get_report_location_verification', {
      p_report_id: id,
    }),
  ]);

  const mapRow = mapResult.data as unknown as Record<string, unknown> | null;
  const latitude = Number(mapRow?.latitude ?? NaN);
  const longitude = Number(mapRow?.longitude ?? NaN);

  const actorIds = [
    row.verified_by ? String(row.verified_by) : '',
    row.reverified_by ? String(row.reverified_by) : '',
    row.escalated_by ? String(row.escalated_by) : '',
    row.resolved_by ? String(row.resolved_by) : '',
    ...(historyResult.data ?? []).map((event) =>
      event.changed_by ? String(event.changed_by) : '',
    ),
  ];
  const namesById = await fetchProfileNamesById(actorIds);

  const reporter: MapReportReporter = {
    id: String(mapRow?.reporter_id ?? row.reporter_id ?? ''),
    firstName: String(mapRow?.reporter_first_name ?? ''),
    lastName: String(mapRow?.reporter_last_name ?? ''),
    middleName: mapRow?.reporter_middle_name
      ? String(mapRow.reporter_middle_name)
      : null,
    avatarPath: mapRow?.reporter_avatar_path
      ? String(mapRow.reporter_avatar_path)
      : null,
  };

  const timeline: OfficialReportTimelineEvent[] = (
    historyResult.data ?? []
  ).map((event) => ({
    id: String(event.id),
    eventType: String(event.event_type ?? 'status_change'),
    fromStatus: event.from_status ? asReportStatus(event.from_status) : null,
    toStatus: event.to_status ? asReportStatus(event.to_status) : null,
    note: event.note ? String(event.note) : null,
    changedByName: event.changed_by
      ? namesById.get(String(event.changed_by)) ?? null
      : null,
    createdAt: String(event.created_at ?? ''),
  }));

  const previewRow = Array.isArray(contactPreview.data)
    ? contactPreview.data[0]
    : contactPreview.data;
  const verificationRow = Array.isArray(locationVerificationResult.data)
    ? locationVerificationResult.data[0]
    : locationVerificationResult.data;

  const escalatedAt = row.escalated_at ? String(row.escalated_at) : null;
  const reverifiedAt = row.reverified_at ? String(row.reverified_at) : null;
  const status = asReportStatus(row.status);
  const barangayId = row.barangay_id ? String(row.barangay_id) : null;

  const session = await getActiveSession();
  const detail: OfficialReportDetail = {
    id: String(row.id),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    incidentType: isIncidentType(row.incident_type) ? row.incident_type : null,
    incidentTypeOther: row.incident_type_other
      ? String(row.incident_type_other)
      : null,
    status,
    barangayId,
    addressText: row.address_text ? String(row.address_text) : null,
    latitude: Number.isFinite(latitude) ? latitude : 0,
    longitude: Number.isFinite(longitude) ? longitude : 0,
    deviceLatitude:
      verificationRow?.device_latitude == null
        ? null
        : Number(verificationRow.device_latitude),
    deviceLongitude:
      verificationRow?.device_longitude == null
        ? null
        : Number(verificationRow.device_longitude),
    gpsAccuracyMeters:
      verificationRow?.gps_accuracy_meters == null
        ? null
        : Number(verificationRow.gps_accuracy_meters),
    locationAdjustmentMeters:
      verificationRow?.location_adjustment_meters == null
        ? null
        : Number(verificationRow.location_adjustment_meters),
    createdAt: String(row.created_at ?? ''),
    reporter,
    reporterName: formatReporterName(reporter) || 'Resident',
    media: mediaResult.media,
    mediaError: mediaResult.error,
    verified: {
      name: row.verified_by
        ? namesById.get(String(row.verified_by)) ?? null
        : null,
      at: row.verified_at ? String(row.verified_at) : null,
    },
    reverified: {
      name: row.reverified_by
        ? namesById.get(String(row.reverified_by)) ?? null
        : null,
      at: reverifiedAt,
    },
    escalated: {
      name: row.escalated_by
        ? namesById.get(String(row.escalated_by)) ?? null
        : null,
      at: escalatedAt,
    },
    resolved: {
      name: row.resolved_by
        ? namesById.get(String(row.resolved_by)) ?? null
        : null,
      at: row.resolved_at ? String(row.resolved_at) : null,
    },
    escalatedAt,
    reverifiedAt,
    timeline,
    canContactReporter: Boolean(previewRow?.can_contact),
    maskedPhone: previewRow?.masked_phone
      ? String(previewRow.masked_phone)
      : null,
    canEditContent:
      kind !== 'Mayor' && String(row.reporter_id) === session?.user?.id,
    canCorrectLocation: kind === 'BDRRMO' || kind === 'MDRRMO',
    allowedTransitions: allowedTransitionsForReport(scope, {
      status,
      barangayId,
      escalatedAt,
      reverifiedAt,
    }),
  };

  return { detail, error: null };
}

/** Call the secure status-transition RPC. */
export async function transitionOfficialReportStatus(input: {
  reportId: string;
  targetStatus: ReportStatus;
  note?: string | null;
}): Promise<TransitionReportResult> {
  if (!isValidReportId(input.reportId)) {
    return { report: null, error: 'Invalid report id.' };
  }

  const { note, error: noteError } = normalizeStatusNote(input.note);
  if (noteError) {
    return { report: null, error: noteError };
  }

  const { data, error } = await supabase.rpc('transition_report_status', {
    p_report_id: input.reportId.trim(),
    p_target_status: input.targetStatus,
    p_note: note,
  });

  if (error) {
    return {
      report: null,
      error: error.message || GENERIC_TRANSITION_ERROR,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) {
    return { report: null, error: GENERIC_TRANSITION_ERROR };
  }

  return {
    report: {
      id: String(row.id),
      status: asReportStatus(row.status),
    },
    error: null,
  };
}

/**
 * After confirmation: audit + return full phone for native dialer handoff.
 * Does not place the call — caller must open tel:.
 */
export async function requestReporterContact(
  reportId: string,
): Promise<ReporterContactResult> {
  if (!isValidReportId(reportId)) {
    return { phone: null, error: GENERIC_CONTACT_ERROR };
  }

  const { data, error } = await supabase.rpc('request_reporter_contact', {
    p_report_id: reportId.trim(),
  });

  if (error) {
    return { phone: null, error: GENERIC_CONTACT_ERROR };
  }

  const phone = typeof data === 'string' ? data.trim() : '';
  if (!phone) {
    return { phone: null, error: GENERIC_CONTACT_ERROR };
  }

  return { phone, error: null };
}

/** Open the native dialer with the number prefilled (does not auto-call). */
export async function openReporterDialer(
  phone: string,
): Promise<{ error: string | null }> {
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits) {
    return { error: 'Could not open the phone dialer.' };
  }

  const url = `tel:${digits}`;
  try {
    // Skip canOpenURL: Android package visibility can report tel: as unsupported
    // even on phones that can open the dialer. Failures still land in catch.
    await Linking.openURL(url);
    return { error: null };
  } catch {
    return { error: 'Could not open the phone dialer.' };
  }
}

export function transitionActionLabel(target: ReportStatus): string {
  if (target === 'verified') return 'Mark verified';
  if (target === 'escalated') return 'Escalate to MDRRMO';
  if (target === 'resolved') return 'Mark resolved';
  return 'Update status';
}

export function transitionConfirmMessage(
  target: ReportStatus,
  kind: OfficialKind,
): string {
  if (target === 'verified' && kind === 'MDRRMO') {
    return 'Re-verify this escalated report?';
  }
  if (target === 'verified') {
    return 'Mark this report as verified?';
  }
  if (target === 'escalated') {
    return 'Escalate this report to MDRRMO?';
  }
  if (target === 'resolved') {
    return 'Mark this report as resolved?';
  }
  return 'Update this report status?';
}
