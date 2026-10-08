// Supabase-backed Mayor analytics and paginated read-only situation queries.

import { supabase } from './supabase';
import { mayorReportStatusLabel } from './mayorStatusLabels';
import type { ReportStatus } from './officialReports';
import type {
  MayorActivityRange,
  MayorBarangayFilter,
  MayorReportActivityRow,
  MayorReportTotalRow,
  MayorStatusFilter,
  MayorStatusCounts,
} from './mayorAnalyticsReducer';

export {
  MAYOR_STATUSES,
  emptyMayorStatusCounts,
  isValidMayorBarangayId,
  mayorPercentage,
  normalizeMayorBarangayFilter,
  normalizeMayorStatusFilter,
  reduceMayorActivityTotals,
  reduceMayorDashboardSnapshot,
  reduceMayorReportActivity,
} from './mayorAnalyticsReducer';
export type {
  MayorBarangayFilter,
  MayorBarangayTotal,
  MayorActivityPoint,
  MayorActivityRange,
  MayorDashboardSnapshot,
  MayorReportTotalRow,
  MayorReportActivityRow,
  MayorStatusCounts,
  MayorStatusActivitySeries,
  MayorStatusFilter,
} from './mayorAnalyticsReducer';

export type MayorSituationItem = {
  id: string;
  title: string;
  description: string;
  status: ReportStatus;
  barangayId: string | null;
  barangayName: string;
  addressText: string | null;
  createdAt: string;
  reporterName: string;
  reverifiedAt: string | null;
};

export type MayorWatchlistReport = {
  id: string;
  title: string;
  status: ReportStatus;
  barangayName: string;
  addressText: string | null;
  createdAt: string;
  escalatedAt: string | null;
  latestStatusActivityAt: string | null;
};

export type MayorWatchlistSnapshot = {
  longestWaitingBdrrmoReport: MayorWatchlistReport | null;
  longestWaitingMdrrmoEscalation: MayorWatchlistReport | null;
  largestActiveBacklog: {
    barangayId: string;
    barangayName: string;
    activeCount: number;
  } | null;
  missingContextReports: MayorWatchlistReport[];
  missingContextCount: number;
  inactiveStatusReports: MayorWatchlistReport[];
  inactiveStatusCount: number;
};

type MayorSituationRow = {
  id: string;
  title: string | null;
  description: string | null;
  status: unknown;
  barangay_id: string | null;
  barangay_name: string | null;
  address_text: string | null;
  created_at: string | null;
  reporter_name: string | null;
  reverified_at: string | null;
  total_count: number | string | null;
};

type MayorWatchlistRow = {
  item_key: unknown;
  id: unknown;
  title: unknown;
  status: unknown;
  barangay_id: unknown;
  barangay_name: unknown;
  address_text: unknown;
  created_at: unknown;
  escalated_at: unknown;
  latest_status_activity_at: unknown;
  active_backlog: number | string | null;
  item_count: number | string | null;
};

const MAX_SEARCH_LENGTH = 200;
export const MAYOR_SITUATION_PAGE_SIZE = 20;
export const MAYOR_SITUATION_INITIAL_PAGE_SIZE = 2;

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

function emptyMayorWatchlistSnapshot(): MayorWatchlistSnapshot {
  return {
    longestWaitingBdrrmoReport: null,
    longestWaitingMdrrmoEscalation: null,
    largestActiveBacklog: null,
    missingContextReports: [],
    missingContextCount: 0,
    inactiveStatusReports: [],
    inactiveStatusCount: 0,
  };
}

function asMayorWatchlistReport(row: MayorWatchlistRow): MayorWatchlistReport | null {
  const status = asReportStatus(row.status);
  const id = String(row.id ?? '').trim();
  if (!status || !id) return null;

  return {
    id,
    title: String(row.title ?? ''),
    status,
    barangayName: String(row.barangay_name ?? 'Unassigned'),
    addressText: row.address_text ? String(row.address_text) : null,
    createdAt: String(row.created_at ?? ''),
    escalatedAt: row.escalated_at ? String(row.escalated_at) : null,
    latestStatusActivityAt: row.latest_status_activity_at
      ? String(row.latest_status_activity_at)
      : null,
  };
}

/** Fetch every compact aggregate row available to the signed-in official. */
export async function fetchMayorReportTotals(): Promise<{
  rows: MayorReportTotalRow[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('report_totals_by_barangay')
    .select('barangay_id, barangay_name, status, report_count');

  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as MayorReportTotalRow[], error: null };
}

/** Fetch the current Monday–Sunday aggregate used by the Brief line chart. */
/** Fetch zero-filled Mayor report activity buckets for a selected chart range. */
export async function fetchMayorReportActivity(input: {
  range: MayorActivityRange;
  barangayId: MayorBarangayFilter;
}): Promise<{
  rows: MayorReportActivityRow[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('mayor_report_activity', {
    p_range: input.range,
    p_barangay_id: input.barangayId === 'all' ? null : input.barangayId,
  });

  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as MayorReportActivityRow[], error: null };
}

