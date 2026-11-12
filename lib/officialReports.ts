// lib/officialReports.ts
// Typed helpers for the official incident-operations workspace.
// Status changes and reporter contact go through secure RPCs only.

import { Linking } from 'react-native';
import type { ResponseEventDetails } from './reportContactFlow';
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
import { notifyReportPublicationChanged, processPublicReportPhoto } from './reportPublication';
import { deriveLifecycle, hasCurrentResponseAction, type LifecycleFacts, type LifecycleSummary, type ReviewOutcome } from './reportLifecycle';
import { allowedIncidentActions, callReportFlowRpc, fetchIncidentCaseDetail, validateFlowText, type IncidentAction, type IncidentCaseDetail } from './incidentCases';

export type ReviewDecision = 'verify' | 'link' | 'needs_assessment' | 'could_not_confirm' | 'reject';
export type OfficialWorkflowQueue = 'all' | 'needs_review' | 'under_review' | 'mine' | 'being_assessed' | 'awaiting_mdrrmo' | 'jurisdiction_check' | 'incoming_requests' | 'legacy_escalations' | 'municipal_review' | 'municipal_lead' | 'mayor_requests';
export type ReviewAction = 'claim' | 'take_over' | 'release' | ReviewDecision;
export type RejectReasonCode = 'test_or_spam' | 'not_an_emergency_incident' | 'outside_approved_type' | 'abusive_content' | 'insufficient_location' | 'other';
export type ResponseEventType = 'reporter_call' | 'hotline_contacted' | 'assistance_requested' | 'dispatch_confirmed' | 'responders_on_site' | 'assistance_given' | 'work_done' | 'external_info' | 'internal_note';
export type IncidentLinkCandidate = {
  id: string; incidentCaseId: string; sourceReportId: string; incidentType: string | null;
  verification: string; coordination: string; distanceMeters: number; linkedReportCount: number; createdAt: string;
};

const OFFICIAL_REPORT_QUEUE_LEGACY_SELECT =
  'id, title, description, incident_type, incident_type_other, status, barangay_id, address_text, created_at, latitude, longitude, reporter_id, reporter_first_name, reporter_last_name, reporter_middle_name, upvote_count, comment_count';
const OFFICIAL_REPORT_QUEUE_SELECT =
  `${OFFICIAL_REPORT_QUEUE_LEGACY_SELECT}, reporter_avatar_path, incident_case_id, review_outcome, review_claimed_by, review_claimed_at, jurisdiction_status, intake_channel`;
const REPORT_MAP_IDENTITY_LEGACY_SELECT =
  'latitude, longitude, reporter_id, reporter_first_name, reporter_last_name, reporter_middle_name';
const REPORT_MAP_IDENTITY_SELECT =
  `${REPORT_MAP_IDENTITY_LEGACY_SELECT}, reporter_avatar_path`;

export type ReportStatus =
  | 'unverified'
  | 'verified'
  | 'escalated'
  | 'resolved'
  | 'closed';

export type OfficialKind = 'Mayor' | 'BDRRMO' | 'MDRRMO';

export type OfficialStatusCounts = {
  unverified: number;
  verified: number;
  escalated: number;
  resolved: number;
  closed: number;
  total: number;
};

