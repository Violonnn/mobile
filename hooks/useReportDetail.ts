// hooks/useReportDetail.ts — local state for one opened report.
// Pull-to-refresh uses the focused reports_map row only, so refreshing a detail
// never re-fetches the full feed or all map markers.
import { useCallback, useEffect, useState } from 'react';
import {
  fetchMapReportById,
  type MapReportMarker,
} from '../lib/reports';

export function useReportDetail(sourceReport: MapReportMarker | null) {
  const [report, setReport] = useState<MapReportMarker | null>(sourceReport);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  // Realtime/map or feed refreshes remain authoritative until this detail is
  // explicitly refreshed again.
  useEffect(() => {
    setReport(sourceReport);
    setRefreshError(null);
  }, [sourceReport]);

  const refresh = useCallback(async () => {
    if (!sourceReport || sourceReport.isPending) return;

    setRefreshing(true);
    const result = await fetchMapReportById(sourceReport.id);
    setRefreshing(false);

    if (result.error || !result.report) {
      setRefreshError(result.error ?? 'Could not refresh this report.');
      return;
    }

    setReport(result.report);
    setRefreshError(null);
    // The inline comments hook watches this token and refreshes only this
    // report's currently visible comment/reply pages.
    setRefreshVersion((current) => current + 1);
  }, [sourceReport]);

  // Show a newly opened/switched source immediately instead of waiting one
  // effect cycle (which would briefly render an empty or previous detail).
  const visibleReport =
    report?.id === sourceReport?.id ? report : sourceReport;

  return {
    report: visibleReport,
    refreshing,
    refreshError,
    refreshVersion,
    refresh,
  };
}
