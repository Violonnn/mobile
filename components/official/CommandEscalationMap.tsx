import React, { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';

import { officialReportMapMarker } from '../map/officialMapReports';
import InteractiveMap from '../map/InteractiveMap';
import { formatIncidentType } from '../../lib/incidentTypes';
import type { OfficialReportQueueItem } from '../../lib/officialReports';
import {
  getReportStatusPresentation,
  type MapReportMarker,
} from '../../lib/reports';
import { scopedLifecyclePresentation } from '../../lib/reportPresentation';
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
  return formatIncidentType(report.incidentType, report.incidentTypeOther);
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
  selectedLane,
  onLaneChange,
  requestCount,
  activeCount,
  laneLoading,
  laneError,
  onRetry,
  onGestureActiveChange,
}: {
  reports: OfficialReportQueueItem[];
  selectedLane: 'requests' | 'active';
  onLaneChange: (lane: 'requests' | 'active') => void;
  requestCount: number;
  activeCount: number;
  laneLoading: boolean;
  laneError: string | null;
  onRetry: () => Promise<void>;
  onGestureActiveChange?: (active: boolean) => void;
}) {
  const router = useRouter();
  const laneReports = reports;
  const queue = selectedLane === 'requests' ? 'incoming_requests' : 'municipal_active';
  const laneTitle = selectedLane === 'requests' ? 'Requests' : 'Active response';
  const totalCount = selectedLane === 'requests' ? requestCount : activeCount;
  const markers = useMemo(
    () => laneReports
      .map(officialReportMapMarker)
      .filter((marker): marker is MapReportMarker => marker !== null),
    [laneReports],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [referenceTime, setReferenceTime] = useState(() => Date.now());
  const [previousSelectedLane, setPreviousSelectedLane] = useState(selectedLane);
  if (selectedLane !== previousSelectedLane) {
    setPreviousSelectedLane(selectedLane);
    setActiveIndex(0);
  }
  const maximumActiveIndex = Math.max(0, laneReports.length - 1);
  const safeActiveIndex = Math.min(activeIndex, maximumActiveIndex);
  const activeReport = laneReports[safeActiveIndex] ?? null;
  const activeReportPresentation = activeReport
    ? scopedLifecyclePresentation(activeReport.lifecycle, {
        audience: 'mitcom',
        barangayName: activeReport.barangayName,
        leadOffice: activeReport.lifecycleFacts.leadOffice,
        claimedByName: activeReport.lifecycleFacts.reviewClaimedByName,
        claimedAt: activeReport.lifecycleFacts.reviewClaimedAt,
      })
    : null;
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
    if (laneReports.length < 2) return;
    setActiveIndex(
        (currentIndex) =>
        (currentIndex + direction + laneReports.length) % laneReports.length,
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
              const selectedIndex = laneReports.findIndex((report) =>
                reportIds.includes(report.id),
              );
              if (selectedIndex >= 0) setActiveIndex(selectedIndex);
            }}
          />
        </View>

        <View style={[styles.mapQueueTabs, styles.commandMapQueueTabs]} accessibilityRole="tablist">
          {[
            { lane: 'requests' as const, label: 'Requests', count: requestCount, color: REQUESTS_STATUS_COLOR },
            { lane: 'active' as const, label: 'Active response', count: activeCount, color: getReportStatusPresentation('verified').color },
          ].map((tab) => {
            const selected = selectedLane === tab.lane;
            return (
              <TouchableOpacity
                key={tab.lane}
                style={[styles.mapQueueTab, styles.commandMapQueueTab, selected && { backgroundColor: tab.color }]}
                onPress={() => {
                  onLaneChange(tab.lane);
                  setActiveIndex(0);
                }}
                accessibilityRole="tab"
                accessibilityLabel={`${tab.label}, ${tab.count}`}
                accessibilityState={{ selected }}
              >
                <Text style={[styles.mapQueueTabText, selected && { color: colors.white }]} numberOfLines={1} adjustsFontSizeToFit>{tab.count} {tab.label.toUpperCase()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.mapEscalationBadge, styles.mapQueueViewBadge]}
          onPress={() => router.push(`/official/incidents?queue=${queue}&from=command` as Href)}
          accessibilityRole="button"
          accessibilityLabel={`View ${totalCount} ${laneTitle.toLowerCase()}`}
        >
          <View style={[styles.mapEscalationDot, { backgroundColor: selectedLane === 'requests' ? REQUESTS_STATUS_COLOR : getReportStatusPresentation('verified').color }]} />
          <Text style={[styles.mapEscalationBadgeText, { color: selectedLane === 'requests' ? REQUESTS_STATUS_COLOR : getReportStatusPresentation('verified').color }]}>VIEW QUEUE</Text>
          <Ionicons name="chevron-forward" size={15} color={colors.text} />
        </TouchableOpacity>

        {laneReports.length > 0 ? (
          <View style={styles.mapPager}>
            <TouchableOpacity
              style={styles.mapPagerButton}
              onPress={() => move(-1)}
              disabled={laneReports.length < 2}
              accessibilityRole="button"
              accessibilityState={{ disabled: laneReports.length < 2 }}
              accessibilityLabel={`Previous ${selectedLane === 'requests' ? 'request' : 'active response'}`}
            >
              <Ionicons name="chevron-back" size={17} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.mapPagerText} accessibilityRole="text" accessibilityLabel={`${safeActiveIndex + 1} of ${laneReports.length} ${laneTitle.toLowerCase()}`}>{safeActiveIndex + 1} of {laneReports.length}</Text>
            <TouchableOpacity
              style={styles.mapPagerButton}
              onPress={() => move(1)}
              disabled={laneReports.length < 2}
              accessibilityRole="button"
              accessibilityState={{ disabled: laneReports.length < 2 }}
              accessibilityLabel={`Next ${selectedLane === 'requests' ? 'request' : 'active response'}`}
            >
              <Ionicons name="chevron-forward" size={17} color={colors.text} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {laneError && !activeReport ? (
        <View style={[styles.activeIncidentEmpty, styles.commandActiveIncidentEmpty]}>
          <Text style={styles.activeIncidentEmptyTitle}>Could not load {laneTitle.toLowerCase()}</Text>
          <Text style={styles.activeIncidentEmptyBody}>{laneError}</Text>
          <TouchableOpacity
            onPress={() => void onRetry()}
            accessibilityRole="button"
            accessibilityLabel={`Retry ${laneTitle.toLowerCase()}`}
          >
            <Text style={styles.activeIncidentEmptyTitle}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : laneLoading && !activeReport ? (
        <View style={[styles.activeIncidentEmpty, styles.commandActiveIncidentEmpty]}>
          <Text style={styles.activeIncidentEmptyTitle}>Loading {laneTitle.toLowerCase()}…</Text>
        </View>
      ) : activeReport ? (
        <View style={styles.activeIncidentCard}>
          {laneError ? (
            <View>
              <Text style={styles.activeIncidentEmptyBody}>{laneError}</Text>
              <TouchableOpacity onPress={() => void onRetry()} accessibilityRole="button">
                <Text style={styles.activeIncidentEmptyTitle}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.activeIncidentTopRow}>
            <View style={styles.activeIncidentCopy}>
              <Text style={[styles.activeIncidentEyebrow, { color: activeReportPresentation?.tone.color }]}>
                {activeReportPresentation?.stageLabel.toUpperCase()} · {formatElapsedLabel(
                  activeReport.escalatedAt || activeReport.createdAt,
                  referenceTime,
                )}
              </Text>
              <Text style={styles.activeIncidentTitle}>
                {activeIncidentType} • {activeIncidentPlace}
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

          <View style={[styles.activeIncidentQuote, { backgroundColor: activeReportPresentation?.tone.softColor }]}>
            <View style={[styles.activeIncidentQuoteAccent, { backgroundColor: activeReportPresentation?.tone.color }]} />
            <Text style={[styles.activeIncidentQuoteMark, { color: activeReportPresentation?.tone.color }]}>“</Text>
            <View style={styles.activeIncidentQuoteCopy}>
              <Text style={styles.activeIncidentQuoteText}>
                {activeReport.escalationNote?.trim() ||
                  activeReport.description.trim() || 'No description provided.'}
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
          {[activeReportPresentation?.coordinationLabel, activeReportPresentation?.leadLabel, activeReportPresentation?.reviewLabel, activeReportPresentation?.note]
            .filter((label): label is string => Boolean(label))
            .map((label) => <Text key={label} style={styles.activeIncidentMeta}>{label}</Text>)}
        </View>
      ) : (
        <View style={[styles.activeIncidentEmpty, styles.commandActiveIncidentEmpty]}>
          <View style={styles.activeIncidentEmptyIcon}>
            <Ionicons name="checkmark-circle-outline" size={31} color={colors.navigationActive} />
          </View>
          <Text style={styles.activeIncidentEmptyTitle}>{selectedLane === 'requests' ? 'No incoming requests' : 'No active response'}</Text>
        </View>
      )}
    </View>
  );
}
