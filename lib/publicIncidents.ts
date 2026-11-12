import { isIncidentType, type IncidentType } from './incidentTypes';
import { resolveSignedMediaUrls } from './mediaUrlCache';
import { supabase } from './supabase';
import { RESIDENT_STAGE_TONES, residentStageTone, type LifecycleSummary, type StageTone } from './reportLifecycle';
import { mapPublicResidentReportRecord, type PublicResidentReport } from './reportPublication';
import { mapPublicPhotoUrlPairs } from './publicPhotoPairs';

export type PublicIncidentStatusFilter = 'all' | 'confirmed' | 'response_ongoing' | 'resolved' | 'withdrawn';
export const PUBLIC_INCIDENT_STATUS_OPTIONS: { value: PublicIncidentStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'response_ongoing', label: 'Response ongoing' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'withdrawn', label: 'Corrections' },
];

export function publicIncidentLifecycle(publicStatus: string): LifecycleSummary | null {
  if (!['confirmed', 'response_ongoing', 'resolved', 'withdrawn'].includes(publicStatus)) return null;
  return {
    primaryStage: publicStatus as 'confirmed' | 'response_ongoing' | 'resolved' | 'withdrawn',
    coordinationBadge: null,
    summaryMissing: false,
  };
}

export function publicIncidentLocationLabel(incident: PublicIncident): string {
  if (incident.publicLocationMode === 'exact_shared' && incident.exactLocation) {
    return `Exact location shared by the reporter Â· Brgy. ${incident.barangayName}`;
  }
  if (incident.publicLocationMode === 'exact_for_safety' && incident.exactLocation) {
    return `Safety location · ${incident.barangayName}: ${incident.exactLocation.reason}`;
  }
  if (incident.publicLocationMode === 'approximate_area' && incident.approximateArea) {
    return `Approximate location · Brgy. ${incident.barangayName}`;
  }
  return `Brgy. ${incident.barangayName} · Location kept private`;
}

/** Short label for compact rows; location precision stays in the detail view. */
export function publicIncidentBarangayLabel(incident: PublicIncident): string {
  return `Brgy. ${incident.barangayName}`;
}

export function publicIncidentStatusLabel(status: string): string {
  if (status === 'response_ongoing') return 'Response ongoing';
  if (status === 'resolved') return 'Resolved';
  if (status === 'withdrawn') return 'Confirmation withdrawn';
  return status === 'confirmed' ? 'Confirmed' : 'Incident update';
}

export function publicIncidentTone(status: string): StageTone {
  const lifecycle = publicIncidentLifecycle(status);
  return lifecycle ? residentStageTone(lifecycle) : RESIDENT_STAGE_TONES.confirmed;
}

export type PublicIncident = {
  incidentCaseId: string;
  /** Distinguishes individual screened resident posts that share one incident. */
  reportId?: string;
  reporterName?: string | null;
  reporterAvatarUrl?: string | null;
  incidentType: IncidentType | null;
  publicTypeLabel: string;
  /** Screened copy of the resident report. Officials publish it; it is never the raw report. */
  publicTitle: string | null;
  publicCaption: string | null;
  publicLandmark: string | null;
  engagement: IncidentEngagement;
  barangayName: string;
  publicLocationMode: 'barangay_only' | 'approximate_area' | 'exact_for_safety' | 'exact_shared';
  approximateArea: { latitude: number; longitude: number } | null;
  exactLocation: { latitude: number; longitude: number; reason: string } | null;
  publicStatus: string;
  confirmedAt: string | null;
  lastPublicUpdateAt: string | null;
  latestPublicUpdate: string | null;
  publicSummary: string | null;
  publicCorrection: string | null;
  linkedReportCount: number;
  publicPhotoIdentities: string[];
  publicPhotoThumbnails: Array<string | null>;
  publicPhotoDisplays: Array<string | null>;
  photoError: string | null;
};
export type PublicIncidentUpdate = { occurredAt: string; entryType: string; publicText: string };
export type IncidentEngagement = { upvoteCount: number; commentCount: number; hasUpvoted: boolean };
type PublicRow = Record<string, unknown>;

