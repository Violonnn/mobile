// app/official/map.tsx
// Official map: report clusters + facility/evac layers with legend filters.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  PanResponder,
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import InteractiveMap, {
  type MapLayerVisibility,
  type MapResourceMarker,
  type MapFocusTarget,
} from '../../components/map/InteractiveMap';
import HighlightedReportCallout from '../../components/map/HighlightedReportCallout';
import ReportMapDetailSheet from '../../components/map/ReportMapDetailSheet';
import EscalatedReportsPanel from '../../components/map/EscalatedReportsPanel';
import MayorMapPanel from '../../components/map/MayorMapPanel';
import { ReportEngagementProvider } from '../../components/report/ReportEngagementProvider';
import { useReports } from '../../hooks/useReports';
import { useResources } from '../../hooks/useResources';
import { useEvacuationCenters } from '../../hooks/useEvacuationCenters';
import { useOfficialPortal } from '../../context/OfficialPortalContext';
import MdrrmoHeader from '../../components/official/MdrrmoHeader';
import {
  evacuationStatusLabel,
  facilityTypeLabel,
} from '../../lib/resources';
import { type MapReportMarker } from '../../lib/reports';
import { colors, fonts, fontSizes, spacing } from '../../styles/theme';
import { officialStyles } from '../../styles/screens/official.styles';
import { residentMapStyles } from '../../styles/screens/residentMap.styles';
import { officialNavMetrics } from '../../styles/components/officialBottomNav.styles';
import { isValidReportId } from '../../lib/officialReports';
import { createMutableNumber } from '../../lib/mutableNumber';

const COLLAPSED_PANEL_HEADER_HEIGHT = 88;

