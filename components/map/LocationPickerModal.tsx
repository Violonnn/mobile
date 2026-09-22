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
import { distanceBetweenCoordinates } from '../../lib/reportLocation';
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

function buildPickerHtml(
  latitude: number,
  longitude: number,
  referenceCoordinate?: MapPickerCoordinate,
  maximumDistanceMeters?: number,
): string {
  const allowedAreaScript =
    referenceCoordinate && maximumDistanceMeters
      ? `
      L.circle([${referenceCoordinate.latitude}, ${referenceCoordinate.longitude}], {
        radius: ${maximumDistanceMeters},
        color: '#0F2044',
        weight: 2,
        fillColor: '#AAC0DC',
        fillOpacity: 0.16,
        interactive: false
      }).addTo(map);
      L.circleMarker([${referenceCoordinate.latitude}, ${referenceCoordinate.longitude}], {
        radius: 5,
        color: '#FFFFFF',
        weight: 2,
        fillColor: '#0F2044',
        fillOpacity: 1,
        interactive: false
      }).addTo(map);`
      : '';

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
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      function reportMapLoadError() {
        if (!window.ReactNativeWebView) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapError' }));
      }
    </script>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onerror="reportMapLoadError()"></script>
    <script>
      if (typeof L === 'undefined') {
        reportMapLoadError();
      } else {
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
      ${allowedAreaScript}
      var referenceLatitude = ${referenceCoordinate?.latitude ?? 'null'};
      var referenceLongitude = ${referenceCoordinate?.longitude ?? 'null'};
      var maximumDistance = ${maximumDistanceMeters ?? 'null'};
      var lastValidCoordinate = L.latLng(${latitude}, ${longitude});
      var restoringLastValidCoordinate = false;

      function distanceMeters(firstLat, firstLng, secondLat, secondLng) {
        var earthRadiusMeters = 6371000;
        var latitudeDelta = (secondLat - firstLat) * Math.PI / 180;
        var longitudeDelta = (secondLng - firstLng) * Math.PI / 180;
        var firstLatitudeRadians = firstLat * Math.PI / 180;
        var secondLatitudeRadians = secondLat * Math.PI / 180;
        var haversine = Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
          Math.cos(firstLatitudeRadians) * Math.cos(secondLatitudeRadians) *
          Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);
        return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
      }

      function postPin(type, lat, lng) {
        if (!window.ReactNativeWebView) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, latitude: lat, longitude: lng }));
      }

      function useCoordinate(nextCoordinate) {
        var isOutsideAllowedArea = referenceLatitude !== null &&
          referenceLongitude !== null &&
          maximumDistance !== null &&
          distanceMeters(referenceLatitude, referenceLongitude, nextCoordinate.lat, nextCoordinate.lng) > maximumDistance;

        if (isOutsideAllowedArea) {
          restoringLastValidCoordinate = true;
          map.panTo(lastValidCoordinate, { animate: false });
          postPin('pinRejected', lastValidCoordinate.lat, lastValidCoordinate.lng);
          return;
        }

        lastValidCoordinate = L.latLng(nextCoordinate.lat, nextCoordinate.lng);
        postPin('pinMoved', lastValidCoordinate.lat, lastValidCoordinate.lng);
      }

      map.on('movestart', function() {
        postPin('mapMoving', map.getCenter().lat, map.getCenter().lng);
      });
      map.on('moveend', function() {
        if (restoringLastValidCoordinate) {
          restoringLastValidCoordinate = false;
          return;
        }
        useCoordinate(map.getCenter());
      });
      map.on('click', function(event) {
        map.panTo(event.latlng, { animate: false });
      });

      function stabilizeMapSize() {
        map.invalidateSize(false);
        map.setView(lastValidCoordinate, map.getZoom(), { animate: false });
      }

      map.whenReady(function() {
        requestAnimationFrame(stabilizeMapSize);
        setTimeout(stabilizeMapSize, 350);
        setTimeout(function() {
          postPin('pinMoved', lastValidCoordinate.lat, lastValidCoordinate.lng);
        }, 400);
      });
      window.addEventListener('resize', stabilizeMapSize);
      }
    </script>
  </body>
