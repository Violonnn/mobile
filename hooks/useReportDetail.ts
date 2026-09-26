// hooks/useReportDetail.ts — local state for one opened report.
// Pull-to-refresh uses the focused reports_map row only, so refreshing a detail
// never re-fetches the full feed or all map markers.
import { useCallback, useEffect, useState } from 'react';
import {
  fetchMapReportById,
  type MapReportMarker,
} from '../lib/reports';

const DETAIL_CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_CACHED_REPORT_DETAILS = 24;

type CachedReportDetail = {
  report: MapReportMarker;
  cachedAt: number;
};

// This cache remains in memory only and is scoped to the current resident.
// It avoids repeat detail queries without storing report data on the device.
const reportDetailCache = new Map<string, CachedReportDetail>();

function getCacheKey(cacheScope: string | null | undefined, reportId: string): string | null {
  if (!cacheScope) return null;
  return `${cacheScope}:${reportId}`;
}

function getCachedReportDetail(
  cacheScope: string | null | undefined,
  reportId: string,
): MapReportMarker | null {
  const cacheKey = getCacheKey(cacheScope, reportId);
  if (!cacheKey) return null;

  const cachedDetail = reportDetailCache.get(cacheKey);
  if (!cachedDetail) return null;
  if (Date.now() - cachedDetail.cachedAt < DETAIL_CACHE_TTL_MS) {
    return cachedDetail.report;
  }

  reportDetailCache.delete(cacheKey);
  return null;
}

function cacheReportDetail(cacheScope: string | null | undefined, report: MapReportMarker): void {
  const cacheKey = getCacheKey(cacheScope, report.id);
  if (!cacheKey) return;

  // Remove expired entries first, then cap memory for long resident sessions.
  const now = Date.now();
  reportDetailCache.forEach((cachedDetail, key) => {
    if (now - cachedDetail.cachedAt >= DETAIL_CACHE_TTL_MS) {
      reportDetailCache.delete(key);
    }
  });
  if (reportDetailCache.size >= MAX_CACHED_REPORT_DETAILS) {
    const oldestEntry = reportDetailCache.entries().next().value;
    if (oldestEntry) reportDetailCache.delete(oldestEntry[0]);
  }

  reportDetailCache.set(cacheKey, { report, cachedAt: now });
}

export function useReportDetail(
  sourceReport: MapReportMarker | null,
  options?: { cacheScope?: string | null },
) {
  const cacheScope = options?.cacheScope;
  const [report, setReport] = useState<MapReportMarker | null>(sourceReport);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [previousSourceReport, setPreviousSourceReport] = useState(sourceReport);

  const cachedSourceReport = sourceReport
    ? getCachedReportDetail(cacheScope, sourceReport.id)
    : null;

  // Realtime/map or feed refreshes remain authoritative until this detail is
  // explicitly refreshed again, except for a fresh cached full detail.
  if (sourceReport !== previousSourceReport) {
    setPreviousSourceReport(sourceReport);
    if (sourceReport) {
      setReport(cachedSourceReport ?? sourceReport);
    }
    setRefreshError(null);
  }

  const refresh = useCallback(async (options?: { showRefreshIndicator?: boolean }) => {
    if (!sourceReport || sourceReport.isPending) return;

    const showRefreshIndicator = options?.showRefreshIndicator ?? true;
    if (showRefreshIndicator) setRefreshing(true);
    const result = await fetchMapReportById(sourceReport.id);
    if (showRefreshIndicator) setRefreshing(false);

    if (result.error || !result.report) {
      setRefreshError(result.error ?? 'Could not refresh this report.');
      return;
    }

    setReport(result.report);
    cacheReportDetail(cacheScope, result.report);
    setRefreshError(null);
    // The inline comments hook watches this token and refreshes only this
    // report's currently visible comment/reply pages.
    setRefreshVersion((current) => current + 1);
  }, [cacheScope, sourceReport]);

  useEffect(() => {
    if (
      !sourceReport ||
      sourceReport.isPending ||
      sourceReport.mediaDetailLoaded ||
      cachedSourceReport?.mediaDetailLoaded
    ) {
      return;
    }
    // The detail skeleton already communicates automatic loading. Do not also
    // display the native pull-to-refresh indicator before the resident pulls.
    const timer = setTimeout(
      () => void refresh({ showRefreshIndicator: false }),
      0,
    );
    return () => clearTimeout(timer);
  }, [cachedSourceReport?.mediaDetailLoaded, refresh, sourceReport]);

  // Show a newly opened/switched source immediately instead of waiting one
  // effect cycle (which would briefly render an empty or previous detail).
  const visibleReport =
    report?.id === sourceReport?.id ? report : cachedSourceReport ?? sourceReport;

  return {
    report: visibleReport,
    refreshing,
    refreshError,
    refreshVersion,
    refresh,
  };
}
