import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import type { BarangayOption } from '../lib/barangays';
import { fetchBarangays } from '../lib/barangays';
import { fetchMyProfile, setCachedMyProfile, type PublicProfile } from '../lib/profile';
import {
  fetchActiveFacilities,
  fetchActiveHotlines,
  fetchEvacuationCenters,
  type EvacuationCenterRecord,
  type FacilityRecord,
  type HotlineRecord,
} from '../lib/resources';
import { normalizeSearchText } from '../lib/reportProximity';
import { supabase } from '../lib/supabase';
import { useRealtimeChannelName } from '../hooks/useRealtimeChannelName';

const PROFILE_STALE_TIME_MS = 5 * 60 * 1000;
const RESOURCE_STALE_TIME_MS = 10 * 60 * 1000;

type LoadOptions = {
  force?: boolean;
};

type ResidentDataContextValue = {
  profile: PublicProfile | null;
  barangays: BarangayOption[];
  barangayNamesById: ReadonlyMap<string, string>;
  residentBarangayId: string | null;
  profileInitialLoading: boolean;
  profileRefreshing: boolean;
  profileError: string | null;
  refreshProfile: (options?: LoadOptions) => Promise<void>;
  updateProfile: (profile: PublicProfile) => void;
  hotlines: HotlineRecord[];
  facilities: FacilityRecord[];
  centers: EvacuationCenterRecord[];
  hotlinesLoaded: boolean;
  facilitiesLoaded: boolean;
  centersLoaded: boolean;
  hotlinesLoading: boolean;
  facilitiesLoading: boolean;
  centersLoading: boolean;
  hotlinesError: string | null;
  facilitiesError: string | null;
  centersError: string | null;
  ensureHotlines: (options?: LoadOptions) => Promise<void>;
  ensureFacilities: (options?: LoadOptions) => Promise<void>;
  ensureCenters: (options?: LoadOptions) => Promise<void>;
};

const ResidentDataContext = createContext<ResidentDataContextValue | null>(null);

function isFresh(loadedAt: number, staleTimeMs: number): boolean {
  return loadedAt > 0 && Date.now() - loadedAt < staleTimeMs;
}

