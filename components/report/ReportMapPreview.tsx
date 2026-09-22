import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { GpsPosition } from '../../lib/location';
import {
  reportColors,
  reportStyles as styles,
} from '../../styles/screens/report.styles';

type Props = {
  position: Pick<GpsPosition, 'latitude' | 'longitude'>;
  compact?: boolean;
  adjusting?: boolean;
  referencePosition?: Pick<GpsPosition, 'latitude' | 'longitude'>;
  maximumDistanceMeters?: number;
  onPositionChange?: (
    position: Pick<GpsPosition, 'latitude' | 'longitude'>,
  ) => void;
};

function buildPreviewHtml(
  latitude: number,
  longitude: number,
  zoom: number,
  referenceLatitude: number,
  referenceLongitude: number,
  maximumDistanceMeters: number,
): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; margin: 0; background: #EAF3F6; }
      #map { touch-action: none; }
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
      var map = L.map('map', {
        center: [${latitude}, ${longitude}],
        zoom: ${zoom},
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false,
        keyboard: false,
        fadeAnimation: false,
        zoomAnimation: false,
        markerZoomAnimation: false
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        keepBuffer: 4,
        updateWhenIdle: false
      }).addTo(map);

      var adjusting = false;
      var adjustmentBoundary = null;
      var referenceCoordinate = L.latLng(${referenceLatitude}, ${referenceLongitude});
      var maximumDistance = ${maximumDistanceMeters};
      var lastValidCoordinate = L.latLng(${latitude}, ${longitude});
      var restoringLastValidCoordinate = false;

      function distanceMeters(firstCoordinate, secondCoordinate) {
        var earthRadiusMeters = 6371000;
        var latitudeDelta = (secondCoordinate.lat - firstCoordinate.lat) * Math.PI / 180;
        var longitudeDelta = (secondCoordinate.lng - firstCoordinate.lng) * Math.PI / 180;
        var firstLatitudeRadians = firstCoordinate.lat * Math.PI / 180;
        var secondLatitudeRadians = secondCoordinate.lat * Math.PI / 180;
        var haversine = Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
          Math.cos(firstLatitudeRadians) * Math.cos(secondLatitudeRadians) *
          Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);
        return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
      }

      function postPosition(type, coordinate) {
        if (!window.ReactNativeWebView) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: type,
          latitude: coordinate.lat,
          longitude: coordinate.lng
        }));
      }

      function setMapInteractionEnabled(enabled) {
        if (enabled) {
          map.dragging.enable();
          return;
        }
        map.dragging.disable();
      }

      window.setReportMapAdjustmentMode = function(configuration) {
        adjusting = Boolean(configuration.enabled);
        referenceCoordinate = L.latLng(
          configuration.referenceLatitude,
          configuration.referenceLongitude
        );
        maximumDistance = configuration.maximumDistanceMeters;
        lastValidCoordinate = L.latLng(configuration.latitude, configuration.longitude);

        if (adjustmentBoundary) {
          map.removeLayer(adjustmentBoundary);
          adjustmentBoundary = null;
        }

        if (adjusting) {
          adjustmentBoundary = L.circle(referenceCoordinate, {
            radius: maximumDistance,
            color: '#0F2044',
            weight: 3,
            opacity: 0.9,
            dashArray: '7 6',
            fill: false,
            interactive: false
          }).addTo(map);
        }

        setMapInteractionEnabled(adjusting);
        map.invalidateSize(false);
        map.setView(lastValidCoordinate, map.getZoom(), { animate: false });
      };

      map.on('moveend', function() {
        if (!adjusting) return;
        if (restoringLastValidCoordinate) {
          restoringLastValidCoordinate = false;
          return;
        }

        var nextCoordinate = map.getCenter();
        if (distanceMeters(referenceCoordinate, nextCoordinate) > maximumDistance) {
          restoringLastValidCoordinate = true;
          map.panTo(lastValidCoordinate, { animate: false });
          postPosition('pinRejected', lastValidCoordinate);
          return;
        }

        lastValidCoordinate = nextCoordinate;
        postPosition('pinMoved', lastValidCoordinate);
      });

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

/** Map preview that can enter bounded adjustment mode without being remounted. */
export default function ReportMapPreview({
  position,
  compact = false,
  adjusting = false,
  referencePosition = position,
  maximumDistanceMeters = 150,
  onPositionChange,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const [initialMapConfiguration] = useState(() => ({
      latitude: position.latitude,
      longitude: position.longitude,
      referenceLatitude: referencePosition.latitude,
      referenceLongitude: referencePosition.longitude,
      maximumDistanceMeters,
    }));
  const [mapFailed, setMapFailed] = useState(false);
  const html = useMemo(
    () =>
      buildPreviewHtml(
        initialMapConfiguration.latitude,
        initialMapConfiguration.longitude,
        compact ? 15 : 16,
        initialMapConfiguration.referenceLatitude,
        initialMapConfiguration.referenceLongitude,
        initialMapConfiguration.maximumDistanceMeters,
      ),
    // Keep one map document mounted while the resident adjusts and confirms.
    // Position changes are sent through setReportMapAdjustmentMode below.
    [compact, initialMapConfiguration],
  );
  const source = useMemo(() => ({ html }), [html]);

  const syncAdjustmentMode = useCallback(() => {
    const configuration = JSON.stringify({
      enabled: adjusting,
      latitude: position.latitude,
      longitude: position.longitude,
      referenceLatitude: referencePosition.latitude,
      referenceLongitude: referencePosition.longitude,
      maximumDistanceMeters,
    });
    webViewRef.current?.injectJavaScript(`
      if (window.setReportMapAdjustmentMode) {
        window.setReportMapAdjustmentMode(${configuration});
      }
      true;
    `);
  }, [
    adjusting,
    maximumDistanceMeters,
    position.latitude,
    position.longitude,
    referencePosition.latitude,
    referencePosition.longitude,
  ]);

  useEffect(() => {
    syncAdjustmentMode();
  }, [syncAdjustmentMode]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (event.nativeEvent.data === 'map-load-error') {
        setMapFailed(true);
        return;
      }

      try {
        const message = JSON.parse(event.nativeEvent.data) as {
          type?: string;
          latitude?: number;
          longitude?: number;
        };
        if (message.type !== 'pinMoved' && message.type !== 'pinRejected') return;

        const latitude = Number(message.latitude);
        const longitude = Number(message.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        onPositionChange?.({ latitude, longitude });
      } catch {
        // Ignore malformed messages from the embedded map.
      }
    },
    [onPositionChange],
  );

  if (mapFailed) {
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
      pointerEvents={adjusting ? 'auto' : 'none'}
    >
      <WebView
        ref={webViewRef}
        style={styles.mapPreviewWebView}
        originWhitelist={['*']}
        source={source}
        scrollEnabled={false}
        nestedScrollEnabled
        overScrollMode="never"
        onMessage={handleMessage}
        // Tile requests can report their own HTTP errors. One missing tile must
        // not replace the whole otherwise usable Leaflet map with a gray fallback.
        onError={() => setMapFailed(true)}
        onLoadEnd={syncAdjustmentMode}
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
        pointerEvents="none"
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
