import { allowedReviewActions, type OfficialReportDetail, type OfficialReportQueueItem } from '../officialReports';
import type { OfficialAccessScope } from '../officialRegistration';
import type { IncidentCaseDetail } from '../incidentCases';
import type { AnnouncementRecord } from '../announcements';
import { deriveLifecycle, type LifecycleFacts } from '../reportLifecycle';

function previewReport(
  id: string,
  title: string,
  overrides: Partial<LifecycleFacts>,
): OfficialReportQueueItem {
  const lifecycleFacts: LifecycleFacts = {
    status: 'unverified', reviewOutcome: 'pending', reviewClaimedByName: null,
    reviewClaimedAt: null, jurisdictionStatus: 'in_coverage', incidentVerification: null,
    incidentState: null, coordination: null, leadOffice: 'barangay', municipalFinding: null,
    hasQualifyingResponseAction: false, legacyResolution: false, withdrawn: false,
    legacyEscalation: false, ...overrides,
  };
  const reporter = { id: 'preview-reporter', firstName: 'Preview', lastName: 'Reporter', middleName: null, avatarPath: null };
  return {
    id, title, description: 'Water is rising beside the road. The nearby footpath is affected.',
    incidentType: 'flood', incidentTypeOther: null, status: lifecycleFacts.status,
    lifecycleFacts, lifecycle: deriveLifecycle(lifecycleFacts), incidentCaseId: null,
    reviewClaimedById: null, barangayId: 'preview-barangay', barangayName: 'Calajo-an',
    addressText: 'Near the barangay road and footpath', createdAt: '2026-11-18T01:00:00Z',
    latestActivityAt: '2026-11-18T02:00:00Z', verifiedAt: null, verifiedByName: null,
    escalatedAt: null, escalatedByName: null, escalationNote: null, resolvedAt: null,
    reporterName: 'Preview Reporter', reporterInitial: 'P', reporter,
    latitude: 10.24, longitude: 123.79, firstPhotoUrl: null, mediaCount: 0,
    media: [], mediaError: null, upvoteCount: 0, commentCount: 0,
  };
}

/** Synthetic display fixtures; no real report IDs, account information or mutations. */
export const reportUiPreviewReports = [
  previewReport('preview-review', 'Roadside flooding', {
    reviewClaimedByName: 'Assigned response officer', reviewClaimedAt: '2026-11-18T01:10:00Z',
  }),
  previewReport('preview-transfer', 'Flooding near the access road', {
    status: 'verified', reviewOutcome: 'verified', incidentVerification: 'confirmed',
    incidentState: 'active', coordination: 'transfer_requested',
  }),
  previewReport('preview-response', 'Response at the roadside', {
    status: 'verified', reviewOutcome: 'verified', incidentVerification: 'confirmed',
    incidentState: 'active', coordination: 'support_active', hasQualifyingResponseAction: true,
  }),
  previewReport('preview-resolved', 'Resolved report awaiting its summary', {
    status: 'resolved', incidentState: 'resolved', legacyResolution: true,
  }),
];

export function reportUiPreviewScope(municipal: boolean): OfficialAccessScope {
  return { role: 'officer', barangay_id: municipal ? null : 'preview-barangay', barangay_name: municipal ? null : 'Calajo-an', email: 'preview@example.test' };
}

export function reportUiPreviewDetail(municipal: boolean, claimed: boolean): OfficialReportDetail {
  const report = previewReport('preview-review', 'Roadside flooding', {
    barangayHasActiveBdrrmo: !municipal,
    reviewClaimedByName: claimed ? 'Preview officer' : null,
    reviewClaimedAt: claimed ? '2026-11-18T01:10:00Z' : null,
  });
  const currentUserId = 'preview-officer';
  const reviewClaimedById = claimed ? currentUserId : null;
  return {
    ...report, currentUserId, reviewClaimedById, incidentCase: null,
    allowedReviewActions: allowedReviewActions(reportUiPreviewScope(municipal), { ...report.lifecycleFacts, barangayId: report.barangayId, claimedById: reviewClaimedById }, currentUserId),
    allowedIncidentActions: [], reviewReasonCode: null, intakeChannel: 'resident_app',
    canReviewReport: true, canReroute: true, latitude: 10.24, longitude: 123.79,
    deviceLatitude: null, deviceLongitude: null, gpsAccuracyMeters: null,
    locationAdjustmentMeters: null, verified: { name: null, at: null },
    reverified: { name: null, at: null }, escalated: { name: null, at: null },
    resolved: { name: null, at: null }, reverifiedAt: null, timeline: [],
    canContactReporter: true, maskedPhone: null, canEditContent: false,
    canCorrectLocation: true, allowedTransitions: [],
  };
}

export const reportUiPreviewIncident: IncidentCaseDetail = {
  id: 'preview-incident', sourceReportId: 'preview-transfer', barangayId: 'preview-barangay',
  barangayName: 'Calajo-an', verification: 'confirmed', state: 'active',
  coordination: 'transfer_requested', leadOffice: 'barangay', leadBarangayId: 'preview-barangay',
  municipalFinding: null, confirmedAt: '2026-11-18T01:15:00Z', legacyResolution: false,
  publicSummary: null, publicCorrection: null, publicTitle: null, publicCaption: null,
  publicLandmark: null, withdrawnAt: null, isSensitive: false,
  publicLocationMode: 'barangay_only', publicLocationReason: null, media: [],
  createdAt: '2026-11-18T01:00:00Z', events: [], hasQualifyingResponseAction: false,
  latestProgressAt: null, legacyHandoff: false,
  supportRequests: [{ id: 'preview-request', incidentCaseId: 'preview-incident', sourceReportId: 'preview-transfer',
    kind: 'transfer', status: 'requested', requestNote: 'Additional municipal coordination is needed.',
    responseNote: null, isLegacy: false, legacyLabel: null, requestedByName: 'Preview officer',
    respondedByName: null, requestingBarangayId: 'preview-barangay', barangayName: 'Calajo-an',
    createdAt: '2026-11-18T02:00:00Z', respondedAt: null }],
};

const municipalAnnouncement: AnnouncementRecord = {
  id: 'preview-announcement', authorId: 'preview-author',
  author: { id: 'preview-author', firstName: 'Preview', lastName: 'Officer', middleName: null, avatarPath: null, roleLabel: 'MDRRMO' },
  scope: 'municipal', barangayId: null, barangayName: null,
  title: 'Roadside flooding', body: 'An update from the responsible response office.',
  authorRank: 2, createdAt: '2026-11-18T01:00:00Z', updatedAt: '2026-11-18T01:00:00Z',
  media: [], mediaCount: 0, mediaDetailLoaded: true, upvoteCount: 0, commentCount: 0,
};

export const reportUiPreviewAnnouncements: AnnouncementRecord[] = [
  municipalAnnouncement,
  { ...municipalAnnouncement, id: 'preview-barangay-announcement',
    author: { ...municipalAnnouncement.author, roleLabel: 'BDRRMO' },
    scope: 'barangay', barangayId: 'preview-barangay', barangayName: 'Calajo-an', authorRank: 3 },
];
