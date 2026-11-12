import React, { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';

import { officialReportMapMarker } from '../map/officialMapReports';
import { officialLabel } from '../../lib/reportLifecycle';
import InteractiveMap from '../map/InteractiveMap';
import { formatIncidentType } from '../../lib/incidentTypes';
import type { OfficialReportQueueItem } from '../../lib/officialReports';
import {
  getMapReportPresentation,
  getReportStatusPresentation,
  type MapReportMarker,
} from '../../lib/reports';
import { colors } from '../../styles/theme';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';

const REQUESTS_STATUS_COLOR = getReportStatusPresentation('escalated').color;

function formatElapsedLabel(value: string, referenceTime: number): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'NOW';

  const ageMinutes = Math.max(1, Math.floor((referenceTime - timestamp) / 60_000));
  if (ageMinutes < 60) return `${ageMinutes} MIN`;

  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 24) return `${ageHours} HR`;

  const ageDays = Math.floor(ageHours / 24);
  return `${ageDays} DAY${ageDays === 1 ? '' : 'S'}`;
}

function formatTimelineTime(value: string | null): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return date
    .toLocaleTimeString('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(' ', '');
}

function incidentTypeLabel(report: OfficialReportQueueItem): string {
  if (!report.incidentType) return 'Report';

  // Custom "Other" reports use the resident's entered incident name directly.
  if (report.incidentType === 'other') {
    return report.incidentTypeOther?.trim() || 'Other';
  }

  return formatIncidentType(report.incidentType);
}

function reportedPlaceLabel(report: OfficialReportQueueItem): string {
  return (
    report.addressText?.trim() ||
    report.barangayName?.trim() ||
    'Minglanilla'
  );
}

