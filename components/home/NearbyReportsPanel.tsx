import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import InteractiveMap from '../map/InteractiveMap';
import { formatIncidentType } from '../../lib/incidentTypes';
import type { GpsPosition } from '../../lib/location';
import {
  formatReportLocation,
  getReportStatusPresentation,
  type MapReportMarker,
} from '../../lib/reports';
import { homeStyles as styles } from '../../styles/screens/home.styles';
import { colors } from '../../styles/theme';
import { useAccessibilityLayout } from '../../hooks/useAccessibilityLayout';
import ReportStatusTimeline from '../report/ReportStatusTimeline';

type NearbyReportsPanelProps = {
  reports: MapReportMarker[];
  loading: boolean;
  error: string | null;
  userLocation: GpsPosition | null;
  barangayNamesById: ReadonlyMap<string, string>;
  onOpenReport: (reportId: string) => void;
  onRetry: () => void;
  onGestureActiveChange: (active: boolean) => void;
};

function formatElapsedLabel(value: string, referenceTime: number): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'NOW';

  const ageMinutes = Math.max(1, Math.floor((referenceTime - timestamp) / 60_000));
  if (ageMinutes < 60) return `${ageMinutes} MIN`;

  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 24) return `${ageHours} HR`;

  return `${Math.floor(ageHours / 24)} DAY`;
}

