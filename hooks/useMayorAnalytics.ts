// Mayor dashboard data with focus, pull-to-refresh, and Realtime updates.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchBarangays, type BarangayOption } from '../lib/barangays';
import {
  fetchMayorReportTotals,
  fetchMayorReportActivity,
  reduceMayorReportActivity,
  reduceMayorDashboardSnapshot,
  type MayorBarangayFilter,
  type MayorActivityRange,
  type MayorDashboardSnapshot,
  type MayorStatusFilter,
  type MayorStatusActivitySeries,
} from '../lib/mayorAnalytics';
import { supabase } from '../lib/supabase';

export function useMayorAnalytics(input: {
  enabled: boolean;
  barangayId: MayorBarangayFilter;
  status: MayorStatusFilter;
  activityRange: MayorActivityRange;
}) {
  const [snapshot, setSnapshot] = useState<MayorDashboardSnapshot | null>(null);
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [recentActivitySeries, setRecentActivitySeries] = useState<MayorStatusActivitySeries[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [barangayError, setBarangayError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const barangaysRef = useRef<BarangayOption[]>([]);
  const channelName = useMemo(
    () => `mayor-analytics-${Math.random().toString(36).slice(2)}`,
    [],
  );

  const load = useCallback(async () => {
    if (!input.enabled) {
      setSnapshot(null);
      setBarangays([]);
      setRecentActivitySeries([]);
      setError(null);
      setBarangayError(null);
      setActivityError(null);
      setLoading(false);
      return;
    }

    const [totalsResult, barangaysResult, activityResult] = await Promise.all([
      fetchMayorReportTotals(),
      fetchBarangays(),
      fetchMayorReportActivity({
        range: input.activityRange,
        barangayId: input.barangayId,
      }),
    ]);

    if (totalsResult.error) {
      // Preserve a previous snapshot during a later network failure.
      setError(totalsResult.error);
      setBarangayError(barangaysResult.error);
      setLoading(false);
      return;
    }

    // Keep prior labels during a transient label-query failure; aggregate rows
    // carry their own labels, so counts can still refresh independently.
    const nextBarangays = barangaysResult.error
      ? barangaysRef.current
      : barangaysResult.barangays;
    setSnapshot(
      reduceMayorDashboardSnapshot(totalsResult.rows, nextBarangays, {
        barangayId: input.barangayId,
        status: input.status,
      }),
    );
    barangaysRef.current = nextBarangays;
    setBarangays(nextBarangays);
    setRecentActivitySeries(
      activityResult.error
        ? []
        : reduceMayorReportActivity(activityResult.rows, input.activityRange),
    );
    setError(null);
    setBarangayError(barangaysResult.error);
    setActivityError(activityResult.error);
    setLoading(false);
  }, [input.activityRange, input.enabled, input.barangayId, input.status]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!input.enabled) return;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, input.enabled, load]);

  return {
    snapshot,
    barangays,
    error,
    barangayError,
    activityError,
    recentActivitySeries,
    loading,
    refreshing,
    reload: load,
    refresh,
  };
}
