import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import InteractiveMap, {
  type MapFocusTarget,
  type MapLayerVisibility,
  type MapResourceMarker,
} from '../../components/map/InteractiveMap';
import ReportMapDetailSheet from '../../components/map/ReportMapDetailSheet';
import ResourceMapDetailSheet from '../../components/map/ResourceMapDetailSheet';
import YourContributionsPanel from '../../components/map/YourContributionsPanel';
import { ReportEngagementProvider } from '../../components/report/ReportEngagementProvider';
import { useEvacuationCenters } from '../../hooks/useEvacuationCenters';
import { useReports } from '../../hooks/useReports';
import { useResources } from '../../hooks/useResources';
import { getActiveSession } from '../../lib/auth';
import type { MapReportMarker } from '../../lib/reports';
import { evacuationStatusLabel, facilityTypeLabel } from '../../lib/resources';
import { navMetrics } from '../../styles/components/bottomNav.styles';
import { residentMapStyles as styles } from '../../styles/screens/residentMap.styles';

const COLLAPSED_HEADER_HEIGHT = 88;

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { reportId, resourceId, resourceKind } = useLocalSearchParams<{
    reportId?: string | string[];
    resourceId?: string | string[];
    resourceKind?: string | string[];
  }>();
  const {
    reports: markers,
    error,
    loading: reportsLoading,
    reload,
  } = useReports({ realtime: true });
  const { facilities } = useResources({ mode: 'resident' });
  const { centers } = useEvacuationCenters();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [selectedResource, setSelectedResource] = useState<MapResourceMarker | null>(null);
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);
  const [contributionsCollapsed, setContributionsCollapsed] = useState(false);
  const contributionsCollapsedRef = useRef(false);
  const contributionTranslateY = useRef(new Animated.Value(0)).current;
  const dragStartOffsetRef = useRef(0);
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

  useEffect(() => {
    let cancelled = false;

    void getActiveSession().then((session) => {
      if (cancelled) return;
      setCurrentUserId(session?.user.id ?? null);
      setIdentityLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!requestedReportId) {
      handledRouteReportIdRef.current = null;
      return;
    }
    if (handledRouteReportIdRef.current === requestedReportId) return;

    const requestedReport = markers.find((marker) => marker.id === requestedReportId);
    if (!requestedReport) return;

    handledRouteReportIdRef.current = requestedReportId;
    setSelectedResource(null);
    setSelectedReportIds([requestedReport.id]);
    setFocusTarget({
      reportId: requestedReport.id,
      latitude: requestedReport.latitude,
      longitude: requestedReport.longitude,
    });
    router.setParams({ reportId: undefined });
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
    setSelectedReportIds([]);
    setSelectedResource(requestedResource);
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

  const contributions = useMemo(() => {
    if (!currentUserId) return [];
    return markers
      .filter((marker) => marker.reporter.id === currentUserId)
      .sort(
        (first, second) =>
          new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
      );
  }, [currentUserId, markers]);

  const openContribution = (report: MapReportMarker) => {
    setLayers((current) => ({ ...current, reports: true }));
    setSelectedResource(null);
    setSelectedReportIds([report.id]);
    setFocusTarget({
      reportId: report.id,
      latitude: report.latitude,
      longitude: report.longitude,
    });
  };

  const landscape = windowWidth > windowHeight;
  const contributionSheetHeight = landscape
    ? Math.max(240, Math.min(windowHeight * 0.7, 430))
    : Math.max(300, Math.min(windowHeight * 0.46, 520));
  const contributionBottomInset = navMetrics.barHeight + insets.bottom + 24;
  const collapsedOffset = Math.max(
    0,
    contributionSheetHeight -
      navMetrics.barHeight -
      insets.bottom -
      COLLAPSED_HEADER_HEIGHT,
  );

  const settleContributions = useCallback(
    (collapse: boolean) => {
      contributionsCollapsedRef.current = collapse;
      setContributionsCollapsed(collapse);
      Animated.spring(contributionTranslateY, {
        toValue: collapse ? collapsedOffset : 0,
        damping: 22,
        stiffness: 230,
        mass: 0.85,
        useNativeDriver: true,
      }).start();
    },
    [collapsedOffset, contributionTranslateY],
  );

  useEffect(() => {
    contributionTranslateY.setValue(
      contributionsCollapsedRef.current ? collapsedOffset : 0,
    );
  }, [collapsedOffset, contributionTranslateY]);

  const contributionPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 7 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          contributionTranslateY.stopAnimation((currentOffset) => {
            dragStartOffsetRef.current = currentOffset;
          });
        },
        onPanResponderMove: (_, gesture) => {
          const nextOffset = Math.max(
            0,
            Math.min(collapsedOffset, dragStartOffsetRef.current + gesture.dy),
          );
          contributionTranslateY.setValue(nextOffset);
        },
        onPanResponderRelease: (_, gesture) => {
          contributionTranslateY.stopAnimation((currentOffset) => {
            const draggedDown = gesture.vy > 0.35 || gesture.dy > 54;
            const draggedUp = gesture.vy < -0.35 || gesture.dy < -54;
            const collapse = draggedDown
              ? true
              : draggedUp
                ? false
                : currentOffset > collapsedOffset / 2;
            settleContributions(collapse);
          });
        },
        onPanResponderTerminate: () => {
          contributionTranslateY.stopAnimation((currentOffset) => {
            settleContributions(currentOffset > collapsedOffset / 2);
          });
        },
      }),
    [collapsedOffset, contributionTranslateY, settleContributions],
  );

  return (
    <ReportEngagementProvider reports={markers}>
      <View style={styles.screen}>
        <StatusBar style="dark" />

        <View style={styles.mapSection}>
          <InteractiveMap
            markers={markers}
            facilities={facilityMarkers}
            evacuationCenters={centerMarkers}
            layerVisibility={layers}
            showLayerFilters
            layerFiltersTopInset={insets.top + (error ? 70 : 24)}
            showZoomControls={false}
            onLayerVisibilityChange={setLayers}
            focusTarget={focusTarget}
            onReportSelection={(ids) => {
              setSelectedResource(null);
              setSelectedReportIds(ids);
            }}
            onResourceSelection={(resource) => {
              setSelectedReportIds([]);
              setSelectedResource(resource);
            }}
          />
          {error ? (
            <View style={[styles.errorBanner, { top: insets.top + 8 }]} pointerEvents="none">
              <Text style={styles.errorText}>Map data could not fully refresh.</Text>
            </View>
          ) : null}
        </View>

        <Animated.View
          style={[
            styles.contributionSheet,
            {
              height: contributionSheetHeight,
              transform: [{ translateY: contributionTranslateY }],
            },
          ]}
        >
          <YourContributionsPanel
            reports={contributions}
            loading={reportsLoading || identityLoading}
            error={error}
            bottomInset={contributionBottomInset}
            onReportPress={openContribution}
            onRetry={() => void reload()}
            collapsed={contributionsCollapsed}
            onToggleCollapsed={() => settleContributions(!contributionsCollapsed)}
            dragHandlePanHandlers={contributionPanResponder.panHandlers}
          />
        </Animated.View>

        <ReportMapDetailSheet
          visible={selectedReports.length > 0}
          reports={selectedReports}
          onClose={() => setSelectedReportIds([])}
        />
        <ResourceMapDetailSheet
          visible={selectedResource != null}
          resource={selectedResource}
          onClose={() => setSelectedResource(null)}
        />
      </View>
    </ReportEngagementProvider>
  );
}
