// Pure Mayor analytics reduction helpers. Kept framework-free for unit tests.

import type { BarangayOption } from './barangays';
import type { ReportStatus } from './officialReports';

export type MayorStatusFilter = ReportStatus | 'all';
export type MayorBarangayFilter = string | 'all';
export type MayorStatusCounts = Record<ReportStatus, number>;

export type MayorBarangayTotal = {
  barangayId: string | null;
  barangayName: string;
  total: number;
  statusCounts: MayorStatusCounts;
};

export type MayorDashboardSnapshot = {
  matchingTotal: number;
  statusCounts: MayorStatusCounts;
  barangayTotals: MayorBarangayTotal[];
  unassignedCount: number;
  fetchedAt: string;
};

export type MayorReportTotalRow = {
  barangay_id: string | null;
  barangay_name: string | null;
  status: unknown;
  report_count: number | string | null;
};

export type MayorActivityPoint = {
  date: string;
  label: string;
  count: number;
};

export type MayorStatusActivitySeries = {
  status: ReportStatus;
  points: MayorActivityPoint[];
};

export type MayorActivityRange = 'today' | '3d' | '7d';

export type MayorReportActivityRow = {
  bucket: string | null;
  status: unknown;
  report_count: number | string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MAYOR_STATUSES: ReportStatus[] = [
  'unverified',
  'verified',
  'escalated',
  'resolved',
];

export function emptyMayorStatusCounts(): MayorStatusCounts {
  return { unverified: 0, verified: 0, escalated: 0, resolved: 0 };
}

function asReportStatus(value: unknown): ReportStatus | null {
  if (
    value === 'unverified' ||
    value === 'verified' ||
    value === 'escalated' ||
    value === 'resolved'
  ) {
    return value;
  }
  return null;
}

function asCount(value: number | string | null): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function normalizedBarangayId(value: string | null | undefined): string | null {
  const id = value?.trim();
  return id ? id : null;
}

/** Whether a route value can safely be used as a barangay identifier. */
export function isValidMayorBarangayId(value: string | null | undefined): value is string {
  return Boolean(value?.trim() && UUID_PATTERN.test(value.trim()));
}

/** Normalize a route status. Invalid values intentionally return All. */
export function normalizeMayorStatusFilter(
  value: string | string[] | null | undefined,
): MayorStatusFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === 'all') return 'all';
  return asReportStatus(candidate) ?? 'all';
}

/** Normalize a route barangay against currently valid municipality options. */
export function normalizeMayorBarangayFilter(
  value: string | string[] | null | undefined,
  barangays: BarangayOption[],
): MayorBarangayFilter {
  const candidate = (Array.isArray(value) ? value[0] : value)?.trim();
  if (!candidate || candidate === 'all' || !isValidMayorBarangayId(candidate)) {
    return 'all';
  }
  return barangays.some((barangay) => barangay.id === candidate)
    ? candidate
    : 'all';
}

/** A screen-reader-ready percentage that never divides by zero. */
export function mayorPercentage(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

/** Converts the Mayor-only RPC's zero-filled buckets into status line series. */
export function reduceMayorReportActivity(
  rows: MayorReportActivityRow[],
  range: MayorActivityRange,
): MayorStatusActivitySeries[] {
  const pointsByStatus = new Map<ReportStatus, MayorActivityPoint[]>(
    MAYOR_STATUSES.map((status) => [status, []]),
  );

  for (const row of rows) {
    const status = asReportStatus(row.status);
    if (!status || !row.bucket) continue;
    const date = new Date(row.bucket);
    if (!Number.isFinite(date.getTime())) continue;
    const label = range === 'today'
      ? date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        hour12: true,
        timeZone: 'Asia/Manila',
      })
      : date.toLocaleDateString('en-US', {
        weekday: 'short',
        timeZone: 'Asia/Manila',
      });
    pointsByStatus.get(status)?.push({
      date: row.bucket,
      label,
      count: asCount(row.report_count),
    });
  }

  return MAYOR_STATUSES.map((status) => ({
    status,
    points: (pointsByStatus.get(status) ?? []).sort(
      (left, right) => left.date.localeCompare(right.date),
    ),
  }));
}

/** Combine the zero-filled status series into the single total trend line. */
export function reduceMayorActivityTotals(
  series: MayorStatusActivitySeries[],
): MayorActivityPoint[] {
  const referencePoints = series[0]?.points ?? [];

  return referencePoints.map((point, index) => ({
    date: point.date,
    label: point.label,
    count: series.reduce(
      (total, statusSeries) => total + (statusSeries.points[index]?.count ?? 0),
      0,
    ),
  }));
}

function rowBarangayName(
  row: MayorReportTotalRow,
  barangayNames: Map<string, string>,
): string {
  if (!row.barangay_id) return 'Unassigned';
  return barangayNames.get(row.barangay_id) || row.barangay_name?.trim() || 'Unknown barangay';
}

/**
 * Reduces compact aggregate rows without ever relying on paginated report data.
 */
export function reduceMayorDashboardSnapshot(
  rows: MayorReportTotalRow[],
  barangays: BarangayOption[],
  filters: { barangayId: MayorBarangayFilter; status: MayorStatusFilter },
  fetchedAt = new Date().toISOString(),
): MayorDashboardSnapshot {
  const barangayNames = new Map(barangays.map((barangay) => [barangay.id, barangay.name]));
  const totalsByBarangay = new Map<string | null, MayorBarangayTotal>();

  for (const barangay of barangays) {
    totalsByBarangay.set(barangay.id, {
      barangayId: barangay.id,
      barangayName: barangay.name,
      total: 0,
      statusCounts: emptyMayorStatusCounts(),
    });
  }

  for (const row of rows) {
    const status = asReportStatus(row.status);
    if (!status) continue;
    const barangayId = normalizedBarangayId(row.barangay_id);
    const current = totalsByBarangay.get(barangayId) ?? {
      barangayId,
      barangayName: rowBarangayName(row, barangayNames),
      total: 0,
      statusCounts: emptyMayorStatusCounts(),
    };
    const reportCount = asCount(row.report_count);
    current.total += reportCount;
    current.statusCounts[status] += reportCount;
    totalsByBarangay.set(barangayId, current);
  }

  const selectedTotals = [...totalsByBarangay.values()].filter((total) =>
    filters.barangayId === 'all' || total.barangayId === filters.barangayId,
  );
  const statusCounts = emptyMayorStatusCounts();
  let matchingTotal = 0;
  let unassignedCount = 0;

  for (const total of selectedTotals) {
    for (const status of MAYOR_STATUSES) {
      statusCounts[status] += total.statusCounts[status];
    }
    matchingTotal += filters.status === 'all'
      ? total.total
      : total.statusCounts[filters.status];
    if (total.barangayId === null) unassignedCount = total.total;
  }

  const barangayTotals = selectedTotals
    .filter((total) => total.barangayId !== null)
    .sort((left, right) => {
      const leftCount = filters.status === 'all' ? left.total : left.statusCounts[filters.status];
      const rightCount = filters.status === 'all' ? right.total : right.statusCounts[filters.status];
      if (rightCount !== leftCount) return rightCount - leftCount;
      return left.barangayName.localeCompare(right.barangayName);
    });

  return { matchingTotal, statusCounts, barangayTotals, unassignedCount, fetchedAt };
}
