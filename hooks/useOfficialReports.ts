// hooks/useOfficialReports.ts
// Official queue + detail loading with pull-to-refresh and Realtime updates.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { OfficialAccessScope } from '../lib/officialRegistration';
import {
  fetchOfficialReportDetail,
  fetchOfficialReportQueue,
  type OfficialReportDetail,
  type OfficialReportQueueItem,
  type OfficialStatusCounts,
} from '../lib/officialReports';
import { supabase } from '../lib/supabase';

function emptyCounts(): OfficialStatusCounts {
  return {
    unverified: 0,
    verified: 0,
    escalated: 0,
    resolved: 0,
    total: 0,
  };
}

/** Scoped report queue for the official overview screen. */
export function useOfficialReportQueue(scope: OfficialAccessScope | null) {
  const [reports, setReports] = useState<OfficialReportQueueItem[]>([]);
  const [counts, setCounts] = useState<OfficialStatusCounts>(emptyCounts());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const channelName = useMemo(
    () => `official-queue-${Math.random().toString(36).slice(2)}`,
    [],
  );

  const load = useCallback(async () => {
    if (!scope) {
      setReports([]);
      setCounts(emptyCounts());
      setError(null);
      setLoading(false);
      return;
    }

    const result = await fetchOfficialReportQueue(scope);
    setReports(result.reports);
    setCounts(result.counts);
    setError(result.error);
    setLoading(false);
  }, [scope]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  // Live refresh when reports change (BDRRMO filter keeps noise down).
  useEffect(() => {
    if (!scope) return;

    const filter =
      scope.role === 'officer' && scope.barangay_id
        ? `barangay_id=eq.${scope.barangay_id}`
        : undefined;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reports',
          ...(filter ? { filter } : {}),
        },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scope, channelName, load]);

  return {
    reports,
    counts,
    error,
    loading,
    refreshing,
    reload: load,
    refresh,
  };
}

/** Single official report detail with Realtime refresh. */
export function useOfficialReportDetail(
  reportId: string | undefined,
  scope: OfficialAccessScope | null,
) {
  const [detail, setDetail] = useState<OfficialReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const channelName = useMemo(
    () => `official-detail-${Math.random().toString(36).slice(2)}`,
    [],
  );

  const load = useCallback(async () => {
    if (!scope || !reportId) {
      setDetail(null);
      setError(reportId ? null : 'Missing report id.');
      setLoading(false);
      return;
    }

    const result = await fetchOfficialReportDetail(reportId, scope);
    setDetail(result.detail);
    setError(result.error);
    setLoading(false);
  }, [reportId, scope]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!scope || !reportId) return;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reports',
          filter: `id=eq.${reportId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scope, reportId, channelName, load]);

  return {
    detail,
    error,
    loading,
    refreshing,
    reload: load,
    refresh,
  };
}
