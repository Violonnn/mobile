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
  reportId: string;
  latitude: number;
  longitude: number;
};

type Props = {
  markers?: MapReportMarker[];
  facilities?: MapResourceMarker[];
  evacuationCenters?: MapResourceMarker[];
  layerVisibility?: MapLayerVisibility;
  showLayerFilters?: boolean;
  onLayerVisibilityChange?: (next: MapLayerVisibility) => void;
  onReportSelection?: (reportIds: string[]) => void;
  /** Used by the home preview: opens a marker popup with a details action. */
  showReportDetailsPopup?: boolean;
  onReportDetailsRequest?: (reportId: string) => void;
  onResourceSelection?: (resource: MapResourceMarker) => void;
  focusTarget?: MapFocusTarget | null;
  showZoomControls?: boolean;
};

const DEFAULT_LAYERS: MapLayerVisibility = {
  reports: true,
  facilities: true,
  evacuationCenters: true,
};

function buildMapHtml(showZoomControls: boolean): string {
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
            html: '<div><span>' + count + '</span></div>',
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
        button.textContent = 'See details';
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

export default function InteractiveMap({
  markers = [],
  facilities = [],
  evacuationCenters = [],
  layerVisibility = DEFAULT_LAYERS,
  showLayerFilters = false,
  onLayerVisibilityChange,
  onReportSelection,
  showReportDetailsPopup = false,
  onReportDetailsRequest,
  onResourceSelection,
  focusTarget,
  showZoomControls = true,
}: Props) {
  const webRef = useRef<WebView>(null);
  const html = useMemo(() => buildMapHtml(showZoomControls), [showZoomControls]);
  const readyRef = useRef(false);

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
    webRef.current.injectJavaScript(focusToInjectScript(focusTarget));
  }, [focusTarget]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string;
          reportIds?: string[];
          reportId?: string;
          resource?: MapResourceMarker;
        };
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
    [onReportSelection, onReportDetailsRequest, onResourceSelection],
  );

  function toggleLayer(key: keyof MapLayerVisibility) {
    if (!onLayerVisibilityChange) return;
    onLayerVisibilityChange({
      ...layerVisibility,
      [key]: !layerVisibility[key],
    });
  }

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
          webRef.current?.injectJavaScript(
            markersToInjectScript(visibleReports, showReportDetailsPopup),
          );
          webRef.current?.injectJavaScript(resourcesToInjectScript(visibleResources));
          if (focusTarget) {
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
        <View style={mapStyles.legend} pointerEvents="box-none">
          <Pressable
            style={[
              mapStyles.legendChip,
              layerVisibility.reports && mapStyles.legendChipActive,
            ]}
            onPress={() => toggleLayer('reports')}
            accessibilityRole="button"
            accessibilityLabel="Toggle reports layer"
          >
            <View style={[mapStyles.legendDot, { backgroundColor: '#F04444' }]} />
            <Text style={mapStyles.legendText}>Reports</Text>
          </Pressable>
          <Pressable
            style={[
              mapStyles.legendChip,
              layerVisibility.facilities && mapStyles.legendChipActive,
            ]}
            onPress={() => toggleLayer('facilities')}
            accessibilityRole="button"
            accessibilityLabel="Toggle facilities layer"
          >
            <View style={[mapStyles.legendDot, { backgroundColor: '#1A56DB' }]} />
            <Text style={mapStyles.legendText}>Facilities</Text>
          </Pressable>
          <Pressable
            style={[
              mapStyles.legendChip,
              layerVisibility.evacuationCenters && mapStyles.legendChipActive,
            ]}
            onPress={() => toggleLayer('evacuationCenters')}
            accessibilityRole="button"
            accessibilityLabel="Toggle evacuation centers layer"
          >
            <View style={[mapStyles.legendDot, { backgroundColor: '#16A34A' }]} />
            <Text style={mapStyles.legendText}>Evac</Text>
          </Pressable>
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
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(28, 43, 75, 0.08)',
    opacity: 0.55,
  },
  legendChipActive: {
    opacity: 1,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.text,
  },
});