export type OfficialReportQueueItem = {
  lifecycleFacts: LifecycleFacts;
  lifecycle: LifecycleSummary;
  incidentCaseId: string | null;
  reviewClaimedById: string | null;
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
  detail: Record<string, unknown>;
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
  currentUserId: string;
  lifecycleFacts: LifecycleFacts;
  lifecycle: LifecycleSummary;
  incidentCase: IncidentCaseDetail | null;
  allowedReviewActions: ReviewAction[];
  allowedIncidentActions: IncidentAction[];
  reviewClaimedById: string | null;
  reviewReasonCode: string | null;
  intakeChannel: 'resident_app' | 'official_field' | 'hotline_call';
  canReviewReport: boolean;
  canReroute: boolean;
  id: string;
  title: string;
  description: string;
  incidentType: IncidentType | null;
  incidentTypeOther: string | null;
  status: ReportStatus;
  barangayId: string | null;
  barangayName: string | null;
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

export function allowedReviewActions(
  scope: OfficialAccessScope,
  facts: LifecycleFacts & { barangayId: string | null; claimedById: string | null },
  currentUserId: string,
): ReviewAction[] {
  if (scope.role !== 'officer' || !currentUserId) return [];
  const canReview = scope.barangay_id
    ? facts.barangayId === scope.barangay_id
    : facts.barangayHasActiveBdrrmo === false;
  if (!canReview || facts.reviewOutcome !== 'pending' || facts.jurisdictionStatus !== 'in_coverage') return [];
  if (!facts.claimedById) return ['claim'];
  if (facts.claimedById !== currentUserId) return ['take_over'];
  return ['verify', 'link', 'needs_assessment', 'could_not_confirm', 'reject', 'release'];
}

async function reportMutation(name: string, reportId: string, fields: Record<string, unknown>, validationError: string | null = null): Promise<{ error: string | null }> {
  if (!isValidReportId(reportId)) return { error: 'Invalid report id.' };
  if (validationError) return { error: validationError };
  return callReportFlowRpc(name, { p_report_id: reportId.trim(), ...fields });
}

export function claimReportReview(input: { reportId: string; takeOver?: boolean }) {
  return reportMutation('claim_report_review', input.reportId, { p_take_over: input.takeOver ?? false });
}
export function releaseReportReview(input: { reportId: string; note?: string | null }) {
  return reportMutation('release_report_review', input.reportId, { p_note: input.note?.trim() || null }, validateFlowText(input.note));
}
export type ReportPublicationDecision = {
  operationId?: string;
  publish?: boolean;
  publicationAcknowledged?: boolean;
  approveReporterName?: boolean;
  approveReporterAvatar?: boolean;
  approveExactLocation?: boolean;
  photoMediaIds?: string[];
  markIncidentSensitive?: boolean;
  sensitivityReason?: string | null;
};

function createReportOperationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const randomValue = Math.floor(Math.random() * 16);
    const value = character === 'x' ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function reviewOfficialReport(input: {
  reportId: string; decision: ReviewDecision; reasonCode?: RejectReasonCode | null;
  note?: string | null; linkIncidentCaseId?: string | null; publication?: ReportPublicationDecision;
}): Promise<{ error: string | null; publicAvailable?: boolean; publicationStatus?: string | null }> {
  let validationError = validateFlowText(input.note, input.decision === 'could_not_confirm' || (input.decision === 'reject' && input.reasonCode === 'other'));
  if (input.decision === 'reject' && !input.reasonCode) validationError = 'Select a rejection reason.';
  if (input.decision === 'link' && !isValidReportId(input.linkIncidentCaseId)) validationError = 'Select an incident to link.';
  const publication = input.publication ?? {};
  const selectedPhotos = publication.photoMediaIds ?? [];
  if (publication.publish && !publication.publicationAcknowledged) {
    validationError = 'Review the source text and selected photos before saving.';
  }
  if (publication.markIncidentSensitive && (!publication.sensitivityReason?.trim() || selectedPhotos.length > 0 || publication.publish)) {
    validationError = 'Give a safety reason and clear publication photos for a sensitive incident.';
  }
  if (new Set(selectedPhotos).size !== selectedPhotos.length) validationError = 'Select each photo only once.';
  if (!isValidReportId(input.reportId)) return { error: 'Invalid report id.' };
  if (validationError) return { error: validationError };

  if (publication.publish) {
    for (const mediaId of selectedPhotos) {
      const prepared = await processPublicReportPhoto(input.reportId, mediaId);
      if (prepared.error) return prepared;
    }
  }

  try {
    const { data, error } = await supabase.rpc('review_report_with_publication', {
      p_operation_id: publication.operationId ?? createReportOperationId(),
      p_report_id: input.reportId.trim(),
      p_decision: input.decision,
      p_reason_code: input.reasonCode ?? null,
      p_note: input.note?.trim() || null,
      p_link_incident_case_id: input.linkIncidentCaseId?.trim() || null,
      p_public_title: null,
      p_public_description: null,
      p_publish: publication.publish ?? false,
      p_approve_reporter_name: publication.approveReporterName ?? false,
      p_approve_reporter_avatar: publication.approveReporterAvatar ?? false,
      p_approve_exact_location: publication.approveExactLocation ?? false,
      p_photo_media_ids: selectedPhotos,
      p_publication_acknowledged: publication.publicationAcknowledged ?? false,
      p_mark_incident_sensitive: publication.markIncidentSensitive ?? false,
      p_sensitivity_reason: publication.sensitivityReason?.trim() || null,
    });
    if (error) return { error: error.message };
    const result = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    notifyReportPublicationChanged();
    return {
      error: null,
      publicAvailable: result.publicAvailable === true,
      publicationStatus: typeof result.publicationStatus === 'string' ? result.publicationStatus : null,
    };
  } catch {
    return { error: 'Could not connect. Check your connection and try again.' };
  }
}
export function reopenReportReview(input: { reportId: string; reason: string }) {
  return reportMutation('reopen_report_review', input.reportId, { p_reason: input.reason.trim() }, validateFlowText(input.reason, true));
}
export function rerouteReportBarangay(input: { reportId: string; targetBarangayId: string; reason: string }) {
  return reportMutation('reroute_report_barangay', input.reportId, { p_target_barangay_id: input.targetBarangayId, p_reason: input.reason.trim() },
    !isValidReportId(input.targetBarangayId) ? 'Select a valid barangay.' : validateFlowText(input.reason, true));
}
export function resolveReportJurisdiction(input: { reportId: string; decision: 'in_coverage' | 'outside_coverage'; barangayId?: string | null; note?: string | null }) {
  return reportMutation('resolve_report_jurisdiction', input.reportId, { p_decision: input.decision, p_barangay_id: input.barangayId ?? null, p_note: input.note?.trim() || null },
    input.barangayId && !isValidReportId(input.barangayId) ? 'Select a valid barangay.' : validateFlowText(input.note));
}
export function logReportContact(input: { reportId: string; eventType: ResponseEventType; details: ResponseEventDetails; note?: string | null }) {
  return reportMutation('log_report_contact', input.reportId, { p_event_type: input.eventType, p_details: input.details, p_note: input.note?.trim() || null }, validateFlowText(input.note));
}

export async function fetchIncidentLinkCandidates(reportId: string): Promise<{ candidates: IncidentLinkCandidate[]; error: string | null }> {
  if (!isValidReportId(reportId)) return { candidates: [], error: 'Invalid report id.' };
  const { data, error } = await supabase.rpc('list_incident_link_candidates', { p_report_id: reportId });
  if (error) return { candidates: [], error: error.message };
  return { candidates: (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.incident_case_id), incidentCaseId: String(row.incident_case_id), sourceReportId: String(row.source_report_id),
    incidentType: row.incident_type ? String(row.incident_type) : null, verification: String(row.verification),
    coordination: String(row.coordination), distanceMeters: Number(row.distance_meters), linkedReportCount: Number(row.linked_report_count), createdAt: String(row.created_at),
  })), error: null };
}

