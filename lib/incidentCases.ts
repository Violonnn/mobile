import type { OfficialAccessScope } from './officialRegistration';
import type { ResponseEventType } from './officialReports';
import type { ResponseEventDetails } from './reportContactFlow';
import type {
  IncidentCoordination,
  IncidentState,
  IncidentVerification,
} from './reportLifecycle';
import { hasCurrentResponseAction } from './reportLifecycle';
import { supabase } from './supabase';
import { getOfficialReportPublicationReview, notifyReportPublicationChanged, processPublicReportPhoto } from './reportPublication';
import { resolveSignedMediaUrls } from './mediaUrlCache';

export type IncidentAction =
  | 'log_event'
  | 'post_progress'
  | 'record_finding'
  | 'request_support'
  | 'request_transfer'
  | 'cancel_request'
  | 'respond_request'
  | 'resolve'
  | 'add_public_summary'
  | 'reopen'
  | 'publish_photo'
  | 'acknowledge_mayor_request'
  | 'answer_mayor_request';
export type IncidentEvent = {
  id: string;
  eventType: string;
  details: Record<string, unknown>;
  note: string | null;
  publicText: string | null;
  createdAt: string;
  occurredAt: string;
  actorName: string | null;
  officeLabel: string;
  isPublic: boolean;
};
export type SupportRequest = {
  id: string;
  incidentCaseId: string;
  sourceReportId: string;
  kind: 'support' | 'transfer';
  status: 'requested' | 'accepted' | 'returned' | 'cancelled';
  requestNote: string | null;
  responseNote: string | null;
  isLegacy: boolean;
  legacyLabel: string | null;
  requestedByName: string | null;
  respondedByName: string | null;
  requestingBarangayId: string;
  barangayName: string | null;
  createdAt: string;
  respondedAt: string | null;
};
export type IncidentCaseDetail = {
  publicLocationMode: 'barangay_only' | 'approximate_area' | 'exact_for_safety';
  publicLocationReason: string | null;
  media: { id: string; reportId: string; type: 'photo' | 'video'; url: string; thumbnailUrl: string | null; isPublic: boolean; publicDisplaySafe: boolean }[];
  id: string;
  sourceReportId: string;
  barangayId: string | null;
  barangayName: string | null;
  verification: IncidentVerification;
  state: IncidentState;
  coordination: IncidentCoordination;
  leadOffice: 'barangay' | 'municipal';
  leadBarangayId: string | null;
  municipalFinding: 'confirmed' | 'not_confirmed' | null;
  confirmedAt: string | null;
  legacyResolution: boolean;
  publicSummary: string | null;
  publicCorrection: string | null;
  publicTitle: string | null;
  publicCaption: string | null;
  publicLandmark: string | null;
  withdrawnAt: string | null;
  isSensitive: boolean;
  createdAt: string;
  events: IncidentEvent[];
  supportRequests: SupportRequest[];
  hasQualifyingResponseAction: boolean;
  latestProgressAt: string | null;
  legacyHandoff: boolean;
};

type DatabaseRow = Record<string, unknown>;
const INCIDENT_FIELDS =
  'id, source_report_id, barangay_id, verification, state, coordination, lead_office, lead_barangay_id, municipal_finding, confirmed_at, municipal_finding_at, legacy_resolution, public_summary, public_correction, public_title, public_caption, public_landmark, withdrawn_at, is_sensitive, public_location_mode, public_location_reason, created_at';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function nullableText(value: unknown): string | null {
  return value == null ? null : String(value);
}

/** All workflow writes use authenticated RPCs; the database checks office scope. */
export async function callReportFlowRpc(
  name: string,
  parameters: Record<string, unknown>,
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc(name, parameters);
    return { error: error?.message ?? null };
  } catch {
    return { error: 'Could not connect. Check your connection and try again.' };
  }
}

export function validateFlowText(
  text: string | null | undefined,
  required = false,
  maximum = 500,
): string | null {
  if (required && !text?.trim()) return 'Enter the required explanation.';
  if ((text?.trim().length ?? 0) > maximum) {
    return `Use ${maximum} characters or fewer.`;
  }
  return null;
}

