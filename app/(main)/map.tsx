// Map tab: report pins + active facilities/evac centers (read-only layers).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AppHeader from '../../components/navigation/AppHeader';
import InteractiveMap, {
  type MapLayerVisibility,
  type MapResourceMarker,
} from '../../components/map/InteractiveMap';
import ReportMapDetailSheet from '../../components/map/ReportMapDetailSheet';
import ResourceMapDetailSheet from '../../components/map/ResourceMapDetailSheet';
import { ReportEngagementProvider } from '../../components/report/ReportEngagementProvider';
import { tabStyles as styles } from '../../styles/screens/tab.styles';
import { type MapReportMarker } from '../../lib/reports';
import { useReports } from '../../hooks/useReports';
import { useResources } from '../../hooks/useResources';
import { useEvacuationCenters } from '../../hooks/useEvacuationCenters';
import {
  evacuationStatusLabel,
  facilityTypeLabel,
} from '../../lib/resources';
import { colors, fonts, fontSizes, spacing } from '../../styles/theme';

export default function MapScreen() {
  const router = useRouter();
  const { reportId } = useLocalSearchParams<{ reportId?: string | string[] }>();
  const { reports: markers, error } = useReports({ realtime: true });
  const { facilities } = useResources({ mode: 'resident' });
  const { centers } = useEvacuationCenters();

  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [selectedResource, setSelectedResource] =
    useState<MapResourceMarker | null>(null);
  const [focusTarget, setFocusTarget] = useState<{
    reportId: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [layers, setLayers] = useState<MapLayerVisibility>({
    reports: true,
    facilities: true,
    evacuationCenters: true,
  });
  const handledRouteReportIdRef = useRef<string | null>(null);
  const requestedReportId = Array.isArray(reportId) ? reportId[0] : reportId;

  useEffect(() => {
    if (!requestedReportId) {
      handledRouteReportIdRef.current = null;
      return;
    }

    if (handledRouteReportIdRef.current === requestedReportId) {
      return;
    }

    const requestedReport = markers.find(
      (marker) => marker.id === requestedReportId,
    );
    if (!requestedReport) return;

    handledRouteReportIdRef.current = requestedReportId;
    setSelectedResource(null);
    setSelectedReportIds([requestedReport.id]);
    setFocusTarget({
      reportId: requestedReport.id,
      latitude: requestedReport.latitude,
      longitude: requestedReport.longitude,
    });
    // Clear the route value so opening the same home card later works again.
    router.setParams({ reportId: undefined });
  }, [markers, requestedReportId, router]);

  const facilityMarkers = useMemo<MapResourceMarker[]>(
    () =>
      facilities
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
    [facilities],
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
    const byId = new Map(markers.map((marker) => [marker.id, marker]));
    return selectedReportIds
      .map((id) => byId.get(id))
      .filter((marker): marker is MapReportMarker => marker != null);
  }, [markers, selectedReportIds]);

  return (
    <ReportEngagementProvider reports={markers}>
      <View style={styles.container}>
        <StatusBar style="light" />
        <AppHeader searchPlaceholder="Search facilities and reports" />
        <View style={styles.mapFill}>
          <InteractiveMap
            markers={markers}
            facilities={facilityMarkers}
            evacuationCenters={centerMarkers}
            layerVisibility={layers}
            showLayerFilters
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
            <View style={localStyles.banner} pointerEvents="none">
              <Text style={localStyles.bannerText}>{error}</Text>
            </View>
          ) : null}
        </View>

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

const localStyles = StyleSheet.create({
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
