// components/home/HomeMapPreview.tsx
// Visual-only Leaflet map preview. Expo can't run Leaflet natively, so we embed
// it in a WebView with OSM tiles centered on Minglanilla, Cebu. Non-interactive
// for now — no markers, no navigation, no data.
import React from 'react';
import { View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { homeStyles as styles } from '../../styles/screens/home.styles';
import { colors } from '../../styles/theme';

// Minglanilla, Cebu
const CENTER = { lat: 10.2447, lng: 123.7967 };
const ZOOM = 13;

const MAP_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; background: #F0F4FF; }
      .leaflet-control-attribution, .leaflet-control-zoom { display: none; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var map = L.map('map', {
        center: [${CENTER.lat}, ${CENTER.lng}],
        zoom: ${ZOOM},
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false,
        boxZoom: false,
        keyboard: false,
        tap: false
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);
    </script>
  </body>
</html>`;

export default function HomeMapPreview() {
  return (
    <View style={styles.mapCard} pointerEvents="none">
      <WebView
        style={styles.mapWebview}
        originWhitelist={['*']}
        source={{ html: MAP_HTML }}
        scrollEnabled={false}
        androidLayerType="hardware"
        renderError={() => (
          <View style={styles.mapFallback}>
            <Ionicons name="map-outline" size={28} color={colors.textMuted} />
            <Text style={styles.mapFallbackText}>Map preview unavailable</Text>
          </View>
        )}
        startInLoadingState={false}
      />
    </View>
  );
}