</html>`;
}

export type LocationPickerPanelProps = {
  initialCoordinate: MapPickerCoordinate;
  title: string;
  hint: string;
  confirmLabel?: string;
  /** Optional immutable origin and allowed radius for incident-pin adjustment. */
  referenceCoordinate?: MapPickerCoordinate;
  maximumDistanceMeters?: number;
  onConfirm: (coordinate: MapPickerCoordinate) => void;
  onClose: () => void;
  /** Removes the nested-modal shell so the picker can live inside another flow. */
  embedded?: boolean;
};

type LocationPickerModalProps = Omit<LocationPickerPanelProps, 'embedded'> & {
  visible: boolean;
};

export function LocationPickerPanel({
  initialCoordinate,
  title,
  hint,
  confirmLabel = 'Use this pin',
  referenceCoordinate,
  maximumDistanceMeters,
  onConfirm,
  onClose,
  embedded = false,
}: LocationPickerPanelProps) {
  const [draft, setDraft] = useState<MapPickerCoordinate>(initialCoordinate);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapMoving, setMapMoving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const coordinateResetKey = `${initialCoordinate.latitude}:${initialCoordinate.longitude}`;
  const [previousCoordinateResetKey, setPreviousCoordinateResetKey] =
    useState(coordinateResetKey);

  if (coordinateResetKey !== previousCoordinateResetKey) {
    setPreviousCoordinateResetKey(coordinateResetKey);
    setDraft(initialCoordinate);
    setMapError(null);
    setMapMoving(false);
    setValidationError(null);
  }

  const html = useMemo(
    () =>
      buildPickerHtml(
        initialCoordinate.latitude,
        initialCoordinate.longitude,
        referenceCoordinate,
        maximumDistanceMeters,
      ),
    [
      initialCoordinate.latitude,
      initialCoordinate.longitude,
      maximumDistanceMeters,
      referenceCoordinate,
    ],
  );

  const movedDistanceMeters = referenceCoordinate
    ? distanceBetweenCoordinates(referenceCoordinate, draft)
    : 0;

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        latitude?: number;
        longitude?: number;
      };

      if (data.type === 'mapError') {
        setMapError('The map could not load. Check your connection and try again.');
        setMapMoving(false);
        return;
      }
      if (data.type === 'mapMoving') {
        setMapMoving(true);
        return;
      }
      if (data.type === 'pinRejected') {
        setMapMoving(false);
        setValidationError(
          'That point is outside the permitted adjustment area. The pin was returned to its last valid position.',
        );
        return;
      }
      if (data.type !== 'pinMoved') return;

      const latitude = Number(data.latitude);
      const longitude = Number(data.longitude);
      if (!isValidMapPickerCoordinate(latitude, longitude)) return;

      setDraft({ latitude, longitude });
      setMapMoving(false);
      setValidationError(null);
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
    if (
      referenceCoordinate &&
      maximumDistanceMeters &&
      movedDistanceMeters > maximumDistanceMeters
    ) {
      setValidationError(
        `Keep the incident pin within ${Math.round(maximumDistanceMeters)} m of the verified device location.`,
      );
      return;
    }
    onConfirm(draft);
  }

  return (
    <View style={[localStyles.card, embedded && localStyles.embeddedCard]}>
      <View style={localStyles.header}>
        <View style={localStyles.headerTitleRow}>
          <Ionicons name="map" size={22} color={colors.text} />
          <Text style={[localStyles.title, embedded && localStyles.embeddedTitle]}>
            {title}
          </Text>
        </View>
      </View>
      <Text style={localStyles.hint}>{hint}</Text>

      <View style={[localStyles.mapFrame, embedded && localStyles.embeddedMapFrame]}>
        {mapError ? (
          <View style={localStyles.fallback}>
            <Ionicons name="map-outline" size={30} color={colors.textMuted} />
            <Text style={localStyles.fallbackText}>{mapError}</Text>
            <TouchableOpacity style={localStyles.retryButton} onPress={retryMap}>
              <Text style={localStyles.retryButtonText}>Retry map</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <WebView
              key={retryKey}
              style={localStyles.webview}
              originWhitelist={['*']}
              source={{ html }}
              androidLayerType="hardware"
              nestedScrollEnabled
              overScrollMode="never"
              onMessage={handleMessage}
              onError={() =>
                setMapError(
                  'The map could not load. Check your connection and try again.',
                )
              }
              onHttpError={() =>
                setMapError(
                  'The map could not load. Check your connection and try again.',
                )
              }
              renderLoading={() => (
                <View style={localStyles.loading}>
                  <ActivityIndicator color={colors.themeSoft} />
                </View>
              )}
              startInLoadingState
            />
            <View style={localStyles.fixedMapMarker} pointerEvents="none">
              <Ionicons
                name="location-sharp"
                size={58}
                color={colors.white}
                style={localStyles.fixedMapMarkerOutline}
              />
              <Ionicons
                name="location-sharp"
                size={50}
                color={colors.navigationActive}
              />
            </View>
          </>
        )}
      </View>

      {referenceCoordinate && maximumDistanceMeters ? (
        <View style={localStyles.distanceRow}>
          <Ionicons
            name="shield-checkmark-outline"
            size={17}
            color={colors.navigationActive}
          />
          <Text style={localStyles.distanceText}>
            Pin moved {Math.round(movedDistanceMeters)} m of{' '}
            {Math.round(maximumDistanceMeters)} m allowed
          </Text>
        </View>
      ) : null}
      {validationError ? (
        <Text style={localStyles.validationError}>{validationError}</Text>
      ) : null}

      <View style={localStyles.footer}>
        <TouchableOpacity style={localStyles.secondaryButton} onPress={onClose}>
          <Text style={localStyles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            localStyles.primaryButton,
            (mapError ||
              mapMoving ||
              Boolean(
                referenceCoordinate &&
                  maximumDistanceMeters &&
                  movedDistanceMeters > maximumDistanceMeters,
              )) &&
              localStyles.buttonDisabled,
          ]}
          onPress={confirmLocation}
          disabled={
            Boolean(mapError) ||
            mapMoving ||
            Boolean(
              referenceCoordinate &&
                maximumDistanceMeters &&
                movedDistanceMeters > maximumDistanceMeters,
            )
          }
        >
          <Text style={localStyles.primaryButtonText}>{confirmLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function LocationPickerModal({
  visible,
  ...panelProps
}: LocationPickerModalProps) {
  if (!visible) return null;

  const panelKey = `${panelProps.initialCoordinate.latitude}:${panelProps.initialCoordinate.longitude}`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={panelProps.onClose}>
      <View style={localStyles.overlay}>
        <Pressable style={localStyles.backdrop} onPress={panelProps.onClose} />
        <LocationPickerPanel key={panelKey} {...panelProps} />
      </View>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: spacing.md },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17, 24, 39, 0.45)' },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', borderRadius: radius.xl, backgroundColor: colors.white, padding: spacing.lg, gap: spacing.sm },
  embeddedCard: { maxWidth: '100%', padding: 0, borderRadius: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  headerTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.text },
  embeddedTitle: { fontSize: 22, lineHeight: 27 },
  hint: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: 20 },
  mapFrame: { height: 290, overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  embeddedMapFrame: { height: 330 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  fixedMapMarker: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 58,
    height: 58,
    marginLeft: -29,
    marginTop: -54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedMapMarkerOutline: { position: 'absolute' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  fallbackText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  distanceText: { flex: 1, fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.navigationActive },
  validationError: { fontFamily: fonts.medium, fontSize: fontSizes.sm, lineHeight: 19, color: colors.unverified },
  retryButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  retryButtonText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.text },
  footer: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md },
  secondaryButtonText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.text },
  primaryButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.navigationActive, paddingVertical: spacing.md },
  primaryButtonText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.white },
  buttonDisabled: { opacity: 0.5 },
});
