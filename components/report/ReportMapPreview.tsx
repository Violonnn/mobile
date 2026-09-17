import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

import type { GpsPosition } from '../../lib/location';
import {
  reportColors,
  reportStyles as styles,
} from '../../styles/screens/report.styles';

type Props = {
  position: Pick<GpsPosition, 'latitude' | 'longitude'>;
  compact?: boolean;
};

function buildPreviewHtml(
  latitude: number,
  longitude: number,
  zoom: number,
): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; margin: 0; background: #EAF3F6; }
      .leaflet-control-container { display: none; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      function reportMapLoadError() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage('map-load-error');
        }
      }
    </script>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onerror="reportMapLoadError()"></script>
    <script>
      if (typeof L === 'undefined') {
        reportMapLoadError();
      } else {
      const map = L.map('map', {
        center: [${latitude}, ${longitude}],
        zoom: ${zoom},
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false,
        keyboard: false
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      function stabilizeMapSize() {
        map.invalidateSize(false);
        map.setView([${latitude}, ${longitude}], ${zoom}, { animate: false });
      }

      map.whenReady(function() {
        requestAnimationFrame(stabilizeMapSize);
        setTimeout(stabilizeMapSize, 350);
      });
      window.addEventListener('resize', stabilizeMapSize);
      }
    </script>
  </body>
</html>`;
}

/** Read-only map used by both the location and review steps. */
export default function ReportMapPreview({ position, compact = false }: Props) {
  const mapKey = `${position.latitude}:${position.longitude}:${compact ? 'compact' : 'full'}`;
  const [failedMapKey, setFailedMapKey] = useState<string | null>(null);
  const html = useMemo(
    () =>
      buildPreviewHtml(
        position.latitude,
        position.longitude,
        compact ? 15 : 16,
      ),
    [compact, position.latitude, position.longitude],
  );

  if (failedMapKey === mapKey) {
    return (
      <View style={[styles.mapPreviewFallback, compact && styles.mapPreviewCompact]}>
        <Ionicons name="map-outline" size={compact ? 22 : 32} color={reportColors.primary} />
        {!compact ? (
          <Text style={styles.mapPreviewFallbackText}>Map preview unavailable</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={[styles.mapPreview, compact && styles.mapPreviewCompact]}
      pointerEvents="none"
    >
      <WebView
        key={mapKey}
        style={styles.mapPreviewWebView}
        originWhitelist={['*']}
        source={{ html }}
        scrollEnabled={false}
        onMessage={(event) => {
          if (event.nativeEvent.data === 'map-load-error') {
            setFailedMapKey(mapKey);
          }
        }}
        onError={() => setFailedMapKey(mapKey)}
        onHttpError={() => setFailedMapKey(mapKey)}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.mapPreviewLoading}>
            <ActivityIndicator color={reportColors.primary} />
          </View>
        )}
      />
      <View
        style={[
          styles.mapCenterMarker,
          compact && styles.mapCenterMarkerCompact,
        ]}
      >
        <Ionicons
          name="location-sharp"
          size={compact ? 38 : 56}
          color={reportColors.white}
          style={styles.mapCenterMarkerOutline}
        />
        <Ionicons
          name="location-sharp"
          size={compact ? 32 : 48}
          color={reportColors.primary}
        />
      </View>
    </View>
  );
}
