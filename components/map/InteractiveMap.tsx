// Interactive Leaflet map in a WebView (OSM tiles, Minglanilla).
// Soft red report pins with clustering; blue facility + green evac markers.
// Layer filters live in React Native so report clustering stays unchanged.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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

export type MapUserLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
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
  /** Adds the resident search field and filter-panel control from the map design. */
  showSearchBar?: boolean;
  searchBarTopInset?: number;
  userLocation?: MapUserLocation | null;
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
  /** Controls how close the camera moves when a report is focused. */
  focusZoomLevel?: number;
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
  focusZoomLevel: number,
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
        width: 46px;
        height: 46px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: rgba(169, 51, 64, 0.14);
        border: 1px solid rgba(169, 51, 64, 0.2);
      }

      .report-pin-core {
        width: 31px;
        height: 31px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: #B33443;
        border: 3px solid #FFFFFF;
        box-shadow: 0 4px 12px rgba(106, 24, 36, 0.34);
      }

      .report-pin-core svg {
        width: 17px;
        height: 17px;
      }

      .resource-pin {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        border: 3px solid #FFFFFF;
        box-shadow: 0 3px 10px rgba(28, 43, 75, 0.28);
      }

      .resource-pin svg {
        width: 18px;
        height: 18px;
      }

      .resource-pin.facility {
        background: #4B82B5;
      }

      .resource-pin.evacuation {
        background: #3F7B6C;
      }

      .resource-pin.evacuation.priority {
        box-shadow: 0 0 0 3px rgba(234, 179, 8, 0.55), 0 3px 10px rgba(28, 43, 75, 0.28);
      }

      .marker-cluster-report {
        overflow: visible;
        background: rgba(169, 51, 64, 0.13);
        border: 2px solid rgba(255, 255, 255, 0.95);
        border-radius: 50%;
        box-shadow: 0 4px 14px rgba(106, 24, 36, 0.25);
      }

      .marker-cluster-report div {
        position: relative;
        z-index: 1;
        width: 34px;
        height: 34px;
        margin-left: 2px;
        margin-top: 2px;
        background: #B33443;
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

      .user-location-marker {
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: rgba(47, 103, 171, 0.13);
      }

      .user-location-marker::after {
        content: '';
        width: 11px;
        height: 11px;
        border-radius: 50%;
        background: #2F67AB;
        border: 2.5px solid #FFFFFF;
        box-shadow: 0 2px 7px rgba(32, 72, 125, 0.4);
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
            '<div class="report-pin-core">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                '<path d="M12 3.4 21 20H3L12 3.4Z" fill="#FFFFFF"/>' +
                '<path d="M12 8v6" stroke="#B33443" stroke-width="2.2" stroke-linecap="round"/>' +
                '<circle cx="12" cy="17.2" r="1.25" fill="#B33443"/>' +
              '</svg>' +
            '</div>' +
          '</div>',
        iconSize: [46, 46],
        iconAnchor: [23, 23],
        popupAnchor: [0, -25]
      });

      function resourceIcon(kind, isPriority) {
        var extra = kind === 'evacuation' && isPriority ? ' priority' : '';
        var icon = kind === 'facility'
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" stroke="#FFFFFF" stroke-width="2.7" stroke-linecap="round"/></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-6 8 6v8H4v-8Z" fill="#FFFFFF"/><path d="M10 19v-5h4v5" fill="#3F7B6C"/></svg>';
        return L.divIcon({
          className: 'resource-pin-wrap',
          html: '<div class="resource-pin ' + kind + extra + '">' + icon + '</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
      }

      var userLocationIcon = L.divIcon({
        className: 'resource-pin-wrap',
        html: '<div class="user-location-marker"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
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
            html: '${pulseReportClusters ? '<span class="cluster-pulse"></span>' : ''}<div><span>' + count + '</span></div>',
            className: 'marker-cluster-report',
            iconSize: L.point(38, 38)
          });
        }
      }).addTo(map);

      var resourceGroup = L.layerGroup().addTo(map);
      var userLocationGroup = L.layerGroup().addTo(map);
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

      window.setUserLocation = function(location) {
        userLocationGroup.clearLayers();
        if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') return;
        L.marker([location.latitude, location.longitude], {
          icon: userLocationIcon,
          interactive: false,
          zIndexOffset: 900
        }).addTo(userLocationGroup);
      };

      window.focusReport = function(target) {
        if (!target || typeof target.latitude !== 'number' || typeof target.longitude !== 'number') return;
        var signature = focusSignature(target);
        var sameTarget = signature === lastFocusSignature;
        // Keep an in-progress pan, but still jump when a different report is selected.
        if (pointerCount > 0 && sameTarget) return;
        if (stickyFocus && sameTarget) return;
        lastFocusSignature = signature;
        map.setView([target.latitude, target.longitude], ${focusZoomLevel}, { animate: true });
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
      if (window.__pendingUserLocation) {
        window.setUserLocation(window.__pendingUserLocation);
        window.__pendingUserLocation = null;
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

function userLocationToInjectScript(location: MapUserLocation | null): string {
  const json = JSON.stringify(location).replace(/</g, '\\u003c');
  return `(function() {
    var location = ${json};
    if (window.setUserLocation) {
      window.setUserLocation(location);
    } else {
      window.__pendingUserLocation = location;
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
  showSearchBar = false,
  searchBarTopInset = spacing.md,
  userLocation = null,
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
  focusZoomLevel = 16,
  stickyFocus = false,
}: Props) {
  const webRef = useRef<WebView>(null);
  const initialShowMapDetailsRef = useRef(showMapDetails);
  const lastFocusSignatureRef = useRef('');
  // Leaflet supports a wider range, but the app's tile sources are configured for levels 1-19.
  const safeFocusZoomLevel = Math.min(19, Math.max(1, Math.round(focusZoomLevel)));
  const html = useMemo(
    () =>
      buildMapHtml(
        showZoomControls,
        tone,
        pulseReportClusters,
        initialShowMapDetailsRef.current,
        stickyFocus,
        safeFocusZoomLevel,
      ),
    [pulseReportClusters, safeFocusZoomLevel, showZoomControls, stickyFocus, tone],
  );
  const readyRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [layerPanelVisible, setLayerPanelVisible] = useState(showLayerFilters);

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
    if (!readyRef.current || !webRef.current) return;
    webRef.current.injectJavaScript(userLocationToInjectScript(userLocation));
  }, [userLocation]);

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

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const searchResults = useMemo(() => {
    if (normalizedSearchQuery.length < 2) return [];

    const reportResults = markers
      .filter((report) =>
        `${report.title} ${report.description} ${report.addressText ?? ''}`
          .toLocaleLowerCase()
          .includes(normalizedSearchQuery),
      )
      .slice(0, 4)
      .map((report) => ({
        id: report.id,
        kind: 'report' as const,
        title: report.title || 'Untitled report',
        subtitle: report.addressText || 'Community report',
        latitude: report.latitude,
        longitude: report.longitude,
      }));

    const resourceResults = [...facilities, ...evacuationCenters]
      .filter((resource) =>
        `${resource.name} ${resource.subtitle ?? ''}`
          .toLocaleLowerCase()
          .includes(normalizedSearchQuery),
      )
      .slice(0, 4)
      .map((resource) => ({
        id: resource.id,
        kind: resource.kind,
        title: resource.name,
        subtitle: resource.subtitle || (resource.kind === 'facility' ? 'Facility' : 'Evacuation center'),
        latitude: resource.latitude,
        longitude: resource.longitude,
        resource,
      }));

    return [...reportResults, ...resourceResults].slice(0, 6);
  }, [evacuationCenters, facilities, markers, normalizedSearchQuery]);

  function selectSearchResult(result: (typeof searchResults)[number]) {
    Keyboard.dismiss();
    setSearchFocused(false);
    setSearchQuery(result.title);
    if (result.kind === 'report') {
      onReportSelection?.([result.id]);
      webRef.current?.injectJavaScript(
        focusToInjectScript({
          reportId: result.id,
          latitude: result.latitude,
          longitude: result.longitude,
        }),
      );
      return;
    }

    if (!('resource' in result)) return;
    onResourceSelection?.(result.resource);
    webRef.current?.injectJavaScript(
      focusToInjectScript({
        resourceId: result.id,
        latitude: result.latitude,
        longitude: result.longitude,
      }),
    );
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
          webRef.current?.injectJavaScript(userLocationToInjectScript(userLocation));
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

      {showSearchBar ? (
        <View style={[mapStyles.searchOverlay, { top: searchBarTopInset }]} pointerEvents="box-none">
          <View style={mapStyles.searchBar}>
            <Ionicons name="search-outline" size={22} color={colors.navigationActive} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search reports or places"
              placeholderTextColor="#75819A"
              style={mapStyles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              onSubmitEditing={() => {
                const firstResult = searchResults[0];
                if (firstResult) selectSearchResult(firstResult);
              }}
              accessibilityLabel="Search reports or places"
            />
            {searchQuery ? (
              <Pressable
                style={mapStyles.searchAction}
                onPress={() => setSearchQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear map search"
              >
                <Ionicons name="close" size={19} color={colors.textMuted} />
              </Pressable>
            ) : null}
            <Pressable
              style={mapStyles.searchAction}
              onPress={() => setLayerPanelVisible((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel="Show or hide map layers"
              accessibilityState={{ expanded: layerPanelVisible }}
            >
              <Ionicons name="options-outline" size={22} color={colors.navigationActive} />
            </Pressable>
          </View>

          {searchFocused && normalizedSearchQuery.length >= 2 ? (
            <View style={mapStyles.searchResults}>
              {searchResults.length > 0 ? (
                <ScrollView keyboardShouldPersistTaps="handled" style={mapStyles.searchResultsScroll}>
                  {searchResults.map((result) => (
                    <Pressable
                      key={`${result.kind}-${result.id}`}
                      style={mapStyles.searchResultRow}
                      onPress={() => selectSearchResult(result)}
                    >
                      <View style={mapStyles.searchResultIcon}>
                        <Ionicons
                          name={
                            result.kind === 'report'
                              ? 'warning-outline'
                              : result.kind === 'facility'
                                ? 'medical-outline'
                                : 'home-outline'
                          }
                          size={17}
                          color={colors.navigationActive}
                        />
                      </View>
                      <View style={mapStyles.searchResultCopy}>
                        <Text style={mapStyles.searchResultTitle} numberOfLines={1}>{result.title}</Text>
                        <Text style={mapStyles.searchResultSubtitle} numberOfLines={1}>{result.subtitle}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <Text style={mapStyles.searchEmptyText}>No matching reports or places</Text>
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      {showLayerFilters && layerPanelVisible ? (
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
            <Ionicons name="warning-outline" size={compactLayerFilters ? 18 : 20} color={colors.navigationActive} />
            <Text
              style={[
                mapStyles.legendText,
                compactLayerFilters && mapStyles.legendTextCompact,
                tone === 'dark' && !showSearchBar && mapStyles.legendTextDark,
              ]}
            >
              Reports
            </Text>
            <View style={[mapStyles.layerSwitch, layerVisibility.reports && mapStyles.layerSwitchActive]}>
              <View style={[mapStyles.layerSwitchThumb, layerVisibility.reports && mapStyles.layerSwitchThumbActive]} />
            </View>
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
            <Ionicons name="medical-outline" size={compactLayerFilters ? 18 : 20} color={colors.navigationActive} />
            <Text
              style={[
                mapStyles.legendText,
                compactLayerFilters && mapStyles.legendTextCompact,
                tone === 'dark' && !showSearchBar && mapStyles.legendTextDark,
              ]}
            >
              Facilities
            </Text>
            <View style={[mapStyles.layerSwitch, layerVisibility.facilities && mapStyles.layerSwitchActive]}>
              <View style={[mapStyles.layerSwitchThumb, layerVisibility.facilities && mapStyles.layerSwitchThumbActive]} />
            </View>
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
            <Ionicons name="home-outline" size={compactLayerFilters ? 18 : 20} color={colors.navigationActive} />
            <Text
              style={[
                mapStyles.legendText,
                compactLayerFilters && mapStyles.legendTextCompact,
                tone === 'dark' && !showSearchBar && mapStyles.legendTextDark,
              ]}
            >
              Evacuation centers
            </Text>
            <View style={[mapStyles.layerSwitch, layerVisibility.evacuationCenters && mapStyles.layerSwitchActive]}>
              <View style={[mapStyles.layerSwitchThumb, layerVisibility.evacuationCenters && mapStyles.layerSwitchThumbActive]} />
            </View>
          </Pressable>
          <Text
            style={[
              mapStyles.legendHint,
              compactLayerFilters && mapStyles.legendHintCompact,
              tone === 'dark' && !showSearchBar && mapStyles.legendHintDark,
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
    width: 190,
    gap: spacing.xs,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    shadowColor: '#1C2B4B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.13,
    shadowRadius: 14,
    elevation: 7,
  },
  legendCompact: {
    width: 160,
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  legendRow: {
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    width: '100%',
  },
  legendRowCompact: {
    minHeight: 28,
    gap: 7,
  },
  legendRowInactive: {
    opacity: 0.65,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendDotCompact: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
  },
  legendTextCompact: {
    fontSize: 10,
    lineHeight: 13,
  },
  legendTextDark: {
    color: colors.white,
  },
  legendHint: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  legendHintCompact: {
    marginTop: 3,
    fontSize: 9,
    lineHeight: 11,
  },
  legendHintDark: {
    color: '#FCA5A5',
  },
  layerSwitch: {
    width: 30,
    height: 18,
    padding: 2,
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: '#C8CDD7',
  },
  layerSwitchActive: {
    backgroundColor: colors.navigationActive,
  },
  layerSwitchThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.white,
  },
  layerSwitchThumbActive: {
    alignSelf: 'flex-end',
  },
  searchOverlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 20,
  },
  searchBar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    shadowColor: '#1C2B4B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 48,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
  },
  searchAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  searchResults: {
    marginTop: spacing.sm,
    maxHeight: 252,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: colors.white,
    shadowColor: '#1C2B4B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 8,
  },
  searchResultsScroll: {
    flexGrow: 0,
  },
  searchResultRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchResultIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
  },
  searchResultCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  searchResultTitle: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.text,
  },
  searchResultSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textMuted,
  },
  searchEmptyText: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