/** Fetch a Mayor-only situation page. The SQL function validates authorization. */
export async function fetchMayorSituationPage(input: {
  barangayId: MayorBarangayFilter;
  status: MayorStatusFilter;
  search: string;
  offset: number;
  limit?: number;
}): Promise<{
  reports: MayorSituationItem[];
  totalCount: number;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('list_mayor_situations', {
    p_barangay_id: input.barangayId === 'all' ? null : input.barangayId,
    p_status: input.status === 'all' ? null : input.status,
    p_search: input.search.trim().slice(0, MAX_SEARCH_LENGTH) || null,
    p_limit: Math.min(
      MAYOR_SITUATION_PAGE_SIZE,
      Math.max(1, Math.floor(input.limit ?? MAYOR_SITUATION_PAGE_SIZE)),
    ),
    p_offset: Math.max(0, Math.floor(input.offset)),
  });

  if (error) return { reports: [], totalCount: 0, error: error.message };

  const rows = (data ?? []) as MayorSituationRow[];
  const reports = rows.flatMap((row) => {
    const status = asReportStatus(row.status);
    if (!status || !row.id) return [];
    return [{
      id: String(row.id),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      status,
      barangayId: normalizedBarangayId(row.barangay_id),
      barangayName: String(row.barangay_name ?? 'Unassigned'),
      addressText: row.address_text ? String(row.address_text) : null,
      createdAt: String(row.created_at ?? ''),
      reporterName: String(row.reporter_name ?? 'Resident'),
      reverifiedAt: row.reverified_at ? String(row.reverified_at) : null,
    }];
  });

  return {
    reports,
    totalCount: rows.length > 0 ? asCount(rows[0].total_count) : 0,
    error: null,
  };
}

/** Fetch the Mayor's focused municipal attention items. Authorization is enforced in SQL. */
export async function fetchMayorWatchlist(): Promise<{
  snapshot: MayorWatchlistSnapshot;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('list_mayor_watchlist');
  const snapshot = emptyMayorWatchlistSnapshot();
  if (error) return { snapshot, error: error.message };

  for (const row of (data ?? []) as MayorWatchlistRow[]) {
    const itemKey = String(row.item_key ?? '');
    const report = asMayorWatchlistReport(row);
    const itemCount = asCount(row.item_count);

    if (itemKey === 'longest_waiting_bdrrmo' && report) {
      snapshot.longestWaitingBdrrmoReport = report;
    } else if (itemKey === 'longest_waiting_mdrrmo' && report) {
      snapshot.longestWaitingMdrrmoEscalation = report;
    } else if (itemKey === 'largest_active_backlog' && row.barangay_id) {
      snapshot.largestActiveBacklog = {
        barangayId: String(row.barangay_id),
        barangayName: String(row.barangay_name ?? 'Unknown barangay'),
        activeCount: asCount(row.active_backlog),
      };
    } else if (itemKey === 'missing_context' && report) {
      snapshot.missingContextReports.push(report);
      snapshot.missingContextCount = itemCount;
    } else if (itemKey === 'inactive_status' && report) {
      snapshot.inactiveStatusReports.push(report);
      snapshot.inactiveStatusCount = itemCount;
    }
  }

  return { snapshot, error: null };
}

export function mayorSituationStatusLabel(
  report: Pick<MayorSituationItem, 'status' | 'barangayName' | 'reverifiedAt'>,
): string {
  return mayorReportStatusLabel(report);
}

/** Fetch accurate full-result status totals for the current Mayor filters. */
export async function fetchMayorSituationStatusCounts(input: {
  barangayId: MayorBarangayFilter;
  search: string;
}): Promise<{
  counts: MayorStatusCounts;
  error: string | null;
}> {
  const statuses: ReportStatus[] = ['unverified', 'verified', 'escalated', 'resolved'];
  const normalizedSearch = input.search.trim().slice(0, MAX_SEARCH_LENGTH) || null;
  const results = await Promise.all(
    statuses.map((status) => supabase.rpc('list_mayor_situations', {
      p_barangay_id: input.barangayId === 'all' ? null : input.barangayId,
      p_status: status,
      p_search: normalizedSearch,
      p_limit: 1,
      p_offset: 0,
    })),
  );

  const counts: MayorStatusCounts = {
    unverified: 0,
    verified: 0,
    escalated: 0,
    resolved: 0,
  };

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (result.error) return { counts, error: result.error.message };
    const firstRow = ((result.data ?? []) as MayorSituationRow[])[0];
    counts[statuses[index]] = firstRow ? asCount(firstRow.total_count) : 0;
  }

  return { counts, error: null };
}