/** Preserve separate report posts while replacing refreshed versions of the same post. */
export function mergePublicIncidentPosts(current: PublicIncident[], incoming: PublicIncident[]): PublicIncident[] {
  return [...new Map([...current, ...incoming].map((incident) => [incident.reportId ?? incident.incidentCaseId, incident])).values()];
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

async function mapPublicRows(rows: PublicRow[]): Promise<PublicIncident[]> {
  const paths = rows.flatMap((row) => [
    ...(Array.isArray(row.public_photo_display_paths) ? row.public_photo_display_paths : []),
    ...(Array.isArray(row.public_photo_thumbnail_paths) ? row.public_photo_thumbnail_paths : []),
  ]).filter((path): path is string => typeof path === 'string');
  // Only paths explicitly returned by the public projection are ever signed.
  const signed = paths.length ? await resolveSignedMediaUrls({
    bucket: 'report-media', storagePaths: [...new Set(paths)], variant: 'public-photo',
  }) : { urls: new Map<string, string>(), error: null };
  return rows.map((row) => {
    const publicLocationMode = row.public_location_mode === 'exact_for_safety'
      ? 'exact_for_safety' : row.public_location_mode === 'approximate_area' ? 'approximate_area' : 'barangay_only';
    const approximateArea = publicLocationMode === 'approximate_area' && row.approx_latitude != null && row.approx_longitude != null
      ? { latitude: Number(row.approx_latitude), longitude: Number(row.approx_longitude) } : null;
    const exactLocation = publicLocationMode === 'exact_for_safety' && row.exact_latitude != null && row.exact_longitude != null && optionalText(row.safety_location_reason)
      ? { latitude: Number(row.exact_latitude), longitude: Number(row.exact_longitude), reason: String(row.safety_location_reason) } : null;
    const photoPairs = mapPublicPhotoUrlPairs(
      row.public_photo_display_paths,
      row.public_photo_thumbnail_paths,
      signed.urls,
    );
    return {
      incidentCaseId: String(row.incident_case_id),
      incidentType: isIncidentType(row.incident_type) ? row.incident_type : null,
      publicTypeLabel: String(row.public_type_label ?? 'Incident'),
      publicTitle: optionalText(row.public_title),
      publicCaption: optionalText(row.public_caption),
      publicLandmark: optionalText(row.public_landmark),
      engagement: {
        upvoteCount: Number(row.support_count ?? 0),
        commentCount: Number(row.comment_count ?? 0),
        hasUpvoted: row.has_supported === true,
      },
      barangayName: String(row.barangay_name ?? 'Municipality'),
      publicLocationMode, approximateArea, exactLocation,
      publicStatus: String(row.public_status ?? 'confirmed'),
      confirmedAt: optionalText(row.confirmed_at), lastPublicUpdateAt: optionalText(row.last_public_update_at),
      latestPublicUpdate: optionalText(row.latest_public_update), publicSummary: optionalText(row.public_summary),
      publicCorrection: optionalText(row.public_correction), linkedReportCount: Number(row.linked_report_count ?? 0),
      publicPhotoIdentities: photoPairs.map((pair) => pair.identity),
      publicPhotoThumbnails: photoPairs.map((pair) => pair.thumbnailUrl),
      publicPhotoDisplays: photoPairs.map((pair) => pair.displayUrl),
      photoError: signed.error,
    };
  });
}

export function mapPublicReportToIncident(report: PublicResidentReport): PublicIncident {
  return {
    incidentCaseId: report.incidentCaseId,
    reportId: report.reportId,
    reporterName: report.reporterName,
    reporterAvatarUrl: report.reporterAvatarUrl,
    incidentType: report.incidentType,
    publicTypeLabel: report.publicTypeLabel,
    publicTitle: report.publicTitle,
    publicCaption: report.publicDescription,
    publicLandmark: null,
    engagement: report.engagement,
    barangayName: report.barangayName,
    publicLocationMode: report.publicLocationMode,
    approximateArea: report.approximateArea,
    exactLocation: report.exactLocation ? { ...report.exactLocation, reason: '' } : null,
    publicStatus: report.publicStatus,
    confirmedAt: report.confirmedAt ?? report.createdAt,
    lastPublicUpdateAt: report.latestPublicUpdateAt,
    latestPublicUpdate: report.latestPublicUpdate,
    publicSummary: report.publicSummary,
    publicCorrection: report.publicCorrection,
    linkedReportCount: 1,
    publicPhotoIdentities: report.publicPhotos.map((pair) => pair.identity),
    publicPhotoThumbnails: report.publicPhotos.map((pair) => pair.thumbnailUrl),
    publicPhotoDisplays: report.publicPhotos.map((pair) => pair.displayUrl),
    photoError: report.photoError,
  };
}

export async function fetchPublicIncidents(options?: { barangayId?: string | null; limit?: number; offset?: number }): Promise<{
  incidents: PublicIncident[]; error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc('list_public_community_posts', {
      p_barangay_id: options?.barangayId ?? null,
      p_limit: Math.max(1, Math.min(options?.limit ?? 50, 100)),
      p_offset: Math.max(0, options?.offset ?? 0),
    });
    if (error) return { incidents: [], error: error.message };
    const posts = (data ?? []) as { post_kind?: unknown; post_data?: unknown }[];
    const incidents = await Promise.all(posts.map(async (post) => {
      const row = (post.post_data ?? {}) as PublicRow;
      if (post.post_kind === 'report') {
        return mapPublicReportToIncident(await mapPublicResidentReportRecord(row));
      }
      const [incident] = await mapPublicRows([row]);
      return incident;
    }));
    return { incidents, error: null };
  } catch {
    return { incidents: [], error: 'Could not load incidents. Check your connection and try again.' };
  }
}

export async function fetchPublicIncident(incidentCaseId: string): Promise<{
  incident: PublicIncident | null; updates: PublicIncidentUpdate[]; error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc('get_public_incident', { p_incident_case_id: incidentCaseId });
    if (error || !data?.incident) return { incident: null, updates: [], error: error?.message ?? 'This incident is no longer publicly available.' };
    const [incident] = await mapPublicRows([data.incident as PublicRow]);
    const updates = ((data.updates ?? []) as PublicRow[]).filter((row) => optionalText(row.public_text)).map((row) => ({
      occurredAt: String(row.occurred_at), entryType: String(row.entry_type), publicText: String(row.public_text),
    }));
    return { incident, updates, error: null };
  } catch {
    return { incident: null, updates: [], error: 'Could not load this incident. Check your connection and try again.' };
  }
}

export async function fetchIncidentEngagement(incidentCaseId: string, toggleSupport = false): Promise<{
  engagement: IncidentEngagement | null; error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc(toggleSupport ? 'toggle_incident_upvote' : 'get_incident_engagement', { p_incident_case_id: incidentCaseId });
    return { engagement: error || !data ? null : {
      upvoteCount: Number(data.upvote_count ?? 0), commentCount: Number(data.comment_count ?? 0), hasUpvoted: data.has_upvoted === true,
    }, error: error?.message ?? null };
  } catch {
    return { engagement: null, error: 'Could not load incident support. Check your connection and try again.' };
  }
}
