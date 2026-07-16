// components/map/InteractiveMap.tsx
// Interactive Leaflet map embedded in a WebView (OSM tiles, centered on
// Minglanilla, Cebu). Pan/zoom work, but there's no data/markers yet.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSizes, spacing } from '../../styles/theme';

// Minglanilla, Cebu
const CENTER = { lat: 10.2447, lng: 123.7967 };
const ZOOM = 14;

const MAP_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; background: #F0F4FF; }
      .leaflet-control-attribution { display: none; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
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
    </script>
  </body>
</html>`;

export default function InteractiveMap() {
  return (
    <View style={mapStyles.container}>
      <WebView
        style={mapStyles.webview}
        originWhitelist={['*']}
        source={{ html: MAP_HTML }}
        androidLayerType="hardware"
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
