// Interactive Leaflet map in a WebView (OSM tiles, Minglanilla).
// Soft red report pins with clustering; blue facility + green evac markers.
// Layer filters live in React Native so report clustering stays unchanged.
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSizes, spacing } from '../../styles/theme';
import type { MapReportMarker } from '../../lib/reports';

const CENTER = { lat: 10.2447, lng: 123.7967 };
const ZOOM = 14;

export type MapResourceMarker = {
  id: string;
  kind: 'facility' | 'evacuation';
  name: string;
  latitude: number;
  longitude: number;
  subtitle?: string | null;
  isPriority?: boolean;
};

export type MapLayerVisibility = {
  reports: boolean;
  facilities: boolean;
  evacuationCenters: boolean;
};

/** Imperative camera target supplied by a parent route after markers are scoped. */
export type MapFocusTarget = {
  reportId?: string;
  resourceId?: string;
  latitude: number;
  longitude: number;
};

type Props = {
  markers?: MapReportMarker[];
  facilities?: MapResourceMarker[];
  evacuationCenters?: MapResourceMarker[];
  layerVisibility?: MapLayerVisibility;
  showLayerFilters?: boolean;
  /** Keeps resident layer controls clear of the device status bar. */
  layerFiltersTopInset?: number;
  /** Reduces vertical spacing for filters shown over a full-screen map. */
  compactLayerFilters?: boolean;
  onLayerVisibilityChange?: (next: MapLayerVisibility) => void;
  onReportSelection?: (reportIds: string[]) => void;
  /** Opens a marker popup with a separate report-details action when requested. */
  showReportDetailsPopup?: boolean;
  /** Adds a subtle red pulse around report clusters in compact map previews. */
  pulseReportClusters?: boolean;
  onReportDetailsRequest?: (reportId: string) => void;
  onResourceSelection?: (resource: MapResourceMarker) => void;
  focusTarget?: MapFocusTarget | null;
  showZoomControls?: boolean;
  /** Shows the base map's roads, labels, and geographic details. */
  showMapDetails?: boolean;
  /** Adjusts map contrast for resident and command-center contexts. */
  tone?: 'light' | 'dark';
  /** Lets a parent ScrollView freeze while the user is panning or zooming the map. */
  onGestureActiveChange?: (active: boolean) => void;
  /**
   * Recapture the camera only when the focused pin changes.
   * Use this inside a ScrollView so parent re-renders do not yank the map back.
   */
  stickyFocus?: boolean;
};

const DEFAULT_LAYERS: MapLayerVisibility = {
  reports: true,
  facilities: true,
  evacuationCenters: true,
};

