import type { ReportStatus } from './officialReports';
import { formatOperationTimestamp } from './formatTime.ts';
import { colors } from '../styles/theme.ts';

export type ReviewOutcome =
  | 'pending'
  | 'verified'
  | 'linked'
  | 'needs_assessment'
  | 'could_not_confirm'
  | 'rejected'
  | 'outside_coverage';
export type JurisdictionStatus =
  | 'in_coverage'
  | 'needs_check'
  | 'outside_coverage';
export type IncidentVerification = 'pending' | 'confirmed' | 'not_confirmed';
export type IncidentState = 'active' | 'resolved' | 'closed';
export type IncidentCoordination =
  | 'local'
  | 'support_requested'
  | 'support_active'
  | 'transfer_requested'
  | 'municipal_lead';
export type LifecycleFacts = {
  status: ReportStatus;
  reviewOutcome: ReviewOutcome | null;
  reviewClaimedByName: string | null;
  reviewClaimedAt: string | null;
  jurisdictionStatus: JurisdictionStatus | null;
  incidentVerification: IncidentVerification | null;
  incidentState: IncidentState | null;
  coordination: IncidentCoordination | null;
  leadOffice: 'barangay' | 'municipal' | null;
  municipalFinding: 'confirmed' | 'not_confirmed' | null;
  hasQualifyingResponseAction: boolean;
  legacyResolution: boolean;
  withdrawn: boolean;
  legacyEscalation: boolean;
  legacyHandoff?: boolean;
  barangayHasActiveBdrrmo?: boolean;
  isQueuedLocally?: boolean;
};
export type PrimaryStage =
  | 'sending'
  | 'awaiting_review'
  | 'under_review'
  | 'jurisdiction_check'
  | 'being_assessed'
  | 'confirmed'
  | 'response_ongoing'
  | 'resolved'
  | 'withdrawn'
  | 'not_confirmed'
  | 'could_not_confirm'
  | 'rejected'
  | 'outside_coverage'
  | 'linked';
export type CoordinationBadge =
  | 'support_requested'
  | 'support_active'
  | 'forwarded'
  | 'municipal_review'
  | 'municipal_lead'
  | 'legacy_escalation'
  | 'legacy_handoff'
  | null;
export type LifecycleSummary = {
  primaryStage: PrimaryStage;
  coordinationBadge: CoordinationBadge;
  summaryMissing: boolean;
};

const PUBLIC_DISCUSSION_STAGES: PrimaryStage[] = [
  'confirmed',
  'response_ongoing',
  'resolved',
];

/** Resident discussion follows the backend confirmed, non-withdrawn policy. */
export function publicDiscussionIncidentId(
  incidentCaseId: string | null | undefined,
  lifecycle: LifecycleSummary | null | undefined,
): string | null {
  if (!incidentCaseId || !lifecycle) return null;
  return PUBLIC_DISCUSSION_STAGES.includes(lifecycle.primaryStage)
    ? incidentCaseId
    : null;
}

export type ResidentProgressStep = {
  label: string;
  detail: string;
  complete: boolean;
  current: boolean;
};

export type StageTone = { color: string; softColor: string };

/**
 * Washed-out resident palette. Each milestone keeps one recognizable color on Home,
 * Map and Community. Text colors keep at least 4.5:1 contrast on their soft fill.
 * Official screens keep using lifecycleColor.
 */
export const RESIDENT_STAGE_TONES = {
  received: { color: '#A9475A', softColor: '#FCEFF1' },
  assessing: { color: '#946320', softColor: '#FCF4E4' },
  confirmed: { color: '#367168', softColor: '#E8F4F1' },
  responding: { color: '#455F96', softColor: '#EBF0FA' },
  resolved: { color: '#44714D', softColor: '#EDF5EF' },
  correction: { color: '#9C5430', softColor: '#FCF0EA' },
  closed: { color: '#5A6679', softColor: '#F1F5F9' },
} as const satisfies Record<string, StageTone>;

