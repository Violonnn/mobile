import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
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
import { goBackOrReplace } from '../../lib/navigation';

import InteractiveMap, {
  type MapFocusTarget,
  type MapLayerVisibility,
  type MapResourceMarker,
} from '../../components/map/InteractiveMap';
import HighlightedReportCallout from '../../components/map/HighlightedReportCallout';
import ReportMapDetailSheet from '../../components/map/ReportMapDetailSheet';
import YourContributionsPanel, {
  type ContributionPanelState,
} from '../../components/map/YourContributionsPanel';
import { ReportEngagementProvider } from '../../components/report/ReportEngagementProvider';
import { useResidentData } from '../../context/ResidentDataContext';
import { useReports } from '../../hooks/useReports';
import { getGrantedMapGps, type GpsPosition } from '../../lib/location';
import { getResidentMapTheme, type ResidentMapTheme } from '../../lib/mapPreferences';
import { createMutableNumber } from '../../lib/mutableNumber';
import type { MapReportMarker } from '../../lib/reports';
import { evacuationStatusLabel, facilityTypeLabel } from '../../lib/resources';
import { getResidentBottomNavigationHeight } from '../../styles/components/bottomNav.styles';
import { residentMapStyles as styles } from '../../styles/screens/residentMap.styles';
import { colors, spacing } from '../../styles/theme';

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
  const { reportId, resourceId, resourceKind, fromNotification } = useLocalSearchParams<{
    reportId?: string | string[];
    resourceId?: string | string[];
    resourceKind?: string | string[];
    fromNotification?: string | string[];
  }>();
  const openedFromNotification = Array.isArray(fromNotification)
    ? fromNotification[0] === '1'
    : fromNotification === '1';
  const {
    reports: markers,
    error,
    loading: reportsLoading,
    reload,
  } = useReports({ realtime: true, staleTimeMs: 5 * 60_000 });
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

  const currentUserId = profile?.id ?? null;

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

      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    // Route state is external to React; apply it after commit to avoid a cascading render.
    const routeSyncTimer = setTimeout(() => {
      if (!requestedReportId) {
        handledRouteReportIdRef.current = null;
        return;
      }
      if (handledRouteReportIdRef.current === requestedReportId) return;

      const requestedReport = markers.find((marker) => marker.id === requestedReportId);
      if (!requestedReport) return;

      handledRouteReportIdRef.current = requestedReportId;
      setLayers((current) => ({ ...current, reports: true }));
      setHighlightedResourceId(null);
      setFullReportVisible(false);
      setSelectedReportIds([]);
      setHighlightedReportId(requestedReport.id);
      setFocusTarget({
        reportId: requestedReport.id,
        latitude: requestedReport.latitude,
        longitude: requestedReport.longitude,
      });
      router.setParams({ reportId: undefined });
    }, 0);
    return () => clearTimeout(routeSyncTimer);
  }, [markers, requestedReportId, router]);

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

  const selectedReports = useMemo(() => {
    if (selectedReportIds.length === 0) return [];
    const reportsById = new Map(markers.map((marker) => [marker.id, marker]));
    return selectedReportIds
      .map((id) => reportsById.get(id))
      .filter((marker): marker is MapReportMarker => marker != null);
  }, [markers, selectedReportIds]);

  const highlightedReport = useMemo(
    () => markers.find((marker) => marker.id === highlightedReportId) ?? null,
    [highlightedReportId, markers],
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
    setLayers((current) => ({ ...current, reports: true }));
    setHighlightedResourceId(null);
    setSelectedReportIds([]);
    setFullReportVisible(false);
    setHighlightedReportId(report.id);
    setFocusTarget({
      reportId: report.id,
      latitude: report.latitude,
      longitude: report.longitude,
    });
  };

  const landscape = windowWidth > windowHeight;
  const contributionMediumHeight = landscape
    ? Math.max(240, Math.min(windowHeight * 0.7, 430))
    : Math.max(300, Math.min(windowHeight * 0.46, 520));
  const contributionFullHeight = Math.max(300, windowHeight - insets.top);
  const contributionBottomInset = bottomNavigationHeight + insets.bottom + 24;
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
      toValue: highlightedReportId
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
    highlightedReportId,
    highlightedReportTranslateY,
  ]);

  const handleReportSelection = useCallback(
    (reportIds: string[]) => {
      setHighlightedResourceId(null);
      setFullReportVisible(false);

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

  const openReportInCommunity = useCallback(
    (targetReportId: string) => {
      setFullReportVisible(false);
      setSelectedReportIds([]);
      router.navigate({
        pathname: '/(main)/feed',
        params: {
          reportId: targetReportId,
          openRequest: `${targetReportId}-${Date.now()}`,
        },
      });
    },
    [router],
  );

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
            markers={markers}
            facilities={facilityMarkers}
            evacuationCenters={centerMarkers}
            layerVisibility={layers}
            showLayerFilters
            collapsibleLayerFilters
            showReportStatusFilters
            showSearchBar
            compactLayerFilters
            layerPanelVisible={mapFilterVisible}
            onLayerPanelVisibilityChange={setMapFilterVisible}
            searchBarTopInset={insets.top + (openedFromNotification ? 62 : 12)}
            layerFiltersTopInset={
              insets.top + (error ? 126 : 76) + (openedFromNotification ? 50 : 0)
            }
            userLocation={userLocation}
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
            showHighlightedReportIncidentIcon
            onReportSelection={handleReportSelection}
            onResourceSelection={(resource) => {
              setSelectedReportIds([]);
              setFullReportVisible(false);
              setHighlightedReportId(null);
              setHighlightedResourceId(resource.id);
            }}
          />
          {openedFromNotification ? (
            <TouchableOpacity
              style={[styles.notificationBackButton, { top: insets.top + 8 }]}
              onPress={() => goBackOrReplace(router, '/(main)/home')}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Back to notifications"
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
              <Text style={styles.notificationBackText}>Back</Text>
            </TouchableOpacity>
          ) : null}
          {error ? (
            <View
              style={[
                styles.errorBanner,
                { top: insets.top + 70 + (openedFromNotification ? 50 : 0) },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.errorText}>Map data could not fully refresh.</Text>
            </View>
          ) : null}
        </View>

        {highlightedReport ? (
            <HighlightedReportCallout
              report={highlightedReport}
              bottomOffset={bottomNavigationHeight + insets.bottom + spacing.md}
              onClose={clearHighlightedReport}
              onOpenDetails={openHighlightedReportDetails}
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
            onReportPress={openContribution}
            onShowReportOnMap={showContributionOnMap}
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
          commentMode="prioritizedReadOnly"
          onOpenCommunityReport={openReportInCommunity}
          onClose={() => {
            setFullReportVisible(false);
            setSelectedReportIds([]);
          }}
        />
      </View>
    </ReportEngagementProvider>
  );
}
