// Shared Leaflet-in-WebView location picker for reports and operational resources.
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

export type MapPickerCoordinate = {
  latitude: number;
  longitude: number;
};

/** Same broad municipal bounds currently validated by the report backend. */
const LAT_MIN = 10.15;
const LAT_MAX = 10.35;
const LNG_MIN = 123.7;
const LNG_MAX = 123.9;
const ZOOM = 16;

export function isValidMapPickerCoordinate(
  latitude: number,
  longitude: number,
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= LAT_MIN &&
    latitude <= LAT_MAX &&
    longitude >= LNG_MIN &&
    longitude <= LNG_MAX
  );
}

function buildPickerHtml(latitude: number, longitude: number): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; background: #F0F4FF; }
      /* Let Leaflet receive one-finger pans and two-finger pinch gestures. */
      #map { touch-action: none; }
      .leaflet-control-attribution { font: 10px/14px system-ui, sans-serif; }
      .resource-pin-wrap { background: transparent; border: none; }
      .resource-pin {
        width: 30px; height: 30px; position: relative; transform: translate(-50%, -100%);
      }
      .resource-pin-bubble {
        width: 26px; height: 26px; margin: 0 auto; border-radius: 50% 50% 50% 8px;
        transform: rotate(-45deg); background: linear-gradient(145deg, #AAC0DC 0%, #7094BF 55%, #547FAF 100%);
        border: 2.5px solid #FFFFFF; box-shadow: 0 4px 14px rgba(84, 127, 175, 0.38);
      }
      .resource-pin-dot {
        position: absolute; top: 9px; left: 50%; width: 7px; height: 7px; margin-left: -3.5px;
        border-radius: 50%; background: rgba(255, 255, 255, 0.92);
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var map = L.map('map', {
        center: [${latitude}, ${longitude}],
        zoom: ${ZOOM},
        zoomControl: true,
        attributionControl: true,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        scrollWheelZoom: true,
        keyboard: true
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      var icon = L.divIcon({
        className: 'resource-pin-wrap',
        html: '<div class="resource-pin"><div class="resource-pin-bubble"></div><div class="resource-pin-dot"></div></div>',
        iconSize: [30, 38], iconAnchor: [15, 38]
      });
      var pin = L.marker([${latitude}, ${longitude}], { icon: icon, draggable: true }).addTo(map);
      function postPin(lat, lng) {
        if (!window.ReactNativeWebView) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pinMoved', latitude: lat, longitude: lng }));
      }
      pin.on('dragend', function() { var next = pin.getLatLng(); postPin(next.lat, next.lng); });
      map.on('click', function(event) { pin.setLatLng(event.latlng); postPin(event.latlng.lat, event.latlng.lng); });
      postPin(${latitude}, ${longitude});
    </script>
  </body>
</html>`;
}

type LocationPickerModalProps = {
  visible: boolean;
  initialCoordinate: MapPickerCoordinate;
  title: string;
  hint: string;
  confirmLabel?: string;
  onConfirm: (coordinate: MapPickerCoordinate) => void;
  onClose: () => void;
};

export default function LocationPickerModal({
  visible,
  initialCoordinate,
  title,
  hint,
  confirmLabel = 'Use this pin',
  onConfirm,
  onClose,
}: LocationPickerModalProps) {
  const [draft, setDraft] = useState<MapPickerCoordinate>(initialCoordinate);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const coordinateResetKey = visible
    ? `${initialCoordinate.latitude}:${initialCoordinate.longitude}`
    : 'hidden';
  const [previousCoordinateResetKey, setPreviousCoordinateResetKey] =
    useState(coordinateResetKey);

  if (coordinateResetKey !== previousCoordinateResetKey) {
    setPreviousCoordinateResetKey(coordinateResetKey);
    if (visible) {
      setDraft(initialCoordinate);
      setMapError(null);
    }
  }

  const html = useMemo(
    () => buildPickerHtml(initialCoordinate.latitude, initialCoordinate.longitude),
    [initialCoordinate.latitude, initialCoordinate.longitude],
  );

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        latitude?: number;
        longitude?: number;
      };
      if (data.type !== 'pinMoved') return;

      const latitude = Number(data.latitude);
      const longitude = Number(data.longitude);
      if (!isValidMapPickerCoordinate(latitude, longitude)) return;

      setDraft({ latitude, longitude });
      setMapError(null);
    } catch {
      // Ignore malformed messages from the map WebView.
    }
  }, []);

  function retryMap() {
    setMapError(null);
    setRetryKey((current) => current + 1);
  }

  function confirmLocation() {
    if (!isValidMapPickerCoordinate(draft.latitude, draft.longitude)) {
      setMapError('Choose a valid location within Minglanilla before continuing.');
      return;
    }
    onConfirm(draft);
  }

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={localStyles.overlay}>
        <Pressable style={localStyles.backdrop} onPress={onClose} />
        <View style={localStyles.card}>
          <View style={localStyles.header}>
            <View style={localStyles.headerTitleRow}>
              <Ionicons name="map" size={20} color={colors.text} />
              <Text style={localStyles.title}>{title}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close location picker"
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={localStyles.hint}>{hint}</Text>

          <View style={localStyles.mapFrame}>
            {mapError ? (
              <View style={localStyles.fallback}>
                <Ionicons name="map-outline" size={30} color={colors.textMuted} />
                <Text style={localStyles.fallbackText}>{mapError}</Text>
                <TouchableOpacity style={localStyles.retryButton} onPress={retryMap}>
                  <Text style={localStyles.retryButtonText}>Retry map</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <WebView
                key={retryKey}
                style={localStyles.webview}
                originWhitelist={['*']}
                source={{ html }}
                androidLayerType="hardware"
                nestedScrollEnabled={false}
                onMessage={handleMessage}
                onError={() => setMapError('The map could not load. Check your connection and try again.')}
                onHttpError={() => setMapError('The map could not load. Check your connection and try again.')}
                renderLoading={() => <View style={localStyles.loading}><ActivityIndicator color={colors.themeSoft} /></View>}
                startInLoadingState
              />
            )}
          </View>

          <View style={localStyles.footer}>
            <TouchableOpacity style={localStyles.secondaryButton} onPress={onClose}>
              <Text style={localStyles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[localStyles.primaryButton, mapError && localStyles.buttonDisabled]}
              onPress={confirmLocation}
              disabled={!!mapError}
            >
              <Text style={localStyles.primaryButtonText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: spacing.md },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17, 24, 39, 0.45)' },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', borderRadius: radius.xl, backgroundColor: colors.white, padding: spacing.lg, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  headerTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: 20 },
  mapFrame: { height: 290, overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  fallbackText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  retryButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  retryButtonText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.text },
  footer: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md },
  secondaryButtonText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.text },
  primaryButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.text, paddingVertical: spacing.md },
  primaryButtonText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.white },
  buttonDisabled: { opacity: 0.5 },
});