export async function fetchJurisdictionQueue(): Promise<{ reports: OfficialReportQueueItem[]; error: string | null }> {
  const session = await getActiveSession();
  const { data: profile, error } = await supabase.from('app_profiles').select('role, barangay_id').eq('id', session?.user.id ?? '').maybeSingle();
  if (error || profile?.role !== 'officer' || profile.barangay_id) return { reports: [], error: error?.message ?? 'Only MDRRMO can check jurisdiction.' };
  const result = await fetchOfficialReportQueue({ role: 'officer', barangay_id: null, barangay_name: null, email: session?.user.email ?? '' }, { jurisdictionOnly: true, limit: 50 });
  return { reports: result.reports, error: result.error };
}

function asReportStatus(value: unknown): ReportStatus {
  if (
    value === 'verified' ||
    value === 'escalated' ||
    value === 'resolved' ||
    value === 'closed' ||
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
    closed: 0,
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
    else if (row.status === 'closed') counts.closed += 1;
    else counts.unverified += 1;
  }
  return counts;
}

/** Build facts in batches so a queue page does not fetch each case separately. */
async function fetchQueueLifecycleFacts(rows: Record<string, unknown>[], includeIncidents: boolean): Promise<{ facts: Map<string, LifecycleFacts>; error: string | null }> {
  const facts = new Map<string, LifecycleFacts>();
  if (rows.length === 0) return { facts, error: null };
  const caseIds = [...new Set(rows.flatMap((row) => row.incident_case_id ? [String(row.incident_case_id)] : []))];
  const claimantIds = rows.flatMap((row) => row.review_claimed_by ? [String(row.review_claimed_by)] : []);
  const [caseResult, eventResult, requestResult, claimantNames] = await Promise.all([
    includeIncidents && caseIds.length ? supabase.from('incident_cases').select('id, verification, state, coordination, lead_office, municipal_finding, municipal_finding_at, legacy_resolution, withdrawn_at, created_at').in('id', caseIds) : Promise.resolve({ data: [], error: null }),
    includeIncidents && caseIds.length ? supabase.from('incident_events').select('incident_case_id, event_type, occurred_at').in('incident_case_id', caseIds) : Promise.resolve({ data: [], error: null }),
    includeIncidents && caseIds.length ? supabase.from('incident_support_requests').select('incident_case_id, is_legacy').in('incident_case_id', caseIds).eq('status', 'requested') : Promise.resolve({ data: [], error: null }),
    fetchProfileNamesById(claimantIds),
  ]);
  const error = caseResult.error?.message ?? eventResult.error?.message ?? requestResult.error?.message;
  if (error) return { facts, error };
  const cases = new Map((caseResult.data ?? []).map((row) => [String(row.id), row]));
  for (const row of rows) {
    const incident = cases.get(String(row.incident_case_id));
    const events = (eventResult.data ?? []).filter((event) => event.incident_case_id === row.incident_case_id);
    facts.set(String(row.id), {
      status: asReportStatus(row.status), reviewOutcome: (row.review_outcome as ReviewOutcome | null) ?? null,
      reviewClaimedByName: row.review_claimed_by ? claimantNames.get(String(row.review_claimed_by)) ?? 'an officer' : null,
      reviewClaimedAt: row.review_claimed_at ? String(row.review_claimed_at) : null,
      jurisdictionStatus: (row.jurisdiction_status as LifecycleFacts['jurisdictionStatus']) ?? null,
      incidentVerification: (incident?.verification as LifecycleFacts['incidentVerification']) ?? null,
      incidentState: (incident?.state as LifecycleFacts['incidentState']) ?? null,
      coordination: (incident?.coordination as LifecycleFacts['coordination']) ?? null,
      leadOffice: (incident?.lead_office as LifecycleFacts['leadOffice']) ?? null,
      municipalFinding: (incident?.municipal_finding as LifecycleFacts['municipalFinding']) ?? null,
      hasQualifyingResponseAction: hasCurrentResponseAction(events.map((event) => ({ eventType: event.event_type, occurredAt: event.occurred_at })), incident?.lead_office === 'municipal' ? 'municipal' : 'barangay'),
      legacyResolution: Boolean(incident?.legacy_resolution), withdrawn: Boolean(incident?.withdrawn_at),
      legacyEscalation: (requestResult.data ?? []).some((request) => request.incident_case_id === row.incident_case_id && request.is_legacy),
      legacyHandoff: events.some((event) => event.event_type === 'legacy_handoff'),
    });
  }
  return { facts, error: null };
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
  options?: { limit?: number; offset?: number; jurisdictionOnly?: boolean; queue?: OfficialWorkflowQueue },
): Promise<{
  reports: OfficialReportQueueItem[];
  counts: OfficialStatusCounts;
  error: string | null;
}> {
  const kind = officialKindFromScope(scope);
  const limit = Math.max(1, Math.min(options?.limit ?? 20, 50));
  const offset = Math.max(0, options?.offset ?? 0);
  const queue = options?.jurisdictionOnly ? 'jurisdiction_check' : options?.queue ?? 'all';
  const queueIdsResult = kind !== 'Mayor' || queue !== 'all'
    ? await supabase.rpc('list_official_workflow_report_ids', { p_queue: queue, p_limit: limit, p_offset: offset })
    : { data: null, error: null };
  if (queueIdsResult.error) return { reports: [], counts: emptyCounts(), error: queueIdsResult.error.message };
  const workflowPage = queueIdsResult.data as { ids: string[]; counts: OfficialStatusCounts } | null;
  const queueIds = workflowPage?.ids ?? null;
  if (queueIds && queueIds.length === 0) return { reports: [], counts: workflowPage?.counts ?? emptyCounts(), error: null };

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
      .order('id', { ascending: true })
      .range(queueIds ? 0 : offset, (queueIds ? 0 : offset) + limit - 1);
    if (queueIds) queueQuery = queueQuery.in('id', queueIds);

    // RLS includes the lead/supporting office even for a linked report whose
    // original barangay differs. A client barangay filter would hide that access.
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
  const lifecycleResult = await fetchQueueLifecycleFacts(reportRows, kind !== 'Mayor');
  if (lifecycleResult.error) return { reports: [], counts: emptyCounts(), error: lifecycleResult.error };
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
    const lifecycleFacts = lifecycleResult.facts.get(reportId)!;

    return {
      id: reportId,
      lifecycleFacts,
      lifecycle: deriveLifecycle(lifecycleFacts),
      incidentCaseId: row.incident_case_id ? String(row.incident_case_id) : null,
      reviewClaimedById: row.review_claimed_by ? String(row.review_claimed_by) : null,
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
  if (queueIds) statusQuery = statusQuery.in('id', queueIds);
  const statusResult = workflowPage ? { data: [], error: null } : await statusQuery;
  const allStatusRows = (statusResult.data ?? []).map((row) => ({
    status: asReportStatus(row.status),
  }));

  return {
    reports,
    counts: workflowPage?.counts ?? (statusResult.error ? countStatuses(reports) : countStatuses(allStatusRows)),
    error: statusResult.error?.message ?? activityResult.error ?? null,
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
      reporter_id,
      incident_case_id,
      review_outcome,
      review_reason_code,
      review_claimed_by,
      review_claimed_at,
      jurisdiction_status,
      intake_channel
    `,
    )
    .eq('id', id);

  if (kind === 'BDRRMO') {
    if (!scope.barangay_id) {
      return { detail: null, error: 'Barangay scope is missing for this account.' };
    }
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
        'id, event_type, from_status, to_status, note, detail, created_at, changed_by',
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

  if (mapResult.error || (kind !== 'Mayor' && historyResult.error)) {
    return { detail: null, error: mapResult.error?.message ?? historyResult.error?.message ?? 'Could not load report history.' };
  }

  const mapRow = mapResult.data as unknown as Record<string, unknown> | null;
  const latitude = Number(mapRow?.latitude ?? NaN);
  const longitude = Number(mapRow?.longitude ?? NaN);

  const actorIds = [
    row.verified_by ? String(row.verified_by) : '',
    row.reverified_by ? String(row.reverified_by) : '',
    row.escalated_by ? String(row.escalated_by) : '',
    row.resolved_by ? String(row.resolved_by) : '',
    row.review_claimed_by ? String(row.review_claimed_by) : '',
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
    detail: (event.detail ?? {}) as Record<string, unknown>,
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
  let barangayName: string | null = null;
  if (barangayId) {
    const { data: barangayRow } = await supabase
      .from('barangays')
      .select('name')
      .eq('id', barangayId)
      .maybeSingle();
    barangayName = barangayRow?.name ? String(barangayRow.name) : null;
  }

  const session = await getActiveSession();
  const incidentResult = row.incident_case_id && kind !== 'Mayor'
    ? await fetchIncidentCaseDetail(String(row.incident_case_id), scope)
    : { incident: null, error: null };
  if (incidentResult.error) return { detail: null, error: incidentResult.error };
  const incidentCase = incidentResult.incident;
  const reviewerResult = kind === 'MDRRMO' && !row.incident_case_id
    ? await supabase.rpc('barangay_has_active_bdrrmo', { p_barangay_id: barangayId })
    : { data: true, error: null };
  if (reviewerResult.error) return { detail: null, error: reviewerResult.error.message };
  const reviewClaimedById = row.review_claimed_by ? String(row.review_claimed_by) : null;
  const lifecycleFacts: LifecycleFacts = {
    status, reviewOutcome: row.review_outcome as ReviewOutcome,
    reviewClaimedByName: reviewClaimedById ? namesById.get(reviewClaimedById) ?? 'an officer' : null,
    reviewClaimedAt: row.review_claimed_at ? String(row.review_claimed_at) : null,
    jurisdictionStatus: row.jurisdiction_status as LifecycleFacts['jurisdictionStatus'],
    incidentVerification: incidentCase?.verification ?? null, incidentState: incidentCase?.state ?? null,
    coordination: incidentCase?.coordination ?? null, leadOffice: incidentCase?.leadOffice ?? null,
    municipalFinding: incidentCase?.municipalFinding ?? null,
    hasQualifyingResponseAction: incidentCase?.hasQualifyingResponseAction ?? false,
    legacyResolution: incidentCase?.legacyResolution ?? false, withdrawn: Boolean(incidentCase?.withdrawnAt),
    legacyEscalation: incidentCase?.supportRequests.some((request) => request.isLegacy && request.status === 'requested') ?? false,
    legacyHandoff: incidentCase?.legacyHandoff ?? false,
    barangayHasActiveBdrrmo: Boolean(reviewerResult.data),
  };
  const reviewActions = allowedReviewActions(scope, { ...lifecycleFacts, barangayId, claimedById: reviewClaimedById }, session?.user.id ?? '');
  const canReviewReport = kind === 'BDRRMO' ? barangayId === scope.barangay_id : kind === 'MDRRMO' && !lifecycleFacts.barangayHasActiveBdrrmo;
  const incidentActions = incidentCase ? allowedIncidentActions(scope, incidentCase) : [];
  const incidentLead = incidentCase?.leadOffice === 'municipal' ? kind === 'MDRRMO' : incidentCase?.leadBarangayId === scope.barangay_id;
  const detail: OfficialReportDetail = {
    currentUserId: session?.user.id ?? '',
    id: String(row.id),
    lifecycleFacts,
    lifecycle: deriveLifecycle(lifecycleFacts),
    incidentCase,
    allowedReviewActions: reviewActions,
    allowedIncidentActions: incidentActions,
    reviewClaimedById,
    reviewReasonCode: row.review_reason_code ? String(row.review_reason_code) : null,
    intakeChannel: row.intake_channel as OfficialReportDetail['intakeChannel'],
    canReviewReport,
    canReroute: kind !== 'Mayor' && lifecycleFacts.reviewOutcome === 'pending' && lifecycleFacts.jurisdictionStatus === 'in_coverage',
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    incidentType: isIncidentType(row.incident_type) ? row.incident_type : null,
    incidentTypeOther: row.incident_type_other
      ? String(row.incident_type_other)
      : null,
    status,
    barangayId,
    barangayName,
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
    canContactReporter: Boolean(previewRow?.can_contact) && (!incidentCase || incidentCase.state === 'active'),
    maskedPhone: previewRow?.masked_phone
      ? String(previewRow.masked_phone)
      : null,
    canEditContent:
      kind !== 'Mayor' && String(row.reporter_id) === session?.user?.id && (!incidentCase || incidentLead),
    canCorrectLocation: kind !== 'Mayor' && (!incidentCase || incidentLead),
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
