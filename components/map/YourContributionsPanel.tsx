import React, { useState } from 'react';
import {
  ActivityIndicator,
  type GestureResponderHandlers,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  formatReportLocation,
  getMapReportPresentation,
  type MapReportMarker,
} from '../../lib/reports';
import { formatPublishedAt } from '../../lib/formatTime';
import { contributionStyles as styles } from '../../styles/components/yourContributions.styles';
import { colors } from '../../styles/theme';
import { useReportDetail } from '../../hooks/useReportDetail';
import { CollageCellContent } from '../report/ReportDetailCard';
import IncidentTypeBadge from '../report/IncidentTypeBadge';
import { residentReportStatusIconName } from '../report/ReportStatusTimeline';
import { ContributionSkeleton } from '../ui/ResidentScreenSkeletons';
import {
  formatReportCode,
  ResidentReportPreviewContent,
} from './ResidentReportPreviewSheet';

export type ContributionPanelState = 'collapsed' | 'medium' | 'expanded';

function formatContributionTitle(title: string): string {
  const normalizedTitle = title.trim().toLocaleLowerCase();
  if (!normalizedTitle) return 'Untitled report';

  return `${normalizedTitle.charAt(0).toLocaleUpperCase()}${normalizedTitle.slice(1)}`;
}

function contributionStatus(report: MapReportMarker): {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  backgroundColor: string;
} {
  if (report.isPending) {
    return {
      label: 'Uploading',
      icon: 'cloud-upload-outline',
      color: colors.primary,
      backgroundColor: colors.primaryLight,
    };
  }

  const presentation = getMapReportPresentation(report, 'resident');
  return {
    label: presentation.label,
    icon: residentReportStatusIconName(report.status),
    color: presentation.color,
    backgroundColor: presentation.backgroundColor,
  };
}

