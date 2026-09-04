// hooks/useEvacuationCenters.ts — evacuation center list with Realtime.

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  fetchEvacuationCenters,
  type EvacuationCenterRecord,
} from '../lib/resources';
import { supabase } from '../lib/supabase';
import { useRealtimeChannelName } from './useRealtimeChannelName';

export function useEvacuationCenters(options?: {
  barangayId?: string | null;
  priorityOnly?: boolean;
}) {
  const barangayId = options?.barangayId ?? null;
  const priorityOnly = options?.priorityOnly ?? false;

  const [centers, setCenters] = useState<EvacuationCenterRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const channelName = useRealtimeChannelName('evac-centers');

  const load = useCallback(async () => {
    const result = await fetchEvacuationCenters({ barangayId, priorityOnly });
    setCenters(result.centers);
    setError(result.error);
    setLoading(false);
  }, [barangayId, priorityOnly]);

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
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'evacuation_centers' },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, load]);

  return {
    centers,
    error,
    loading,
    refreshing,
    reload: load,
    refresh,
  };
}
