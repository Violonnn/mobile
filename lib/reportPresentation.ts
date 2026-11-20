import { formatOperationTimestamp } from './formatTime.ts';
import {
  RESIDENT_STAGE_TONES,
  residentStageTone,
  type LifecycleSummary,
  type StageTone,
} from './reportLifecycle.ts';

export type ScopedLifecycleAudience = 'resident' | 'bdrrmo' | 'mitcom';
export type ScopedOfficialAudience = Exclude<ScopedLifecycleAudience, 'resident'>;

export const REPORT_STAGE_LEGEND_ITEMS = [
  { label: 'Sending / review', tone: RESIDENT_STAGE_TONES.received },
  { label: 'Assessment', tone: RESIDENT_STAGE_TONES.assessing },
  { label: 'Confirmed', tone: RESIDENT_STAGE_TONES.confirmed },
  { label: 'Response ongoing', tone: RESIDENT_STAGE_TONES.responding },
  { label: 'Resolved', tone: RESIDENT_STAGE_TONES.resolved },
  { label: 'Correction posted', tone: RESIDENT_STAGE_TONES.correction },
  { label: 'Closed', tone: RESIDENT_STAGE_TONES.closed },
] as const;

export type ScopedLifecyclePresentationContext = {
  audience: ScopedLifecycleAudience;
  barangayName?: string | null;
  leadOffice?: 'barangay' | 'municipal' | null;
  claimedByName?: string | null;
  claimedAt?: string | null;
};

export type ScopedLifecyclePresentation = {
  stageLabel: string;
  tone: StageTone;
  coordinationLabel: string | null;
  leadLabel: string | null;
  reviewLabel: string | null;
  note: string | null;
};

const STAGE_LABELS: Record<LifecycleSummary['primaryStage'], string> = {
  sending: 'Sending',
  awaiting_review: 'Awaiting review',
  under_review: 'Under review',
  jurisdiction_check: 'Coverage check',
  being_assessed: 'Being assessed',
  confirmed: 'Confirmed',
  response_ongoing: 'Response ongoing',
  resolved: 'Resolved',
  withdrawn: 'Withdrawn',
  not_confirmed: 'Not confirmed',
  could_not_confirm: 'Could not confirm',
  rejected: 'Not accepted',
  outside_coverage: 'Outside coverage',
  linked: 'Linked',
};

function municipalOfficeLabel(): string {
  return 'MITCOM';
}

function coordinationLabel(
  summary: LifecycleSummary,
): string | null {
  // Closed lifecycle stages can retain historical coordination facts. Show an
  // active coordination label only while the report still has an active stage.
  if (!hasActiveCoordination(summary)) return null;

  const municipalOffice = municipalOfficeLabel();
  switch (summary.coordinationBadge) {
    case 'support_requested':
      return `${municipalOffice} support requested`;
    case 'support_active':
      return `${municipalOffice} support active`;
    case 'forwarded':
      return `Transfer awaiting ${municipalOffice} acceptance`;
    case 'municipal_review':
      return `${municipalOffice} review`;
    case 'municipal_lead':
      return `${municipalOffice} lead accepted`;
    case 'legacy_escalation':
      return `Legacy escalation · ${municipalOffice} acceptance not recorded`;
    case 'legacy_handoff':
      return `Legacy handoff · ${municipalOffice} acceptance not recorded`;
    default:
      return null;
  }
}

function inferredLeadOffice(
  summary: LifecycleSummary,
): 'barangay' | 'municipal' | null {
  if (
    summary.coordinationBadge === 'support_requested' ||
    summary.coordinationBadge === 'support_active' ||
    summary.coordinationBadge === 'forwarded'
  ) return 'barangay';
  if (
    summary.coordinationBadge === 'municipal_review' ||
    summary.coordinationBadge === 'municipal_lead' ||
    summary.coordinationBadge === 'legacy_handoff'
  ) return 'municipal';
  return null;
}

function hasActiveCoordination(summary: LifecycleSummary): boolean {
  return ['confirmed', 'response_ongoing', 'being_assessed'].includes(
    summary.primaryStage,
  );
}

function leadLabel(
  summary: LifecycleSummary,
  context: ScopedLifecyclePresentationContext,
): string | null {
  // A supplied lead office is a current fact; a badge alone may be stale after closure.
  const leadOffice = context.leadOffice !== undefined
    ? context.leadOffice
    : hasActiveCoordination(summary)
      ? inferredLeadOffice(summary)
      : null;
  if (leadOffice === null && context.leadOffice === null) {
    return hasActiveCoordination(summary) ? 'Lead: Not recorded' : null;
  }
  if (leadOffice === 'municipal') {
    return `Lead: ${municipalOfficeLabel()}`;
  }
  if (leadOffice !== 'barangay') return null;

  const barangayName = context.barangayName?.trim();
  return barangayName
    ? `Lead: Brgy. ${barangayName}`
    : 'Lead: Barangay office';
}

function reviewLabel(
  summary: LifecycleSummary,
  context: ScopedLifecyclePresentationContext,
): string | null {
  // Resident views receive only public lifecycle facts, not officer claim identity.
  if (context.audience === 'resident' || summary.primaryStage !== 'under_review') {
    return null;
  }

  const claimedByName = context.claimedByName?.trim();
  const claimedAt = context.claimedAt?.trim();
  if (!claimedByName && !claimedAt) return null;

  const reviewer = claimedByName || 'an officer';
  const since = claimedAt
    ? ` · since ${formatOperationTimestamp(claimedAt)}`
    : '';
  return `Review claim: ${reviewer}${since}`;
}

/**
 * Keep the factual stage, coordination state and officer metadata separate.
 * MITCOM is presentation-only; lifecycle and stored role values remain unchanged.
 */
export function scopedLifecyclePresentation(
  summary: LifecycleSummary,
  context: ScopedLifecyclePresentationContext,
): ScopedLifecyclePresentation {
  const note = summary.summaryMissing
    ? 'Outcome summary not posted'
    : summary.primaryStage === 'confirmed'
      ? 'No response action recorded yet'
      : null;

  return {
    stageLabel: STAGE_LABELS[summary.primaryStage],
    tone: residentStageTone(summary),
    coordinationLabel: coordinationLabel(summary),
    leadLabel: leadLabel(summary, context),
    reviewLabel: reviewLabel(summary, context),
    note,
  };
}

export const REPORT_ACTIVITY_ORDER_LABEL = 'Newest activity first';

/** Return a copy ordered by timestamp, keeping ties and invalid timestamps stable. */
export function newestActivityFirst<T extends { occurredAt: string }>(
  entries: readonly T[],
): T[] {
  return entries
    .map((entry, originalIndex) => ({
      entry,
      originalIndex,
      timestamp: Date.parse(entry.occurredAt),
    }))
    .sort((first, second) => {
      const firstHasTimestamp = Number.isFinite(first.timestamp);
      const secondHasTimestamp = Number.isFinite(second.timestamp);
      if (firstHasTimestamp !== secondHasTimestamp) {
        return firstHasTimestamp ? -1 : 1;
      }
      if (firstHasTimestamp && first.timestamp !== second.timestamp) {
        return second.timestamp - first.timestamp;
      }
      return first.originalIndex - second.originalIndex;
    })
    .map(({ entry }) => entry);
}