export default function OfficialMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { reportId, resourceId } = useLocalSearchParams<{
    reportId?: string | string[];
    resourceId?: string | string[];
  }>();
  const requestedResourceId = Array.isArray(resourceId) ? resourceId[0] : resourceId;
  const { officialKind, scope } = useOfficialPortal();
  const scopeBarangayId = scope?.barangay_id ?? null;
  const barangayFilter =
    officialKind === 'BDRRMO' ? scopeBarangayId : null;
  const { reports: markers, error, loading, reload } = useReports({
    realtime: true,
    barangayId: barangayFilter,
    includePending: false,
  });

  const { facilities } = useResources({
    mode: 'official',
    barangayId: barangayFilter,
  });
  const { centers } = useEvacuationCenters({ barangayId: barangayFilter });

  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [highlightedReportId, setHighlightedReportId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);
  const [highlightedResourceId, setHighlightedResourceId] = useState<string | null>(
    requestedResourceId ?? null,
  );
  const [focusError, setFocusError] = useState<string | null>(null);
  const [layers, setLayers] = useState<MapLayerVisibility>({
    reports: true,
    facilities: true,
    evacuationCenters: true,
  });
  const [escalatedPanelCollapsed, setEscalatedPanelCollapsed] = useState(false);
  const [escalatedPanelTranslateY] = useState(() => new Animated.Value(0));
  const [highlightedReportTranslateY] = useState(() => new Animated.Value(0));
  const [panelDragStartOffset] = useState(() => createMutableNumber());

  const scopedMarkers = useMemo(() => {
    if (officialKind !== 'BDRRMO' || !scopeBarangayId) {
      return markers;
    }
    return markers.filter(
      (marker) => marker.barangay_id === scopeBarangayId,
    );
  }, [markers, officialKind, scopeBarangayId]);

  const facilityMarkers = useMemo<MapResourceMarker[]>(
    () =>
      facilities
        // Keep inactive facilities off the regular map, but show one when its map action was requested.
        .filter((f) => f.isActive || f.id === requestedResourceId)
        .filter(
          (f) =>
            Number.isFinite(f.latitude) &&
            Number.isFinite(f.longitude) &&
            !(f.latitude === 0 && f.longitude === 0),
        )
        .map((f) => ({
          id: f.id,
          kind: 'facility' as const,
          name: f.name,
          latitude: f.latitude,
          longitude: f.longitude,
          subtitle: facilityTypeLabel(f.type),
        })),
    [facilities, requestedResourceId],
  );

  const centerMarkers = useMemo<MapResourceMarker[]>(
    () =>
      centers
        .filter(
          (c) =>
            Number.isFinite(c.latitude) &&
            Number.isFinite(c.longitude) &&
            !(c.latitude === 0 && c.longitude === 0),
        )
        .map((c) => ({
          id: c.id,
          kind: 'evacuation' as const,
          name: c.name,
          latitude: c.latitude,
          longitude: c.longitude,
          subtitle: `${evacuationStatusLabel(c.status)}${
            c.isPriority ? ' · Priority' : ''
          }`,
          isPriority: c.isPriority,
        })),
    [centers],
  );

  const selectedReports = useMemo(() => {
    if (selectedReportIds.length === 0) return [];
    const byId = new Map(scopedMarkers.map((marker) => [marker.id, marker]));
    return selectedReportIds
      .map((id) => byId.get(id))
      .filter((marker): marker is MapReportMarker => marker != null);
  }, [scopedMarkers, selectedReportIds]);

  const highlightedReport = useMemo(
    () => scopedMarkers.find((marker) => marker.id === highlightedReportId) ?? null,
    [highlightedReportId, scopedMarkers],
  );

  const escalatedReports = useMemo(
    () =>
      scopedMarkers
        .filter((marker) => marker.status === 'escalated')
        .sort(
          (first, second) =>
            new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
        ),
    [scopedMarkers],
  );

  const openEscalatedReport = (report: MapReportMarker) => {
    setLayers((current) => ({ ...current, reports: true }));
    setSelectedReportIds([]);
    setHighlightedReportId(report.id);
    setHighlightedResourceId(null);
    setFocusTarget({
      reportId: report.id,
      latitude: report.latitude,
      longitude: report.longitude,
    });
  };

  const landscape = windowWidth > windowHeight;
  const escalatedPanelHeight = landscape
    ? Math.max(240, Math.min(windowHeight * 0.7, 430))
    : Math.max(300, Math.min(windowHeight * 0.46, 520));
  const escalatedPanelBottomInset = officialNavMetrics.barHeight + insets.bottom + spacing.lg;
  const escalatedPanelHiddenOffset = Math.max(
    0,
    escalatedPanelHeight - officialNavMetrics.barHeight - insets.bottom,
  );
  const collapsedPanelOffset = Math.max(
    0,
    escalatedPanelHeight -
      officialNavMetrics.barHeight -
      insets.bottom -
      COLLAPSED_PANEL_HEADER_HEIGHT,
  );

  const settleEscalatedPanel = useCallback(
    (collapse: boolean) => {
      setEscalatedPanelCollapsed(collapse);
      Animated.spring(escalatedPanelTranslateY, {
        toValue: collapse ? collapsedPanelOffset : 0,
        damping: 22,
        stiffness: 230,
        mass: 0.85,
        useNativeDriver: true,
      }).start();
    },
    [collapsedPanelOffset, escalatedPanelTranslateY],
  );

  const handleLayerVisibilityChange = useCallback((nextLayers: MapLayerVisibility) => {
    setLayers(nextLayers);
    if (nextLayers.reports) return;

    setHighlightedReportId(null);
    setSelectedReportIds([]);
  }, []);

  const handleMapReportSelection = useCallback(
    (reportIds: string[]) => {
      setHighlightedResourceId(null);

      if (reportIds.length === 1) {
        const report = scopedMarkers.find((marker) => marker.id === reportIds[0]);
        if (!report) return;

        setSelectedReportIds([]);
        setHighlightedReportId(report.id);
        return;
      }

      setHighlightedReportId(null);
      setSelectedReportIds(reportIds);
    },
    [scopedMarkers],
  );

  const openHighlightedReportDetails = useCallback(() => {
    if (!highlightedReport) return;
    setSelectedReportIds([highlightedReport.id]);
  }, [highlightedReport]);

  useEffect(() => {
    escalatedPanelTranslateY.setValue(
      escalatedPanelCollapsed ? collapsedPanelOffset : 0,
    );
  }, [collapsedPanelOffset, escalatedPanelCollapsed, escalatedPanelTranslateY]);

  useEffect(() => {
    const currentPanelOffset = escalatedPanelCollapsed ? collapsedPanelOffset : 0;
    Animated.spring(highlightedReportTranslateY, {
      toValue: highlightedReportId
        ? Math.max(0, escalatedPanelHiddenOffset - currentPanelOffset)
        : 0,
      damping: 22,
      stiffness: 230,
      mass: 0.85,
      useNativeDriver: true,
    }).start();
  }, [
    collapsedPanelOffset,
    escalatedPanelCollapsed,
    escalatedPanelHiddenOffset,
    highlightedReportId,
    highlightedReportTranslateY,
  ]);

  const escalatedPanelPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 7 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          escalatedPanelTranslateY.stopAnimation((currentOffset) => {
            panelDragStartOffset.write(currentOffset);
          });
        },
        onPanResponderMove: (_, gesture) => {
          const nextOffset = Math.max(
            0,
            Math.min(collapsedPanelOffset, panelDragStartOffset.read() + gesture.dy),
          );
          escalatedPanelTranslateY.setValue(nextOffset);
        },
        onPanResponderRelease: (_, gesture) => {
          escalatedPanelTranslateY.stopAnimation((currentOffset) => {
            const draggedDown = gesture.vy > 0.35 || gesture.dy > 54;
            const draggedUp = gesture.vy < -0.35 || gesture.dy < -54;
            const collapse = draggedDown
              ? true
              : draggedUp
                ? false
                : currentOffset > collapsedPanelOffset / 2;
            settleEscalatedPanel(collapse);
          });
        },
        onPanResponderTerminate: () => {
          escalatedPanelTranslateY.stopAnimation((currentOffset) => {
            settleEscalatedPanel(currentOffset > collapsedPanelOffset / 2);
          });
        },
      }),
    [
      collapsedPanelOffset,
      escalatedPanelTranslateY,
      panelDragStartOffset,
      settleEscalatedPanel,
    ],
  );

  useEffect(() => {
    // Route state is external to React; apply it after commit to avoid a cascading render.
    const routeSyncTimer = setTimeout(() => {
      const requestedId = Array.isArray(reportId) ? reportId[0] : reportId;
      if (!requestedId) {
        setFocusTarget(null);
        setFocusError(null);
        return;
      }
      if (!isValidReportId(requestedId)) {
        setFocusTarget(null);
        setSelectedReportIds([]);
        setFocusError('The requested report link is invalid.');
        return;
      }
      if (loading) return;

      const targetReport = scopedMarkers.find((marker) => marker.id === requestedId);
      if (!targetReport) {
        setFocusTarget(null);
        setSelectedReportIds([]);
        setFocusError('That report is unavailable in your current scope.');
        return;
      }
      if (!Number.isFinite(targetReport.latitude) || !Number.isFinite(targetReport.longitude)) {
        setFocusTarget(null);
        setSelectedReportIds([]);
        setFocusError('That report does not have a valid map location.');
        return;
      }

      setFocusError(null);
      setSelectedReportIds([]);
      setHighlightedReportId(targetReport.id);
      setHighlightedResourceId(null);
      setFocusTarget({
        reportId: targetReport.id,
        latitude: targetReport.latitude,
        longitude: targetReport.longitude,
      });
    }, 0);
    return () => clearTimeout(routeSyncTimer);
  }, [loading, reportId, scopedMarkers]);

  useEffect(() => {
    // Route state is external to React; apply it after commit to avoid a cascading render.
    const routeSyncTimer = setTimeout(() => {
      const requestedId = Array.isArray(resourceId) ? resourceId[0] : resourceId;
      if (!requestedId) return;

      const resource = [...facilityMarkers, ...centerMarkers].find((item) => item.id === requestedId);
      if (!resource) return;

      setFocusError(null);
      setSelectedReportIds([]);
      setHighlightedReportId(null);
      setHighlightedResourceId(resource.id);
      setLayers((current) => (
        resource.kind === 'facility'
          ? { ...current, facilities: true }
          : { ...current, evacuationCenters: true }
      ));
      // Resource navigation should leave the response queue out of the way.
      settleEscalatedPanel(true);
    }, 0);
    return () => clearTimeout(routeSyncTimer);
  }, [centerMarkers, facilityMarkers, resourceId, settleEscalatedPanel]);

  if (officialKind === 'Mayor') {
    return (
      <ReportEngagementProvider reports={scopedMarkers}>
        <View style={residentMapStyles.screen}>
          <StatusBar style="dark" />
          <View style={residentMapStyles.mapSection}>
            <InteractiveMap
              markers={scopedMarkers}
              facilities={facilityMarkers}
              evacuationCenters={centerMarkers}
              layerVisibility={layers}
              showLayerFilters
              collapsibleLayerFilters
              showReportStatusFilters
              showSearchBar
              compactLayerFilters
              searchBarTopInset={insets.top + 12}
              layerFiltersTopInset={insets.top + (error || focusError ? 126 : 76)}
              showZoomControls={false}
              onLayerVisibilityChange={handleLayerVisibilityChange}
              onReportSelection={handleMapReportSelection}
              onResourceSelection={(resource) => {
                setSelectedReportIds([]);
                setHighlightedReportId(null);
                setHighlightedResourceId(resource.id);
                setFocusTarget({
                  resourceId: resource.id,
                  latitude: resource.latitude,
                  longitude: resource.longitude,
                });
              }}
              focusTarget={focusTarget}
              highlightedReportId={highlightedReportId}
              highlightedResourceId={highlightedResourceId}
            />
            {error || focusError ? (
              <View style={[residentMapStyles.errorBanner, { top: insets.top + spacing.sm }]} pointerEvents="none">
                <Text style={residentMapStyles.errorText}>{focusError || 'Map data could not fully refresh.'}</Text>
              </View>
            ) : null}
          </View>

          <Animated.View
            style={[
              residentMapStyles.contributionSheet,
              {
                height: escalatedPanelHeight,
                transform: [
                  {
                    translateY: Animated.add(
                      escalatedPanelTranslateY,
                      highlightedReportTranslateY,
                    ),
                  },
                ],
              },
            ]}
          >
            <MayorMapPanel
              reports={scopedMarkers}
              centers={centers}
              loading={loading}
              error={error}
              bottomInset={escalatedPanelBottomInset}
              collapsed={escalatedPanelCollapsed}
              onLocateReport={openEscalatedReport}
              onRetry={() => void reload()}
              onToggleCollapsed={() => settleEscalatedPanel(!escalatedPanelCollapsed)}
              dragHandlePanHandlers={escalatedPanelPanResponder.panHandlers}
            />
          </Animated.View>

          {highlightedReport ? (
            <HighlightedReportCallout
              report={highlightedReport}
              bottomOffset={officialNavMetrics.barHeight + insets.bottom + spacing.md}
              onClose={() => setHighlightedReportId(null)}
              onOpenDetails={openHighlightedReportDetails}
            />
          ) : null}

          <ReportMapDetailSheet
            visible={selectedReports.length > 0}
            reports={selectedReports}
            onClose={() => setSelectedReportIds([])}
          />
        </View>
      </ReportEngagementProvider>
    );
  }

  if (officialKind === 'MDRRMO') {
    return (
      <ReportEngagementProvider reports={scopedMarkers}>
        <View style={residentMapStyles.screen}>
          <StatusBar style="dark" />
          <View style={residentMapStyles.mapSection}>
            <InteractiveMap
              markers={scopedMarkers}
              facilities={facilityMarkers}
              evacuationCenters={centerMarkers}
              layerVisibility={layers}
              showLayerFilters
              collapsibleLayerFilters
              showReportStatusFilters
              showSearchBar
              compactLayerFilters
              searchBarTopInset={insets.top + 12}
              layerFiltersTopInset={insets.top + (error || focusError ? 126 : 76)}
              showZoomControls={false}
              onLayerVisibilityChange={handleLayerVisibilityChange}
              onReportSelection={handleMapReportSelection}
              onResourceSelection={(resource) => {
                setSelectedReportIds([]);
                setHighlightedReportId(null);
                setHighlightedResourceId(resource.id);
                setFocusTarget({
                  resourceId: resource.id,
                  latitude: resource.latitude,
                  longitude: resource.longitude,
                });
              }}
              focusTarget={focusTarget}
              highlightedReportId={highlightedReportId}
              highlightedResourceId={highlightedResourceId}
            />
            {error || focusError ? (
              <View
                style={[residentMapStyles.errorBanner, { top: insets.top + spacing.sm }]}
                pointerEvents="none"
              >
                <Text style={residentMapStyles.errorText}>
                  {focusError || 'Map data could not fully refresh.'}
                </Text>
              </View>
            ) : null}
          </View>

          <Animated.View
            style={[
              residentMapStyles.contributionSheet,
              {
                height: escalatedPanelHeight,
                transform: [
                  {
                    translateY: Animated.add(
                      escalatedPanelTranslateY,
                      highlightedReportTranslateY,
                    ),
                  },
                ],
              },
            ]}
          >
            <EscalatedReportsPanel
              reports={escalatedReports}
              loading={loading}
              error={error}
              bottomInset={escalatedPanelBottomInset}
              collapsed={escalatedPanelCollapsed}
              onLocateReport={openEscalatedReport}
              onReviewReport={(report) =>
                router.push(`/official/${report.id}` as Href)
              }
              onRetry={() => void reload()}
              onToggleCollapsed={() =>
                settleEscalatedPanel(!escalatedPanelCollapsed)
              }
              dragHandlePanHandlers={escalatedPanelPanResponder.panHandlers}
            />
          </Animated.View>

          {highlightedReport ? (
            <HighlightedReportCallout
              report={highlightedReport}
              bottomOffset={officialNavMetrics.barHeight + insets.bottom + spacing.md}
              onClose={() => setHighlightedReportId(null)}
              onOpenDetails={openHighlightedReportDetails}
            />
          ) : null}

          <ReportMapDetailSheet
            visible={selectedReports.length > 0}
            reports={selectedReports}
            onClose={() => setSelectedReportIds([])}
          />
        </View>
      </ReportEngagementProvider>
    );
  }

  return (
    <ReportEngagementProvider reports={scopedMarkers}>
      <SafeAreaView style={officialStyles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={localStyles.header}>
          <MdrrmoHeader
            title="Map"
          />
        </View>
        <View style={localStyles.mapFill}>
          <InteractiveMap
            markers={scopedMarkers}
            facilities={facilityMarkers}
            evacuationCenters={centerMarkers}
            layerVisibility={layers}
            showLayerFilters
            collapsibleLayerFilters
            showReportStatusFilters
            showSearchBar
            compactLayerFilters
            searchBarTopInset={spacing.md}
            layerFiltersTopInset={error || focusError ? 120 : 76}
            onLayerVisibilityChange={handleLayerVisibilityChange}
            onReportSelection={handleMapReportSelection}
            onResourceSelection={(resource) => {
              setSelectedReportIds([]);
              setHighlightedReportId(null);
              setHighlightedResourceId(resource.id);
              setFocusTarget({
                resourceId: resource.id,
                latitude: resource.latitude,
                longitude: resource.longitude,
              });
            }}
            focusTarget={focusTarget}
            highlightedReportId={highlightedReportId}
            highlightedResourceId={highlightedResourceId}
          />
          {error || focusError ? (
            <View style={localStyles.banner} pointerEvents="none">
              <Text style={localStyles.bannerText}>{error || focusError}</Text>
            </View>
          ) : null}
        </View>

        {highlightedReport ? (
          <HighlightedReportCallout
            report={highlightedReport}
            bottomOffset={officialNavMetrics.barHeight + insets.bottom + spacing.md}
            onClose={() => setHighlightedReportId(null)}
            onOpenDetails={openHighlightedReportDetails}
          />
        ) : null}

        <ReportMapDetailSheet
          visible={selectedReports.length > 0}
          reports={selectedReports}
          onClose={() => setSelectedReportIds([])}
        />
      </SafeAreaView>
    </ReportEngagementProvider>
  );
}

const localStyles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  mapFill: {
    flex: 1,
  },
  banner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: spacing.md,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bannerText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.white,
    textAlign: 'center',
  },
});
