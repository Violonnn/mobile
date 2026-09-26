// hooks/useAnnouncements.ts — ranked announcements with Realtime refresh.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  fetchRankedAnnouncements,
  type AnnouncementRecord,
} from '../lib/announcements';
import { supabase } from '../lib/supabase';
import { useRealtimeChannelName } from './useRealtimeChannelName';

export function useAnnouncements(options?: {
  enabled?: boolean;
  limit?: number;
  realtime?: boolean;
  staleTimeMs?: number;
}) {
  const limit = options?.limit ?? 50;
  const enabled = options?.enabled ?? true;
  const realtime = options?.realtime ?? true;
  const staleTimeMs = options?.staleTimeMs ?? 2 * 60_000;
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const announcementsRef = useRef<AnnouncementRecord[]>([]);
  const hasLoadedRef = useRef(false);
  const lastLoadedAtRef = useRef(0);
  const loadRequestRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    announcementsRef.current = announcements;
  }, [announcements]);

  const channelName = useRealtimeChannelName('announcements');

  const load = useCallback(async () => {
    if (!enabled) return;
    if (loadRequestRef.current) return loadRequestRef.current;

    const request = (async () => {
      const result = await fetchRankedAnnouncements({ limit });
      setError(result.error);
      hasLoadedRef.current = true;
      setLoading(false);
      if (result.error) return;

      setAnnouncements(result.announcements);
      setHasMore(result.announcements.length >= limit);
      lastLoadedAtRef.current = Date.now();
    })().finally(() => {
      loadRequestRef.current = null;
    });

    loadRequestRef.current = request;
    return request;
  }, [enabled, limit]);

  const loadMore = useCallback(async () => {
    if (!enabled || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const result = await fetchRankedAnnouncements({
      limit,
      offset: announcementsRef.current.length,
    });
    setLoadingMore(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setHasMore(result.announcements.length >= limit);
    setAnnouncements((current) => {
      const byId = new Map(current.map((announcement) => [announcement.id, announcement]));
      result.announcements.forEach((announcement) => byId.set(announcement.id, announcement));
      return [...byId.values()];
    });
  }, [enabled, hasMore, limit, loadingMore]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      // Preserve the current feed while checking for newer announcements.
      if (!hasLoadedRef.current) setLoading(true);
      const dataIsFresh = Date.now() - lastLoadedAtRef.current < staleTimeMs;
      if (!dataIsFresh) void load();
    }, [enabled, load, staleTimeMs]),
  );

  useEffect(() => {
    if (!enabled || !realtime) return;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, enabled, load, realtime]);

  return {
    announcements,
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
