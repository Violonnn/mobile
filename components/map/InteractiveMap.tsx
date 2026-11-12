// Interactive Leaflet map in a WebView (OSM tiles, Minglanilla).
// Stage-colored incident pins with clustering; blue facility + green evacuation markers.
// Layer filters live in React Native so report clustering stays unchanged.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  CompatibleWebView,
  type CompatibleWebViewHandle,
  type WebViewMessageEvent,
} from './CompatibleWebView';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
import {
  getMapReportPresentation,
  type MapReportMarker,
} from '../../lib/reports';
import { PUBLIC_INCIDENT_STATUS_OPTIONS, publicIncidentTone, type PublicIncident, type PublicIncidentStatusFilter } from '../../lib/publicIncidents';
import { MAP_RESOURCE_TONES } from '../../lib/mapResourceTones';

const CENTER = { lat: 10.2447, lng: 123.7967 };
const ZOOM = 14;
// Bump this when embedded marker HTML changes so Fast Refresh rebuilds the WebView document.
const MAP_HTML_VERSION = 'public-incident-markers-v12';

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

export type ReportStatusFilter =
  | 'all'
  | 'unverified'
  | 'verified'
  | 'escalated'
  | 'resolved';

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

export type MapViewportFrame = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  borderRadius?: number;
};

