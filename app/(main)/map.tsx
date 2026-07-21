// Map tab: loads report pins from reports_map and keeps them live via Realtime.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppHeader from '../../components/navigation/AppHeader';
import InteractiveMap from '../../components/map/InteractiveMap';
import ReportMapDetailSheet from '../../components/map/ReportMapDetailSheet';
import { ReportEngagementProvider } from '../../components/report/ReportEngagementProvider';
import { tabStyles as styles } from '../../styles/screens/tab.styles';
import { type MapReportMarker } from '../../lib/reports';
import { useReports } from '../../hooks/useReports';
import { colors, fonts, fontSizes, spacing } from '../../styles/theme';

export default function MapScreen() {
  // Realtime keeps the map markers live as reports are created/updated.
  const { reports: markers, error } = useReports({ realtime: true });
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);

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
        {/* Light status bar icons — matches the white text on the themed header. */}
        <StatusBar style="light" />
        {/* Map header is search-only (no greeting/title row). */}
        <AppHeader searchPlaceholder="Search facilities and reports" />
        <View style={styles.mapFill}>
          <InteractiveMap
            markers={markers}
            onReportSelection={setSelectedReportIds}
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