const STAGE_TONE_BY_PRIMARY_STAGE: Record<PrimaryStage, StageTone> = {
  sending: RESIDENT_STAGE_TONES.received,
  awaiting_review: RESIDENT_STAGE_TONES.received,
  under_review: RESIDENT_STAGE_TONES.received,
  jurisdiction_check: RESIDENT_STAGE_TONES.received,
  being_assessed: RESIDENT_STAGE_TONES.assessing,
  confirmed: RESIDENT_STAGE_TONES.confirmed,
  linked: RESIDENT_STAGE_TONES.confirmed,
  response_ongoing: RESIDENT_STAGE_TONES.responding,
  resolved: RESIDENT_STAGE_TONES.resolved,
  withdrawn: RESIDENT_STAGE_TONES.correction,
  not_confirmed: RESIDENT_STAGE_TONES.closed,
  could_not_confirm: RESIDENT_STAGE_TONES.closed,
  rejected: RESIDENT_STAGE_TONES.closed,
  outside_coverage: RESIDENT_STAGE_TONES.closed,
};

export function residentStageTone(summary: LifecycleSummary): StageTone {
  return STAGE_TONE_BY_PRIMARY_STAGE[summary.primaryStage];
}

/** Colors one timeline milestone by what it means, so a progress bar shows several stage colors. */
export function residentStepTone(stepLabel: string): StageTone {
  if (stepLabel === 'Being assessed' || stepLabel === 'Finding') return RESIDENT_STAGE_TONES.assessing;
  if (stepLabel === 'Confirmed' || stepLabel === 'Linked') return RESIDENT_STAGE_TONES.confirmed;
  if (stepLabel === 'Response ongoing') return RESIDENT_STAGE_TONES.responding;
  if (stepLabel === 'Resolved') return RESIDENT_STAGE_TONES.resolved;
  if (stepLabel === 'Correction posted') return RESIDENT_STAGE_TONES.correction;
  if (['Not confirmed', 'Could not confirm', 'Not accepted', 'Outside coverage'].includes(stepLabel)) {
    return RESIDENT_STAGE_TONES.closed;
  }
  return RESIDENT_STAGE_TONES.received;
}

/**
 * Compact progress shows recorded milestones without inventing a response action.
 * The public audience names the first step "Reported" because neighbors did not send it.
 */
export function residentProgressSteps(
  summary: LifecycleSummary,
  audience: 'reporter' | 'public' = 'reporter',
): ResidentProgressStep[] {
  const step = (
    label: string,
    detail = '',
    complete = false,
    current = false,
  ): ResidentProgressStep => ({ label, detail, complete, current });
  const stage = summary.primaryStage;
  const firstLabel = audience === 'public' ? 'Reported' : 'Received';
  if (stage === 'resolved') {
    // Legacy resolutions can lack confirmation history as well as an outcome summary.
    if (summary.summaryMissing) {
      return [step(firstLabel, '', true), step('Resolved', 'Summary not posted', true, true)];
    }
    // Neighbors always see the same four public milestones. Own-report
    // timelines still omit Response ongoing unless a qualifying action exists.
    if (audience === 'public') {
      return [
        step(firstLabel, '', true),
        step('Confirmed', '', true),
        step('Response ongoing', '', true),
        step('Resolved', 'Outcome posted', true, true),
      ];
    }
    return [
      step(firstLabel, '', true),
      step('Confirmed', '', true),
      step('Resolved', 'Outcome posted', true, true),
    ];
  }
  if (stage === 'confirmed' || stage === 'response_ongoing') {
    const responding = stage === 'response_ongoing';
    return [
      step(firstLabel, '', true),
      step('Confirmed', '', true, !responding),
      step('Response ongoing', responding ? 'Action recorded' : 'Awaiting action', responding, responding),
      step('Resolved'),
    ];
  }
  if (stage === 'withdrawn') {
    return [step(firstLabel, '', true), step('Confirmed', '', true), step('Correction posted', '', false, true)];
  }
  if (stage === 'being_assessed') {
    return [step('Received', '', true), step('Being assessed', 'Finding pending', false, true), step('Finding')];
  }
  if (stage === 'linked') {
    return [step('Received', '', true), step('Linked', 'Shared incident', false, true)];
  }
  const terminalLabels: Partial<Record<PrimaryStage, string>> = {
    not_confirmed: 'Not confirmed',
    could_not_confirm: 'Could not confirm',
    rejected: 'Not accepted',
    outside_coverage: 'Outside coverage',
  };
  const terminalLabel = terminalLabels[stage];
  if (terminalLabel) return [step('Received', '', true), step(terminalLabel, '', false, true)];
  if (stage === 'sending') {
    return [step('Sending', 'Saved on this device', false, true), step('Received'), step('Review')];
  }
  const reviewing = stage === 'under_review' || stage === 'jurisdiction_check';
  return [
    step('Received', '', true, !reviewing),
    step(stage === 'jurisdiction_check' ? 'Coverage check' : 'Under review', reviewing ? 'Office reviewing' : 'Awaiting review', false, reviewing),
    step('Finding'),
  ];
}

