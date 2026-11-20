import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  PanResponder,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import InteractiveMap, {
  type MapFocusTarget,
  type MapLayerVisibility,
  type MapResourceMarker,
} from '../../components/map/InteractiveMap';
import ReportMapDetailSheet from '../../components/map/ReportMapDetailSheet';
import ResidentMapCallout from '../../components/map/ResidentMapCallout';
import YourContributionsPanel, {
  type ContributionPanelState,
} from '../../components/map/YourContributionsPanel';
import { ReportEngagementProvider } from '../../components/report/ReportEngagementProvider';
import PublicIncidentDetail from '../../components/report/PublicIncidentDetail';
import { useResidentData } from '../../context/ResidentDataContext';
import { useReports } from '../../hooks/useReports';
import { usePublicIncidents } from '../../hooks/usePublicIncidents';
import { getGrantedMapGps, type GpsPosition } from '../../lib/location';
import { getResidentMapTheme, type ResidentMapTheme } from '../../lib/mapPreferences';
import { createMutableNumber } from '../../lib/mutableNumber';
import { fetchMapReportById, type MapReportMarker } from '../../lib/reports';
import { getReportPublicationPreferences, subscribeToReportPublicationChanges } from '../../lib/reportPublication';
import { publicIncidentHasMapLocation, type PublicIncidentStatusFilter } from '../../lib/publicIncidents';
import { evacuationStatusLabel, facilityTypeLabel } from '../../lib/resources';
import {
  getResidentBottomNavigationHeight,
  navMetrics,
} from '../../styles/components/bottomNav.styles';
import { residentMapStyles as styles } from '../../styles/screens/residentMap.styles';
import { colors, fonts, radius, spacing } from '../../styles/theme';

