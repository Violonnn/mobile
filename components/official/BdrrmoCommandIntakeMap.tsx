import React, { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';

import { officialReportMapMarker } from '../map/officialMapReports';
import { getMapReportPresentation } from '../../lib/reports';
import { scopedLifecyclePresentation } from '../../lib/reportPresentation';
import InteractiveMap from '../map/InteractiveMap';
import { CommunityReportTags } from '../report/ReportDetailCard';
import type { OfficialReportQueueItem } from '../../lib/officialReports';
import type { MapReportMarker } from '../../lib/reports';
import { residentTypography } from '../../styles/residentTypography';
import { colors, screenEdgeInset } from '../../styles/theme';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';

type LocalResponseStatus = 'unverified' | 'verified';
const LOCAL_RESPONSE_STATES: {
  status: LocalResponseStatus;
  label: string;
  color: string;
}[] = [
  { status: 'unverified', label: 'Needs review', color: getMapReportPresentation({ status: 'unverified' }).color },
  { status: 'verified', label: 'Active reports', color: getMapReportPresentation({ status: 'verified' }).color },
];

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
  const reportsByStatus = useMemo(
    () => ({
      unverified: reports.filter((report) => ['awaiting_review', 'under_review'].includes(report.lifecycle.primaryStage)),
      verified: reports.filter((report) => ['being_assessed', 'confirmed', 'response_ongoing'].includes(report.lifecycle.primaryStage)),
    }),
    [reports],
  );
  const activeReports = reportsByStatus[activeStatus];
  const markers = useMemo(
    () => activeReports.map(officialReportMapMarker).filter((marker): marker is MapReportMarker => marker !== null),
    [activeReports],
  );
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, activeReports.length - 1));
  const activeReport = activeReports[safeActiveIndex] ?? null;
  const activeState = LOCAL_RESPONSE_STATES.find((state) => state.status === activeStatus)!;
  const activeReportPresentation = activeReport
    ? scopedLifecyclePresentation(activeReport.lifecycle, {
        audience: 'bdrrmo',
        barangayName: activeReport.barangayName,
        leadOffice: activeReport.lifecycleFacts.leadOffice,
        claimedByName: activeReport.lifecycleFacts.reviewClaimedByName,
        claimedAt: activeReport.lifecycleFacts.reviewClaimedAt,
      })
    : null;
  const activeReportTone = activeReportPresentation?.tone.color ?? activeState.color;

  useEffect(() => {
    // Keep the selected lane actionable when a report is verified or resolved elsewhere.
    if (activeReports.length > 0) return;
    const nextState = LOCAL_RESPONSE_STATES.find(
      (state) => reportsByStatus[state.status].length > 0,
    );
    if (!nextState) return;

    const animationFrame = requestAnimationFrame(() => {
      setActiveStatus(nextState.status);
      setActiveIndex(0);
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [activeReports.length, reportsByStatus]);

  const focusTarget = activeReport && activeReport.latitude != null && activeReport.longitude != null
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

  const barangayLabel = activeReport?.barangayName || assignedBarangay || '';
  const reportTitle = activeReport?.title.trim() || 'Untitled report';
  const statusPresentation = activeReportPresentation
    ? {
        label: activeReportPresentation.stageLabel,
        color: activeReportPresentation.tone.color,
        backgroundColor: activeReportPresentation.tone.softColor,
      }
    : {
        label: activeState.label,
        color: activeState.color,
      };

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
                onPress={() => {
                  setActiveStatus(state.status);
                  setActiveIndex(0);
                }}
                accessibilityRole="tab"
                accessibilityLabel={`${state.label}, ${count}`}
                accessibilityState={{ selected }}
              >
                <Text style={[styles.mapQueueTabText, selected && { color: colors.white }]}>
                  {count} {state.label.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeReports.length > 0 ? (
          <View style={[styles.mapPager, { minHeight: 32, gap: 0, paddingHorizontal: 0 }]}>
            <TouchableOpacity
              style={[styles.mapPagerButton, { width: 32, height: 32 }]}
              onPress={() => move(-1)}
              disabled={activeReports.length < 2}
              accessibilityRole="button"
              accessibilityState={{ disabled: activeReports.length < 2 }}
              accessibilityLabel="Previous local report"
            >
              <Ionicons name="chevron-back" size={17} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.mapPagerText, { minWidth: 24, fontSize: 14 }]}>{safeActiveIndex + 1} of {activeReports.length}</Text>
            <TouchableOpacity
              style={[styles.mapPagerButton, { width: 32, height: 32 }]}
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
        <View style={[styles.activeIncidentCard, { paddingHorizontal: screenEdgeInset }]}>
          <View style={styles.activeIncidentTopRow}>
            <View style={styles.activeIncidentCopy}>
              <Text style={styles.activeIncidentTitle}>
                {reportTitle}
                <Text style={residentTypography.mutedBody}>{' \u00b7 '}Brgy. {barangayLabel || 'Assigned barangay'}</Text>
              </Text>
              <CommunityReportTags
                report={activeReport}
                statusPresentation={statusPresentation}
              />
            </View>
          </View>

          <View
            style={[
              styles.activeIncidentQuote,
              { backgroundColor: activeReportPresentation?.tone.softColor ?? colors.background },
            ]}
          >
            <View style={[styles.activeIncidentQuoteAccent, { backgroundColor: activeReportTone }]} />
            <Text style={[styles.activeIncidentQuoteMark, { color: activeReportTone }]}>&quot;</Text>
            <View style={styles.activeIncidentQuoteCopy}>
              <Text style={residentTypography.body}>
                {activeReport.description.trim() || 'No report description was provided.'}
              </Text>
              <Text style={residentTypography.mutedBody} numberOfLines={1}>
                Reported by {activeReport.reporterName}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.viewReportButton}
            onPress={() => router.push(`/official/${activeReport.id}` as Href)}
            accessibilityRole="button"
          >
            <Text style={styles.viewReportButtonText}>View report</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </TouchableOpacity>
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