export function ResidentDataProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [profileInitialLoading, setProfileInitialLoading] = useState(true);
  const [profileRefreshing, setProfileRefreshing] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const profileLoadedAtRef = useRef(0);
  const profileRequestRef = useRef<Promise<void> | null>(null);

  const [hotlines, setHotlines] = useState<HotlineRecord[]>([]);
  const [facilities, setFacilities] = useState<FacilityRecord[]>([]);
  const [centers, setCenters] = useState<EvacuationCenterRecord[]>([]);
  const [hotlinesLoaded, setHotlinesLoaded] = useState(false);
  const [facilitiesLoaded, setFacilitiesLoaded] = useState(false);
  const [centersLoaded, setCentersLoaded] = useState(false);
  const [hotlinesLoading, setHotlinesLoading] = useState(false);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [centersLoading, setCentersLoading] = useState(false);
  const [hotlinesError, setHotlinesError] = useState<string | null>(null);
  const [facilitiesError, setFacilitiesError] = useState<string | null>(null);
  const [centersError, setCentersError] = useState<string | null>(null);
  const hotlinesLoadedAtRef = useRef(0);
  const facilitiesLoadedAtRef = useRef(0);
  const centersLoadedAtRef = useRef(0);
  const hotlinesRequestRef = useRef<Promise<void> | null>(null);
  const facilitiesRequestRef = useRef<Promise<void> | null>(null);
  const centersRequestRef = useRef<Promise<void> | null>(null);
  const channelName = useRealtimeChannelName('resident-resources');

  const refreshProfile = useCallback(async (options?: LoadOptions) => {
    if (!options?.force && isFresh(profileLoadedAtRef.current, PROFILE_STALE_TIME_MS)) return;
    if (profileRequestRef.current) return profileRequestRef.current;

    const request = (async () => {
      setProfileRefreshing(profileLoadedAtRef.current > 0);
      setProfileError(null);

      const [profileResult, barangayResult] = await Promise.all([
        fetchMyProfile({ force: options?.force }),
        fetchBarangays({ force: options?.force }),
      ]);

      if (profileResult.error || !profileResult.profile) {
        setProfileError(profileResult.error || 'Your resident profile could not be found.');
      } else {
        setProfile(profileResult.profile);
        profileLoadedAtRef.current = Date.now();
      }

      if (!barangayResult.error) {
        setBarangays(barangayResult.barangays);
      } else if (!profileResult.error) {
        setProfileError(barangayResult.error);
      }

      setProfileInitialLoading(false);
      setProfileRefreshing(false);
    })().finally(() => {
      profileRequestRef.current = null;
    });

    profileRequestRef.current = request;
    return request;
  }, []);

  const ensureHotlines = useCallback(async (options?: LoadOptions) => {
    if (!options?.force && isFresh(hotlinesLoadedAtRef.current, RESOURCE_STALE_TIME_MS)) return;
    if (hotlinesRequestRef.current) return hotlinesRequestRef.current;

    const request = (async () => {
      setHotlinesLoading(hotlinesLoadedAtRef.current === 0);
      setHotlinesError(null);
      const result = await fetchActiveHotlines();
      setHotlinesError(result.error);
      if (!result.error) {
        setHotlines(result.hotlines);
        hotlinesLoadedAtRef.current = Date.now();
        setHotlinesLoaded(true);
      }
      setHotlinesLoading(false);
    })().finally(() => {
      hotlinesRequestRef.current = null;
    });

    hotlinesRequestRef.current = request;
    return request;
  }, []);

  const ensureFacilities = useCallback(async (options?: LoadOptions) => {
    if (!options?.force && isFresh(facilitiesLoadedAtRef.current, RESOURCE_STALE_TIME_MS)) return;
    if (facilitiesRequestRef.current) return facilitiesRequestRef.current;

    const request = (async () => {
      setFacilitiesLoading(facilitiesLoadedAtRef.current === 0);
      setFacilitiesError(null);
      const result = await fetchActiveFacilities();
      setFacilitiesError(result.error);
      if (!result.error) {
        setFacilities(result.facilities);
        facilitiesLoadedAtRef.current = Date.now();
        setFacilitiesLoaded(true);
      }
      setFacilitiesLoading(false);
    })().finally(() => {
      facilitiesRequestRef.current = null;
    });

    facilitiesRequestRef.current = request;
    return request;
  }, []);

  const ensureCenters = useCallback(async (options?: LoadOptions) => {
    if (!options?.force && isFresh(centersLoadedAtRef.current, RESOURCE_STALE_TIME_MS)) return;
    if (centersRequestRef.current) return centersRequestRef.current;

    const request = (async () => {
      setCentersLoading(centersLoadedAtRef.current === 0);
      setCentersError(null);
      const result = await fetchEvacuationCenters();
      setCentersError(result.error);
      if (!result.error) {
        setCenters(result.centers);
        centersLoadedAtRef.current = Date.now();
        setCentersLoaded(true);
      }
      setCentersLoading(false);
    })().finally(() => {
      centersRequestRef.current = null;
    });

    centersRequestRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hotlines' }, () => {
        if (hotlinesLoadedAtRef.current > 0) void ensureHotlines({ force: true });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'facilities' }, () => {
        if (facilitiesLoadedAtRef.current > 0) void ensureFacilities({ force: true });
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'evacuation_centers' },
        () => {
          if (centersLoadedAtRef.current > 0) void ensureCenters({ force: true });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, ensureCenters, ensureFacilities, ensureHotlines]);

  const updateProfile = useCallback((nextProfile: PublicProfile) => {
    setProfile(nextProfile);
    setCachedMyProfile(nextProfile);
    profileLoadedAtRef.current = Date.now();
    setProfileError(null);
  }, []);

  const barangayNamesById = useMemo(
    () => new Map(barangays.map((barangay) => [barangay.id, barangay.name])),
    [barangays],
  );
  const residentBarangayId = useMemo(() => {
    if (!profile) return null;
    const normalizedBarangay = normalizeSearchText(profile.barangay);
    return (
      barangays.find((barangay) => normalizeSearchText(barangay.name) === normalizedBarangay)?.id ??
      null
    );
  }, [barangays, profile]);

  const value = useMemo<ResidentDataContextValue>(
    () => ({
      profile,
      barangays,
      barangayNamesById,
      residentBarangayId,
      profileInitialLoading,
      profileRefreshing,
      profileError,
      refreshProfile,
      updateProfile,
      hotlines,
      facilities,
      centers,
      hotlinesLoaded,
      facilitiesLoaded,
      centersLoaded,
      hotlinesLoading,
      facilitiesLoading,
      centersLoading,
      hotlinesError,
      facilitiesError,
      centersError,
      ensureHotlines,
      ensureFacilities,
      ensureCenters,
    }),
    [
      barangayNamesById,
      barangays,
      centers,
      centersError,
      centersLoaded,
      centersLoading,
      ensureCenters,
      ensureFacilities,
      ensureHotlines,
      facilities,
      facilitiesError,
      facilitiesLoaded,
      facilitiesLoading,
      hotlines,
      hotlinesError,
      hotlinesLoaded,
      hotlinesLoading,
      profile,
      profileError,
      profileInitialLoading,
      profileRefreshing,
      refreshProfile,
      residentBarangayId,
      updateProfile,
    ],
  );

  return <ResidentDataContext.Provider value={value}>{children}</ResidentDataContext.Provider>;
}

export function useResidentData(): ResidentDataContextValue {
  const value = useContext(ResidentDataContext);
  if (!value) throw new Error('useResidentData must be used within ResidentDataProvider.');
  return value;
}
