// hooks/useAnnouncements.ts — ranked announcements with Realtime refresh.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  fetchRankedAnnouncements,
  type AnnouncementRecord,
} from '../lib/announcements';
import { supabase } from '../lib/supabase';

export function useAnnouncements(options?: { limit?: number; realtime?: boolean }) {
  const limit = options?.limit ?? 50;
  const realtime = options?.realtime ?? true;
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const channelName = useMemo(
    () => `announcements-${Math.random().toString(36).slice(2)}`,
    [],
  );

  const load = useCallback(async () => {
    const result = await fetchRankedAnnouncements({ limit });
    setAnnouncements(result.announcements);
    setError(result.error);
    setLoading(false);
  }, [limit]);

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
    reload: load,
    refresh,
  };
}