function formatTimelineTime(value: string): string {
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

function reporterName(report: MapReportMarker): string {
  const fullName = [report.reporter.firstName, report.reporter.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return fullName || 'Resident';
}

function incidentLabel(report: MapReportMarker): string {
  if (!report.incidentType) return 'Report';
  if (report.incidentType === 'other') {
    return report.incidentTypeOther?.trim() || 'Other incident';
  }

  return formatIncidentType(report.incidentType);
}

function reportBarangayLabel(
  report: MapReportMarker,
  barangayNamesById: ReadonlyMap<string, string>,
): string {
  const barangayName = report.barangay_id
    ? barangayNamesById.get(report.barangay_id)?.trim()
    : null;

  return barangayName ? `Brgy. ${barangayName}` : 'Barangay review';
}

export default function NearbyReportsPanel({
  reports,
  loading,
  error,
  userLocation,
  barangayNamesById,
  onOpenReport,
  onRetry,
  onGestureActiveChange,
}: NearbyReportsPanelProps) {
  const { isLargeText } = useAccessibilityLayout();
  const [activeIndex, setActiveIndex] = useState(0);
  const [referenceTime, setReferenceTime] = useState(() => Date.now());
  const maximumActiveIndex = Math.max(0, reports.length - 1);
  const safeActiveIndex = Math.min(activeIndex, maximumActiveIndex);
  const activeReport = reports[safeActiveIndex] ?? null;
  const activeStatus = activeReport
    ? getReportStatusPresentation(activeReport.status)
    : null;
  const nearbyBadgeColor = activeStatus?.color ?? colors.primary;
  const focusTarget = activeReport
    ? {
        reportId: activeReport.id,
        latitude: activeReport.latitude,
        longitude: activeReport.longitude,
      }
    : userLocation
      ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        }
      : null;

  useEffect(() => {
    const elapsedTimer = setInterval(() => setReferenceTime(Date.now()), 60_000);
    return () => clearInterval(elapsedTimer);
  }, []);

  function move(direction: -1 | 1) {
    if (reports.length < 2) return;
    setActiveIndex((currentIndex) => (currentIndex + direction + reports.length) % reports.length);
  }

  return (
    <View style={styles.nearbyReportsPanel}>
      <View style={styles.nearbyMapHero}>
        <View collapsable={false} style={styles.nearbyMapFill}>
          <InteractiveMap
            markers={reports}
            facilities={[]}
            evacuationCenters={[]}
            userLocation={userLocation}
            showZoomControls={false}
            focusZoomLevel={15}
            stickyFocus
            focusTarget={focusTarget}
            highlightedReportId={activeReport?.id ?? null}
            showHighlightedReportIncidentIcon
            onGestureActiveChange={onGestureActiveChange}
            onReportSelection={(reportIds) => {
              const selectedIndex = reports.findIndex((report) => reportIds.includes(report.id));
              if (selectedIndex >= 0) setActiveIndex(selectedIndex);
            }}
          />
        </View>

        <View
          style={styles.nearbyMapCountBadge}
          accessibilityLabel={`${reports.length} nearby active reports`}
        >
          <View style={[styles.nearbyMapCountDot, { backgroundColor: nearbyBadgeColor }]} />
          <Text style={[styles.nearbyMapCountText, { color: nearbyBadgeColor }]}>
            {reports.length} NEARBY
          </Text>
        </View>

        {reports.length > 0 ? (
          <View style={styles.nearbyMapPager}>
            <TouchableOpacity
              style={styles.nearbyMapPagerButton}
              onPress={() => move(-1)}
              disabled={reports.length < 2}
              accessibilityRole="button"
              accessibilityLabel="Previous nearby report"
            >
              <Ionicons name="chevron-back" size={17} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.nearbyMapPagerText}>
              {safeActiveIndex + 1} of {reports.length}
            </Text>
            <TouchableOpacity
              style={styles.nearbyMapPagerButton}
              onPress={() => move(1)}
              disabled={reports.length < 2}
              accessibilityRole="button"
              accessibilityLabel="Next nearby report"
            >
              <Ionicons name="chevron-forward" size={17} color={colors.text} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {loading && reports.length === 0 ? (
        <View style={styles.nearbyReportsState}>
          <Ionicons name="location-outline" size={28} color={colors.primary} />
          <Text style={styles.nearbyReportsStateTitle}>Finding nearby reports</Text>
          <Text style={styles.nearbyReportsStateText}>
            Checking active reports within 5 km of your current location.
          </Text>
        </View>
      ) : error && reports.length === 0 ? (
        <View style={styles.nearbyReportsState} accessibilityRole="alert">
          <Ionicons name="location-outline" size={28} color={colors.textMuted} />
          <Text style={styles.nearbyReportsStateTitle}>Nearby reports unavailable</Text>
          <Text style={styles.nearbyReportsStateText}>{error}</Text>
          <TouchableOpacity
            style={styles.nearbyReportsRetryButton}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry nearby reports"
          >
            <Text style={styles.nearbyReportsRetryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : activeReport && activeStatus ? (
        <View style={styles.nearbyActiveReportCard}>
          <View
            style={[
              styles.nearbyActiveReportTopRow,
              isLargeText && styles.nearbyActiveReportTopRowLargeText,
            ]}
          >
            <View style={styles.nearbyActiveReportCopy}>
              <Text style={[styles.nearbyActiveReportEyebrow, { color: activeStatus.color }]}>
                {activeStatus.label.toLocaleUpperCase()} · {formatElapsedLabel(activeReport.created_at, referenceTime)}
              </Text>
              <Text style={styles.nearbyActiveReportTitle}>
                {activeReport.title || incidentLabel(activeReport)}
              </Text>
              <Text style={styles.nearbyActiveReportMeta}>
                {incidentLabel(activeReport)} · {formatReportLocation(activeReport)}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.nearbyOpenReportAction,
                isLargeText && styles.nearbyOpenReportActionLargeText,
              ]}
              onPress={() => onOpenReport(activeReport.id)}
              accessibilityRole="button"
              accessibilityLabel={`Open nearby report: ${activeReport.title || incidentLabel(activeReport)}`}
            >
              <View style={styles.nearbyOpenReportCircle}>
                <Ionicons name="arrow-forward" size={19} color={colors.white} />
              </View>
              <Text style={styles.nearbyOpenReportLabel}>Open report</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.nearbyActiveReportQuote}>
            <View style={[styles.nearbyActiveReportQuoteAccent, { backgroundColor: activeStatus.color }]} />
            <Text style={[styles.nearbyActiveReportQuoteMark, { color: activeStatus.color }]}>“</Text>
            <View style={styles.nearbyActiveReportQuoteCopy}>
              <Text style={styles.nearbyActiveReportQuoteText}>
                {activeReport.description || 'No additional report details were provided.'}
              </Text>
              <Text style={styles.nearbyActiveReportQuoteSource}>
                {reporterName(activeReport)} · {formatTimelineTime(activeReport.created_at)}
              </Text>
            </View>
          </View>

          <ReportStatusTimeline
            status={activeReport.status}
            barangayLabel={reportBarangayLabel(activeReport, barangayNamesById)}
          />
        </View>
      ) : (
        <View style={styles.nearbyReportsState}>
          <View style={styles.nearbyReportsEmptyIcon}>
            <Ionicons name="checkmark-circle-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.nearbyReportsStateTitle}>No nearby reports</Text>
          <Text style={styles.nearbyReportsStateText}>
            Active reports within 5 km of your current location will appear here.
          </Text>
        </View>
      )}
    </View>
  );
}
