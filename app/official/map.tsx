// app/official/map.tsx
// Official map: report clusters + facility/evac layers with legend filters.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import InteractiveMap, {
  type MapLayerVisibility,
  type MapResourceMarker,
  type MapFocusTarget,
} from '../../components/map/InteractiveMap';
import ReportMapDetailSheet from '../../components/map/ReportMapDetailSheet';
import ResourceMapDetailSheet from '../../components/map/ResourceMapDetailSheet';
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
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { isValidReportId } from '../../lib/officialReports';

export default function OfficialMapScreen() {
  const { reportId } = useLocalSearchParams<{ reportId?: string | string[] }>();
  const { officialKind, scope } = useOfficialPortal();
  const barangayFilter =
    officialKind === 'BDRRMO' ? scope?.barangay_id ?? null : null;
  const { reports: markers, error, loading } = useReports({
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
  const [selectedResource, setSelectedResource] =
    useState<MapResourceMarker | null>(null);
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);
  const [focusError, setFocusError] = useState<string | null>(null);
  const [layers, setLayers] = useState<MapLayerVisibility>({
    reports: true,
    facilities: true,
    evacuationCenters: true,
  });

  const scopedMarkers = useMemo(() => {
    if (officialKind !== 'BDRRMO' || !scope?.barangay_id) {
      return markers;
    }
    return markers.filter(
      (marker) => marker.barangay_id === scope.barangay_id,
    );
  }, [markers, officialKind, scope?.barangay_id]);

  const facilityMarkers = useMemo<MapResourceMarker[]>(
    () =>
      facilities
        .filter((f) => f.isActive)
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
    const byId = new Map(scopedMarkers.map((marker) => [marker.id, marker]));
    return selectedReportIds
      .map((id) => byId.get(id))
      .filter((marker): marker is MapReportMarker => marker != null);
  }, [scopedMarkers, selectedReportIds]);

  useEffect(() => {
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
    setSelectedResource(null);
    setSelectedReportIds([targetReport.id]);
    setFocusTarget({
      reportId: targetReport.id,
      latitude: targetReport.latitude,
      longitude: targetReport.longitude,
    });
  }, [loading, reportId, scopedMarkers]);

  return (
    <ReportEngagementProvider reports={scopedMarkers}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={localStyles.header}>
          <MdrrmoHeader
            title="Map"
            showDefaultControls={officialKind === 'Mayor'}
          />
        </View>
        <View style={localStyles.mapFill}>
          <InteractiveMap
            markers={scopedMarkers}
            facilities={facilityMarkers}
            evacuationCenters={centerMarkers}
            layerVisibility={layers}
            showLayerFilters
            onLayerVisibilityChange={setLayers}
            onReportSelection={(ids) => {
              setSelectedResource(null);
              setSelectedReportIds(ids);
            }}
            onResourceSelection={(resource) => {
              setSelectedReportIds([]);
              setSelectedResource(resource);
            }}
            focusTarget={focusTarget}
          />
          {error || focusError ? (
            <View style={localStyles.banner} pointerEvents="none">
              <Text style={localStyles.bannerText}>{error || focusError}</Text>
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
      </SafeAreaView>
    </ReportEngagementProvider>
  );
}

const localStyles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
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
