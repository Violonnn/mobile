import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAccessibilityLayout } from '../../hooks/useAccessibilityLayout';
import { formatPublishedAt } from '../../lib/formatTime';
import type { GpsPosition } from '../../lib/location';
import {
  publicIncidentHasMapLocation,
  publicIncidentLifecycle,
  publicIncidentBarangayLabel,
  publicIncidentTone,
  type PublicIncident,
} from '../../lib/publicIncidents';
import { PublicIncidentTags } from '../report/PublicIncidentPost';
import { homeStyles as styles } from '../../styles/screens/home.styles';
import { colors, fonts, fontSizes, spacing } from '../../styles/theme';
import InteractiveMap from '../map/InteractiveMap';
import {
  publicIncidentCaption,
  publicIncidentLatestUpdate,
  publicIncidentTitle,
} from '../report/PublicIncidentPost';
import ReportStatusTimeline from '../report/ReportStatusTimeline';

type NearbyReportsPanelProps = {
  incidents: PublicIncident[];
  loading: boolean;
  error: string | null;
  userLocation: GpsPosition | null;
  onOpenIncident: (incidentCaseId: string, reportId?: string) => void;
  onRetry: () => void;
};

function publicIncidentSelectionKey(incident: PublicIncident): string {
  return incident.reportId ?? incident.incidentCaseId;
}