export function isQualifyingResponseEvent(eventType: string): boolean {
  return [
    'dispatch_confirmed',
    'responders_on_site',
    'assistance_given',
    'work_done',
  ].includes(eventType);
}

export function hasCurrentResponseAction(
  events: { eventType: string; occurredAt: string }[],
  leadOffice: 'barangay' | 'municipal',
): boolean {
  // Earlier actions stay in history, but a new lead or reopened case needs its
  // own response record. Initial cases can inherit pre-review contact evidence.
  const newPeriodTimes = events.filter((event) =>
    event.eventType === 'reopened' ||
    (leadOffice === 'municipal' && event.eventType === 'transfer_accepted')
  )
    .map((event) => Date.parse(event.occurredAt)).filter(Number.isFinite);
  const periodStartedAt = Math.max(0, ...newPeriodTimes);
  return events.some((event) =>
    isQualifyingResponseEvent(event.eventType) &&
    Date.parse(event.occurredAt) >= periodStartedAt
  );
}

export function deriveLifecycle(facts: LifecycleFacts): LifecycleSummary {
  let primaryStage: PrimaryStage;
  // Terminal outcomes take precedence over old compatibility statuses and claims.
  if (facts.isQueuedLocally) primaryStage = 'sending';
  else if (facts.incidentState === 'closed' && facts.withdrawn) {
    primaryStage = 'withdrawn';
  } else if (facts.incidentState === 'resolved') primaryStage = 'resolved';
  else if (
    facts.jurisdictionStatus === 'outside_coverage' ||
    facts.reviewOutcome === 'outside_coverage'
  ) primaryStage = 'outside_coverage';
  else if (facts.reviewOutcome === 'could_not_confirm') {
    primaryStage = 'could_not_confirm';
  } else if (facts.reviewOutcome === 'rejected') primaryStage = 'rejected';
  else if (facts.incidentVerification === 'not_confirmed') {
    primaryStage = 'not_confirmed';
  } else if (facts.jurisdictionStatus === 'needs_check') {
    primaryStage = 'jurisdiction_check';
  } else if (facts.incidentVerification === 'pending') {
    primaryStage = 'being_assessed';
  } else if (facts.incidentVerification === 'confirmed') {
    primaryStage = facts.hasQualifyingResponseAction
      ? 'response_ongoing'
      : 'confirmed';
  } else if (facts.reviewOutcome === 'needs_assessment') {
    primaryStage = 'being_assessed';
  } else if (facts.reviewOutcome === 'linked') primaryStage = 'linked';
  else if (facts.reviewOutcome === 'pending') {
    primaryStage = facts.reviewClaimedAt ? 'under_review' : 'awaiting_review';
  } else if (facts.status === 'resolved') primaryStage = 'resolved';
  else if (facts.status === 'closed') primaryStage = 'not_confirmed';
  else if (facts.status === 'verified' || facts.status === 'escalated') {
    primaryStage = 'confirmed';
  } else {primaryStage = facts.reviewClaimedAt
      ? 'under_review'
      : 'awaiting_review';}

  let coordinationBadge: CoordinationBadge = null;
  if (facts.legacyEscalation) coordinationBadge = 'legacy_escalation';
  else if (facts.legacyHandoff) coordinationBadge = 'legacy_handoff';
  else if (facts.coordination === 'transfer_requested') {
    coordinationBadge = 'forwarded';
  } else if (
    facts.leadOffice === 'municipal' || facts.coordination === 'municipal_lead'
  ) {
    coordinationBadge = facts.municipalFinding
      ? 'municipal_lead'
      : 'municipal_review';
  } else if (
    facts.coordination === 'support_requested' ||
    facts.coordination === 'support_active'
  ) coordinationBadge = facts.coordination;
  else if (facts.coordination == null && facts.status === 'escalated') {
    coordinationBadge = 'forwarded';
  }

  return {
    primaryStage,
    coordinationBadge,
    summaryMissing: primaryStage === 'resolved' && facts.legacyResolution,
  };
}

