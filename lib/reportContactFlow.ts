import type { HotlineRecord } from './resources';

export type PendingReportCall = {
  kind: 'reporter' | 'hotline';
  reportId: string;
  hotline?: HotlineRecord;
};

export type ReportActivityResult = {
  eventType: string;
  outcome?: string;
  dismissed?: boolean;
  serviceCount?: number;
};

export type ResponseServiceEntry = {
  details: Record<string, string>;
  note: string | null;
};

export type ResponseEventDetails = Record<string, string> | {
  submission_id: string;
  services: ResponseServiceEntry[];
};

/** Keep the selected category visible alongside the specific provider. */
export function responseServiceLabel(details: Record<string, unknown>): string {
  const labels: Record<string, string> = {
    bfp: 'BFP',
    pnp: 'PNP',
    rhu_ambulance: 'RHU / ambulance',
    mdrrmo_rescue: 'MDRRMO rescue',
    bdrrmo_team: 'BDRRMO team',
  };
  const category = labels[String(details.service)] ?? 'Other service';
  const unitName = typeof details.service_name === 'string'
    ? details.service_name.trim()
    : '';
  const otherName = typeof details.service_other === 'string'
    ? details.service_other.trim()
    : '';
  const parts = [category];
  // Keep a named Other service visible when it also has an optional specific unit.
  const names = details.service === 'other'
    ? [otherName, unitName]
    : [unitName || otherName];
  for (const name of names) {
    if (
      name && !parts.some((part) => part.toLowerCase() === name.toLowerCase())
    ) parts.push(name);
  }
  if (typeof details.municipality === 'string' && details.municipality.trim()) {
    parts.push(details.municipality.trim());
  }
  return parts.join(' · ');
}

export function responseServiceIdentity(
  details: Record<string, string>,
): string {
  // Normalize case/spacing so the same team cannot be queued under spelling-only variants.
  return JSON.stringify(
    [
      details.service,
      details.service_name,
      details.municipality,
      details.service === 'other' ? details.service_other : '',
    ]
      .map((value) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()),
  );
}

/** Retry identifier only, never an authentication token or secret. */
export function createActivitySubmissionId(): string {
  if (
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    (character) => {
      const randomValue = Math.floor(Math.random() * 16);
      return (character === 'x' ? randomValue : (randomValue & 0x3) | 0x8)
        .toString(16);
    },
  );
}

/** A hotline category does not establish the responding agency. Keep the saved
 * contact's name without guessing whether a rescue team is municipal or local. */
export function hotlineEventDetails(
  hotline: HotlineRecord,
): Record<string, string> {
  return { service: 'other', service_other: hotline.name };
}

export function callOutcomeFeedback(result: ReportActivityResult): string {
  if (result.serviceCount != null) {
    return `Activity saved with ${result.serviceCount} ${
      result.serviceCount === 1 ? 'service' : 'services'
    }.`;
  }
  if (
    result.eventType !== 'reporter_call' &&
    result.eventType !== 'hotline_contacted'
  ) {
    return 'Activity saved.';
  }
  const subject = result.eventType === 'reporter_call' ? 'Reporter' : 'Hotline';
  if (result.dismissed || result.outcome === 'not_recorded') {
    return 'Saved: call outcome not recorded. This does not confirm that a call took place.';
  }
  if (result.outcome === 'reached') {
    return `Saved: ${subject.toLowerCase()} reached. This does not verify the incident or confirm dispatch.`;
  }
  if (result.outcome === 'no_answer') return 'Saved: no answer.';
  if (result.outcome === 'call_failed') return 'Saved: call failed.';
  return 'Call outcome saved.';
}
