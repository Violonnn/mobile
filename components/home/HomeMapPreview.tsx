// Home-map preview for nearby reports. It uses the same Leaflet component as
// the Map tab so the visible markers always come from the shared report query.
import React from 'react';
import { View } from 'react-native';
import { homeStyles as styles } from '../../styles/screens/home.styles';
import InteractiveMap from '../map/InteractiveMap';
import type { MapReportMarker } from '../../lib/reports';

export default function HomeMapPreview({
  reports,
  focusedReport,
  onOpenReport,
}: {
  reports: MapReportMarker[];
  focusedReport: MapReportMarker | null;
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
        pulseReportClusters
        onReportSelection={(reportIds) => {
          const reportId = reportIds[0];
          if (reportId) onOpenReport(reportId);
        }}
        showZoomControls={false}
      />
    </View>
  );
}