async function fetchActorNames(
  ids: string[],
): Promise<{ names: Map<string, string>; error: string | null }> {
  const names = new Map<string, string>();
  if (ids.length === 0) return { names, error: null };
  const { data, error } = await supabase.from('app_profiles_public').select(
    'id, first_name, last_name',
  ).in('id', [...new Set(ids)]);
  for (const row of data ?? []) {
    names.set(
      String(row.id),
      [row.first_name, row.last_name].filter(Boolean).join(' '),
    );
  }
  return { names, error: error?.message ?? null };
}

export async function fetchIncidentEvents(
  incidentCaseId: string,
): Promise<{ events: IncidentEvent[]; error: string | null }> {
  if (!UUID_PATTERN.test(incidentCaseId)) {
    return { events: [], error: 'Invalid incident id.' };
  }
  const { data, error } = await supabase.from('incident_events')
    .select(
      'id, event_type, actor_id, actor_office, actor_barangay_id, details, note, is_public, occurred_at, created_at',
    )
    .eq('incident_case_id', incidentCaseId).order('occurred_at', {
      ascending: true,
    });
  if (error) return { events: [], error: error.message };
  const rows = (data ?? []) as DatabaseRow[];
  const [actors, barangays] = await Promise.all([
    fetchActorNames(
      rows.flatMap((row) => row.actor_id ? [String(row.actor_id)] : []),
    ),
    supabase.from('barangays').select('id, name'),
  ]);
  if (actors.error || barangays.error) {
    return {
      events: [],
      error: actors.error ?? barangays.error?.message ??
        'Could not load event attribution.',
    };
  }
  const barangayNames = new Map(
    (barangays.data ?? []).map((row) => [String(row.id), String(row.name)]),
  );
  return {
    events: rows.map((row) => {
      const details = (row.details ?? {}) as Record<string, unknown>;
      return {
        id: String(row.id),
        eventType: String(row.event_type),
        details,
        note: nullableText(row.note),
        publicText: nullableText(
          details.public_text ?? (row.is_public ? details.text : null),
        ),
        createdAt: String(row.created_at),
        occurredAt: String(row.occurred_at),
        actorName: row.actor_id
          ? actors.names.get(String(row.actor_id)) ?? 'Official'
          : 'System',
        officeLabel: row.actor_office === 'municipal'
          ? 'MDRRMO'
          : row.actor_office === 'barangay'
          ? `Brgy. ${
            barangayNames.get(String(row.actor_barangay_id)) ??
              'assigned barangay'
          } BDRRMO`
          : 'System',
        isPublic: Boolean(row.is_public),
      };
    }),
    error: null,
  };
}

async function fetchSupportRequests(
  incidentCaseId?: string,
): Promise<{ requests: SupportRequest[]; error: string | null }> {
  let query = supabase.from('incident_support_requests')
    .select(
      'id, incident_case_id, kind, status, request_note, response_note, is_legacy, legacy_label, requested_by, responded_by, requesting_barangay_id, created_at, responded_at',
    )
    .order('created_at', { ascending: false });
  query = incidentCaseId
    ? query.eq('incident_case_id', incidentCaseId)
    : query.eq('status', 'requested');
  const { data, error } = await query;
  if (error) return { requests: [], error: error.message };
  if (!data?.length) return { requests: [], error: null };
  const [actors, cases, barangays] = await Promise.all([
    fetchActorNames(
      data.flatMap((row) =>
        [row.requested_by, row.responded_by].filter(Boolean).map(String)
      ),
    ),
    supabase.from('incident_cases').select('id, source_report_id').in('id', [
      ...new Set(data.map((row) => String(row.incident_case_id))),
    ]),
    supabase.from('barangays').select('id, name'),
  ]);
  if (actors.error || cases.error || barangays.error) {
    return {
      requests: [],
      error: actors.error ?? cases.error?.message ?? barangays.error?.message ??
        'Could not load requests.',
    };
  }
  const sourceReports = new Map(
    (cases.data ?? []).map((
      row,
    ) => [String(row.id), String(row.source_report_id)]),
  );
  const barangayNames = new Map(
    (barangays.data ?? []).map((row) => [String(row.id), String(row.name)]),
  );
  return {
    requests: data.map((row) => ({
      id: String(row.id),
      incidentCaseId: String(row.incident_case_id),
      sourceReportId: sourceReports.get(String(row.incident_case_id)) ?? '',
      kind: row.kind as SupportRequest['kind'],
      status: row.status as SupportRequest['status'],
      requestNote: nullableText(row.request_note),
      responseNote: nullableText(row.response_note),
      isLegacy: Boolean(row.is_legacy),
      legacyLabel: nullableText(row.legacy_label),
      requestedByName: actors.names.get(String(row.requested_by)) ?? null,
      respondedByName: actors.names.get(String(row.responded_by)) ?? null,
      requestingBarangayId: String(row.requesting_barangay_id),
      barangayName: barangayNames.get(String(row.requesting_barangay_id)) ??
        null,
      createdAt: String(row.created_at),
      respondedAt: nullableText(row.responded_at),
    })),
    error: null,
  };
}