type Props = {
  highlightedPublicIncidentId?: string;
  publicIncidentFilters?: {
    visible: boolean;
    onVisibilityChange: (visible: boolean) => void;
    status: PublicIncidentStatusFilter;
    onStatusChange: (status: PublicIncidentStatusFilter) => void;
    unlocatedCount: number;
    onOpenUnlocated: () => void;
  };
  publicIncidents?: PublicIncident[];
  /** groupIds lists every incident drawn at the same rounded public point. */
  onPublicIncidentPress?: (incidentCaseId: string, groupIds: string[], reportId?: string) => void;
  reportLayerLabel?: string;
  markers?: MapReportMarker[];
  reportPresentation?: (report: MapReportMarker) => { label: string; color: string } | null;
  facilities?: MapResourceMarker[];
  evacuationCenters?: MapResourceMarker[];
  layerVisibility?: MapLayerVisibility;
  showLayerFilters?: boolean;
  /** Lets users collapse and reopen the resident map's floating layer controls. */
  collapsibleLayerFilters?: boolean;
  /** Optionally controls the visibility of the floating layer panel. */
  layerPanelVisible?: boolean;
  onLayerPanelVisibilityChange?: (visible: boolean) => void;
  /** Changes when the owning screen needs search suggestions dismissed. */
  dismissSearchSignal?: number;
  /** Adds resident-facing workflow statuses beneath the Reports layer. */
  showReportStatusFilters?: boolean;
  /** Limits report-status chips to statuses the current role can access. */
  reportStatusOptions?: readonly ReportStatusFilter[];
  /** Keeps resident layer controls clear of the device status bar. */
  layerFiltersTopInset?: number;
  /** Reduces vertical spacing for filters shown over a full-screen map. */
  compactLayerFilters?: boolean;
  /** Adds the resident search field and filter-panel control from the map design. */
  showSearchBar?: boolean;
  /** Hides map-overlay filter controls when the screen provides them in its header. */
  showLayerPanelToggle?: boolean;
  /** Positions the expanded filter panel for screens whose trigger lives on the right. */
  layerPanelAlign?: 'left' | 'right';
  /** Lets a screen rely on its own search-close control instead of an in-field clear action. */
  showSearchClearButton?: boolean;
  searchBarTopInset?: number;
  userLocation?: MapUserLocation | null;
  onLayerVisibilityChange?: (next: MapLayerVisibility) => void;
  onReportSelection?: (reportIds: string[]) => void;
  /** Opens a marker popup with a separate report-details action when requested. */
  showReportDetailsPopup?: boolean;
  onReportDetailsRequest?: (reportId: string) => void;
  onResourceSelection?: (resource: MapResourceMarker) => void;
  focusTarget?: MapFocusTarget | null;
  /** Selected resident report rendered above clustering with a pulsing status pin. */
  highlightedReportId?: string | null;
  /** @deprecated All report pins now use the shared status-colored incident triangle. */
  showHighlightedReportIncidentIcon?: boolean;
  /** Focused facility or evacuation center rendered with a matching pulse. */
  highlightedResourceId?: string | null;
  showZoomControls?: boolean;
  /** Shows the base map's roads, labels, and geographic details. */
  showMapDetails?: boolean;
  /** Adjusts map contrast for resident and command-center contexts. */
  tone?: 'light' | 'dark';
  /** Keeps this framed portion crisp while a synchronized map behind it is blurred. */
  unblurredViewportFrame?: MapViewportFrame;
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

const REPORT_STATUS_OPTIONS: {
  value: ReportStatusFilter;
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'unverified', label: 'Unverified' },
  { value: 'verified', label: 'Verified' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
];

const ALL_REPORT_STATUS_FILTERS = REPORT_STATUS_OPTIONS.map((option) => option.value);

function buildMapHtml(
  showZoomControls: boolean,
  tone: 'light' | 'dark',
  initialShowMapDetails: boolean,
  stickyFocus: boolean,
  focusZoomLevel: number,
  unblurredViewportTop: number,
  unblurredViewportRight: number,
  unblurredViewportBottom: number,
  unblurredViewportLeft: number,
  unblurredViewportRadius: number,
  htmlVersion: string = MAP_HTML_VERSION,
): string {
  const isDark = tone === 'dark';
  const hasUnblurredViewport = unblurredViewportTop > 0;
  const darkMapFilter = isDark
    ? 'invert(82%) hue-rotate(180deg) brightness(88%) saturate(65%) contrast(96%)'
    : '';
  const blurredMapFilter = [darkMapFilter, 'blur(2px)'].filter(Boolean).join(' ');
  const framedMapClip = `inset(${unblurredViewportTop}px ${unblurredViewportRight}px ${unblurredViewportBottom}px ${unblurredViewportLeft}px round ${unblurredViewportRadius}px)`;
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="disasterlink-map-version" content="${htmlVersion}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
    <style>
      html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; background: ${isDark ? '#343B44' : '#F0F4FF'}; }
      #map, #map-background { position: absolute; inset: 0; height: 100%; }
      #map { z-index: 1; ${hasUnblurredViewport ? `-webkit-clip-path: ${framedMapClip}; clip-path: ${framedMapClip};` : ''} }
      #map-background { z-index: 0; pointer-events: none; }
      .leaflet-tile-pane {
        ${darkMapFilter ? `filter: ${darkMapFilter};` : ''}
      }
      #map-background .leaflet-tile-pane { filter: ${blurredMapFilter}; }
      .leaflet-control-attribution { display: none; }

      .report-pin-wrap, .resource-pin-wrap {
        background: transparent;
        border: none;
      }

      .report-pin {
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .report-pin svg {
        width: 40px;
        height: 40px;
        filter: drop-shadow(0 4px 6px rgba(15, 32, 68, 0.3));
      }

      .report-pin-highlighted {
        width: 50px;
        height: 50px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .report-pin-highlighted svg {
        position: relative;
        z-index: 2;
        width: 44px;
        height: 44px;
        filter: drop-shadow(0 5px 7px rgba(15, 32, 68, 0.3));
      }

      .report-pin-highlight-pulse,
      .public-pin-highlight-pulse {
        position: absolute;
        inset: 6px;
        z-index: 1;
        border-radius: 50%;
        pointer-events: none;
        animation: reportHighlightPulse 1.55s ease-out infinite;
      }

      @keyframes reportHighlightPulse {
        0% { opacity: 0.74; transform: scale(0.72); }
        72% { opacity: 0.12; transform: scale(1.55); }
        100% { opacity: 0; transform: scale(1.9); }
      }

      @media (prefers-reduced-motion: reduce) {
        .report-pin-highlight-pulse,
        .public-pin-highlight-pulse,
        .resource-highlight-pulse {
          animation: none;
          opacity: 0.16;
        }
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
        background: ${MAP_RESOURCE_TONES.facility};
      }

      .resource-pin.evacuation {
        background: ${MAP_RESOURCE_TONES.evacuation};
      }

      .resource-pin.evacuation.priority {
        box-shadow: 0 0 0 3px ${MAP_RESOURCE_TONES.priorityHalo}, 0 3px 10px rgba(28, 43, 75, 0.28);
      }

      .resource-pin-highlighted {
        width: 58px;
        height: 58px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .resource-pin-highlighted .resource-pin {
        position: relative;
        z-index: 2;
        width: 36px;
        height: 36px;
      }

      .resource-highlight-pulse {
        position: absolute;
        inset: 8px;
        z-index: 1;
        border-radius: 50%;
        pointer-events: none;
        animation: reportHighlightPulse 1.55s ease-out infinite;
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
        background: #D9828A;
        color: #FFFFFF;
        font: 700 13px/34px system-ui, sans-serif;
        border-radius: 50%;
        text-align: center;
      }

      .marker-cluster-report.cluster-medium div {
        background: #C85E69;
      }

      .marker-cluster-report.cluster-high div {
        background: #A93340;
      }

      .marker-cluster-report.cluster-critical div {
        background: #741F2A;
      }

      .public-pin-wrap {
        background: transparent;
        border: 0;
      }

      .public-pin {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .public-pin-triangle {
        position: relative;
        z-index: 2;
        width: 40px;
        height: 40px;
        overflow: visible;
        filter: drop-shadow(0 4px 6px rgba(15, 32, 68, 0.3));
      }

      .public-pin-triangle-highlighted {
        width: 44px;
        height: 44px;
      }

      .public-pin-stack {
        position: absolute;
        z-index: 3;
        top: 0;
        right: 0;
        width: 13px;
        height: 13px;
        border: 2px solid #FFFFFF;
        border-radius: 4px;
        background: #0F2044;
        box-shadow: -3px 3px 0 -1px #FFFFFF, -4px 4px 0 0 #0F2044;
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
    ${hasUnblurredViewport ? '<div id="map-background"></div>' : ''}
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
    <script>
      var backgroundMap = ${hasUnblurredViewport ? `L.map('map-background', {
        center: [${CENTER.lat}, ${CENTER.lng}],
        zoom: ${ZOOM},
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false,
        keyboard: false
      })` : 'null'};

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
      var backgroundDetailedTileLayer = backgroundMap
        ? L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
        : null;

      // This layer retains roads and geography but removes basemap labels and POI icons.
      var cleanTileLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          maxNativeZoom: 16,
          maxZoom: 19
        }
      );
      var backgroundCleanTileLayer = backgroundMap
        ? L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
            { maxNativeZoom: 16, maxZoom: 19 }
          )
        : null;

      var cleanMapMaximumZoom = 16;
      var showDetailsRequested = ${initialShowMapDetails ? 'true' : 'false'};
      var currentBaseLayer = null;
      var currentBackgroundBaseLayer = null;

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

        if (backgroundMap) {
          var nextBackgroundLayer = useDetailedLayer
            ? backgroundDetailedTileLayer
            : backgroundCleanTileLayer;
          if (currentBackgroundBaseLayer !== nextBackgroundLayer) {
            nextBackgroundLayer.addTo(backgroundMap);
            if (currentBackgroundBaseLayer) {
              backgroundMap.removeLayer(currentBackgroundBaseLayer);
            }
            currentBackgroundBaseLayer = nextBackgroundLayer;
          }
        }
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
      if (backgroundMap) {
        var syncBackgroundCamera = function() {
          backgroundMap.setView(map.getCenter(), map.getZoom(), { animate: false });
        };
        map.on('move', syncBackgroundCamera);
        map.on('zoom', syncBackgroundCamera);
      }
      updateBaseLayer();

      function incidentGlyph(incidentType) {
        if (incidentType === 'fire') {
          return '<g transform="translate(0 3)"><path d="M26 15c-1 5-8 7-8 13 0 5 3 8 8 8s8-3 8-8c0-4-2-7-5-10 0 4-1 6-3 8-2-2-3-5 0-11Zm0 18c-2 0-3-1-3-3s1-3 3-5c0 2 3 3 3 5s-1 3-3 3Z" fill="#FFFFFF" fill-rule="evenodd"/></g>';
        }
        if (incidentType === 'flood') {
          return '<g transform="translate(0 3)"><path d="M15 33h22c-2-5-6-8-11-8s-9 3-11 8Zm6-2c1-6 5-10 10-10 3 0 6 2 7 5-2-1-5-1-7 1-3 2-4 4-7 5h-3Z" fill="#FFFFFF"/></g>';
        }
        if (incidentType === 'road_crash') {
          return '<g transform="translate(0 3)"><path d="m19 25 3-7h8l3 7v7h-3v-2h-8v2h-3v-7Zm3-1h8l-1-3h-6l-1 3Zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" fill="#FFFFFF" fill-rule="evenodd"/></g>';
        }
        if (incidentType === 'medical') {
          return '<g transform="translate(0 3)"><path d="M23 16h6v6h6v6h-6v6h-6v-6h-6v-6h6v-6Z" fill="#FFFFFF"/></g>';
        }
        if (incidentType === 'other') {
          return '<circle cx="19" cy="26" r="2.5" fill="#FFFFFF"/><circle cx="26" cy="26" r="2.5" fill="#FFFFFF"/><circle cx="33" cy="26" r="2.5" fill="#FFFFFF"/>';
        }

        // Legacy and missing incident types retain the warning glyph.
        return '<path d="M26 16v13" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/><circle cx="26" cy="35" r="2.4" fill="#FFFFFF"/>';
      }

      function reportPinHtml(statusColor, incidentType) {
        return '<svg viewBox="0 0 52 48" aria-hidden="true">' +
          '<path d="M26 3 49 44H3L26 3Z" fill="' + statusColor + '" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round"/>' +
          incidentGlyph(incidentType) +
        '</svg>';
      }

      function reportPinIcon(statusColor, incidentType) {
        return L.divIcon({
          className: 'report-pin-wrap',
          html: '<div class="report-pin">' + reportPinHtml(statusColor, incidentType) + '</div>',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
          popupAnchor: [0, -24]
        });
      }

      function highlightedReportPinIcon(statusColor, incidentType) {
        return L.divIcon({
          className: 'report-pin-wrap',
          html:
            '<div class="report-pin-highlighted">' +
              '<span class="report-pin-highlight-pulse" style="background:' + statusColor + '"></span>' +
              reportPinHtml(statusColor, incidentType) +
            '</div>',
          iconSize: [50, 50],
          iconAnchor: [25, 25],
          popupAnchor: [0, -28]
        });
      }

      function resourceIcon(kind, isPriority, highlighted) {
        var priorityEvacuation = kind === 'evacuation' && isPriority;
        var extra = priorityEvacuation ? ' priority' : '';
        var markerColor = priorityEvacuation ? '${MAP_RESOURCE_TONES.priority}' : kind === 'facility' ? '${MAP_RESOURCE_TONES.facility}' : '${MAP_RESOURCE_TONES.evacuation}';
        var icon = kind === 'facility'
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" stroke="#FFFFFF" stroke-width="2.7" stroke-linecap="round"/></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18v10H3zM2 10l5-5h10l5 5H2Z" fill="#FFFFFF"/><path d="M8 20v-6h8v6" fill="${MAP_RESOURCE_TONES.evacuation}"/></svg>';
        var markerHtml = '<div class="resource-pin ' + kind + extra + '">' + icon + '</div>';
        if (highlighted) {
          markerHtml = '<div class="resource-pin-highlighted"><span class="resource-highlight-pulse" style="background:' + markerColor + '"></span>' + markerHtml + '</div>';
        }
        return L.divIcon({
          className: 'resource-pin-wrap',
          html: markerHtml,
          iconSize: highlighted ? [58, 58] : [32, 32],
          iconAnchor: highlighted ? [29, 29] : [16, 16]
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
          var depthClass = count >= 20
            ? 'cluster-critical'
            : count >= 10
              ? 'cluster-high'
              : count >= 5
                ? 'cluster-medium'
                : 'cluster-low';
          return L.divIcon({
            html: '<div><span>' + count + '</span></div>',
            className: 'marker-cluster-report ' + depthClass,
            iconSize: L.point(38, 38)
          });
        }
      }).addTo(map);

      var resourceGroup = L.layerGroup().addTo(map);
      var userLocationGroup = L.layerGroup().addTo(map);
      var highlightedReportGroup = L.layerGroup().addTo(map);
      var reportMarkersById = {};
      var highlightedReportId = null;

      window.setHighlightedReport = function(reportId) {
        var previousMarker = highlightedReportId
          ? reportMarkersById[highlightedReportId]
          : null;
        if (previousMarker) {
          highlightedReportGroup.removeLayer(previousMarker);
          previousMarker.setIcon(reportPinIcon(
            previousMarker.options.reportMeta.statusColor,
            previousMarker.options.reportMeta.incidentType
          ));
          previousMarker.setZIndexOffset(0);
          clusterGroup.addLayer(previousMarker);
        }

        highlightedReportId = reportId || null;
        if (!highlightedReportId) {
          clusterGroup.refreshClusters();
          return;
        }

        var nextMarker = reportMarkersById[highlightedReportId];
        if (!nextMarker) return;

        clusterGroup.removeLayer(nextMarker);
        nextMarker.setIcon(
          highlightedReportPinIcon(
            nextMarker.options.reportMeta.statusColor,
            nextMarker.options.reportMeta.incidentType
          )
        );
        nextMarker.setZIndexOffset(1000);
        highlightedReportGroup.addLayer(nextMarker);
        clusterGroup.refreshClusters();
      };

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

      var publicIncidentGroup = L.layerGroup().addTo(map);

      function publicIncidentIcon(lead, count, highlighted) {
        var size = highlighted ? 50 : 44;
        var triangleClass = highlighted
          ? 'public-pin-triangle public-pin-triangle-highlighted'
          : 'public-pin-triangle';
        var html = '<div class="public-pin" style="width:' + size + 'px;height:' + size + 'px">' +
          (highlighted ? '<span class="public-pin-highlight-pulse" style="background:' + lead.color + '"></span>' : '') +
          '<svg class="' + triangleClass + '" viewBox="0 0 52 48" aria-hidden="true">' +
            '<path d="M26 3 49 44H3L26 3Z" fill="' + lead.color + '" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round"/>' +
            incidentGlyph(lead.incidentType) +
          '</svg>' +
          (count > 1 ? '<span class="public-pin-stack" aria-hidden="true"></span>' : '') +
        '</div>';
        return L.divIcon({ className: 'public-pin-wrap', html: html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
      }

      window.setPublicIncidents = function(incidents) {
        publicIncidentGroup.clearLayers();
        // Several incidents can share one rounded public point, so use a stack mark.
        var groups = {};
        var order = [];
        (incidents || []).forEach(function(incident) {
          var point = incident.exactLocation || incident.approximateArea;
          if (!point) return;
          var key = point.latitude.toFixed(5) + ',' + point.longitude.toFixed(5);
          if (!groups[key]) {
            groups[key] = { point: point, items: [] };
            order.push(key);
          }
          groups[key].items.push(incident);
        });
        order.forEach(function(key) {
          var group = groups[key];
          var highlightedItem = group.items.filter(function(item) { return item.highlighted; })[0];
          var lead = highlightedItem || group.items[0];
          var marker = L.marker([group.point.latitude, group.point.longitude], {
            icon: publicIncidentIcon(lead, group.items.length, Boolean(highlightedItem)),
            zIndexOffset: highlightedItem ? 900 : 300,
            keyboard: false
          });
          var tooltip = document.createElement('span');
          tooltip.textContent = group.items.length > 1
            ? group.items.length + ' community reports near this spot · Brgy. ' + lead.barangayName
            : lead.publicLocationMode === 'exact_shared'
              ? 'Exact submitted location shared by the reporter · Brgy. ' + lead.barangayName
            : lead.exactLocation
              ? 'Exact location for safety: ' + lead.exactLocation.reason
              : 'Approximate location · Brgy. ' + lead.barangayName + '. The pin marks the nearby area, not the exact spot.';
          marker.bindTooltip(tooltip, { direction: 'top' });
          marker.on('click', function(event) {
            L.DomEvent.stopPropagation(event);
            if (!window.ReactNativeWebView) return;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'publicIncident',
              incidentCaseId: lead.incidentCaseId,
              reportId: lead.reportId || null,
              reportIds: group.items.map(function(item) { return item.reportId || item.incidentCaseId; })
            }));
          });
          publicIncidentGroup.addLayer(marker);
        });
      };

      window.setReportMarkers = function(markers) {
        var requestedHighlight = highlightedReportId;
        clusterGroup.clearLayers();
        highlightedReportGroup.clearLayers();
        reportMarkersById = {};
        highlightedReportId = null;
        if (!markers || !markers.length) {
          highlightedReportId = requestedHighlight;
          return;
        }

        var bounds = [];
        markers.forEach(function(m) {
          if (typeof m.latitude !== 'number' || typeof m.longitude !== 'number') return;

          var marker = L.marker([m.latitude, m.longitude], {
            icon: reportPinIcon(m.statusColor, m.incidentType),
            reportId: m.id,
            reportMeta: {
              id: m.id,
              createdAt: m.created_at || '',
              statusColor: m.statusColor || '#A9475A',
              incidentType: m.incidentType || null
            }
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

        if (requestedHighlight) {
          window.setHighlightedReport(requestedHighlight);
        }

        if (initialViewFitted || !bounds.length) return;
        initialViewFitted = true;

        if (bounds.length === 1) {
          map.setView(bounds[0], 15, { animate: false });
        } else {
          map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16, animate: false });
        }
      };

      var resourceMarkersData = [];
      var highlightedResourceId = null;
      window.setResourceMarkers = function(resources) {
        resourceMarkersData = resources || [];
        resourceGroup.clearLayers();
        if (!resourceMarkersData.length) return;

        resourceMarkersData.forEach(function(r) {
          if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') return;
          var marker = L.marker([r.latitude, r.longitude], {
            icon: resourceIcon(r.kind, !!r.isPriority, r.id === highlightedResourceId),
            resourceMeta: r
          });
          marker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            postResource(r);
          });
          resourceGroup.addLayer(marker);
        });
      };

      window.setHighlightedResource = function(resourceId) {
        highlightedResourceId = resourceId || null;
        window.setResourceMarkers(resourceMarkersData);
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
      if (window.__pendingPublicIncidents) {
        window.setPublicIncidents(window.__pendingPublicIncidents);
        window.__pendingPublicIncidents = null;
      }
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
      if (window.__pendingHighlightedReportId !== undefined) {
        window.setHighlightedReport(window.__pendingHighlightedReportId);
        window.__pendingHighlightedReportId = undefined;
      }
      if (window.__pendingHighlightedResourceId !== undefined) {
        window.setHighlightedResource(window.__pendingHighlightedResourceId);
        window.__pendingHighlightedResourceId = undefined;
      }
    </script>
  </body>
</html>`;
}

function publicIncidentsToInjectScript(
  incidents: PublicIncident[],
  highlightedIncidentId?: string,
): string {
  const payload = incidents.map((incident) => {
    const tone = publicIncidentTone(incident.publicStatus);
    return {
      incidentCaseId: incident.incidentCaseId,
      reportId: incident.reportId || null,
      publicLocationMode: incident.publicLocationMode,
      incidentType: incident.incidentType,
      barangayName: incident.barangayName,
      approximateArea: incident.approximateArea,
      exactLocation: incident.exactLocation,
      highlighted: (incident.reportId || incident.incidentCaseId) === highlightedIncidentId,
      color: tone.color,
      softColor: tone.softColor,
    };
  });
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  // iOS can deliver onLoadEnd for an intermediate blank page, before Leaflet starts.
  return `(function() {
    var data = ${json};
    if (window.setPublicIncidents) {
      window.setPublicIncidents(data);
    } else {
      window.__pendingPublicIncidents = data;
    }
  })(); true;`;
}

function markersToInjectScript(
  markers: MapReportMarker[],
  showReportDetailsPopup: boolean,
  reportPresentation?: Props['reportPresentation'],
): string {
  const payload = markers.map((m) => ({
    id: m.id,
    latitude: m.latitude,
    longitude: m.longitude,
    created_at: m.created_at,
    statusColor: reportPresentation?.(m)?.color ?? getMapReportPresentation(m).color,
    incidentType: m.incidentType,
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

function highlightedReportToInjectScript(reportId: string | null): string {
  const json = JSON.stringify(reportId).replace(/</g, '\\u003c');
  return `(function() {
    var reportId = ${json};
    if (window.setHighlightedReport) {
      window.setHighlightedReport(reportId);
    } else {
      window.__pendingHighlightedReportId = reportId;
    }
  })(); true;`;
}

function highlightedResourceToInjectScript(resourceId: string | null): string {
  const json = JSON.stringify(resourceId).replace(/</g, '\\u003c');
  return `(function() {
    var resourceId = ${json};
    if (window.setHighlightedResource) {
      window.setHighlightedResource(resourceId);
    } else {
      window.__pendingHighlightedResourceId = resourceId;
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
  highlightedPublicIncidentId,
  publicIncidentFilters,
  publicIncidents = [],
  onPublicIncidentPress,
  reportLayerLabel = 'Reports',
  markers = [],
  reportPresentation,
  facilities = [],
  evacuationCenters = [],
  layerVisibility = DEFAULT_LAYERS,
  showLayerFilters = false,
  collapsibleLayerFilters = false,
  layerPanelVisible,
  onLayerPanelVisibilityChange,
  dismissSearchSignal = 0,
  showReportStatusFilters = false,
  reportStatusOptions = ALL_REPORT_STATUS_FILTERS,
  layerFiltersTopInset = spacing.md,
  compactLayerFilters = false,
  showSearchBar = false,
  showLayerPanelToggle = true,
  layerPanelAlign = 'left',
  showSearchClearButton = true,
  searchBarTopInset = spacing.md,
  userLocation = null,
  onLayerVisibilityChange,
  onReportSelection,
  showReportDetailsPopup = false,
  onReportDetailsRequest,
  onResourceSelection,
  focusTarget,
  highlightedReportId = null,
  highlightedResourceId = null,
  showZoomControls = true,
  showMapDetails = true,
  tone = 'light',
  unblurredViewportFrame,
  onGestureActiveChange,
  focusZoomLevel = 16,
  stickyFocus = false,
}: Props) {
  const { height: viewportHeight, fontScale } = useWindowDimensions();
  const webRef = useRef<CompatibleWebViewHandle>(null);
  const [initialShowMapDetails] = useState(showMapDetails);
  const lastFocusSignatureRef = useRef('');
  // Leaflet supports a wider range, but the app's tile sources are configured for levels 1-19.
  const safeFocusZoomLevel = Math.min(19, Math.max(1, Math.round(focusZoomLevel)));
  const safeViewportTop = Math.min(500, Math.max(0, Math.round(unblurredViewportFrame?.top ?? 0)));
  const safeViewportRight = Math.min(200, Math.max(0, Math.round(unblurredViewportFrame?.right ?? 0)));
  const safeViewportBottom = Math.min(300, Math.max(0, Math.round(unblurredViewportFrame?.bottom ?? 0)));
  const safeViewportLeft = Math.min(200, Math.max(0, Math.round(unblurredViewportFrame?.left ?? 0)));
  const safeViewportRadius = Math.min(80, Math.max(0, Math.round(unblurredViewportFrame?.borderRadius ?? 0)));
  const mapHtmlVersion = MAP_HTML_VERSION;
  const html = useMemo(
    () =>
      buildMapHtml(
        showZoomControls,
        tone,
        initialShowMapDetails,
        stickyFocus,
        safeFocusZoomLevel,
        safeViewportTop,
        safeViewportRight,
        safeViewportBottom,
        safeViewportLeft,
        safeViewportRadius,
        mapHtmlVersion,
      ),
    [
      mapHtmlVersion,
      initialShowMapDetails,
      safeFocusZoomLevel,
      safeViewportBottom,
      safeViewportLeft,
      safeViewportRadius,
      safeViewportRight,
      safeViewportTop,
      showZoomControls,
      stickyFocus,
      tone,
    ],
  );
  const readyRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [uncontrolledLayerPanelVisible, setUncontrolledLayerPanelVisible] =
    useState(showLayerFilters);
  const [reportStatusFilter, setReportStatusFilter] =
    useState<ReportStatusFilter>('all');
  const isLayerPanelVisible = layerPanelVisible ?? uncontrolledLayerPanelVisible;

  const effectiveReportStatusFilter = reportStatusOptions.includes(reportStatusFilter)
    ? reportStatusFilter
    : 'all';

  useEffect(() => {
    // The screen owns navigation focus, while the map keeps its WebView and viewport mounted.
    const animationFrame = requestAnimationFrame(() => {
      setSearchQuery('');
      setSearchFocused(false);
      Keyboard.dismiss();
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [dismissSearchSignal]);

  useEffect(() => {
    lastFocusSignatureRef.current = '';
  }, [html]);

  const visibleReports = useMemo(() => {
    if (!layerVisibility.reports) return [];
    if (effectiveReportStatusFilter === 'all') return markers;
    // Keep a directly requested report visible even when a saved filter excludes it.
    return markers.filter(
      (report) =>
        report.id === highlightedReportId || report.status === effectiveReportStatusFilter,
    );
  }, [effectiveReportStatusFilter, highlightedReportId, layerVisibility.reports, markers]);
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

  const publicIncidentsScript = useMemo(
    () => publicIncidentsToInjectScript(publicIncidents, highlightedPublicIncidentId),
    [publicIncidents, highlightedPublicIncidentId],
  );

  useEffect(() => {
    if (readyRef.current) webRef.current?.injectJavaScript(publicIncidentsScript);
  }, [publicIncidentsScript]);

  useEffect(() => {
    if (!readyRef.current || !webRef.current) return;
    webRef.current.injectJavaScript(
      markersToInjectScript(
        visibleReports,
        showReportDetailsPopup,
        reportPresentation,
      ),
    );
    webRef.current.injectJavaScript(resourcesToInjectScript(visibleResources));
  }, [
    reportPresentation,
    showReportDetailsPopup,
    visibleReports,
    visibleResources,
  ]);

  useEffect(() => {
    if (!readyRef.current || !webRef.current) return;
    webRef.current.injectJavaScript(userLocationToInjectScript(userLocation));
  }, [userLocation]);

  useEffect(() => {
    if (!readyRef.current || !webRef.current) return;
    webRef.current.injectJavaScript(
      highlightedReportToInjectScript(highlightedReportId),
    );
  }, [highlightedReportId]);

  useEffect(() => {
    if (!readyRef.current || !webRef.current) return;
    webRef.current.injectJavaScript(
      highlightedResourceToInjectScript(highlightedResourceId),
    );
  }, [highlightedResourceId]);

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
          incidentCaseId?: string;
          resource?: MapResourceMarker;
        };
        if (data.type === 'publicIncident' && data.incidentCaseId) {
          const groupIds = Array.isArray(data.reportIds)
            ? data.reportIds.filter((id): id is string => typeof id === 'string')
            : [data.reportId || data.incidentCaseId];
          onPublicIncidentPress?.(data.incidentCaseId, groupIds, data.reportId ?? undefined);
          return;
        }
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
    [onGestureActiveChange, onReportSelection, onReportDetailsRequest, onResourceSelection, onPublicIncidentPress],
  );

  function toggleLayer(key: keyof MapLayerVisibility) {
    if (!onLayerVisibilityChange) return;
    onLayerVisibilityChange({
      ...layerVisibility,
      [key]: !layerVisibility[key],
    });
  }

  function setLayerPanelVisibility(visible: boolean) {
    if (layerPanelVisible === undefined) {
      setUncontrolledLayerPanelVisible(visible);
    }
    onLayerPanelVisibilityChange?.(visible);
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

    const incidentResults = publicIncidents.filter((incident) =>
      `${incident.publicTypeLabel} ${incident.barangayName}`.toLocaleLowerCase().includes(normalizedSearchQuery),
    ).slice(0, 4).map((incident) => {
      const location = incident.exactLocation ?? incident.approximateArea;
      return { id: incident.incidentCaseId, kind: 'incident' as const, title: incident.publicTitle ?? incident.publicTypeLabel,
        subtitle: `${incident.publicLocationMode === 'approximate_area' ? 'Approximate location · ' : ''}Brgy. ${incident.barangayName}`,
        latitude: location?.latitude, longitude: location?.longitude,
      };
    });
    return [...incidentResults, ...reportResults, ...resourceResults].slice(0, 6);
  }, [evacuationCenters, facilities, markers, normalizedSearchQuery, publicIncidents]);

  function selectSearchResult(result: (typeof searchResults)[number]) {
    Keyboard.dismiss();
    setSearchFocused(false);
    setSearchQuery(result.title);
    if (result.kind === 'incident') {
      onPublicIncidentPress?.(result.id, [result.id]);
      if (result.latitude != null && result.longitude != null) {
        webRef.current?.injectJavaScript(focusToInjectScript({ latitude: result.latitude, longitude: result.longitude }));
      }
      return;
    }
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
      <CompatibleWebView
        key={MAP_HTML_VERSION}
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
            markersToInjectScript(
              visibleReports,
              showReportDetailsPopup,
              reportPresentation,
            ),
          );
          webRef.current?.injectJavaScript(resourcesToInjectScript(visibleResources));
          webRef.current?.injectJavaScript(publicIncidentsScript);
          webRef.current?.injectJavaScript(userLocationToInjectScript(userLocation));
          webRef.current?.injectJavaScript(mapDetailsToInjectScript(showMapDetails));
          webRef.current?.injectJavaScript(
            highlightedReportToInjectScript(highlightedReportId),
          );
          webRef.current?.injectJavaScript(
            highlightedResourceToInjectScript(highlightedResourceId),
          );
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
            {showSearchClearButton && searchQuery ? (
              <Pressable
                style={mapStyles.searchAction}
                onPress={() => setSearchQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear map search"
              >
                <Ionicons name="close" size={19} color={colors.textMuted} />
              </Pressable>
            ) : null}
            {showLayerPanelToggle ? (
              <Pressable
                style={mapStyles.searchAction}
                onPress={() => {
                  // Keep the filter card clear of any open search suggestions.
                  Keyboard.dismiss();
                  setSearchFocused(false);
                  setLayerPanelVisibility(!isLayerPanelVisible);
                }}
                accessibilityRole="button"
                accessibilityLabel="Show or hide map layers"
                accessibilityState={{ expanded: isLayerPanelVisible }}
              >
                <Ionicons name="options-outline" size={22} color={colors.navigationActive} />
              </Pressable>
            ) : null}
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
                        {result.kind === 'evacuation' ? (
                          <MaterialCommunityIcons name="warehouse" size={17} color={colors.navigationActive} />
                        ) : (
                          <Ionicons
                            name={result.kind === 'incident' ? 'location-outline' : result.kind === 'report' ? 'flag-outline' : 'medical-outline'}
                            size={17}
                            color={colors.navigationActive}
                          />
                        )}
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

      {showLayerFilters && isLayerPanelVisible ? (
        <View
          style={[
            mapStyles.legend,
            compactLayerFilters && mapStyles.legendCompact,
            compactLayerFilters && fontScale > 1.2 && { width: 270, maxWidth: '90%' },
            showSearchBar && mapStyles.legendBelowSearch,
            layerPanelAlign === 'right' && mapStyles.legendRight,
            { top: showSearchBar ? searchBarTopInset + 60 : layerFiltersTopInset },
          ]}
          pointerEvents="box-none"
        >
          <ScrollView style={{ width: '100%', maxHeight: Math.max(180, viewportHeight - (showSearchBar ? searchBarTopInset + 60 : layerFiltersTopInset) - 165) }} contentContainerStyle={{ gap: compactLayerFilters ? 2 : spacing.xs }} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {collapsibleLayerFilters ? (
            <View style={mapStyles.legendHeader}>
              <Text style={mapStyles.legendTitle}>Map filters</Text>
              <Pressable
                style={mapStyles.legendCollapseButton}
                onPress={() => setLayerPanelVisibility(false)}
                accessibilityRole="button"
                accessibilityLabel="Hide map filters"
              >
                <Ionicons name="chevron-up" size={18} color={colors.navigationActive} />
              </Pressable>
            </View>
          ) : null}
          {publicIncidentFilters ? <>
            <Pressable style={[mapStyles.legendRow, compactLayerFilters && mapStyles.legendRowCompact, !publicIncidentFilters.visible && mapStyles.legendRowInactive]}
              onPress={() => publicIncidentFilters.onVisibilityChange(!publicIncidentFilters.visible)} accessibilityRole="switch" accessibilityState={{ checked: publicIncidentFilters.visible }} accessibilityLabel="Community reports layer">
              <Ionicons name="people-outline" size={18} color={colors.navigationActive} />
              <Text style={[mapStyles.legendText, compactLayerFilters && mapStyles.legendTextCompact]}>Community reports</Text>
              <View style={[mapStyles.layerSwitch, publicIncidentFilters.visible && mapStyles.layerSwitchActive]}><View style={[mapStyles.layerSwitchThumb, publicIncidentFilters.visible && mapStyles.layerSwitchThumbActive]} /></View>
            </Pressable>
            {publicIncidentFilters.visible ? <View style={mapStyles.statusFilterWrap}>
              <Text style={mapStyles.statusFilterLabel}>Community status</Text>
              <View style={mapStyles.statusFilterGrid}>{PUBLIC_INCIDENT_STATUS_OPTIONS.map((option) => <Pressable key={option.value}
                style={[mapStyles.statusFilterChip, publicIncidentFilters.status === option.value && mapStyles.statusFilterChipSelected]}
                onPress={() => publicIncidentFilters.onStatusChange(option.value)} accessibilityRole="button" accessibilityState={{ selected: publicIncidentFilters.status === option.value }}>
                {/* The chip dot doubles as the marker color legend. */}
                {option.value !== 'all' ? <View style={[mapStyles.statusFilterDot, { backgroundColor: publicIncidentTone(option.value).color }]} /> : null}
                <Text style={[mapStyles.statusFilterChipText, publicIncidentFilters.status === option.value && mapStyles.statusFilterChipTextSelected]}>{option.label}</Text>
              </Pressable>)}</View>
            </View> : null}
          </> : null}
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
              {reportLayerLabel}
            </Text>
            <View style={[mapStyles.layerSwitch, layerVisibility.reports && mapStyles.layerSwitchActive]}>
              <View style={[mapStyles.layerSwitchThumb, layerVisibility.reports && mapStyles.layerSwitchThumbActive]} />
            </View>
          </Pressable>
          {layerVisibility.reports && showReportStatusFilters ? (
            <View style={mapStyles.statusFilterWrap}>
              <Text style={mapStyles.statusFilterLabel}>Report status</Text>
              <View style={mapStyles.statusFilterGrid}>
            {REPORT_STATUS_OPTIONS.filter((option) =>
              reportStatusOptions.includes(option.value),
            ).map((option) => {
                  const selected = effectiveReportStatusFilter === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[
                        mapStyles.statusFilterChip,
                        selected && mapStyles.statusFilterChipSelected,
                      ]}
                      onPress={() => setReportStatusFilter(option.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Show ${option.label.toLocaleLowerCase()} reports`}
                    >
                      {option.value !== 'all' ? (
                        <View
                          style={[
                            mapStyles.statusFilterDot,
                            { backgroundColor: getMapReportPresentation({ status: option.value }).color },
                          ]}
                        />
                      ) : null}
                      <Text
                        style={[
                          mapStyles.statusFilterChipText,
                          selected && mapStyles.statusFilterChipTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
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
            <MaterialCommunityIcons name="warehouse" size={compactLayerFilters ? 18 : 20} color={colors.navigationActive} />
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
            {publicIncidentFilters ? 'Pins follow report status. Approximate pins mark an area, not the exact location.' : 'Tap a layer to show or hide'}
          </Text>
          {publicIncidentFilters && publicIncidentFilters.unlocatedCount > 0 ? <Pressable onPress={publicIncidentFilters.onOpenUnlocated} accessibilityRole="button" style={mapStyles.legendUnlocated}>
            <Ionicons name="list-outline" size={16} color={colors.navigationActive} /><Text style={mapStyles.legendHint}>{publicIncidentFilters.unlocatedCount} without public map pins</Text>
          </Pressable> : null}
          </ScrollView>
        </View>
      ) : null}

      {showLayerFilters && collapsibleLayerFilters && !isLayerPanelVisible && !showSearchBar && showLayerPanelToggle ? (
        <Pressable
          style={[mapStyles.legendOpenButton, { top: layerFiltersTopInset }]}
          onPress={() => setLayerPanelVisibility(true)}
          accessibilityRole="button"
          accessibilityLabel="Show map filters"
        >
          <Ionicons name="options-outline" size={21} color={colors.navigationActive} />
        </Pressable>
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
    width: 210,
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  // Right-align with the search filter icon, so the collapse chevron sits directly beneath it.
  legendBelowSearch: {
    left: undefined,
    right: 20,
  },
  legendRight: {
    left: undefined,
    right: spacing.md,
  },
  legendHeader: {
    width: '100%',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendTitle: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.navigationActive,
  },
  legendCollapseButton: {
    width: 48,
    height: 48,
    marginTop: -10,
    marginRight: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendOpenButton: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 20,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    shadowColor: '#1C2B4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 7,
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
  statusFilterWrap: {
    width: '100%',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  statusFilterLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  statusFilterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statusFilterChip: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  statusFilterChipSelected: {
    borderColor: colors.navigationActive,
    backgroundColor: colors.navigationActive,
  },
  statusFilterChipText: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.text,
  },
  statusFilterChipTextSelected: {
    color: colors.white,
  },
  statusFilterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.white,
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
  legendUnlocated: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
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