function buildMapHtml(
  showZoomControls: boolean,
  tone: 'light' | 'dark',
  pulseReportClusters: boolean,
  initialShowMapDetails: boolean,
  stickyFocus: boolean,
): string {
  const isDark = tone === 'dark';
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; background: ${isDark ? '#343B44' : '#F0F4FF'}; }
      .leaflet-tile-pane {
        ${isDark ? 'filter: invert(82%) hue-rotate(180deg) brightness(88%) saturate(65%) contrast(96%);' : ''}
      }
      .leaflet-control-attribution { display: none; }

      .report-pin-wrap, .resource-pin-wrap {
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

      .resource-pin {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2.5px solid #FFFFFF;
        box-shadow: 0 3px 10px rgba(28, 43, 75, 0.28);
        transform: translate(-50%, -50%);
      }

      .resource-pin.facility {
        background: linear-gradient(145deg, #60A5FA 0%, #1A56DB 100%);
      }

      .resource-pin.evacuation {
        background: linear-gradient(145deg, #4ADE80 0%, #16A34A 100%);
      }

      .resource-pin.evacuation.priority {
        box-shadow: 0 0 0 3px rgba(234, 179, 8, 0.55), 0 3px 10px rgba(28, 43, 75, 0.28);
      }

      .marker-cluster-report {
        overflow: visible;
        background: rgba(255, 92, 92, 0.18);
        border: 2px solid rgba(255, 255, 255, 0.95);
        border-radius: 50%;
        box-shadow: 0 4px 14px rgba(255, 92, 92, 0.28);
      }

      .marker-cluster-report div {
        position: relative;
        z-index: 1;
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

      .cluster-pulse {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: rgba(220, 38, 38, 0.48);
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.38);
        pointer-events: none;
        animation: clusterPulse 1.8s ease-out infinite;
      }

      @keyframes clusterPulse {
        0% {
          opacity: 0.78;
          transform: scale(0.88);
        }
        70% {
          opacity: 0.14;
          transform: scale(1.8);
        }
        100% {
          opacity: 0;
          transform: scale(2.15);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .cluster-pulse {
          animation: none;
          opacity: 0;
        }
      }

      .report-details-popup-button {
        border: 0;
        border-radius: 999px;
        background: #111827;
        color: #FFFFFF;
        font-family: ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.1px;
        padding: 10px 16px;
        white-space: nowrap;
        box-shadow: 0 4px 10px rgba(17, 24, 39, 0.2);
      }

      .leaflet-popup-content-wrapper {
        border-radius: 18px;
        box-shadow: 0 8px 20px rgba(17, 24, 39, 0.16);
      }

      .leaflet-popup-tip {
        box-shadow: 3px 3px 8px rgba(17, 24, 39, 0.08);
      }

      .leaflet-popup-content {
        margin: 10px;
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
        zoomControl: ${showZoomControls ? 'true' : 'false'},
        attributionControl: false
      });

      function postMapGesture(active) {
        if (!window.ReactNativeWebView) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'mapGesture',
          active: active
        }));
      }

      var pointerCount = 0;
      var lastFocusSignature = null;
      var stickyFocus = ${stickyFocus ? 'true' : 'false'};

      function focusSignature(target) {
        return String(target.reportId || '') + '|' + String(target.resourceId || '') + '|' + target.latitude + '|' + target.longitude;
      }

      // Tell React Native as soon as a finger is on the map so a parent
      // ScrollView cannot steal the pan on Android.
      document.addEventListener('touchstart', function(event) {
        pointerCount = event.touches.length;
        postMapGesture(true);
      }, { capture: true, passive: true });
      document.addEventListener('touchend', function(event) {
        pointerCount = event.touches.length;
        if (pointerCount === 0) postMapGesture(false);
      }, { capture: true, passive: true });
      document.addEventListener('touchcancel', function(event) {
        pointerCount = event.touches.length;
        if (pointerCount === 0) postMapGesture(false);
      }, { capture: true, passive: true });

      var detailedTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      });

      // This layer retains roads and geography but removes basemap labels and POI icons.
      var cleanTileLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          maxNativeZoom: 16,
          maxZoom: 19
        }
      );

      var cleanMapMaximumZoom = 16;
      var showDetailsRequested = ${initialShowMapDetails ? 'true' : 'false'};
      var currentBaseLayer = null;

      function updateBaseLayer(nextZoom) {
        // Close zoom levels fall back to OSM so the limited clean layer never stretches.
        var zoomLevel = typeof nextZoom === 'number' ? nextZoom : map.getZoom();
        var useDetailedLayer = showDetailsRequested || zoomLevel > cleanMapMaximumZoom;
        var nextBaseLayer = useDetailedLayer ? detailedTileLayer : cleanTileLayer;
        if (currentBaseLayer === nextBaseLayer) return;

        nextBaseLayer.addTo(map);
        if (currentBaseLayer) {
          map.removeLayer(currentBaseLayer);
        }
        currentBaseLayer = nextBaseLayer;
      }

      window.setMapDetailsVisibility = function(showDetails) {
        showDetailsRequested = showDetails;
        updateBaseLayer();
      };

      // Switch before animated zoom frames request unsupported clean-map tiles.
      map.on('zoomanim', function(event) {
        updateBaseLayer(event.zoom);
      });
      map.on('zoomend', function() {
        updateBaseLayer();
      });
      updateBaseLayer();

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

      function resourceIcon(kind, isPriority) {
        var extra = kind === 'evacuation' && isPriority ? ' priority' : '';
        return L.divIcon({
          className: 'resource-pin-wrap',
          html: '<div class="resource-pin ' + kind + extra + '"></div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });
      }

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
            html: '${pulseReportClusters ? '<span class="cluster-pulse"></span>' : ''}<div><span>' + count + '</span></div>',
            className: 'marker-cluster-report',
            iconSize: L.point(38, 38)
          });
        }
      }).addTo(map);

      var resourceGroup = L.layerGroup().addTo(map);
      var reportMarkersById = {};

      function postSelection(reportIds) {
        if (!window.ReactNativeWebView || !reportIds || !reportIds.length) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'reportSelection',
          reportIds: reportIds
        }));
      }

      function postReportDetails(reportId) {
        if (!window.ReactNativeWebView || !reportId) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'reportDetails',
          reportId: reportId
        }));
      }

      function createReportDetailsPopup(reportId) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'report-details-popup-button';
        button.textContent = 'See Details';
        button.addEventListener('click', function(event) {
          L.DomEvent.stop(event);
          postReportDetails(reportId);
        });
        return button;
      }

      function postResource(resource) {
        if (!window.ReactNativeWebView || !resource) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'resourceSelection',
          resource: resource
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
        reportMarkersById = {};
        if (!markers || !markers.length) return;

        var bounds = [];
        markers.forEach(function(m) {
          if (typeof m.latitude !== 'number' || typeof m.longitude !== 'number') return;

          var marker = L.marker([m.latitude, m.longitude], {
            icon: reportPinIcon,
            reportId: m.id,
            reportMeta: { id: m.id, createdAt: m.created_at || '' }
          });

          if (m.showDetailsPopup) {
            marker.bindPopup(createReportDetailsPopup(m.id), {
              closeButton: false,
              autoPanPadding: [18, 18]
            });
          }

          marker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            if (m.showDetailsPopup) {
              marker.openPopup();
              return;
            }
            postSelection([m.id]);
          });

          clusterGroup.addLayer(marker);
          reportMarkersById[m.id] = marker;
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

      window.setResourceMarkers = function(resources) {
        resourceGroup.clearLayers();
        if (!resources || !resources.length) return;

        resources.forEach(function(r) {
          if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') return;
          var marker = L.marker([r.latitude, r.longitude], {
            icon: resourceIcon(r.kind, !!r.isPriority),
            resourceMeta: r
          });
          marker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            postResource(r);
          });
          resourceGroup.addLayer(marker);
        });
      };

      window.focusReport = function(target) {
        if (!target || typeof target.latitude !== 'number' || typeof target.longitude !== 'number') return;
        var signature = focusSignature(target);
        var sameTarget = signature === lastFocusSignature;
        // Keep an in-progress pan, but still jump when a different report is selected.
        if (pointerCount > 0 && sameTarget) return;
        if (stickyFocus && sameTarget) return;
        lastFocusSignature = signature;
        map.setView([target.latitude, target.longitude], 16, { animate: true });
        var marker = reportMarkersById[target.reportId];
        if (marker && marker.getPopup()) {
          window.setTimeout(function() { marker.openPopup(); }, 150);
        }
      };

      // On iOS, React Native can inject markers before this script has run
      // (onLoadEnd fires for the intermediate blank page). Apply anything
      // that was buffered while we were still loading.
      if (window.__pendingReportMarkers) {
        window.setReportMarkers(window.__pendingReportMarkers);
        window.__pendingReportMarkers = null;
      }
      if (window.__pendingResourceMarkers) {
        window.setResourceMarkers(window.__pendingResourceMarkers);
        window.__pendingResourceMarkers = null;
      }
      if (window.__pendingFocusTarget) {
        window.focusReport(window.__pendingFocusTarget);
        window.__pendingFocusTarget = null;
      }
    </script>
  </body>