export async function fetchOpenSupportRequests(
  scope: OfficialAccessScope,
): Promise<{ requests: SupportRequest[]; error: string | null }> {
  if (scope.role !== 'officer') {
    return { requests: [], error: 'Operational officer access is required.' };
  }
  return fetchSupportRequests();
}

export async function fetchIncidentCaseDetail(
  incidentCaseId: string,
  scope: OfficialAccessScope,
): Promise<{ incident: IncidentCaseDetail | null; error: string | null }> {
  if (scope.role !== 'officer' || !UUID_PATTERN.test(incidentCaseId)) {
    return { incident: null, error: 'Incident is unavailable in your scope.' };
  }
  const { data: row, error } = await supabase.from('incident_cases').select(
    INCIDENT_FIELDS,
  ).eq('id', incidentCaseId).maybeSingle();
  if (error || !row) {
    return {
      incident: null,
      error: error?.message ?? 'Incident not found in your scope.',
    };
  }
  const [eventsResult, requestsResult, barangayResult] = await Promise.all([
    fetchIncidentEvents(incidentCaseId),
    fetchSupportRequests(incidentCaseId),
    row.barangay_id
      ? supabase.from('barangays').select('name').eq('id', row.barangay_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (eventsResult.error || requestsResult.error || barangayResult.error) {
    return {
      incident: null,
      error: eventsResult.error ?? requestsResult.error ??
        barangayResult.error?.message ?? 'Could not load incident.',
    };
  }
  const progress = eventsResult.events.filter((event) =>
    event.eventType === 'progress_update'
  );
  const linked = await supabase.from('reports').select('id').eq('incident_case_id', incidentCaseId);
  if (linked.error) return { incident: null, error: linked.error.message };
  const reportIds = (linked.data ?? []).map((report) => String(report.id));
  const mediaResult = reportIds.length ? await supabase.from('report_media')
    .select('id,report_id,type,display_storage_path,thumbnail_storage_path,public_approved_at')
    .in('report_id', reportIds) : { data: [], error: null };
  if (mediaResult.error) return { incident: null, error: mediaResult.error.message };
  const photoRows = (mediaResult.data ?? []).filter((media) => media.type === 'photo');
  const signed = await resolveSignedMediaUrls({ bucket: 'report-media', variant: 'detail',
    storagePaths: photoRows.flatMap((media) => [media.display_storage_path, media.thumbnail_storage_path].filter((path): path is string => Boolean(path))),
  });
  if (signed.error) return { incident: null, error: signed.error };
  const reviews = await Promise.all(reportIds.map((reportId) => getOfficialReportPublicationReview(reportId)));
  const photoReviewById = new Map(reviews.flatMap((result) => result.review?.media.map((media) => [media.mediaId, media] as const) ?? []));
  const incidentCanPublishPhotos = row.verification === 'confirmed' && row.withdrawn_at == null && row.is_sensitive !== true;
  return {
    incident: {
      id: String(row.id),
      sourceReportId: String(row.source_report_id),
      barangayId: nullableText(row.barangay_id),
      barangayName: barangayResult.data?.name ?? null,
      verification: row.verification as IncidentVerification,
      state: row.state as IncidentState,
      coordination: row.coordination as IncidentCoordination,
      leadOffice: row.lead_office as 'barangay' | 'municipal',
      leadBarangayId: nullableText(row.lead_barangay_id),
      municipalFinding: row
        .municipal_finding as IncidentCaseDetail['municipalFinding'],
      confirmedAt: nullableText(row.confirmed_at),
      legacyResolution: Boolean(row.legacy_resolution),
      publicSummary: nullableText(row.public_summary),
      publicCorrection: nullableText(row.public_correction),
      publicTitle: nullableText(row.public_title),
      publicCaption: nullableText(row.public_caption),
      publicLandmark: nullableText(row.public_landmark),
      withdrawnAt: nullableText(row.withdrawn_at),
      isSensitive: Boolean(row.is_sensitive),
      publicLocationMode: row.public_location_mode as IncidentCaseDetail['publicLocationMode'],
      publicLocationReason: nullableText(row.public_location_reason),
      media: photoRows.map((media) => {
        const photoReview = photoReviewById.get(String(media.id));
        const safeCopyVerified = photoReview?.safeCopyVerified === true;
        return { id: String(media.id), reportId: String(media.report_id), type: 'photo',
        url: signed.urls.get(String(media.display_storage_path)) ?? '',
        thumbnailUrl: signed.urls.get(String(media.thumbnail_storage_path)) ?? null,
        isPublic: incidentCanPublishPhotos && safeCopyVerified && photoReview?.isPublicApproved === true,
        publicDisplaySafe: safeCopyVerified,
      };
      }),
      createdAt: String(row.created_at),
      events: eventsResult.events,
      supportRequests: requestsResult.requests,
      hasQualifyingResponseAction: hasCurrentResponseAction(
        eventsResult.events,
        row.lead_office as 'barangay' | 'municipal',
      ),
      latestProgressAt: progress.at(-1)?.createdAt ?? null,
      legacyHandoff: eventsResult.events.some((event) =>
        event.eventType === 'legacy_handoff'
      ),
    },
    error: null,
  };
}

export function allowedIncidentActions(
  scope: OfficialAccessScope,
  incident: IncidentCaseDetail,
): IncidentAction[] {
  if (scope.role !== 'officer') return [];
  const municipal = !scope.barangay_id;
  const lead = incident.leadOffice === 'municipal'
    ? municipal
    : scope.barangay_id === incident.leadBarangayId;
  const supporter = municipal
    ? incident.leadOffice === 'barangay' &&
      incident.coordination === 'support_active'
    : incident.leadOffice === 'municipal' &&
      scope.barangay_id === incident.barangayId;
  const openRequest = incident.supportRequests.some((request) =>
    request.status === 'requested'
  );
  if (incident.state !== 'active') {
    if (!lead) return [];
    return incident.state === 'resolved' && incident.legacyResolution &&
        !incident.publicSummary
      ? ['reopen', 'add_public_summary', 'publish_photo']
      : ['reopen', 'publish_photo'];
  }
  const actions: IncidentAction[] = [];
  if (lead || supporter) actions.push('log_event');
  if (municipal && openRequest) actions.push('respond_request');
  if (!lead) return actions;
  actions.push('publish_photo');
  actions.push('post_progress');
  if (
    incident.verification === 'pending' ||
    (municipal && incident.municipalFinding === null)
  ) actions.push('record_finding');
  if (!municipal && !openRequest) {
    if (incident.coordination === 'local') actions.push('request_support');
    if (
      incident.coordination === 'local' ||
      incident.coordination === 'support_active'
    ) actions.push('request_transfer');
  }
  if (!municipal && openRequest) actions.push('cancel_request');
  if (
    incident.verification === 'confirmed' &&
    (!municipal || incident.municipalFinding === 'confirmed') && !openRequest
  ) actions.push('resolve');
  return actions;
}

async function incidentMutation(
  name: string,
  idKey: string,
  id: string,
  fields: Record<string, unknown>,
  validationError: string | null = null,
) {
  if (!UUID_PATTERN.test(id)) {
    return { error: 'Invalid incident or request id.' };
  }
  if (validationError) return { error: validationError };
  return callReportFlowRpc(name, { [idKey]: id, ...fields });
}

export async function recordIncidentFinding(
  input: {
    incidentCaseId: string;
    finding: 'confirmed' | 'not_confirmed';
    note: string;
    publicCorrection?: string | null;
    operationId?: string;
    reportPublications?: {
      reportId: string;
      publish: boolean;
      publicationAcknowledged: boolean;
      approveReporterName: boolean;
      approveReporterAvatar: boolean;
      approveExactLocation: boolean;
      photoMediaIds: string[];
    }[];
    markIncidentSensitive?: boolean;
    sensitivityReason?: string | null;
  },
): Promise<{ error: string | null; publicAvailable?: boolean; publicationStatus?: string | null }> {
  if (!UUID_PATTERN.test(input.incidentCaseId)) return { error: 'Invalid incident id.' };
  const validationError = validateFlowText(input.note, true) ??
    validateFlowText(input.publicCorrection, false, 280) ??
    validateFlowText(input.sensitivityReason, Boolean(input.markIncidentSensitive), 280);
  if (validationError) return { error: validationError };
  const publications = input.reportPublications ?? [];
  if (input.finding === 'confirmed' && !input.markIncidentSensitive) {
    for (const publication of publications) {
      if (!publication.publish) continue;
      for (const mediaId of publication.photoMediaIds) {
        const result = await processPublicReportPhoto(publication.reportId, mediaId);
        if (result.error) return result;
      }
    }
  }
  const operationId = input.operationId ?? (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
      const randomValue = Math.floor(Math.random() * 16);
      const value = character === 'x' ? randomValue : (randomValue & 0x3) | 0x8;
      return value.toString(16);
    }));
  try {
    const { data, error } = await supabase.rpc('record_incident_finding_with_publication', {
      p_operation_id: operationId,
      p_incident_case_id: input.incidentCaseId,
      p_finding: input.finding,
      p_note: input.note.trim(),
      p_public_correction: input.publicCorrection?.trim() || null,
      p_report_publications: publications,
      p_mark_incident_sensitive: input.markIncidentSensitive ?? false,
      p_sensitivity_reason: input.sensitivityReason?.trim() || null,
    });
    if (error) return { error: error.message };
    notifyReportPublicationChanged();
    const result = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    return {
      error: null,
      publicAvailable: result.publicAvailable === true,
      publicationStatus: typeof result.publicationStatus === 'string' ? result.publicationStatus : null,
    };
  } catch {
    return { error: 'Could not connect. Check your connection and try again.' };
  }
}
export function requestMunicipalSupport(
  input: { incidentCaseId: string; kind: 'support' | 'transfer'; note: string },
) {
  return incidentMutation(
    'request_municipal_support',
    'p_incident_case_id',
    input.incidentCaseId,
    { p_kind: input.kind, p_note: input.note.trim() || null },
    validateFlowText(input.note, input.kind === 'transfer'),
  );
}
export function cancelSupportRequest(
  input: { requestId: string; note?: string | null },
) {
  return incidentMutation(
    'cancel_support_request',
    'p_request_id',
    input.requestId,
    { p_note: input.note?.trim() || null },
    validateFlowText(input.note),
  );
}
export function respondSupportRequest(
  input: {
    requestId: string;
    decision: 'accept' | 'return';
    note?: string | null;
  },
) {
  return incidentMutation(
    'respond_support_request',
    'p_request_id',
    input.requestId,
    { p_decision: input.decision, p_note: input.note?.trim() || null },
    validateFlowText(input.note, input.decision === 'return'),
  );
}
export function logIncidentEvent(
  input: {
    incidentCaseId: string;
    eventType: ResponseEventType;
    details: ResponseEventDetails;
    note: string;
    occurredAt?: string | null;
  },
) {
  return incidentMutation(
    'log_incident_event',
    'p_incident_case_id',
    input.incidentCaseId,
    {
      p_event_type: input.eventType,
      p_details: input.details,
      p_note: input.note.trim() || null,
      p_is_public: false,
      p_occurred_at: input.occurredAt ?? null,
    },
    validateFlowText(input.note),
  );
}
export async function postProgressUpdate(
  input: { incidentCaseId: string; text: string },
): Promise<{ error: string | null; retryAfterMinutes: number | null }> {
  const result = await incidentMutation(
    'log_incident_event',
    'p_incident_case_id',
    input.incidentCaseId,
    {
      p_event_type: 'progress_update',
      p_details: { text: input.text.trim() },
      p_note: null,
      p_is_public: true,
    },
    validateFlowText(input.text, true, 280),
  );
  let retryAfterMinutes: number | null = null;
  if (result.error?.includes('ten minutes')) {
    const latest = await supabase.from('incident_events').select('created_at')
      .eq('incident_case_id', input.incidentCaseId).eq('event_type', 'progress_update')
      .eq('is_public', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!latest.error && latest.data) {
      const nextAllowedAt = Date.parse(latest.data.created_at) + 10 * 60_000;
      if (Number.isFinite(nextAllowedAt)) retryAfterMinutes = Math.max(1, Math.ceil((nextAllowedAt - Date.now()) / 60_000));
    }
  }
  return {
    ...result,
    retryAfterMinutes,
  };
}
export function resolveIncident(
  input: { incidentCaseId: string; outcomeNote: string; publicSummary: string },
) {
  return incidentMutation(
    'resolve_incident',
    'p_incident_case_id',
    input.incidentCaseId,
    {
      p_outcome_note: input.outcomeNote.trim(),
      p_public_summary: input.publicSummary.trim(),
    },
    validateFlowText(input.outcomeNote, true) ??
      validateFlowText(input.publicSummary, true, 280),
  );
}
export function addPublicSummary(
  input: { incidentCaseId: string; publicSummary: string },
) {
  return incidentMutation(
    'add_public_summary',
    'p_incident_case_id',
    input.incidentCaseId,
    { p_public_summary: input.publicSummary.trim() },
    validateFlowText(input.publicSummary, true, 280),
  );
}
export function reopenIncident(
  input: { incidentCaseId: string; reason: string },
) {
  return incidentMutation(
    'reopen_incident',
    'p_incident_case_id',
    input.incidentCaseId,
    { p_reason: input.reason.trim() },
    validateFlowText(input.reason, true),
  );
}

export function setReportMediaPublic(input: { mediaId: string; makePublic: boolean; reason?: string | null }) {
  return notifyAfterPublicationChange(incidentMutation('set_report_media_public', 'p_media_id', input.mediaId,
    { p_make_public: input.makePublic, p_reason: input.reason?.trim() || null }, validateFlowText(input.reason)));
}

export function setIncidentSensitive(input: { incidentCaseId: string; isSensitive: boolean; reason: string }) {
  return notifyAfterPublicationChange(incidentMutation('set_incident_sensitive', 'p_incident_case_id', input.incidentCaseId,
    { p_is_sensitive: input.isSensitive, p_reason: input.reason.trim() }, validateFlowText(input.reason, true)));
}

export function setIncidentPublicLocation(input: { incidentCaseId: string; mode: IncidentCaseDetail['publicLocationMode']; reason?: string | null }) {
  return notifyAfterPublicationChange(incidentMutation('set_incident_public_location', 'p_incident_case_id', input.incidentCaseId,
    { p_mode: input.mode, p_reason: input.reason?.trim() || null }, validateFlowText(input.reason, input.mode === 'exact_for_safety')));
}

async function notifyAfterPublicationChange(
  resultPromise: Promise<{ error: string | null }>,
): Promise<{ error: string | null }> {
  const result = await resultPromise;
  if (!result.error) notifyReportPublicationChanged();
  return result;
}

export const PUBLIC_POST_LIMITS = { title: 80, caption: 500, landmark: 120 } as const;

/** Publishes or clears the screened resident-facing post; pass null title and caption to clear it. */
export function setIncidentPublicPost(input: {
  incidentCaseId: string;
  title: string | null;
  caption: string | null;
  landmark?: string | null;
}) {
  const title = input.title?.trim() || null;
  const caption = input.caption?.trim() || null;
  const landmark = input.landmark?.trim() || null;
  const pairError = Boolean(title) !== Boolean(caption)
    ? 'Enter both a public title and a caption, or clear both.'
    : null;
  const landmarkError = landmark && !title ? 'Add a public title and caption before the landmark.' : null;
  return notifyAfterPublicationChange(incidentMutation('set_incident_public_post', 'p_incident_case_id', input.incidentCaseId,
    { p_title: title, p_caption: caption, p_landmark: landmark },
    pairError ?? landmarkError
      ?? validateFlowText(title, false, PUBLIC_POST_LIMITS.title)
      ?? validateFlowText(caption, false, PUBLIC_POST_LIMITS.caption)
      ?? validateFlowText(landmark, false, PUBLIC_POST_LIMITS.landmark)));
}

export type LegacyIncidentComment = { id: string; body: string; createdAt: string; alreadyPublic: boolean };
export async function fetchLegacyIncidentComments(incidentCaseId: string, offset = 0): Promise<{ comments: LegacyIncidentComment[]; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('list_legacy_incident_comments', { p_incident_case_id: incidentCaseId, p_limit: 20, p_offset: Math.max(0, offset) });
    return { comments: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id), body: String(row.body), createdAt: String(row.created_at), alreadyPublic: row.already_public === true,
    })), error: error?.message ?? null };
  } catch { return { comments: [], error: 'Could not load source discussion. Try again.' }; }
}

export function publishLegacyIncidentComment(commentId: string) {
  return incidentMutation('publish_legacy_incident_comment', 'p_comment_id', commentId, {});
}
