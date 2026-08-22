// Home-map preview for nearby reports. It uses the same Leaflet component as
// the Map tab so the visible markers always come from the shared report query.
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeStyles as styles } from '../../styles/screens/home.styles';
import { colors } from '../../styles/theme';
import InteractiveMap from '../map/InteractiveMap';
import type { MapReportMarker } from '../../lib/reports';

export default function HomeMapPreview({
  reports,
  focusedReport,
  onFocusReport,
  onOpenReport,
}: {
  reports: MapReportMarker[];
  focusedReport: MapReportMarker | null;
  onFocusReport: (reportId: string) => void;
  onOpenReport: (reportId: string) => void;
}) {
  const focusTarget = focusedReport
    ? {
        reportId: focusedReport.id,
        latitude: focusedReport.latitude,
        longitude: focusedReport.longitude,
      }
    : null;

  return (
    <View style={styles.nearbyMap}>
      <InteractiveMap
        markers={reports}
        focusTarget={focusTarget}
        showReportDetailsPopup={false}
        onReportSelection={(reportIds) => {
          const reportId = reportIds[0];
          if (reportId) onFocusReport(reportId);
        }}
        showZoomControls={false}
      />
      {focusedReport ? (
        <TouchableOpacity
          style={styles.nearbyMapDetailsButton}
          activeOpacity={0.84}
          onPress={() => onOpenReport(focusedReport.id)}
          accessibilityRole="button"
          accessibilityLabel={`See details for ${focusedReport.title || 'selected report'}`}
        >
          <View style={styles.nearbyMapDetailsIcon}>
            <Ionicons name="location" size={15} color={colors.white} />
          </View>
          <Text style={styles.nearbyMapDetailsText} numberOfLines={1}>
            See details
          </Text>
          <View style={styles.nearbyMapDetailsArrow}>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
