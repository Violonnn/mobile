// hooks/useAnnouncements.ts — ranked announcements with Realtime refresh.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  fetchRankedAnnouncements,
  type AnnouncementRecord,
} from '../lib/announcements';
import { supabase } from '../lib/supabase';
import { useRealtimeChannelName } from './useRealtimeChannelName';

export function useAnnouncements(options?: { limit?: number; realtime?: boolean }) {
  const limit = options?.limit ?? 50;
  const realtime = options?.realtime ?? true;
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const announcementsRef = useRef<AnnouncementRecord[]>([]);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    announcementsRef.current = announcements;
  }, [announcements]);

  const channelName = useRealtimeChannelName('announcements');

  const load = useCallback(async () => {
    const result = await fetchRankedAnnouncements({ limit });
    setAnnouncements(result.announcements);
    setHasMore(result.announcements.length >= limit);
    setError(result.error);
    hasLoadedRef.current = true;
    setLoading(false);
  }, [limit]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
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
  }, [hasMore, limit, loadingMore]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      // Preserve the current feed while checking for newer announcements.
      if (!hasLoadedRef.current) setLoading(true);
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!realtime) return;

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
  }, [channelName, load, realtime]);

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