export default function CommandEscalationMap({
  reports,
  onGestureActiveChange,
}: {
  reports: OfficialReportQueueItem[];
  onGestureActiveChange?: (active: boolean) => void;
}) {
  const router = useRouter();
  const escalations = useMemo(
    () => reports.filter((report) => ['support_requested', 'transfer_requested'].includes(report.lifecycleFacts.coordination ?? '')),
    [reports],
  );
  const markers = useMemo(
    () => escalations
      .map(officialReportMapMarker)
      .filter((marker): marker is MapReportMarker => marker !== null),
    [escalations],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [referenceTime, setReferenceTime] = useState(() => Date.now());
  const maximumActiveIndex = Math.max(0, escalations.length - 1);
  const safeActiveIndex = Math.min(activeIndex, maximumActiveIndex);
  const activeReport = escalations[safeActiveIndex] ?? null;
  const activeReportPresentation = activeReport ? getMapReportPresentation(activeReport) : null;
  const activeIncidentType = activeReport ? incidentTypeLabel(activeReport) : 'Report';
  const activeIncidentPlace = activeReport
    ? reportedPlaceLabel(activeReport)
    : 'Minglanilla';

  useEffect(() => {
    const elapsedTimer = setInterval(() => setReferenceTime(Date.now()), 60_000);
    return () => clearInterval(elapsedTimer);
  }, []);

  const focusTarget = activeReport?.latitude != null && activeReport.longitude != null
    ? {
        reportId: activeReport.id,
        latitude: activeReport.latitude,
        longitude: activeReport.longitude,
      }
    : null;

  function move(direction: -1 | 1) {
    if (escalations.length < 2) return;
    setActiveIndex(
      (currentIndex) =>
        (currentIndex + direction + escalations.length) % escalations.length,
    );
  }

  return (
    <View style={styles.commandHero}>
      <View style={styles.mapHero}>
        <View collapsable={false} style={styles.mapFill}>
          <InteractiveMap
            markers={markers}
            facilities={[]}
            evacuationCenters={[]}
            showZoomControls={false}
            focusZoomLevel={15}
            stickyFocus
            focusTarget={focusTarget}
            highlightedReportId={activeReport?.id ?? null}
            onGestureActiveChange={onGestureActiveChange}
            onReportSelection={(reportIds) => {
              const selectedIndex = escalations.findIndex((report) =>
                reportIds.includes(report.id),
              );
              if (selectedIndex >= 0) setActiveIndex(selectedIndex);
            }}
          />
        </View>

        <TouchableOpacity
          style={styles.mapEscalationBadge}
          onPress={() => router.push('/official/incidents?queue=incoming_requests' as Href)}
          accessibilityRole="button"
          accessibilityLabel={`View ${escalations.length} incoming requests`}
        >
          <View
            style={[
              styles.mapEscalationDot,
              { backgroundColor: REQUESTS_STATUS_COLOR },
            ]}
          />
          <Text
            style={[
              styles.mapEscalationBadgeText,
              { color: REQUESTS_STATUS_COLOR },
            ]}
          >
            {escalations.length} REQUESTS
          </Text>
          <Ionicons name="chevron-forward" size={15} color={colors.text} />
        </TouchableOpacity>

        {escalations.length > 0 ? (
          <View style={styles.mapPager}>
            <TouchableOpacity
              style={styles.mapPagerButton}
              onPress={() => move(-1)}
              disabled={escalations.length < 2}
              accessibilityLabel="Previous request"
            >
              <Ionicons name="chevron-back" size={17} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.mapPagerText}>{safeActiveIndex + 1} of {escalations.length}</Text>
            <TouchableOpacity
              style={styles.mapPagerButton}
              onPress={() => move(1)}
              disabled={escalations.length < 2}
              accessibilityLabel="Next request"
            >
              <Ionicons name="chevron-forward" size={17} color={colors.text} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {activeReport ? (
        <View style={styles.activeIncidentCard}>
          <View style={styles.activeIncidentTopRow}>
            <View style={styles.activeIncidentCopy}>
              <Text style={[styles.activeIncidentEyebrow, { color: activeReportPresentation?.color }]}>
                REQUESTS · {formatElapsedLabel(
                  activeReport.escalatedAt || activeReport.createdAt,
                  referenceTime,
                )}
              </Text>
              <Text style={styles.activeIncidentTitle}>
                {activeIncidentType} • {activeIncidentPlace}
              </Text>
              <Text style={styles.activeIncidentMeta}>
                Minglanilla • {activeReport.mediaCount} media
              </Text>
            </View>
            <TouchableOpacity
              style={styles.openIncidentAction}
              onPress={() => router.push(`/official/${activeReport.id}` as Href)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${activeIncidentType} incident at ${activeIncidentPlace}`}
            >
              <View style={styles.openIncidentCircle}>
                <Ionicons name="arrow-forward" size={19} color={colors.white} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.activeIncidentQuote, { backgroundColor: activeReportPresentation?.backgroundColor }]}>
            <View style={[styles.activeIncidentQuoteAccent, { backgroundColor: activeReportPresentation?.color }]} />
            <Text style={[styles.activeIncidentQuoteMark, { color: activeReportPresentation?.color }]}>“</Text>
            <View style={styles.activeIncidentQuoteCopy}>
              <Text style={styles.activeIncidentQuoteText}>
                {activeReport.escalationNote?.trim() ||
                  'Open the incident to review the request and current lead office.'}
              </Text>
              <Text style={styles.activeIncidentQuoteSource} numberOfLines={1}>
                {activeReport.barangayName
                  ? `${activeReport.barangayName} BDRRMO`
                  : activeReport.reporterName}
                {' · '}
                {formatTimelineTime(activeReport.escalatedAt || activeReport.createdAt)}
              </Text>
            </View>
          </View>

          <Text style={styles.activeIncidentMeta}>
            {officialLabel(activeReport.lifecycle, { claimedByName: activeReport.lifecycleFacts.reviewClaimedByName, claimedAt: activeReport.lifecycleFacts.reviewClaimedAt })}
          </Text>
          <Text style={styles.activeIncidentMeta}>The barangay keeps the lead until a transfer is accepted.</Text>
        </View>
      ) : (
        <View style={styles.activeIncidentEmpty}>
          <View style={styles.activeIncidentEmptyIcon}>
            <Ionicons name="checkmark-circle-outline" size={31} color={colors.navigationActive} />
          </View>
          <Text style={styles.activeIncidentEmptyTitle}>No incoming requests</Text>
          <Text style={styles.activeIncidentEmptyBody}>
            Support and transfer requests will appear here.
          </Text>
        </View>
      )}
    </View>
  );
}
