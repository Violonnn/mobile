// hooks/useOfficialReports.ts
// Official queue + detail loading with pull-to-refresh and Realtime updates.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { OfficialAccessScope } from '../lib/officialRegistration';
import {
  fetchOfficialReportDetail,
  fetchOfficialReportQueue,
  type OfficialReportDetail,
  type OfficialReportQueueItem,
  type OfficialStatusCounts,
  type OfficialWorkflowQueue,
} from '../lib/officialReports';
import { supabase } from '../lib/supabase';
import { useRealtimeChannelName } from './useRealtimeChannelName';

function emptyCounts(): OfficialStatusCounts {
  return {
    unverified: 0,
    verified: 0,
    escalated: 0,
    resolved: 0,
    closed: 0,
    total: 0,
  };
}

const OFFICIAL_DETAIL_CACHE_TTL_MS = 30 * 1000;
const MAX_CACHED_OFFICIAL_DETAILS = 12;

type CachedOfficialReportDetail = {
  detail: OfficialReportDetail;
  cachedAt: number;
};

// Official report data stays only in memory. The key prevents one official's
// cached report from appearing under another official's role or barangay scope.
const officialDetailCache = new Map<string, CachedOfficialReportDetail>();

function getOfficialDetailCacheKey(
  scope: OfficialAccessScope | null,
  reportId: string | undefined,
): string | null {
  if (!scope || !reportId) return null;

  // Barangay routing can change, so always recheck BDRRMO scope through RLS.
  if (scope.role === 'officer' && scope.barangay_id) return null;

  const officialEmail = scope.email.trim().toLowerCase();
  const barangayScope = scope.barangay_id ?? 'municipal';
  return `${scope.role}:${officialEmail}:${barangayScope}:${reportId}`;
}

function getCachedOfficialReportDetail(
  scope: OfficialAccessScope | null,
  reportId: string | undefined,
): OfficialReportDetail | null {
  const cacheKey = getOfficialDetailCacheKey(scope, reportId);
  if (!cacheKey) return null;

  const cachedDetail = officialDetailCache.get(cacheKey);
  if (!cachedDetail) return null;
  if (Date.now() - cachedDetail.cachedAt < OFFICIAL_DETAIL_CACHE_TTL_MS) {
    return cachedDetail.detail;
  }

  officialDetailCache.delete(cacheKey);
  return null;
}

function cacheOfficialReportDetail(
  scope: OfficialAccessScope | null,
  detail: OfficialReportDetail,
): void {
  const cacheKey = getOfficialDetailCacheKey(scope, detail.id);
  if (!cacheKey) return;

  // Remove expired entries first and cap the cache for long-running sessions.
  const now = Date.now();
  officialDetailCache.forEach((cachedDetail, key) => {
    if (now - cachedDetail.cachedAt >= OFFICIAL_DETAIL_CACHE_TTL_MS) {
      officialDetailCache.delete(key);
    }
  });
  if (officialDetailCache.size >= MAX_CACHED_OFFICIAL_DETAILS) {
    const oldestEntry = officialDetailCache.entries().next().value;
    if (oldestEntry) officialDetailCache.delete(oldestEntry[0]);
  }

  officialDetailCache.set(cacheKey, { detail, cachedAt: now });
}

function invalidateOfficialReportDetailCache(
  scope: OfficialAccessScope | null,
  reportId: string | undefined,
): void {
  const cacheKey = getOfficialDetailCacheKey(scope, reportId);
  if (cacheKey) officialDetailCache.delete(cacheKey);
}