const commonLabels: Record<PrimaryStage, string> = {
  sending: 'Sending',
  awaiting_review: 'Awaiting barangay review',
  under_review: 'Under review',
  jurisdiction_check: 'Checking which office covers this location',
  being_assessed: 'Being assessed',
  confirmed: 'Confirmed',
  response_ongoing: 'Response ongoing',
  resolved: 'Resolved',
  withdrawn: 'Withdrawn after municipal review',
  not_confirmed: 'Not confirmed',
  could_not_confirm:
    'Could not be confirmed — send a new report if conditions change',
  rejected: 'Not accepted',
  outside_coverage:
    'Outside DisasterLink coverage — not forwarded to any office',
  linked: 'Added to an existing incident',
};

function hasActiveCoordination(summary: LifecycleSummary): boolean {
  return ['confirmed', 'response_ongoing', 'being_assessed'].includes(
    summary.primaryStage,
  );
}

export function residentLabel(
  summary: LifecycleSummary,
  context: { barangayName: string | null },
): string {
  if (summary.summaryMissing) {
    return 'Resolved — the office has not posted an outcome summary yet';
  }
  if (!hasActiveCoordination(summary)) {
    return commonLabels[summary.primaryStage];
  }
  if (summary.coordinationBadge === 'legacy_escalation') {
    return 'Forwarded to MDRRMO';
  }
  if (summary.coordinationBadge === 'forwarded') {
    return `Forwarded to MDRRMO — Brgy. ${
      context.barangayName ?? 'your barangay'
    } remains responsible until MDRRMO accepts`;
  }
  if (summary.coordinationBadge === 'municipal_review') {
    return 'Municipal review — MDRRMO is now responsible';
  }
  if (
    summary.coordinationBadge === 'municipal_lead' ||
    summary.coordinationBadge === 'legacy_handoff'
  ) {
    return summary.primaryStage === 'confirmed'
      ? 'Confirmed — MDRRMO responsible'
      : `${commonLabels[summary.primaryStage]} (MDRRMO)`;
  }
  return commonLabels[summary.primaryStage];
}

