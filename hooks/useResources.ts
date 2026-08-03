// hooks/useResources.ts — hotlines + facilities for resident and official UIs.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  fetchActiveFacilities,
  fetchActiveHotlines,
  fetchOfficialFacilities,
  fetchOfficialHotlines,
  type FacilityRecord,
  type HotlineRecord,
} from '../lib/resources';
import { supabase } from '../lib/supabase';

type Mode = 'resident' | 'official';

export function useResources(options?: {
  mode?: Mode;
  barangayId?: string | null;
}) {
  const mode = options?.mode ?? 'resident';
  const barangayId = options?.barangayId ?? null;

  const [hotlines, setHotlines] = useState<HotlineRecord[]>([]);
  const [facilities, setFacilities] = useState<FacilityRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hotlinesError, setHotlinesError] = useState<string | null>(null);
  const [facilitiesError, setFacilitiesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const channelName = useMemo(
    () => `resources-${Math.random().toString(36).slice(2)}`,
    [],
  );

  const load = useCallback(async () => {
    const [hotlineResult, facilityResult] =
      mode === 'official'
        ? await Promise.all([
            fetchOfficialHotlines({ barangayId }),
            fetchOfficialFacilities({ barangayId }),
          ])
        : await Promise.all([fetchActiveHotlines(), fetchActiveFacilities()]);

    setHotlines(hotlineResult.hotlines);
    setFacilities(facilityResult.facilities);
    setHotlinesError(hotlineResult.error);
    setFacilitiesError(facilityResult.error);
    setError(hotlineResult.error || facilityResult.error);
    setLoading(false);
  }, [mode, barangayId]);

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
        { event: '*', schema: 'public', table: 'hotlines' },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'facilities' },
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
    hotlines,
    facilities,
    error,
    hotlinesError,
    facilitiesError,
    loading,
    refreshing,
    reload: load,
    refresh,
  };
}
