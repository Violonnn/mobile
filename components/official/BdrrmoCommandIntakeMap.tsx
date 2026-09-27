import React, { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';

import InteractiveMap from '../map/InteractiveMap';
import { formatIncidentType } from '../../lib/incidentTypes';
import type { OfficialReportQueueItem, ReportStatus } from '../../lib/officialReports';
import type { MapReportMarker } from '../../lib/reports';
import { colors } from '../../styles/theme';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';

type LocalResponseStatus = Extract<ReportStatus, 'unverified' | 'verified'>;

const LOCAL_RESPONSE_STATES: {
  status: LocalResponseStatus;
  label: string;
  color: string;
}[] = [
  { status: 'unverified', label: 'Unverified', color: colors.unverified },
  { status: 'verified', label: 'Verified', color: colors.success },
];

function hasValidLocation(report: OfficialReportQueueItem): boolean {
  return (
    Number.isFinite(report.latitude) &&
    Number.isFinite(report.longitude) &&
    !(report.latitude === 0 && report.longitude === 0)
  );
}

function asMapMarker(report: OfficialReportQueueItem): MapReportMarker | null {
  if (!hasValidLocation(report)) return null;

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

function elapsedLabel(value: string, referenceTime: number): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'NOW';

  const minutes = Math.max(1, Math.floor((referenceTime - timestamp) / 60_000));
  if (minutes < 60) return `${minutes} MIN`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} HR`;

  return `${Math.floor(hours / 24)} DAY`;
}

function incidentTypeLabel(report: OfficialReportQueueItem): string {
  if (!report.incidentType) return 'Report';
  if (report.incidentType === 'other') return report.incidentTypeOther?.trim() || 'Other';
  return formatIncidentType(report.incidentType);
}

export default function BdrrmoCommandIntakeMap({
  reports,
  assignedBarangay,
  onGestureActiveChange,
}: {
  reports: OfficialReportQueueItem[];
  assignedBarangay: string | null;
  onGestureActiveChange?: (active: boolean) => void;
}) {
  const router = useRouter();
  const [activeStatus, setActiveStatus] = useState<LocalResponseStatus>('unverified');
  const [activeIndex, setActiveIndex] = useState(0);
  const [referenceTime, setReferenceTime] = useState(() => Date.now());
  const reportsByStatus = useMemo(
    () => ({
      unverified: reports.filter((report) => report.status === 'unverified'),
      verified: reports.filter((report) => report.status === 'verified'),
    }),
    [reports],
  );
  const activeReports = reportsByStatus[activeStatus];
  const markers = useMemo(
    () => activeReports.map(asMapMarker).filter((marker): marker is MapReportMarker => marker !== null),
    [activeReports],
  );
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, activeReports.length - 1));
  const activeReport = activeReports[safeActiveIndex] ?? null;
  const activeState = LOCAL_RESPONSE_STATES.find((state) => state.status === activeStatus)!;

  useEffect(() => {
    const timer = setInterval(() => setReferenceTime(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Keep the selected lane actionable when a report is verified or resolved elsewhere.
    if (activeReports.length > 0) return;
    const nextState = LOCAL_RESPONSE_STATES.find(
      (state) => reportsByStatus[state.status].length > 0,
    );
    if (nextState) setActiveStatus(nextState.status);
  }, [activeReports.length, reportsByStatus]);

  useEffect(() => {
    setActiveIndex(0);
  }, [activeStatus]);

  const focusTarget = activeReport && hasValidLocation(activeReport)
    ? {
        reportId: activeReport.id,
        latitude: activeReport.latitude,
        longitude: activeReport.longitude,
      }
    : null;

  function move(direction: -1 | 1) {
    if (activeReports.length < 2) return;
    setActiveIndex((current) => (current + direction + activeReports.length) % activeReports.length);
  }

  const placeLabel = activeReport?.addressText?.trim() || assignedBarangay || 'Assigned barangay';
  const typeLabel = activeReport ? incidentTypeLabel(activeReport) : 'Report';

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
              const selectedIndex = activeReports.findIndex((report) => reportIds.includes(report.id));
              if (selectedIndex >= 0) setActiveIndex(selectedIndex);
            }}
          />
        </View>

        <View style={styles.mapQueueTabs} accessibilityRole="tablist">
          {LOCAL_RESPONSE_STATES.map((state) => {
            const selected = activeStatus === state.status;
            const count = reportsByStatus[state.status].length;
            return (
              <TouchableOpacity
                key={state.status}
                style={[styles.mapQueueTab, selected && { backgroundColor: state.color }]}
                onPress={() => setActiveStatus(state.status)}
                accessibilityRole="tab"
                accessibilityLabel={`${state.label} local reports, ${count}`}
                accessibilityState={{ selected }}
              >
                <Text style={[styles.mapQueueTabText, selected && { color: colors.white }]}>
                  {count} {state.label.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.mapEscalationBadge}
          onPress={() => router.push(`/official/incidents?status=${activeStatus}&from=command` as Href)}
          accessibilityRole="button"
          accessibilityLabel={`View ${activeReports.length} ${activeState.label.toLowerCase()} local reports`}
        >
          <View style={[styles.mapEscalationDot, { backgroundColor: activeState.color }]} />
          <Text style={[styles.mapEscalationBadgeText, { color: activeState.color }]}>VIEW QUEUE</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.text} />
        </TouchableOpacity>

        {activeReports.length > 0 ? (
          <View style={styles.mapPager}>
            <TouchableOpacity
              style={styles.mapPagerButton}
              onPress={() => move(-1)}
              disabled={activeReports.length < 2}
              accessibilityRole="button"
              accessibilityState={{ disabled: activeReports.length < 2 }}
              accessibilityLabel="Previous local report"
            >
              <Ionicons name="chevron-back" size={17} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.mapPagerText}>{safeActiveIndex + 1} of {activeReports.length}</Text>
            <TouchableOpacity
              style={styles.mapPagerButton}
              onPress={() => move(1)}
              disabled={activeReports.length < 2}
              accessibilityRole="button"
              accessibilityState={{ disabled: activeReports.length < 2 }}
              accessibilityLabel="Next local report"
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
              <Text style={[styles.activeIncidentEyebrow, { color: activeState.color }]}>
                {activeState.label.toUpperCase()} · {elapsedLabel(activeReport.createdAt, referenceTime)}
              </Text>
              <Text style={styles.activeIncidentTitle}>{typeLabel} · {placeLabel}</Text>
              <Text style={styles.activeIncidentMeta}>
                {assignedBarangay || 'Assigned barangay'} · {activeReport.mediaCount} media
              </Text>
            </View>
            <TouchableOpacity
              style={styles.openIncidentAction}
              onPress={() => router.push(`/official/${activeReport.id}` as Href)}
              accessibilityRole="button"
              accessibilityLabel={`Manage ${typeLabel} report at ${placeLabel}`}
            >
              <View style={styles.openIncidentCircle}>
                <Ionicons name="arrow-forward" size={19} color={colors.white} />
              </View>
              <Text style={styles.openIncidentLabel}>
                {activeStatus === 'verified' ? 'Choose action' : 'Review report'}
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.activeIncidentQuote,
              {
                backgroundColor:
                  activeStatus === 'verified'
                    ? 'rgba(34, 197, 94, 0.08)'
                    : 'rgba(217, 45, 32, 0.06)',
              },
            ]}
          >
            <View style={[styles.activeIncidentQuoteAccent, { backgroundColor: activeState.color }]} />
            <Text style={[styles.activeIncidentQuoteMark, { color: activeState.color }]}>“</Text>
            <View style={styles.activeIncidentQuoteCopy}>
              <Text style={styles.activeIncidentQuoteText}>
                {activeReport.description.trim() || 'No report description was provided.'}
              </Text>
              <Text style={styles.activeIncidentQuoteSource} numberOfLines={1}>
                Reported by {activeReport.reporterName}
              </Text>
            </View>
          </View>

          <View style={styles.incidentTimeline}>
            <View style={styles.incidentTimelineLine} />
            {[
              {
                label: 'Reported',
                name: activeReport.reporterName,
                complete: true,
                current: activeStatus === 'unverified',
                icon: 'time-outline' as const,
              },
              {
                label: 'Verified',
                name: activeStatus === 'verified' ? 'BDRRMO verified' : 'BDRRMO review',
                complete: activeStatus === 'verified',
                current: activeStatus === 'verified',
                icon: 'shield-checkmark-outline' as const,
              },
              {
                label: 'Respond',
                name: 'Resolve or escalate',
                complete: false,
                current: false,
                icon: 'navigate-outline' as const,
              },
            ].map((step) => (
              <View key={step.label} style={styles.incidentTimelineStep}>
                <View
                  style={[
                    styles.incidentTimelineDot,
                    step.current && { backgroundColor: activeState.color },
                    !step.complete && !step.current && styles.incidentTimelineDotPending,
                  ]}
                >
                  <Ionicons name={step.icon} size={13} color={colors.white} />
                </View>
                <Text style={styles.incidentTimelineLabel}>{step.label}</Text>
                <Text style={styles.incidentTimelineName} numberOfLines={2}>{step.name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.activeIncidentEmpty}>
          <View style={styles.activeIncidentEmptyIcon}>
            <Ionicons name="checkmark-circle-outline" size={31} color={colors.navigationActive} />
          </View>
          <Text style={styles.activeIncidentEmptyTitle}>
            No {activeState.label.toLowerCase()} reports
          </Text>
          <Text style={styles.activeIncidentEmptyBody}>
            New local reports from {assignedBarangay || 'your assigned barangay'} will appear here.
          </Text>
        </View>
      )}
    </View>
  );
}
