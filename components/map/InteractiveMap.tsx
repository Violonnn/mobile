// Interactive Leaflet map in a WebView (OSM tiles, Minglanilla).
// Soft red report pins with clustering; taps post back to React Native.
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSizes, spacing } from '../../styles/theme';
import type { MapReportMarker } from '../../lib/reports';

const CENTER = { lat: 10.2447, lng: 123.7967 };
const ZOOM = 14;

type Props = {
  markers?: MapReportMarker[];
  onReportSelection?: (reportIds: string[]) => void;
};

function buildMapHtml(): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; background: #F0F4FF; }
      .leaflet-control-attribution { display: none; }

      .report-pin-wrap {
        background: transparent;
        border: none;
      }

      .report-pin {
        width: 30px;
        height: 30px;
        position: relative;
        transform: translate(-50%, -100%);
      }

      .report-pin-bubble {
        width: 26px;
        height: 26px;
        margin: 0 auto;
        border-radius: 50% 50% 50% 8px;
        transform: rotate(-45deg);
        background: linear-gradient(145deg, #FF8A8A 0%, #FF5C5C 55%, #F04444 100%);
        border: 2.5px solid #FFFFFF;
        box-shadow: 0 4px 14px rgba(255, 92, 92, 0.38);
      }

      .report-pin-dot {
        position: absolute;
        top: 9px;
        left: 50%;
        width: 7px;
        height: 7px;
        margin-left: -3.5px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.92);
      }

      .report-pin-tail {
        width: 0;
        height: 0;
        margin: -3px auto 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 7px solid #F04444;
        filter: drop-shadow(0 2px 3px rgba(255, 92, 92, 0.25));
      }

      .marker-cluster-report {
        background: rgba(255, 92, 92, 0.18);
        border: 2px solid rgba(255, 255, 255, 0.95);
        border-radius: 50%;
        box-shadow: 0 4px 14px rgba(255, 92, 92, 0.28);
      }

      .marker-cluster-report div {
        width: 34px;
        height: 34px;
        margin-left: 2px;
        margin-top: 2px;
        background: linear-gradient(145deg, #FF8A8A, #F04444);
        color: #FFFFFF;
        font: 700 13px/34px system-ui, sans-serif;
        border-radius: 50%;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
    <script>
      var map = L.map('map', {
        center: [${CENTER.lat}, ${CENTER.lng}],
        zoom: ${ZOOM},
        zoomControl: true,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      var reportPinIcon = L.divIcon({
        className: 'report-pin-wrap',
        html:
          '<div class="report-pin">' +
            '<div class="report-pin-bubble"></div>' +
            '<div class="report-pin-dot"></div>' +
            '<div class="report-pin-tail"></div>' +
          '</div>',
        iconSize: [30, 38],
        iconAnchor: [15, 38],
        popupAnchor: [0, -34]
      });

      // Animations stay off: leaflet.markercluster throws internally when
      // layers are cleared/re-added while a zoom animation is running, which
      // silently aborts marker loading on iOS WKWebView (only 1 pin shows).
      var clusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: false,
        spiderfyOnMaxZoom: false,
        animate: false,
        animateAddingMarkers: false,
        maxClusterRadius: 52,
        iconCreateFunction: function(cluster) {
          var count = cluster.getChildCount();
          return L.divIcon({
            html: '<div><span>' + count + '</span></div>',
            className: 'marker-cluster-report',
            iconSize: L.point(38, 38)
          });
        }
      }).addTo(map);

      function postSelection(reportIds) {
        if (!window.ReactNativeWebView || !reportIds || !reportIds.length) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'reportSelection',
          reportIds: reportIds
        }));
      }

      function sortByCreatedAtDesc(markers) {
        return markers.slice().sort(function(a, b) {
          var aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
          var bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
          return bTime - aTime;
        });
      }

      clusterGroup.on('clusterclick', function(event) {
        var childMarkers = event.layer.getAllChildMarkers();
        var sorted = sortByCreatedAtDesc(childMarkers.map(function(marker) {
          return marker.options.reportMeta || { id: marker.options.reportId, createdAt: '' };
        }));
        postSelection(sorted.map(function(item) { return item.id; }));
      });

      // Fit the view to the pins only on the first load — refitting on every
      // refresh would yank the viewport away from where the user panned, and
      // the animated refit is what raced with clearLayers on iOS.
      var initialViewFitted = false;

      window.setReportMarkers = function(markers) {
        clusterGroup.clearLayers();
        if (!markers || !markers.length) return;

        var bounds = [];
        markers.forEach(function(m) {
          if (typeof m.latitude !== 'number' || typeof m.longitude !== 'number') return;

          var marker = L.marker([m.latitude, m.longitude], {
            icon: reportPinIcon,
            reportId: m.id,
            reportMeta: { id: m.id, createdAt: m.created_at || '' }
          });

          marker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            postSelection([m.id]);
          });

          clusterGroup.addLayer(marker);
          bounds.push([m.latitude, m.longitude]);
        });

        if (initialViewFitted || !bounds.length) return;
        initialViewFitted = true;

        if (bounds.length === 1) {
          map.setView(bounds[0], 15, { animate: false });
        } else {
          map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16, animate: false });
        }
      };

      // On iOS, React Native can inject markers before this script has run
      // (onLoadEnd fires for the intermediate blank page). Apply anything
      // that was buffered while we were still loading.
      if (window.__pendingReportMarkers) {
        window.setReportMarkers(window.__pendingReportMarkers);
        window.__pendingReportMarkers = null;
      }
    </script>
  </body>
</html>`;
}

function markersToInjectScript(markers: MapReportMarker[]): string {
  const payload = markers.map((m) => ({
    id: m.id,
    latitude: m.latitude,
    longitude: m.longitude,
    created_at: m.created_at,
  }));
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  // If the page script hasn't finished loading yet (an iOS timing quirk),
  // buffer the payload instead of dropping it — the page applies it on load.
  return `(function() {
    var data = ${json};
    if (window.setReportMarkers) {
      window.setReportMarkers(data);
    } else {
      window.__pendingReportMarkers = data;
    }
  })(); true;`;
}

export default function InteractiveMap({
  markers = [],
  onReportSelection,
}: Props) {
  const webRef = useRef<WebView>(null);
  const html = useMemo(() => buildMapHtml(), []);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!readyRef.current || !webRef.current) return;
    webRef.current.injectJavaScript(markersToInjectScript(markers));
  }, [markers]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (!onReportSelection) return;
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string;
          reportIds?: string[];
        };
        if (data.type === 'reportSelection' && Array.isArray(data.reportIds)) {
          onReportSelection(data.reportIds.filter(Boolean));
        }
      } catch {
        // Ignore malformed WebView messages.
      }
    },
    [onReportSelection],
  );

  return (
    <View style={mapStyles.container}>
      <WebView
        ref={webRef}
        style={mapStyles.webview}
        originWhitelist={['*']}
        source={{ html }}
        androidLayerType="hardware"
        onMessage={handleMessage}
        onLoadEnd={() => {
          readyRef.current = true;
          webRef.current?.injectJavaScript(markersToInjectScript(markers));
        }}
        renderError={() => (
          <View style={mapStyles.fallback}>
            <Ionicons name="map-outline" size={28} color={colors.textMuted} />
            <Text style={mapStyles.fallbackText}>Map unavailable</Text>
          </View>
        )}
        startInLoadingState={false}
      />
    </View>
  );
}

const mapStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  fallbackText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
});