export function officialLabel(
  summary: LifecycleSummary,
  context: { claimedByName: string | null; claimedAt: string | null },
): string {
  if (summary.summaryMissing) {
    return 'Resolved · summary missing (action needed)';
  }
  if (summary.primaryStage === 'under_review') {
    return `Under review by ${context.claimedByName ?? 'an officer'}${
      context.claimedAt ? ` · since ${formatOperationTimestamp(context.claimedAt)}` : ''
    }`;
  }
  if (summary.primaryStage === 'awaiting_review') return 'Needs review';
  if (summary.primaryStage === 'jurisdiction_check') {
    return 'Jurisdiction check (MDRRMO)';
  }
  if (summary.primaryStage === 'withdrawn') {
    return 'Withdrawn · correction posted';
  }
  if (summary.primaryStage === 'not_confirmed') return 'Closed — not confirmed';
  if (summary.primaryStage === 'could_not_confirm') {
    return 'Closed — could not confirm';
  }
  if (summary.primaryStage === 'rejected') return 'Closed — rejected';
  if (summary.primaryStage === 'outside_coverage') {
    return 'Closed — outside coverage';
  }
  if (summary.primaryStage === 'linked') return 'Linked to incident';
  if (!hasActiveCoordination(summary)) {
    return commonLabels[summary.primaryStage];
  }
  if (summary.coordinationBadge === 'legacy_escalation') {
    return 'Legacy escalation · MDRRMO acceptance not recorded';
  }
  if (summary.coordinationBadge === 'legacy_handoff') {
    return 'Legacy handoff · MDRRMO re-verified; separate acceptance not recorded';
  }
  if (summary.coordinationBadge === 'support_requested') {
    return 'Support requested · awaiting MDRRMO';
  }
  if (summary.coordinationBadge === 'support_active') {
    return 'MDRRMO supporting';
  }
  if (summary.coordinationBadge === 'forwarded') {
    return 'Forwarded · awaiting MDRRMO acceptance';
  }
  if (summary.coordinationBadge === 'municipal_review') {
    return 'Municipal review · finding needed';
  }
  if (summary.primaryStage === 'being_assessed') return 'Being assessed';
  const municipal = summary.coordinationBadge === 'municipal_lead';
  if (summary.primaryStage === 'response_ongoing') {
    return `Response ongoing (${municipal ? 'municipal' : 'local'})`;
  }
  return municipal
    ? 'Confirmed (MDRRMO) · no response action recorded'
    : 'Confirmed · no response action recorded';
}

export function mayorLabel(
  summary: LifecycleSummary,
  context: { barangayName: string | null },
): string {
  if (summary.summaryMissing) return 'Resolved · summary missing';
  if (summary.primaryStage === 'awaiting_review') {
    return `Awaiting Brgy. ${
      context.barangayName ?? 'assigned barangay'
    } review`;
  }
  if (summary.primaryStage === 'under_review') {
    return `Under review at Brgy. ${
      context.barangayName ?? 'assigned barangay'
    }`;
  }
  if (summary.primaryStage === 'jurisdiction_check') {
    return 'Jurisdiction check';
  }
  if (summary.primaryStage === 'withdrawn') return 'Withdrawn';
  if (!hasActiveCoordination(summary)) {
    return commonLabels[summary.primaryStage];
  }
  if (summary.coordinationBadge === 'legacy_escalation') {
    return 'Forwarded (legacy)';
  }
  if (summary.coordinationBadge === 'legacy_handoff') {
    return 'Municipal (legacy handoff)';
  }
  if (summary.coordinationBadge === 'support_requested') {
    return 'MDRRMO support requested';
  }
  if (summary.coordinationBadge === 'support_active') {
    return `Brgy. ${
      context.barangayName ?? 'assigned barangay'
    } lead · MDRRMO supporting`;
  }
  if (summary.coordinationBadge === 'forwarded') {
    return 'Forwarded to municipal';
  }
  if (summary.coordinationBadge === 'municipal_review') {
    return 'Awaiting municipal finding';
  }
  if (summary.primaryStage === 'being_assessed') return 'Being assessed';
  if (summary.coordinationBadge === 'municipal_lead') {
    return summary.primaryStage === 'response_ongoing'
      ? 'Municipal response ongoing'
      : 'Municipal · awaiting response action';
  }
  return summary.primaryStage === 'response_ongoing'
    ? `Brgy. ${context.barangayName ?? 'assigned barangay'} response ongoing`
    : 'Confirmed · awaiting response action';
}

export function lifecycleColor(summary: LifecycleSummary): string {
  if (summary.primaryStage === 'resolved') return colors.textMuted;
  if (['confirmed', 'response_ongoing'].includes(summary.primaryStage)) {
    return colors.success;
  }
  if (
    [
      'withdrawn',
      'not_confirmed',
      'could_not_confirm',
      'rejected',
      'outside_coverage',
    ].includes(summary.primaryStage)
  ) return colors.danger;
  if (summary.coordinationBadge) return colors.escalated;
  return colors.primary;
}
