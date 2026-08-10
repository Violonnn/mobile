// Home-map preview for the selected nearby report. It uses the same Leaflet
// component as the Map tab so marker behavior stays consistent across screens.
import React from 'react';
import { View } from 'react-native';
import { homeStyles as styles } from '../../styles/screens/home.styles';
import InteractiveMap, { type MapFocusTarget } from '../map/InteractiveMap';
import type { MapReportMarker } from '../../lib/reports';

export default function HomeMapPreview({
  report,
  focusTarget,
  onOpenReport,
}: {
  report: MapReportMarker | null;
  focusTarget: MapFocusTarget | null;
  onOpenReport: (reportId: string) => void;
}) {
  // Keep the nearby report's details action visible, even before its card is tapped.
  const activeFocusTarget =
    focusTarget ??
    (report
      ? {
          reportId: report.id,
          latitude: report.latitude,
          longitude: report.longitude,
        }
      : null);

  return (
    <View style={styles.mapCard}>
      <InteractiveMap
        markers={report ? [report] : []}
        focusTarget={activeFocusTarget}
        showReportDetailsPopup={report != null}
        onReportDetailsRequest={onOpenReport}
        showZoomControls={false}
      />
    </View>
  );
}
