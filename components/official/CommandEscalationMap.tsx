import React, { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';

import InteractiveMap from '../map/InteractiveMap';
import { formatIncidentType } from '../../lib/incidentTypes';
import type { OfficialReportQueueItem } from '../../lib/officialReports';
import {
  getReportStatusPresentation,
  type MapReportMarker,
} from '../../lib/reports';
import { colors } from '../../styles/theme';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';

const ESCALATED_STATUS_COLOR = getReportStatusPresentation('escalated').color;

function asMapMarker(report: OfficialReportQueueItem): MapReportMarker | null {
  if (report.latitude == null || report.longitude == null) return null;

  return {
    id: report.id,
    title: report.title,
    description: report.description,
    incidentType: report.incidentType,
    incidentTypeOther: report.incidentTypeOther,
    status: report.status,
    latitude: report.latitude,
    longitude: report.longitude,
    addressText: report.addressText,
    barangay_id: report.barangayId,
    created_at: report.createdAt,
    reporter: report.reporter,
    media: report.media,
    mediaError: report.mediaError,
    upvoteCount: report.upvoteCount,
    commentCount: report.commentCount,
  };
}

function formatElapsedLabel(value: string, referenceTime: number): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'NOW';

  const ageMinutes = Math.max(1, Math.floor((referenceTime - timestamp) / 60_000));
  if (ageMinutes < 60) return `${ageMinutes} MIN`;

  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 24) return `${ageHours} HR`;

  return `${Math.floor(ageHours / 24)} DAY`;
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
    () => reports.filter((report) => report.status === 'escalated'),
    [reports],
  );
  const markers = useMemo(
    () => escalations
      .map(asMapMarker)
      .filter((marker): marker is MapReportMarker => marker !== null),
    [escalations],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [referenceTime, setReferenceTime] = useState(() => Date.now());
  const maximumActiveIndex = Math.max(0, escalations.length - 1);
  const safeActiveIndex = Math.min(activeIndex, maximumActiveIndex);
  const activeReport = escalations[safeActiveIndex] ?? null;
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
          onPress={() => router.push('/official/incidents?status=escalated' as Href)}
          accessibilityRole="button"
          accessibilityLabel={`View ${escalations.length} escalated reports`}
        >
          <View
            style={[
              styles.mapEscalationDot,
              { backgroundColor: ESCALATED_STATUS_COLOR },
            ]}
          />
          <Text
            style={[
              styles.mapEscalationBadgeText,
              { color: ESCALATED_STATUS_COLOR },
            ]}
          >
            {escalations.length} ESCALATED
          </Text>
          <Ionicons name="chevron-forward" size={15} color={colors.text} />
        </TouchableOpacity>

        {escalations.length > 0 ? (
          <View style={styles.mapPager}>
            <TouchableOpacity
              style={styles.mapPagerButton}
              onPress={() => move(-1)}
              disabled={escalations.length < 2}
              accessibilityLabel="Previous escalation"
            >
              <Ionicons name="chevron-back" size={17} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.mapPagerText}>{safeActiveIndex + 1} of {escalations.length}</Text>
            <TouchableOpacity
              style={styles.mapPagerButton}
              onPress={() => move(1)}
              disabled={escalations.length < 2}
              accessibilityLabel="Next escalation"
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
              <Text style={styles.activeIncidentEyebrow}>
                ESCALATED · {formatElapsedLabel(
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
              <Text style={styles.openIncidentLabel}>Open incident</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activeIncidentQuote}>
            <View style={styles.activeIncidentQuoteAccent} />
            <Text style={styles.activeIncidentQuoteMark}>“</Text>
            <View style={styles.activeIncidentQuoteCopy}>
              <Text style={styles.activeIncidentQuoteText}>
                {activeReport.escalationNote?.trim() ||
                  'No escalation message was provided.'}
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

          <View style={styles.incidentTimeline}>
            <View style={styles.incidentTimelineLine} />
            {[
              {
                label: 'Reported by',
                name: activeReport.reporterName,
                complete: true,
              },
              {
                label: 'Verified by',
                name: activeReport.verifiedByName ?? 'Name unavailable',
                complete: Boolean(activeReport.verifiedAt),
              },
              {
                label: 'Escalated by',
                name: activeReport.escalatedByName ?? 'Name unavailable',
                complete: Boolean(activeReport.escalatedAt),
                current: true,
              },
            ].map((step) => (
              <View key={step.label} style={styles.incidentTimelineStep}>
                <View
                  style={[
                    styles.incidentTimelineDot,
                    step.current && styles.incidentTimelineDotCurrent,
                    !step.complete && styles.incidentTimelineDotPending,
                  ]}
                >
                  <Ionicons
                    name={
                      step.label === 'Reported by'
                        ? 'time-outline'
                        : step.label === 'Verified by'
                          ? 'location-outline'
                          : 'document-text-outline'
                    }
                    size={13}
                    color={colors.white}
                  />
                </View>
                <Text style={styles.incidentTimelineLabel}>{step.label}</Text>
                <Text style={styles.incidentTimelineName} numberOfLines={2}>
                  {step.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.activeIncidentEmpty}>
          <View style={styles.activeIncidentEmptyIcon}>
            <Ionicons name="checkmark-circle-outline" size={31} color={colors.navigationActive} />
          </View>
          <Text style={styles.activeIncidentEmptyTitle}>No active escalations</Text>
          <Text style={styles.activeIncidentEmptyBody}>
            Escalated municipal reports will appear here.
          </Text>
        </View>
      )}
    </View>
  );
}
