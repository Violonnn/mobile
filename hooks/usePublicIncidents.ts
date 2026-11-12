import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { fetchPublicIncidents, mergePublicIncidentPosts, type IncidentEngagement, type PublicIncident } from '../lib/publicIncidents';
import { subscribeToReportPublicationChanges } from '../lib/reportPublication';

export function usePublicIncidents(options?: { barangayId?: string | null; enabled?: boolean }) {
  const barangayId = options?.barangayId ?? null;
  const enabled = options?.enabled ?? true;
  const [incidents, setIncidents] = useState<PublicIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const scopeKey = barangayId ?? 'all';
  const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null);
  const generation = useRef(0);
  const pageSize = 50;
  const reload = useCallback(async () => {
    if (!enabled) return;
    const requestId = ++generation.current;
    const result = await fetchPublicIncidents({ barangayId, limit: pageSize });
    if (requestId !== generation.current) return;
    setLoading(false);
    setLoadedScopeKey(scopeKey);
    setLoadingMore(false);
    setError(result.error);
    // Clear stale public data when a refresh fails: withdrawn/sensitive cases
    // must not linger as if they were still current public information.
    setIncidents(result.incidents);
    setHasMore(!result.error && result.incidents.length === pageSize);
  }, [barangayId, enabled, scopeKey]);
  const loadMore = useCallback(async () => {
    if (!enabled || loadingMore || !hasMore) return;
    const requestId = generation.current;
    setLoadingMore(true);
    const result = await fetchPublicIncidents({ barangayId, limit: pageSize, offset: incidents.length });
    if (requestId !== generation.current) return;
    setLoadingMore(false);
    setError(result.error);
    if (result.error) return;
    setIncidents((current) => mergePublicIncidentPosts(current, result.incidents));
    setHasMore(result.incidents.length === pageSize);
  }, [barangayId, enabled, hasMore, incidents.length, loadingMore]);
  useFocusEffect(useCallback(() => {
    void reload();
    // Public changes are delivered through a privacy-limited RPC, rather than
    // subscribing residents to private incident tables. Poll while focused.
    const timer = enabled ? setInterval(() => void reload(), 60_000) : undefined;
    return () => { clearInterval(timer); generation.current += 1; };
  }, [enabled, reload]));
  useEffect(() => subscribeToReportPublicationChanges(() => {
    if (!enabled) return;
    // Do not keep a withdrawn name, photo, location, or post visible during refresh.
    setIncidents([]);
    setLoading(true);
    void reload();
  }), [enabled, reload]);
  /** Keeps feed cards in sync after a support toggle or comment without a full reload. */
  const patchEngagement = useCallback((incidentCaseId: string, engagement: IncidentEngagement) => {
    setIncidents((current) => current.map((incident) =>
      incident.incidentCaseId === incidentCaseId ? { ...incident, engagement } : incident));
  }, []);
  const scopeIsCurrent = loadedScopeKey === scopeKey;
  return { incidents: scopeIsCurrent ? incidents : [], loading: loading || !scopeIsCurrent,
    loadingMore, error: scopeIsCurrent ? error : null, hasMore: scopeIsCurrent && hasMore, reload, loadMore,
    patchEngagement };
}