</html>`;
}

function markersToInjectScript(
  markers: MapReportMarker[],
  showReportDetailsPopup: boolean,
): string {
  const payload = markers.map((m) => ({
    id: m.id,
    latitude: m.latitude,
    longitude: m.longitude,
    created_at: m.created_at,
    showDetailsPopup: showReportDetailsPopup,
  }));
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `(function() {
    var data = ${json};
    if (window.setReportMarkers) {
      window.setReportMarkers(data);
    } else {
      window.__pendingReportMarkers = data;
    }
  })(); true;`;
}

function resourcesToInjectScript(resources: MapResourceMarker[]): string {
  const payload = resources.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    subtitle: r.subtitle ?? null,
    isPriority: Boolean(r.isPriority),
  }));
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `(function() {
    var data = ${json};
    if (window.setResourceMarkers) {
      window.setResourceMarkers(data);
    } else {
      window.__pendingResourceMarkers = data;
    }
  })(); true;`;
}

function focusSignature(target: MapFocusTarget | null | undefined): string {
  if (!target) return '';
  return `${target.reportId ?? ''}|${target.resourceId ?? ''}|${target.latitude}|${target.longitude}`;
}

function focusToInjectScript(target: MapFocusTarget): string {
  const json = JSON.stringify(target).replace(/</g, '\\u003c');
  return `(function() {
    var target = ${json};
    if (window.focusReport) {
      window.focusReport(target);
    } else {
      window.__pendingFocusTarget = target;
    }
  })(); true;`;
}

function mapDetailsToInjectScript(showMapDetails: boolean): string {
  return `(function() {
    if (window.setMapDetailsVisibility) {
      window.setMapDetailsVisibility(${showMapDetails ? 'true' : 'false'});
    }
  })(); true;`;
}

export default function InteractiveMap({
  markers = [],
  facilities = [],
  evacuationCenters = [],
  layerVisibility = DEFAULT_LAYERS,
  showLayerFilters = false,
  layerFiltersTopInset = spacing.md,
  compactLayerFilters = false,
  onLayerVisibilityChange,
  onReportSelection,
  showReportDetailsPopup = false,
  pulseReportClusters = false,
  onReportDetailsRequest,
  onResourceSelection,
  focusTarget,
  showZoomControls = true,
  showMapDetails = true,
  tone = 'light',
  onGestureActiveChange,
  stickyFocus = false,
}: Props) {
  const webRef = useRef<WebView>(null);
  const initialShowMapDetailsRef = useRef(showMapDetails);
  const lastFocusSignatureRef = useRef('');
  const html = useMemo(
    () =>
      buildMapHtml(
        showZoomControls,
        tone,
        pulseReportClusters,
        initialShowMapDetailsRef.current,
        stickyFocus,
      ),
    [pulseReportClusters, showZoomControls, stickyFocus, tone],
  );
  const readyRef = useRef(false);

  useEffect(() => {
    lastFocusSignatureRef.current = '';
  }, [html]);

  const visibleReports = useMemo(
    () => (layerVisibility.reports ? markers : []),
    [layerVisibility.reports, markers],
  );
  const visibleResources = useMemo(() => {
    const next: MapResourceMarker[] = [];
    if (layerVisibility.facilities) {
      for (const facility of facilities) {
        next.push(facility);
      }
    }
    if (layerVisibility.evacuationCenters) {
      for (const center of evacuationCenters) {
        next.push(center);
      }
    }
    return next;
  }, [facilities, evacuationCenters, layerVisibility]);

  useEffect(() => {
    if (!readyRef.current || !webRef.current) return;
    webRef.current.injectJavaScript(
      markersToInjectScript(visibleReports, showReportDetailsPopup),
    );
    webRef.current.injectJavaScript(resourcesToInjectScript(visibleResources));
  }, [visibleReports, visibleResources, showReportDetailsPopup]);

  useEffect(() => {
    if (!focusTarget || !readyRef.current || !webRef.current) return;
    const signature = focusSignature(focusTarget);
    // Sticky command maps keep the same pin selected across parent re-renders.
    if (stickyFocus && signature === lastFocusSignatureRef.current) return;
    lastFocusSignatureRef.current = signature;
    webRef.current.injectJavaScript(focusToInjectScript(focusTarget));
  }, [focusTarget, stickyFocus]);

  useEffect(() => {
    if (!readyRef.current || !webRef.current) return;
    webRef.current.injectJavaScript(mapDetailsToInjectScript(showMapDetails));
  }, [showMapDetails]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string;
          active?: boolean;
          reportIds?: string[];
          reportId?: string;
          resource?: MapResourceMarker;
        };
        if (data.type === 'mapGesture' && typeof data.active === 'boolean') {
          onGestureActiveChange?.(data.active);
          return;
        }
        if (data.type === 'reportSelection' && Array.isArray(data.reportIds)) {
          onReportSelection?.(data.reportIds.filter(Boolean));
          return;
        }
        if (data.type === 'reportDetails' && data.reportId) {
          onReportDetailsRequest?.(data.reportId);
          return;
        }
        if (data.type === 'resourceSelection' && data.resource?.id) {
          onResourceSelection?.(data.resource);
        }
      } catch {
        // Ignore malformed WebView messages.
      }
    },
    [onGestureActiveChange, onReportSelection, onReportDetailsRequest, onResourceSelection],
  );

  function toggleLayer(key: keyof MapLayerVisibility) {
    if (!onLayerVisibilityChange) return;
    onLayerVisibilityChange({
      ...layerVisibility,
      [key]: !layerVisibility[key],
    });
  }

  return (
    <View
      style={mapStyles.container}
      collapsable={false}
      onTouchStart={onGestureActiveChange ? () => onGestureActiveChange(true) : undefined}
      onTouchEnd={onGestureActiveChange ? () => onGestureActiveChange(false) : undefined}
      onTouchCancel={onGestureActiveChange ? () => onGestureActiveChange(false) : undefined}
    >
      <WebView
        ref={webRef}
        style={mapStyles.webview}
        originWhitelist={['*']}
        source={{ html }}
        androidLayerType="hardware"
        nestedScrollEnabled
        overScrollMode="never"
        onMessage={handleMessage}
        onLoadEnd={() => {
          readyRef.current = true;
          webRef.current?.injectJavaScript(
            markersToInjectScript(visibleReports, showReportDetailsPopup),
          );
          webRef.current?.injectJavaScript(resourcesToInjectScript(visibleResources));
          webRef.current?.injectJavaScript(mapDetailsToInjectScript(showMapDetails));
          if (focusTarget) {
            lastFocusSignatureRef.current = focusSignature(focusTarget);
            webRef.current?.injectJavaScript(focusToInjectScript(focusTarget));
          }
        }}
        renderError={() => (
          <View style={mapStyles.fallback}>
            <Ionicons name="map-outline" size={28} color={colors.textMuted} />
            <Text style={mapStyles.fallbackText}>Map unavailable</Text>
          </View>
        )}
        startInLoadingState={false}
      />

      {showLayerFilters ? (
        <View
          style={[
            mapStyles.legend,
            compactLayerFilters && mapStyles.legendCompact,
            { top: layerFiltersTopInset },
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            style={[
              mapStyles.legendRow,
              compactLayerFilters && mapStyles.legendRowCompact,
              !layerVisibility.reports && mapStyles.legendRowInactive,
            ]}
            onPress={() => toggleLayer('reports')}
            accessibilityRole="button"
            accessibilityLabel="Toggle reports layer"
          >
            <View
              style={[
                mapStyles.legendDot,
                { backgroundColor: layerVisibility.reports ? '#F04444' : '#9CA3AF' },
              ]}
            />
            <Text style={[mapStyles.legendText, tone === 'dark' && mapStyles.legendTextDark]}>
              Reports
            </Text>
          </Pressable>
          <Pressable
            style={[
              mapStyles.legendRow,
              compactLayerFilters && mapStyles.legendRowCompact,
              !layerVisibility.facilities && mapStyles.legendRowInactive,
            ]}
            onPress={() => toggleLayer('facilities')}
            accessibilityRole="button"
            accessibilityLabel="Toggle facilities layer"
          >
            <View
              style={[
                mapStyles.legendDot,
                { backgroundColor: layerVisibility.facilities ? '#1A56DB' : '#9CA3AF' },
              ]}
            />
            <Text style={[mapStyles.legendText, tone === 'dark' && mapStyles.legendTextDark]}>
              Facilities
            </Text>
          </Pressable>
          <Pressable
            style={[
              mapStyles.legendRow,
              compactLayerFilters && mapStyles.legendRowCompact,
              !layerVisibility.evacuationCenters && mapStyles.legendRowInactive,
            ]}
            onPress={() => toggleLayer('evacuationCenters')}
            accessibilityRole="button"
            accessibilityLabel="Toggle evacuation centers layer"
          >
            <View
              style={[
                mapStyles.legendDot,
                {
                  backgroundColor: layerVisibility.evacuationCenters
                    ? '#16A34A'
                    : '#9CA3AF',
                },
              ]}
            />
            <Text style={[mapStyles.legendText, tone === 'dark' && mapStyles.legendTextDark]}>
              Evacuation centers
            </Text>
          </Pressable>
          <Text
            style={[
              mapStyles.legendHint,
              compactLayerFilters && mapStyles.legendHintCompact,
              tone === 'dark' && mapStyles.legendHintDark,
            ]}
          >
            Tap a layer to show or hide
          </Text>
        </View>
      ) : null}
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
  legend: {
    position: 'absolute',
    left: spacing.md,
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  legendCompact: {
    gap: 2,
    paddingVertical: 2,
  },
  legendRow: {
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendRowCompact: {
    minHeight: 22,
    gap: spacing.sm,
  },
  legendRowInactive: {
    opacity: 0.65,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
  },
  legendTextDark: {
    color: colors.white,
  },
  legendHint: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.primary,
  },
  legendHintCompact: {
    marginTop: 0,
  },
  legendHintDark: {
    color: '#FCA5A5',
  },
});