const COLLAPSED_HEADER_HEIGHT = 88;
const RESTING_CONTRIBUTION_LIFT = 12;
const CONTRIBUTION_PANEL_STATES: ContributionPanelState[] = [
  'collapsed',
  'medium',
  'expanded',
];

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight, fontScale } = useWindowDimensions();
  const bottomNavigationHeight = getResidentBottomNavigationHeight(fontScale);
  const { reportId, publicReportId, resourceId, resourceKind, incidentId, openRequest } = useLocalSearchParams<{
    reportId?: string | string[];
    publicReportId?: string | string[];
    resourceId?: string | string[];
    resourceKind?: string | string[];
    incidentId?: string | string[];
    openRequest?: string | string[];
  }>();
  const { incidents, error: incidentsError, loading: incidentsLoading, reload: reloadIncidents, patchEngagement } = usePublicIncidents({ loadAll: true });
  const [publicLayerVisible, setPublicLayerVisible] = useState(true);
  const [publicStatus, setPublicStatus] = useState<PublicIncidentStatusFilter>('all');
  // selectedIncidentId opens the detail sheet; highlightedIncidentId drives the callout and pulsing marker.
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedPublicReportId, setSelectedPublicReportId] = useState<string | null>(null);
  const [highlightedIncidentId, setHighlightedIncidentId] = useState<string | null>(null);
  const [incidentGroupIds, setIncidentGroupIds] = useState<string[]>([]);
  const requestedIncidentId = Array.isArray(incidentId) ? incidentId[0] : incidentId;
  const requestedPublicReportId = Array.isArray(publicReportId) ? publicReportId[0] : publicReportId;
  const requestedOpenKey = Array.isArray(openRequest) ? openRequest[0] : openRequest;
  const handledIncidentRequestRef = useRef<string | null>(null);
  const eligiblePublicIncidents = incidents.filter(publicIncidentHasMapLocation);
  const visibleIncidents = eligiblePublicIncidents.filter((incident) =>
    publicStatus === 'all' || incident.publicStatus === publicStatus,
  );
  const highlightedIncident = highlightedIncidentId
    ? eligiblePublicIncidents.find((incident) => (incident.reportId ?? incident.incidentCaseId) === highlightedIncidentId)
      ?? eligiblePublicIncidents.find((incident) => incident.incidentCaseId === highlightedIncidentId) ?? null
    : null;
  const {
    reports: loadedMarkers,
    error,
    loading: reportsLoading,
    reload,
  } = useReports({
    ownOnly: true,
    realtime: true,
    // Pins only need coordinates and incident metadata. Attachment thumbnails
    // are loaded for one report after the resident opens it.
    includeMediaSummaries: false,
    staleTimeMs: 5 * 60_000,
  });
  const {
    profile,
    profileInitialLoading,
    facilities,
    centers,
    ensureFacilities,
    ensureCenters,
  } = useResidentData();

  const [userLocation, setUserLocation] = useState<GpsPosition | null>(null);
  const [mapTheme, setMapTheme] = useState<ResidentMapTheme>('light');
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [fullReportVisible, setFullReportVisible] = useState(false);
  const [highlightedReportId, setHighlightedReportId] = useState<string | null>(null);
  const [highlightedResourceId, setHighlightedResourceId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);
  const [contributionPanelState, setContributionPanelState] =
    useState<ContributionPanelState>('collapsed');
  const [contributionPanelStateIndex] = useState(() => createMutableNumber(0));
  const [contributionTranslateY] = useState(() => new Animated.Value(0));
  const [highlightedReportTranslateY] = useState(() => new Animated.Value(0));
  const [dragStartOffset] = useState(() => createMutableNumber());
  const [mapFilterVisible, setMapFilterVisible] = useState(false);
  const shouldHideMapFilters =
    fullReportVisible ||
    selectedReportIds.length > 0 ||
    Boolean(selectedIncidentId);
  const [layers, setLayers] = useState<MapLayerVisibility>({
    reports: true,
    facilities: true,
    evacuationCenters: true,
  });
  const handledRouteReportIdRef = useRef<string | null>(null);
  const handledRouteResourceIdRef = useRef<string | null>(null);
  const requestedReportId = Array.isArray(reportId) ? reportId[0] : reportId;
  const requestedResourceId = Array.isArray(resourceId) ? resourceId[0] : resourceId;
  const requestedResourceKind = Array.isArray(resourceKind)
    ? resourceKind[0]
    : resourceKind;

  const [requestedOwnReport, setRequestedOwnReport] = useState<MapReportMarker | null>(null);
  const [requestedOwnError, setRequestedOwnError] = useState<string | null>(null);
  const [requestRetry, setRequestRetry] = useState(0);
  const [ownExactLocationReportIds, setOwnExactLocationReportIds] = useState<Set<string>>(() => new Set());
  const [ownLocationPreferencesError, setOwnLocationPreferencesError] = useState<string | null>(null);
  const [publicationPreferenceRefresh, setPublicationPreferenceRefresh] = useState(0);
  const markers = useMemo(() => requestedOwnReport && requestedOwnReport.reporter.id === profile?.id && !loadedMarkers.some((report) => report.id === requestedOwnReport.id)
    ? [requestedOwnReport, ...loadedMarkers]
    : loadedMarkers, [loadedMarkers, requestedOwnReport, profile?.id]);
  useEffect(() => subscribeToReportPublicationChanges(() => {
    setPublicationPreferenceRefresh((current) => current + 1);
  }), []);
  useEffect(() => {
    let cancelled = false;
    const allowedIds = new Set(markers
      .filter((marker) => marker.isPending && marker.allowExactLocation === true)
      .map((marker) => marker.id));
    const serverReportIds = markers.filter((marker) => !marker.isPending).map((marker) => marker.id).sort();
    setOwnExactLocationReportIds(new Set(allowedIds));
    setOwnLocationPreferencesError(null);

    async function loadOwnerLocationChoices() {
      let choiceLoadFailed = false;
      // Use the existing owner-only RPC in small batches so every lookup is
      // authorized to this resident without flooding PostgREST.
      for (let start = 0; start < serverReportIds.length; start += 8) {
        const batch = serverReportIds.slice(start, start + 8);
        const results = await Promise.all(batch.map(async (reportId) => ({
          reportId,
          ...await getReportPublicationPreferences(reportId),
        })));
        if (cancelled) return;
        for (const result of results) {
          if (result.error) choiceLoadFailed = true;
          if (result.preferences?.allowExactLocation) allowedIds.add(result.reportId);
        }
        setOwnExactLocationReportIds(new Set(allowedIds));
      }
      if (!cancelled && choiceLoadFailed) {
        setOwnLocationPreferencesError('Could not verify your location sharing choices. Some report pins are hidden. Tap to retry.');
      }
    }

    void loadOwnerLocationChoices();
    return () => { cancelled = true; };
  }, [markers, publicationPreferenceRefresh]);

  // Publicly shared reports use the privacy-limited, officially approved
  // projection for corrected coordinates. Other own pins require the owner's
  // explicit exact-location choice, read through the owner-only RPC.
  const mapMarkers = useMemo(() => {
    const exactLocationsByReportId = new Map(eligiblePublicIncidents
      .filter((incident) => incident.reportId && incident.exactLocation)
      .map((incident) => [incident.reportId as string, incident.exactLocation!]));
    return markers.flatMap((marker) => {
      const publicLocation = exactLocationsByReportId.get(marker.id);
      if (!ownExactLocationReportIds.has(marker.id)) return [];
      const location = publicLocation ?? marker;
      return [{ ...marker, latitude: location.latitude, longitude: location.longitude }];
    });
  }, [eligiblePublicIncidents, markers, ownExactLocationReportIds]);
  const currentUserId = profile?.id ?? null;

  useEffect(() => {
    if (!requestedReportId) return;
    let cancelled = false;
    void fetchMapReportById(requestedReportId, { ownOnly: true }).then((result) => {
      if (cancelled) return;
      setRequestedOwnReport(result.report);
      setRequestedOwnError(result.error ?? (!result.report ? 'This report is unavailable in your account.' : null));
    }).catch(() => { if (!cancelled) setRequestedOwnError('Could not open your report. Tap to retry.'); });
    return () => { cancelled = true; };
  }, [requestedReportId, requestRetry]);

  useEffect(() => {
    void Promise.all([ensureFacilities(), ensureCenters()]);
  }, [ensureCenters, ensureFacilities]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void Promise.all([getResidentMapTheme(), getGrantedMapGps()]).then(
        ([storedTheme, grantedLocation]) => {
          if (!active) return;
          setMapTheme(storedTheme);
          setUserLocation(grantedLocation);
        },
      );
      setPublicationPreferenceRefresh((current) => current + 1);

      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    if (mapFilterVisible && contributionPanelState !== 'collapsed') {
      setMapFilterVisible(false);
    }
  }, [contributionPanelState, mapFilterVisible]);

  useEffect(() => {
    // Route state is external to React; apply it after commit to avoid a cascading render.
    const routeSyncTimer = setTimeout(() => {
      if (!requestedReportId) {
        handledRouteReportIdRef.current = null;
        return;
      }
      if (handledRouteReportIdRef.current === requestedReportId) return;

      const requestedReport = mapMarkers.find((marker) => marker.id === requestedReportId);
      if (!requestedReport) return;

      handledRouteReportIdRef.current = requestedReportId;
      setLayers((current) => ({ ...current, reports: true }));
      setHighlightedResourceId(null);
      setFullReportVisible(true);
      setSelectedReportIds([requestedReport.id]);
      setHighlightedReportId(requestedReport.id);
      setFocusTarget({
        reportId: requestedReport.id,
        latitude: requestedReport.latitude,
        longitude: requestedReport.longitude,
      });
      router.setParams({ reportId: undefined });
    }, 0);
    return () => clearTimeout(routeSyncTimer);
  }, [mapMarkers, requestedReportId, router]);

  const facilityMarkers = useMemo<MapResourceMarker[]>(
    () =>
      facilities
        .filter(
          (facility) =>
            Number.isFinite(facility.latitude) &&
            Number.isFinite(facility.longitude) &&
            !(facility.latitude === 0 && facility.longitude === 0),
        )
        .map((facility) => ({
          id: facility.id,
          kind: 'facility' as const,
          name: facility.name,
          latitude: facility.latitude,
          longitude: facility.longitude,
          subtitle: facilityTypeLabel(facility.type),
        })),
    [facilities],
  );

  const centerMarkers = useMemo<MapResourceMarker[]>(
    () =>
      centers
        .filter(
          (center) =>
            Number.isFinite(center.latitude) &&
            Number.isFinite(center.longitude) &&
            !(center.latitude === 0 && center.longitude === 0),
        )
        .map((center) => ({
          id: center.id,
          kind: 'evacuation' as const,
          name: center.name,
          latitude: center.latitude,
          longitude: center.longitude,
          subtitle: `${evacuationStatusLabel(center.status)}${
            center.isPriority ? ' · Priority' : ''
          }`,
          isPriority: center.isPriority,
        })),
    [centers],
  );

  useEffect(() => {
    // Route state is external to React; apply it after commit to avoid a cascading render.
    const routeSyncTimer = setTimeout(() => {
      if (!requestedResourceId) {
        handledRouteResourceIdRef.current = null;
        return;
      }
      if (handledRouteResourceIdRef.current === requestedResourceId) return;

      const availableResources =
        requestedResourceKind === 'evacuation' ? centerMarkers : facilityMarkers;
      const requestedResource = availableResources.find(
        (resource) => resource.id === requestedResourceId,
      );
      if (!requestedResource) return;

      handledRouteResourceIdRef.current = requestedResourceId;
      setHighlightedReportId(null);
      setSelectedReportIds([]);
      setFullReportVisible(false);
      // Match the MDRRMO flow: center and pulse the requested resource without a detail sheet.
      setHighlightedResourceId(requestedResource.id);
      setLayers((current) => ({
        ...current,
        facilities: requestedResource.kind === 'facility' ? true : current.facilities,
        evacuationCenters:
          requestedResource.kind === 'evacuation' ? true : current.evacuationCenters,
      }));
      setFocusTarget({
        resourceId: requestedResource.id,
        latitude: requestedResource.latitude,
        longitude: requestedResource.longitude,
      });
      router.setParams({ resourceId: undefined, resourceKind: undefined });
    }, 0);
    return () => clearTimeout(routeSyncTimer);
  }, [
    centerMarkers,
    facilityMarkers,
    requestedResourceId,
    requestedResourceKind,
    router,
  ]);

  const highlightPublicIncident = useCallback((incidentCaseId: string, groupIds: string[], reportId?: string) => {
    setHighlightedReportId(null);
    setSelectedReportIds([]);
    setFullReportVisible(false);
    setHighlightedResourceId(null);
    const publicKey = reportId ?? incidentCaseId;
    setHighlightedIncidentId(publicKey);
    setIncidentGroupIds(groupIds.length > 0 ? groupIds : [publicKey]);
  }, []);

  const clearHighlightedIncident = useCallback(() => {
    setHighlightedIncidentId(null);
    setIncidentGroupIds([]);
  }, []);

  useEffect(() => {
    // "View on map" from Community or Home: center and pulse the incident, or
    // open its details directly when it has no public pin.
    const routeSyncTimer = setTimeout(() => {
      if (!requestedIncidentId) return;
      const requestKey = `${requestedIncidentId}:${requestedPublicReportId ?? ''}:${requestedOpenKey ?? ''}`;
      if (handledIncidentRequestRef.current === requestKey || incidentsLoading) return;
      handledIncidentRequestRef.current = requestKey;
      router.setParams({ incidentId: undefined, publicReportId: undefined, openRequest: undefined });

      const requestedIncident = eligiblePublicIncidents.find((incident) => requestedPublicReportId
        ? incident.reportId === requestedPublicReportId
        : incident.incidentCaseId === requestedIncidentId);
      const point = requestedIncident?.exactLocation ?? null;
      if (!requestedIncident || !point) return;
      setPublicLayerVisible(true);
      setPublicStatus('all');
      highlightPublicIncident(requestedIncident.incidentCaseId, [requestedIncident.reportId ?? requestedIncident.incidentCaseId], requestedIncident.reportId);
      setFocusTarget({ latitude: point.latitude, longitude: point.longitude });
    }, 0);
    return () => clearTimeout(routeSyncTimer);
  }, [eligiblePublicIncidents, highlightPublicIncident, incidentsLoading, requestedIncidentId, requestedPublicReportId, requestedOpenKey, router]);

  /** Discussion lives in Community; the map only links there. */
  const openCommunityIncident = useCallback((incidentCaseId: string) => {
    setSelectedIncidentId(null);
    setFullReportVisible(false);
    setSelectedReportIds([]);
    router.navigate({
      pathname: '/(main)/feed',
      params: { incidentId: incidentCaseId, openRequest: `${incidentCaseId}-${Date.now()}`, focus: 'comments' },
    });
  }, [router]);

  const highlightedIncidentGroupIndex = highlightedIncidentId
    ? Math.max(0, incidentGroupIds.indexOf(highlightedIncidentId))
    : 0;
  const stepIncidentGroup = (direction: 1 | -1) => {
    if (incidentGroupIds.length < 2) return;
    const nextIndex = (highlightedIncidentGroupIndex + direction + incidentGroupIds.length) % incidentGroupIds.length;
    setHighlightedIncidentId(incidentGroupIds[nextIndex]);
  };

  const selectedReports = useMemo(() => {
    if (selectedReportIds.length === 0) return [];
    const reportsById = new Map(mapMarkers.map((marker) => [marker.id, marker]));
    return selectedReportIds
      .map((id) => reportsById.get(id))
      .filter((marker): marker is MapReportMarker => marker != null);
  }, [mapMarkers, selectedReportIds]);

  const highlightedReport = useMemo(
    () => mapMarkers.find((marker) => marker.id === highlightedReportId) ?? null,
    [highlightedReportId, mapMarkers],
  );

  const contributions = useMemo(() => {
    if (!currentUserId) return [];
    return markers
      .filter((marker) => marker.reporter.id === currentUserId)
      .sort(
        (first, second) =>
          new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
      );
  }, [currentUserId, markers]);

  const openContribution = () => {
    setHighlightedResourceId(null);
    setFullReportVisible(false);
    setSelectedReportIds([]);
    setHighlightedReportId(null);
    settleContributions('expanded');
  };

  const showContributionOnMap = (report: MapReportMarker) => {
    const mapReport = mapMarkers.find((marker) => marker.id === report.id);
    if (!mapReport) return;
    setLayers((current) => ({ ...current, reports: true }));
    setHighlightedResourceId(null);
    clearHighlightedIncident();
    setSelectedReportIds([]);
    setFullReportVisible(false);
    setHighlightedReportId(mapReport.id);
    setFocusTarget({
      reportId: mapReport.id,
      latitude: mapReport.latitude,
      longitude: mapReport.longitude,
    });
  };

  const landscape = windowWidth > windowHeight;
  const contributionMediumHeight = landscape
    ? Math.max(240, Math.min(windowHeight * 0.7, 430))
    : Math.max(300, Math.min(windowHeight * 0.46, 520));
  const contributionFullHeight = Math.max(300, windowHeight - insets.top);
  const contributionBottomInset = bottomNavigationHeight + insets.bottom + 24;
  // The center Report action rises above the tab bar. Keep the selected-report
  // callout entirely above that raised control instead of behind it.
  const highlightedReportBottomOffset =
    bottomNavigationHeight + insets.bottom + navMetrics.reportLift + spacing.xs;
  const contributionHiddenOffset = Math.max(
    0,
    contributionFullHeight - bottomNavigationHeight - insets.bottom,
  );
  const contributionOffsets = useMemo(
    () => ({
      expanded: 0,
      medium: Math.max(
        0,
        contributionFullHeight - contributionMediumHeight - RESTING_CONTRIBUTION_LIFT,
      ),
      collapsed: Math.max(
        0,
        contributionFullHeight -
          bottomNavigationHeight -
          insets.bottom -
          COLLAPSED_HEADER_HEIGHT -
          RESTING_CONTRIBUTION_LIFT,
      ),
    }),
    [bottomNavigationHeight, contributionFullHeight, contributionMediumHeight, insets.bottom],
  );

  const settleContributions = useCallback(
    (nextState: ContributionPanelState) => {
      contributionPanelStateIndex.write(CONTRIBUTION_PANEL_STATES.indexOf(nextState));
      setContributionPanelState(nextState);
      Animated.spring(contributionTranslateY, {
        toValue: contributionOffsets[nextState],
        damping: 22,
        stiffness: 230,
        mass: 0.85,
        useNativeDriver: true,
      }).start();
    },
    [contributionOffsets, contributionPanelStateIndex, contributionTranslateY],
  );

  useEffect(() => {
    if (!shouldHideMapFilters) return;
    setMapFilterVisible(false);
    if (contributionPanelState !== 'collapsed') {
      settleContributions('collapsed');
    }
  }, [contributionPanelState, settleContributions, shouldHideMapFilters]);

  const handleMapFilterVisibilityChange = useCallback(
    (visible: boolean) => {
      if (visible && contributionPanelState !== 'collapsed') {
        settleContributions('collapsed');
      }
      setMapFilterVisible(visible);
    },
    [contributionPanelState, settleContributions],
  );

  useFocusEffect(
    useCallback(() => {
      // Reset only presentation state when returning to the cached map screen.
      setMapFilterVisible(false);
      settleContributions('collapsed');
    }, [settleContributions]),
  );

  useEffect(() => {
    const currentState = CONTRIBUTION_PANEL_STATES[contributionPanelStateIndex.read()];
    contributionTranslateY.setValue(contributionOffsets[currentState]);
  }, [contributionOffsets, contributionPanelStateIndex, contributionTranslateY]);

  useEffect(() => {
    // Temporarily move the contribution sheet behind the bottom navigation so
    // the highlighted report can replace it without losing the panel's state.
    const currentOffset = contributionOffsets[contributionPanelState];
    Animated.spring(highlightedReportTranslateY, {
      toValue: highlightedReportId || highlightedIncident
        ? Math.max(0, contributionHiddenOffset - currentOffset)
        : 0,
      damping: 22,
      stiffness: 230,
      mass: 0.85,
      useNativeDriver: true,
    }).start();
  }, [
    contributionHiddenOffset,
    contributionOffsets,
    contributionPanelState,
    highlightedIncident,
    highlightedReportId,
    highlightedReportTranslateY,
  ]);

  const handleReportSelection = useCallback(
    (reportIds: string[]) => {
      setHighlightedResourceId(null);
      setFullReportVisible(false);
      setHighlightedIncidentId(null);
      setIncidentGroupIds([]);

      if (reportIds.length === 1) {
        const report = markers.find((marker) => marker.id === reportIds[0]);
        if (!report) return;

        setSelectedReportIds([]);
        setHighlightedReportId(report.id);
        return;
      }

      setHighlightedReportId(null);
      setSelectedReportIds(reportIds);
    },
    [markers],
  );

  const openHighlightedReportDetails = useCallback(() => {
    if (!highlightedReport) return;
    setSelectedReportIds([highlightedReport.id]);
    setFullReportVisible(true);
  }, [highlightedReport]);

  const clearHighlightedReport = useCallback(() => {
    setHighlightedReportId(null);
    setSelectedReportIds([]);
  }, []);


  const contributionPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 7 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          contributionTranslateY.stopAnimation((currentOffset) => {
            dragStartOffset.write(currentOffset);
          });
        },
        onPanResponderMove: (_, gesture) => {
          const nextOffset = Math.max(
            0,
            Math.min(contributionOffsets.collapsed, dragStartOffset.read() + gesture.dy),
          );
          contributionTranslateY.setValue(nextOffset);
        },
        onPanResponderRelease: (_, gesture) => {
          contributionTranslateY.stopAnimation((currentOffset) => {
            const draggedDown = gesture.vy > 0.35 || gesture.dy > 54;
            const draggedUp = gesture.vy < -0.35 || gesture.dy < -54;

            if (draggedDown) {
              settleContributions(
                contributionPanelState === 'expanded' ? 'medium' : 'collapsed',
              );
              return;
            }

            if (draggedUp) {
              settleContributions(
                contributionPanelState === 'collapsed' ? 'medium' : 'expanded',
              );
              return;
            }

            const closestState = (
              Object.keys(contributionOffsets) as ContributionPanelState[]
            ).reduce((closest, candidate) => {
              const closestDistance = Math.abs(currentOffset - contributionOffsets[closest]);
              const candidateDistance = Math.abs(currentOffset - contributionOffsets[candidate]);
              return candidateDistance < closestDistance ? candidate : closest;
            }, contributionPanelState);
            settleContributions(closestState);
          });
        },
        onPanResponderTerminate: () => {
          settleContributions(contributionPanelState);
        },
      }),
    [
      contributionOffsets,
      contributionPanelState,
      contributionTranslateY,
      dragStartOffset,
      settleContributions,
    ],
  );

  return (
    <ReportEngagementProvider reports={markers}>
      <View style={styles.screen}>
        <StatusBar style={mapTheme === 'dark' ? 'light' : 'dark'} />

        <View style={styles.mapSection}>
          <InteractiveMap
            markers={mapMarkers}
            publicIncidents={publicLayerVisible ? visibleIncidents : []}
            highlightedPublicIncidentId={highlightedIncidentId ?? undefined}
            onPublicIncidentPress={highlightPublicIncident}
            reportLayerLabel="Your contributions"
            publicIncidentFilters={{
              visible: publicLayerVisible, onVisibilityChange: setPublicLayerVisible,
              status: publicStatus, onStatusChange: setPublicStatus,
            }}
            facilities={facilityMarkers}
            evacuationCenters={centerMarkers}
            layerVisibility={layers}
            showLayerFilters={!shouldHideMapFilters}
            collapsibleLayerFilters
            showSearchBar
            compactLayerFilters
            layerPanelVisible={mapFilterVisible}
            onLayerPanelVisibilityChange={handleMapFilterVisibilityChange}
            showLayerPanelToggle={!shouldHideMapFilters}
            searchBarTopInset={insets.top + 12}
            layerFiltersTopInset={insets.top + (error ? 126 : 76)}
            userLocation={userLocation}
            showUserLocationMarker={false}
            showZoomControls={false}
            showMapDetails={false}
            tone={mapTheme}
            onLayerVisibilityChange={(nextLayers) => {
              setLayers(nextLayers);
              if (!nextLayers.reports) {
                setHighlightedReportId(null);
                setSelectedReportIds([]);
                setFullReportVisible(false);
              }
            }}
            focusTarget={focusTarget}
            highlightedReportId={highlightedReportId}
            highlightedResourceId={highlightedResourceId}
            onReportSelection={handleReportSelection}
            onResourceSelection={(resource) => {
              setSelectedReportIds([]);
              setFullReportVisible(false);
              setHighlightedReportId(null);
              clearHighlightedIncident();
              setHighlightedResourceId(resource.id);
            }}
          />
          {(incidentsError || error || requestedOwnError || ownLocationPreferencesError) ? <TouchableOpacity
            style={[styles.errorBanner, { top: insets.top + 70 }]}
            onPress={() => { void reloadIncidents(); void reload(); setRequestRetry((value) => value + 1); setPublicationPreferenceRefresh((value) => value + 1); }} accessibilityRole="button">
            <Text accessibilityRole="alert" style={styles.errorText}>{requestedOwnError ?? ownLocationPreferencesError ?? 'Some map data could not refresh. Tap to retry.'}</Text>
          </TouchableOpacity> : null}
        </View>

        {highlightedReport ? (
          <ResidentMapCallout
            report={highlightedReport}
            useScopedPresentation
            bottomOffset={highlightedReportBottomOffset}
            onClose={clearHighlightedReport}
            onOpenDetails={openHighlightedReportDetails}
          />
        ) : highlightedIncident ? (
          <ResidentMapCallout
            incident={highlightedIncident}
            bottomOffset={highlightedReportBottomOffset}
            onClose={clearHighlightedIncident}
            onOpenDetails={() => {
              setSelectedIncidentId(highlightedIncident.incidentCaseId);
              setSelectedPublicReportId(highlightedIncident.reportId ?? null);
            }}
            pager={{
              index: highlightedIncidentGroupIndex,
              total: incidentGroupIds.length,
              onPrevious: () => stepIncidentGroup(-1),
              onNext: () => stepIncidentGroup(1),
            }}
          />
        ) : null}

        <Animated.View
          style={[
            styles.contributionSheet,
            {
              height: contributionFullHeight,
              transform: [
                {
                  translateY: Animated.add(
                    contributionTranslateY,
                    highlightedReportTranslateY,
                  ),
                },
              ],
            },
          ]}
        >
          <YourContributionsPanel
            reports={contributions}
            loading={reportsLoading || profileInitialLoading}
            error={error}
            bottomInset={contributionBottomInset}
            detailCacheScope={currentUserId}
            onReportPress={openContribution}
            onShowReportOnMap={showContributionOnMap}
            canShowReportOnMap={(report) => mapMarkers.some((marker) => marker.id === report.id)}
            onRetry={() => void reload()}
            onBackFromReport={() => settleContributions('medium')}
            panelState={contributionPanelState}
            onToggleExpanded={() =>
              settleContributions(
                contributionPanelState === 'collapsed'
                  ? 'medium'
                  : contributionPanelState === 'medium'
                    ? 'expanded'
                    : 'medium',
              )
            }
            dragHandlePanHandlers={contributionPanResponder.panHandlers}
          />
        </Animated.View>

        <ReportMapDetailSheet
          visible={selectedReports.length > 1 || fullReportVisible}
          reports={selectedReports}
          detailCacheScope={currentUserId}
          commentMode="interactive"
          useScopedPresentation
          onOpenCommunityIncident={openCommunityIncident}
          onClose={() => {
            setFullReportVisible(false);
            setSelectedReportIds([]);
          }}
        />
        {selectedIncidentId ? (
          <PublicIncidentDetail
            key={`${selectedIncidentId}-${selectedPublicReportId ?? 'incident'}`}
            incidentCaseId={selectedIncidentId}
            reportId={selectedPublicReportId ?? undefined}
            context="map"
            onClose={() => { setSelectedIncidentId(null); setSelectedPublicReportId(null); }}
            onOpenCommunity={openCommunityIncident}
            onEngagementChange={patchEngagement}
          />
        ) : null}
      </View>
    </ReportEngagementProvider>
  );
}

const publicStyles = StyleSheet.create({
  toolbarButton: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  sheet: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  title: { fontFamily: fonts.semibold, fontSize: 18, color: colors.text },
  caption: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
});
