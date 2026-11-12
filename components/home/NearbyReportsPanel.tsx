import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAccessibilityLayout } from '../../hooks/useAccessibilityLayout';
import { formatPublishedAt } from '../../lib/formatTime';
import { incidentTypeTone } from '../../lib/incidentTypes';
import type { GpsPosition } from '../../lib/location';
import {
  publicIncidentLifecycle,
  publicIncidentBarangayLabel,
  publicIncidentStatusLabel,
  publicIncidentTone,
  type PublicIncident,
} from '../../lib/publicIncidents';
import { homeStyles as styles } from '../../styles/screens/home.styles';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
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
  onGestureActiveChange: (active: boolean) => void;
};

export default function NearbyReportsPanel({ incidents, loading, error, userLocation, onOpenIncident, onRetry, onGestureActiveChange }: NearbyReportsPanelProps) {
  const { isLargeText } = useAccessibilityLayout();
  const [activeIndex, setActiveIndex] = useState(0);
  const [referenceTime, setReferenceTime] = useState(() => Date.now());
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, incidents.length - 1));
  const activeIncident = incidents[safeActiveIndex] ?? null;
  const lifecycle = activeIncident ? publicIncidentLifecycle(activeIncident.publicStatus) : null;
  const activeTone = activeIncident ? publicIncidentTone(activeIncident.publicStatus) : null;
  const activeColor = activeTone?.color ?? colors.primary;
  const typeTone = incidentTypeTone(activeIncident?.incidentType);
  // The report caption is the highlight. Official text stays on the secondary row.
  const latestUpdate = activeIncident ? publicIncidentLatestUpdate(activeIncident) : null;
  const activeLocation = activeIncident?.exactLocation ?? activeIncident?.approximateArea;
  const focusTarget = activeLocation ?? userLocation;

  useEffect(() => {
    const timer = setInterval(() => setReferenceTime(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  function move(direction: -1 | 1) {
    if (incidents.length < 2) return;
    setActiveIndex((current) => (current + direction + incidents.length) % incidents.length);
  }

  const updatedAt = activeIncident?.lastPublicUpdateAt ?? activeIncident?.confirmedAt;
  const ageMinutes = updatedAt ? Math.max(1, Math.floor((referenceTime - Date.parse(updatedAt)) / 60_000)) : null;
  const elapsed = ageMinutes == null || !Number.isFinite(ageMinutes) ? ''
    : ageMinutes < 60 ? `${ageMinutes} MIN` : ageMinutes < 1440 ? `${Math.floor(ageMinutes / 60)} HR` : `${Math.floor(ageMinutes / 1440)} DAY`;

  return (
    <View style={styles.nearbyReportsPanel}>
      <View style={styles.nearbyMapHero}>
        <View collapsable={false} style={styles.nearbyMapFill}>
          <InteractiveMap
            publicIncidents={incidents}
            highlightedPublicIncidentId={activeIncident?.reportId ?? activeIncident?.incidentCaseId}
            userLocation={userLocation}
            showZoomControls={false}
            focusZoomLevel={15}
            stickyFocus
            focusTarget={focusTarget}
            onGestureActiveChange={onGestureActiveChange}
            onPublicIncidentPress={(incidentCaseId: string, _groupIds: string[], reportId?: string) => {
              const selectedIndex = incidents.findIndex((incident) => reportId
                ? incident.reportId === reportId
                : incident.incidentCaseId === incidentCaseId);
              if (selectedIndex >= 0) setActiveIndex(selectedIndex);
            }}
          />
        </View>
        <View style={styles.nearbyMapCountBadge} accessibilityLabel={`${incidents.length} nearby community reports`}>
          <View style={[styles.nearbyMapCountDot, { backgroundColor: activeColor }]} />
          <Text style={[styles.nearbyMapCountText, { color: activeColor }]}>{incidents.length} NEARBY</Text>
        </View>
        {incidents.length > 0 ? (
          <View style={styles.nearbyMapPager}>
            <TouchableOpacity style={styles.nearbyMapPagerButton} onPress={() => move(-1)} disabled={incidents.length < 2} accessibilityRole="button" accessibilityLabel="Previous nearby report">
              <Ionicons name="chevron-back" size={17} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.nearbyMapPagerText}>{safeActiveIndex + 1} of {incidents.length}</Text>
            <TouchableOpacity style={styles.nearbyMapPagerButton} onPress={() => move(1)} disabled={incidents.length < 2} accessibilityRole="button" accessibilityLabel="Next nearby report">
              <Ionicons name="chevron-forward" size={17} color={colors.text} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      {activeIncident ? (
        <View style={styles.nearbyActiveReportCard}>
          <View style={[styles.nearbyActiveReportTopRow, isLargeText && styles.nearbyActiveReportTopRowLargeText]}>
            <View style={styles.nearbyActiveReportCopy}>
              <Text style={[styles.nearbyActiveReportEyebrow, { color: activeColor }]}>
                {publicIncidentStatusLabel(activeIncident.publicStatus).toLocaleUpperCase()}{elapsed ? ` · ${elapsed}` : ''}
              </Text>
              <Text style={styles.nearbyActiveReportTitle} numberOfLines={2}>{publicIncidentTitle(activeIncident)}</Text>
              <View style={panelStyles.metaRow}>
                <View style={[panelStyles.typeChip, { backgroundColor: typeTone.softColor }]}>
                  <Ionicons name={typeTone.icon} size={12} color={typeTone.color} />
                  <Text numberOfLines={2} ellipsizeMode="tail" style={[panelStyles.typeChipText, { color: typeTone.color }]}>{activeIncident.publicTypeLabel}</Text>
                </View>
                <Text style={[styles.nearbyActiveReportMeta, panelStyles.metaText]} numberOfLines={1}>{publicIncidentBarangayLabel(activeIncident)}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.nearbyOpenReportAction} onPress={() => onOpenIncident(activeIncident.incidentCaseId, activeIncident.reportId)} accessibilityRole="button" accessibilityLabel={`Open ${publicIncidentTitle(activeIncident)} report`}>
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
                  : 'Official incident summary'} · Brgy. {activeIncident.barangayName}
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
          {loading ? <ActivityIndicator color={colors.primary} /> : <Ionicons name={error ? 'location-outline' : 'checkmark-circle-outline'} size={28} color={colors.primary} />}
          <Text style={styles.nearbyReportsStateTitle}>{loading ? 'Finding nearby reports' : error ? 'Nearby reports unavailable' : 'No nearby reports'}</Text>
          <Text style={styles.nearbyReportsStateText}>{error ?? 'Active community reports near your location appear here. Open report details to check whether its public location is exact or approximate.'}</Text>
          {error ? <TouchableOpacity style={styles.nearbyReportsRetryButton} onPress={onRetry} accessibilityRole="button"><Text style={styles.nearbyReportsRetryText}>Try again</Text></TouchableOpacity> : null}
        </View>
      )}
    </View>
  );
}

const panelStyles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  metaText: {
    flexShrink: 1,
  },
  typeChip: {
    maxWidth: '100%',
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  typeChipText: {
    minWidth: 0,
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
  },
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