export default function NearbyReportsPanel({ incidents, loading, error, userLocation, onOpenIncident, onRetry }: NearbyReportsPanelProps) {
  const { isLargeText } = useAccessibilityLayout();
  const [selectedIncidentKey, setSelectedIncidentKey] = useState<string | null>(null);
  // Report posts need reporter and official exact-location approval. Legacy
  // incidents can also use their separately approved safety location mode.
  const mapIncidents = incidents.filter((incident) =>
    publicIncidentHasMapLocation(incident),
  );
  const selectedIncidentIndex = selectedIncidentKey
    ? mapIncidents.findIndex((incident) => publicIncidentSelectionKey(incident) === selectedIncidentKey)
    : -1;
  const safeActiveIndex = selectedIncidentIndex >= 0 ? selectedIncidentIndex : 0;
  const activeIncident = mapIncidents[safeActiveIndex] ?? null;
  const selectedIncident = mapIncidents[safeActiveIndex] ?? null;
  const lifecycle = activeIncident ? publicIncidentLifecycle(activeIncident.publicStatus) : null;
  const activeTone = activeIncident ? publicIncidentTone(activeIncident.publicStatus) : null;
  const activeColor = activeTone?.color ?? colors.primary;
  // The report caption is the highlight. Official text stays on the secondary row.
  const latestUpdate = activeIncident ? publicIncidentLatestUpdate(activeIncident) : null;
  const selectedIncidentLocation = selectedIncident?.exactLocation ?? selectedIncident?.approximateArea;
  const focusTarget = selectedIncident && selectedIncidentLocation
    ? {
        reportId: publicIncidentSelectionKey(selectedIncident),
        latitude: selectedIncidentLocation.latitude,
        longitude: selectedIncidentLocation.longitude,
      }
    : userLocation;

  useEffect(() => {
    if (!selectedIncidentKey || selectedIncidentIndex >= 0) return;
    setSelectedIncidentKey(null);
  }, [selectedIncidentIndex, selectedIncidentKey]);

  function move(direction: -1 | 1) {
    if (mapIncidents.length < 2) return;
    const nextIndex = (safeActiveIndex + direction + mapIncidents.length) % mapIncidents.length;
    setSelectedIncidentKey(publicIncidentSelectionKey(mapIncidents[nextIndex]));
  }

  function openActiveIncident() {
    if (!activeIncident) return;
    setSelectedIncidentKey(publicIncidentSelectionKey(activeIncident));
    onOpenIncident(activeIncident.incidentCaseId, activeIncident.reportId);
  }

  const updatedAt = activeIncident?.lastPublicUpdateAt ?? activeIncident?.confirmedAt;

  return (
    <View style={styles.nearbyReportsPanel}>
      <View style={styles.nearbyMapHero}>
        <View collapsable={false} style={styles.nearbyMapFill}>
          <InteractiveMap
            publicIncidents={mapIncidents}
            highlightedPublicIncidentId={selectedIncident ? publicIncidentSelectionKey(selectedIncident) : undefined}
            userLocation={userLocation}
            showUserLocationMarker={false}
            mapGesturesEnabled={false}
            showZoomControls={false}
            focusZoomLevel={15}
            stickyFocus
            focusTarget={focusTarget}
            onPublicIncidentPress={(incidentCaseId: string, _groupIds: string[], reportId?: string) => {
              const selectedIndex = mapIncidents.findIndex((incident) => reportId
                ? incident.reportId === reportId
                : incident.incidentCaseId === incidentCaseId);
              if (selectedIndex >= 0) {
                setSelectedIncidentKey(publicIncidentSelectionKey(mapIncidents[selectedIndex]));
              }
            }}
          />
        </View>
        {mapIncidents.length > 0 ? (
          <View style={styles.nearbyMapCountBadge} accessibilityLabel={`${mapIncidents.length} nearby community reports`}>
            <View style={[styles.nearbyMapCountDot, { backgroundColor: activeColor }]} />
            <Text style={[styles.nearbyMapCountText, { color: activeColor }]}>{mapIncidents.length} NEARBY</Text>
          </View>
        ) : null}
        {mapIncidents.length > 0 ? (
          <View style={styles.nearbyMapPager}>
            <TouchableOpacity style={styles.nearbyMapPagerButton} onPress={() => move(-1)} disabled={mapIncidents.length < 2} accessibilityRole="button" accessibilityLabel="Previous nearby report">
              <Ionicons name="chevron-back" size={17} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.nearbyMapPagerText}>{safeActiveIndex + 1} of {mapIncidents.length}</Text>
            <TouchableOpacity style={styles.nearbyMapPagerButton} onPress={() => move(1)} disabled={mapIncidents.length < 2} accessibilityRole="button" accessibilityLabel="Next nearby report">
              <Ionicons name="chevron-forward" size={17} color={colors.text} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      {activeIncident ? (
        <View style={styles.nearbyActiveReportCard}>
          <View style={[styles.nearbyActiveReportTopRow, isLargeText && styles.nearbyActiveReportTopRowLargeText]}>
            <View style={styles.nearbyActiveReportCopy}>
              <Text style={styles.nearbyActiveReportTitle}>
                {publicIncidentTitle(activeIncident)}
                <Text style={styles.nearbyActiveReportMeta}>
                  {' · '}{publicIncidentBarangayLabel(activeIncident)}
                </Text>
              </Text>
              <PublicIncidentTags incident={activeIncident} />
            </View>
            <TouchableOpacity style={styles.nearbyOpenReportAction} onPress={openActiveIncident} accessibilityRole="button" accessibilityLabel={`Open ${publicIncidentTitle(activeIncident)} report`}>
              <Ionicons name="arrow-forward" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={[styles.nearbyActiveReportQuote, { backgroundColor: activeTone?.softColor ?? colors.primaryLight }]}>
            <View style={[styles.nearbyActiveReportQuoteAccent, { backgroundColor: activeColor }]} />
            <Text style={[styles.nearbyActiveReportQuoteMark, { color: activeColor }]}>{'\u201C'}</Text>
            <View style={styles.nearbyActiveReportQuoteCopy}>
              <Text style={styles.nearbyActiveReportQuoteText} numberOfLines={4}>
                {publicIncidentCaption(activeIncident)}
              </Text>
              {activeIncident.publicLandmark ? (
                <Text style={styles.nearbyActiveReportQuoteSource} numberOfLines={1}>Near {activeIncident.publicLandmark}</Text>
              ) : null}
              <Text style={styles.nearbyActiveReportQuoteSource}>
                {activeIncident.reportId
                  ? activeIncident.reporterName ?? 'Anonymous resident'
                  : 'Official incident summary'}
                {updatedAt ? ` · ${formatPublishedAt(activeIncident.confirmedAt ?? updatedAt)}` : ''}
              </Text>
            </View>
          </View>
          {latestUpdate ? (
            <View style={panelStyles.updateRow}>
              <Ionicons name={latestUpdate.label === 'Correction' ? 'alert-circle-outline' : 'megaphone-outline'} size={15} color={activeColor} />
              <Text style={panelStyles.updateText} numberOfLines={1}>
                <Text style={[panelStyles.updateLabel, { color: activeColor }]}>{latestUpdate.label}: </Text>
                {latestUpdate.text}
              </Text>
            </View>
          ) : null}
          {lifecycle ? <ReportStatusTimeline lifecycle={lifecycle} audience="public" useStatusProgressColors /> : null}
          {error ? <TouchableOpacity onPress={onRetry} accessibilityRole="button"><Text accessibilityRole="alert" style={styles.nearbyReportsStateText}>{error} · Retry</Text></TouchableOpacity> : null}
        </View>
      ) : (
        <View style={styles.nearbyReportsState}>
          {loading ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="map-outline" size={28} color={colors.textMuted} />}
          <Text style={styles.nearbyReportsStateTitle}>{loading ? 'Finding nearby reports' : error ? 'Nearby reports unavailable' : 'No nearby reports'}</Text>
          <Text style={styles.nearbyReportsStateText}>{error ?? 'Active community reports near your location appear here.'}</Text>
          {error ? <TouchableOpacity style={styles.nearbyReportsRetryButton} onPress={onRetry} accessibilityRole="button"><Text style={styles.nearbyReportsRetryText}>Try again</Text></TouchableOpacity> : null}
        </View>
      )}
    </View>
  );
}

const panelStyles = StyleSheet.create({
  updateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  updateText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  updateLabel: {
    fontFamily: fonts.semibold,
  },
});
