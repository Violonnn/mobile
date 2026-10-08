import type { ReportStatus } from './officialReports';

type MayorStatusLabelInput = {
  status: ReportStatus | string;
  barangayName?: string | null;
  reverifiedAt?: string | null;
};

function brgyLabel(barangayName: string | null | undefined): string {
  const trimmedName = barangayName?.trim();
  if (!trimmedName || trimmedName.toLocaleLowerCase() === 'unassigned') {
    return 'Brgy.';
  }
  return `Brgy. ${trimmedName}`;
}

export function mayorReportStatusLabel({
  status,
  barangayName,
  reverifiedAt,
}: MayorStatusLabelInput): string {
  if (status === 'unverified') {
    return `Awaiting ${brgyLabel(barangayName)} review`;
  }

  if (status === 'verified') {
    if (reverifiedAt) return 'Municipal response in progress';
    return `${brgyLabel(barangayName)} response in progress`;
  }

  if (status === 'escalated') {
    return 'Awaiting municipal review';
  }

  return 'Resolved';
}

export function mayorStatusFilterLabel(status: ReportStatus | 'all'): string {
  if (status === 'all') return 'All statuses';
  if (status === 'unverified') return 'Awaiting brgy. review';
  if (status === 'verified') return 'Response in progress';
  if (status === 'escalated') return 'Awaiting municipal review';
  return 'Resolved';
}