function ContributionMediaThumb({ report }: { report: MapReportMarker }) {
  const firstMedia = report.media[0];
  if (!firstMedia) return null;

  const extraCount = report.media.length - 1;

  return (
    <View
      style={styles.mediaThumb}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <CollageCellContent item={firstMedia} />
      {extraCount > 0 ? (
        <View style={styles.mediaMoreBadge}>
          <Text style={styles.mediaMoreText}>{`+${extraCount} more`}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function YourContributionsPanel({
  reports,
  loading,
  error,
  bottomInset,
  detailCacheScope,
  onReportPress,
  onShowReportOnMap,
  canShowReportOnMap,
  onRetry,
  panelState,
  onToggleExpanded,
  onBackFromReport,
  dragHandlePanHandlers,
}: {
  reports: MapReportMarker[];
  loading: boolean;
  error: string | null;
  bottomInset: number;
  detailCacheScope: string | null;
  onReportPress: () => void;
  onShowReportOnMap: (report: MapReportMarker) => void;
  canShowReportOnMap: (report: MapReportMarker) => boolean;
  onRetry: () => void;
  panelState: ContributionPanelState;
  onToggleExpanded: () => void;
  onBackFromReport: () => void;
  dragHandlePanHandlers: GestureResponderHandlers;
}) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const resolvedCount = reports.filter((report) => report.status === 'resolved').length;
  const selectedReport = reports.find((report) => report.id === selectedReportId) ?? null;
  const selectedReportCanShowOnMap = selectedReport ? canShowReportOnMap(selectedReport) : false;
  const {
    report: selectedReportDetail,
    refreshError: detailError,
    refreshing: detailRefreshing,
    refresh: refreshSelectedReport,
  } = useReportDetail(selectedReport, { cacheScope: detailCacheScope });
  const loadingSelectedReportDetail = Boolean(
    selectedReport &&
    !selectedReport.isPending &&
    !detailError &&
    !selectedReportDetail?.mediaDetailLoaded,
  );
  const openContribution = (report: MapReportMarker) => {
    setSelectedReportId(report.id);
    onReportPress();
  };

  const returnToContributions = () => {
    setSelectedReportId(null);
    onBackFromReport();
  };

  return (
    <View style={styles.panel}>
      <View style={styles.dragHandleArea} {...dragHandlePanHandlers}>
        <TouchableOpacity
          style={styles.handleButton}
          onPress={onToggleExpanded}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={
            panelState === 'expanded' ? 'Collapse your contributions' : 'Expand your contributions'
          }
          accessibilityHint="You can also drag the handle up or down"
          accessibilityState={{ expanded: panelState === 'expanded' }}
        >
          <View style={styles.dragIndicator} />
        </TouchableOpacity>

        {selectedReport ? (
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={returnToContributions}
              accessibilityRole="button"
              accessibilityLabel="Back to your contributions"
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerCopy}
              onPress={onToggleExpanded}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Resize report details"
            >
              <Text style={styles.eyebrow}>REPORT DETAILS</Text>
              <Text style={styles.headerSubtitle}>
                #{formatReportCode(selectedReport.id)}
              </Text>
            </TouchableOpacity>
            <View style={styles.backButton} />
          </View>
        ) : (
        <TouchableOpacity
          style={styles.headerRow}
          onPress={onToggleExpanded}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Resize your contributions"
        >
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>YOUR CONTRIBUTIONS</Text>
            <Text style={styles.headerSubtitle}>
              {panelState === 'collapsed'
                ? 'Drag up to view your reports'
                : panelState === 'expanded'
                  ? 'Full screen · drag down to return to the map'
                  : 'Drag up for full screen or down to maximize the map'}
            </Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{reports.length}</Text>
          </View>
        </TouchableOpacity>
        )}
      </View>

      {selectedReport ? (
        <View style={[styles.detailContent, { paddingBottom: bottomInset }]}>
          {selectedReport.isPending ? null : detailError ? (
            <View style={styles.detailError}>
              <Text accessibilityRole="alert" style={styles.stateText}>{detailError}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => void refreshSelectedReport()}
                disabled={detailRefreshing}
                accessibilityRole="button"
              >
                <Text style={styles.retryText}>{detailRefreshing ? 'Retrying…' : 'Retry report details'}</Text>
              </TouchableOpacity>
            </View>
          ) : loadingSelectedReportDetail ? (
            <View style={styles.detailLoading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.stateText}>Loading your report details…</Text>
            </View>
          ) : null}
          {!loadingSelectedReportDetail ? (
            <ResidentReportPreviewContent
              report={selectedReportDetail ?? selectedReport}
              onOpenFullReport={() => onShowReportOnMap(selectedReport)}
              primaryActionLabel={selectedReportCanShowOnMap ? 'Show on map' : null}
              unavailableActionMessage={selectedReportCanShowOnMap ? undefined : 'Location is not shared on resident maps.'}
              showActivity
            />
          ) : null}
        </View>
      ) : (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading && reports.length === 0 ? (
          <ContributionSkeleton />
        ) : error && reports.length === 0 ? (
          <View style={styles.stateBlock}>
            <Ionicons name="cloud-offline-outline" size={27} color={colors.textMuted} />
            <Text style={styles.stateTitle}>Contributions unavailable</Text>
            <Text style={styles.stateText}>Check your connection and try loading the reports again.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.stateBlock}>
            <View style={styles.emptyIcon}>
              <Ionicons name="location-outline" size={27} color={colors.primary} />
            </View>
            <Text style={styles.stateTitle}>No contributions yet</Text>
            <Text style={styles.stateText}>
              Reports submitted from the center Report button will appear here.
            </Text>
          </View>
        ) : (
          <>
            {reports.map((report) => {
                  const status = contributionStatus(report);
                  const isLatest = report.id === reports[0]?.id;

                  return (
                    <TouchableOpacity
                      key={report.id}
                      style={[styles.reportCard, isLatest && styles.latestReportCard]}
                      onPress={() => openContribution(report)}
                      activeOpacity={0.82}
                      accessibilityRole="button"
                      accessibilityLabel={
                        report.media.length > 1
                          ? `Open report: ${report.title}, ${report.media.length} attachments`
                          : `Open report: ${report.title}`
                      }
                    >
                      <View style={styles.cardMain}>
                        <View style={styles.cardCopy}>
                          <View style={styles.titleDateRow}>
                            <Text style={[styles.reportTitle, isLatest && styles.latestReportTitle]} numberOfLines={2}>
                              {formatContributionTitle(report.title)}
                            </Text>
                            <Text style={styles.dateText} numberOfLines={1}>
                              {formatPublishedAt(report.created_at)}
                            </Text>
                          </View>
                          <View style={styles.reportTagRow}>
                            {isLatest ? <Text style={styles.latestBadge}>LATEST</Text> : null}
                            <View
                              style={[
                                styles.statusPill,
                                {
                                  borderColor: status.color,
                                  backgroundColor: status.backgroundColor,
                                },
                              ]}
                            >
                              <Ionicons name={status.icon} size={13} color={status.color} />
                              <Text style={[styles.statusText, { color: status.color }]}>
                                {status.label}
                              </Text>
                            </View>
                            <IncidentTypeBadge
                              incidentType={report.incidentType}
                              incidentTypeOther={report.incidentTypeOther}
                              labelFontSize={14}
                            />
                          </View>
                          <View style={styles.metadataRow}>
                            <Ionicons name="location-outline" size={15} color={colors.textMuted} />
                            <Text style={styles.metadataText}>
                              {formatReportLocation(report)}
                            </Text>
                          </View>
                          <Text style={styles.description}>
                            {report.description || 'No description provided.'}
                          </Text>
                        </View>

                        <ContributionMediaThumb report={report} />
                      </View>

                      <View style={styles.cardFooter}>
                        <View style={styles.engagementSummary}>
                          <Ionicons name="arrow-up-circle-outline" size={21} color={colors.textMuted} />
                          <Text style={styles.engagementText}>{report.upvoteCount}</Text>
                          <Ionicons name="chatbubble-outline" size={21} color={colors.textMuted} />
                          <Text style={styles.engagementText}>{report.commentCount}</Text>
                        </View>
                        <View style={styles.openAction}>
                          <Text style={styles.openActionText}>View report</Text>
                          <Ionicons name="arrow-forward" size={18} color={colors.primary} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}

            <View style={styles.summaryRow}>
              <View style={styles.summaryCopy}>
                <View style={styles.summaryDot} />
                <Text style={styles.summaryText}>
                  {reports.length} {reports.length === 1 ? 'report' : 'reports'} submitted
                </Text>
              </View>
              <Text style={styles.resolvedText}>{resolvedCount} resolved</Text>
            </View>
          </>
        )}
      </ScrollView>
      )}
    </View>
  );
}