/** Scoped report queue for the official overview screen. */
export function useOfficialReportQueue(scope: OfficialAccessScope | null, queue: OfficialWorkflowQueue = 'all') {
  const pageSize = 20;
  const [reports, setReports] = useState<OfficialReportQueueItem[]>([]);
  const [counts, setCounts] = useState<OfficialStatusCounts>(emptyCounts());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const reportsRef = useRef<OfficialReportQueueItem[]>([]);
  const hasLoadedRef = useRef(false);
  const loadSequence = useRef(0);

  useEffect(() => {
    reportsRef.current = reports;
  }, [reports]);

  const channelName = useRealtimeChannelName('official-queue');

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!scope) {
      hasLoadedRef.current = false;
      setReports([]);
      setCounts(emptyCounts());
      setError(null);
      setLoading(false);
      setLoadingMore(false);
      setHasMore(false);
      return;
    }

    try {
      const result = await fetchOfficialReportQueue(scope, { limit: pageSize, queue });
      // A previous queue or Realtime request may finish after a newer request.
      if (sequence !== loadSequence.current) return;
      setReports(result.reports);
      setCounts(result.counts);
      setError(result.error);
      setHasMore(result.reports.length < result.counts.total);
      hasLoadedRef.current = true;
    } catch {
      if (sequence !== loadSequence.current) return;
      setReports([]);
      setError('Could not load this queue. Check your connection and retry.');
    } finally {
      if (sequence === loadSequence.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [scope, queue]);

  const loadMore = useCallback(async () => {
    if (!scope || loadingMore || !hasMore) return;
    const sequence = loadSequence.current;
    setLoadingMore(true);
    try {
      const result = await fetchOfficialReportQueue(scope, {
        limit: pageSize,
        offset: reportsRef.current.length,
        queue,
      });
      if (sequence !== loadSequence.current) return;
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setCounts(result.counts);
      setHasMore(reportsRef.current.length + result.reports.length < result.counts.total);
      setReports((current) => {
        const byId = new Map(current.map((report) => [report.id, report]));
        result.reports.forEach((report) => byId.set(report.id, report));
        return [...byId.values()];
      });
    } catch {
      if (sequence === loadSequence.current) setError('Could not load more reports. Please retry.');
    } finally {
      if (sequence === loadSequence.current) setLoadingMore(false);
    }
  }, [hasMore, loadingMore, scope, queue]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleRealtimeChange = useCallback(() => { void load(); }, [load]);

  useFocusEffect(
    useCallback(() => {
      // Keep existing cards and maps mounted while fresh data loads in the background.
      if (!hasLoadedRef.current) setLoading(true);
      void load();
      return () => { loadSequence.current += 1; };
    }, [load]),
  );

  // Live refresh when reports change (BDRRMO filter keeps noise down).
  useEffect(() => {
    if (!scope) return;

    const filter =
      scope.role === 'officer' && scope.barangay_id
        ? `barangay_id=eq.${scope.barangay_id}`
        : undefined;

    let channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reports',
          ...(filter ? { filter } : {}),
        },
        handleRealtimeChange,
      );
    for (const table of ['incident_cases', 'incident_events', 'incident_support_requests', 'incident_update_requests']) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, handleRealtimeChange);
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scope, channelName, handleRealtimeChange]);

  return {
    reports,
    counts,
    error,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    reload: load,
    loadMore,
    refresh,
  };
}

/** Single official report detail with Realtime refresh. */
export function useOfficialReportDetail(
  reportId: string | undefined,
  scope: OfficialAccessScope | null,
) {
  const [detail, setDetail] = useState<OfficialReportDetail | null>(() =>
    getCachedOfficialReportDetail(scope, reportId),
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() =>
    !getCachedOfficialReportDetail(scope, reportId),
  );
  const [refreshing, setRefreshing] = useState(false);
  const detailLoadSequence = useRef(0);

  const channelName = useRealtimeChannelName('official-detail');

  const load = useCallback(async () => {
    const sequence = ++detailLoadSequence.current;
    if (!scope || !reportId) {
      setDetail(null);
      setError(reportId ? null : 'Missing report id.');
      setLoading(false);
      return;
    }

    try {
      const result = await fetchOfficialReportDetail(reportId, scope);
      if (sequence !== detailLoadSequence.current) return;
      if (result.detail) cacheOfficialReportDetail(scope, result.detail);
      else invalidateOfficialReportDetailCache(scope, reportId);
      setDetail(result.detail);
      setError(result.error);
    } catch {
      if (sequence !== detailLoadSequence.current) return;
      setDetail(null);
      setError('Could not load this report. Check your connection and retry.');
    } finally {
      if (sequence === detailLoadSequence.current) setLoading(false);
    }
  }, [reportId, scope]);

  const invalidateCache = useCallback(() => {
    invalidateOfficialReportDetailCache(scope, reportId);
  }, [reportId, scope]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const cachedDetail = getCachedOfficialReportDetail(scope, reportId);
      if (cachedDetail) {
        // A short cache window avoids repeat queries during quick reopens.
        // Realtime updates still invalidate this entry while the screen is open.
        setDetail(cachedDetail);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      void load();
    }, [load, reportId, scope]),
  );

  useEffect(() => {
    if (!scope || !reportId) return;

    const changed = () => { invalidateCache(); void load(); };
    let channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reports',
          filter: `id=eq.${reportId}`,
        },
        changed,
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_status_history', filter: `report_id=eq.${reportId}` }, changed);
    const incidentCaseId = detail?.incidentCase?.id;
    if (incidentCaseId) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'incident_cases', filter: `id=eq.${incidentCaseId}` }, changed);
      for (const table of ['incident_events', 'incident_support_requests', 'incident_update_requests']) {
        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `incident_case_id=eq.${incidentCaseId}` }, changed);
      }
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scope, reportId, channelName, invalidateCache, load, detail?.incidentCase?.id]);

  const reload = useCallback(async () => {
    invalidateCache();
    await load();
  }, [invalidateCache, load]);

  return {
    detail,
    error,
    loading,
    refreshing,
    reload,
    refresh,
    invalidateCache,
  };
}
