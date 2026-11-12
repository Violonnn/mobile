import React from 'react';
import {
  ActivityIndicator,
  type GestureResponderHandlers,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatPublishedAt } from '../../lib/formatTime';
import {
  formatReportLocation,
  getMapReportPresentation,
  type MapReportMarker,
} from '../../lib/reports';
import IncidentTypeBadge from '../report/IncidentTypeBadge';
import { contributionStyles as styles } from '../../styles/components/yourContributions.styles';
import { colors } from '../../styles/theme';

type Props = {
  reports: MapReportMarker[];
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  reportPresentation?: (report: MapReportMarker) => { label: string; color: string } | null;
  loading: boolean;
  error: string | null;
  bottomInset: number;
  collapsed: boolean;
  onLocateReport: (report: MapReportMarker) => void;
  onReviewReport: (report: MapReportMarker) => void;
  onRetry: () => void;
  onToggleCollapsed: () => void;
  dragHandlePanHandlers: GestureResponderHandlers;
  queueTitle?: string;
  emptyTitle?: string;
  emptyBody?: string;
  loadingLabel?: string;
  reviewActionLabel?: string;
  reviewAccessibilityVerb?: string;
  summaryText?: (count: number) => string;
  summaryColor?: string;
};

export default function EscalatedReportsPanel({
  reports,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  reportPresentation,
  loading,
  error,
  bottomInset,
  collapsed,
  onLocateReport,
  onReviewReport,
  onRetry,
  onToggleCollapsed,
  dragHandlePanHandlers,
  queueTitle = 'INCOMING REQUESTS',
  emptyTitle = 'No incoming requests',
  emptyBody = 'New support and transfer requests will appear here automatically.',
  loadingLabel = 'Loading requests…',
  reviewActionLabel = 'Review report',
  reviewAccessibilityVerb = 'Review',
  summaryText = (count) => `${count} awaiting MDRRMO coordination`,
  summaryColor = colors.escalated,
}: Props) {
  return (
    <View style={styles.panel}>
      <View style={styles.dragHandleArea} {...dragHandlePanHandlers}>
        <TouchableOpacity
          style={styles.handleButton}
          onPress={onToggleCollapsed}
          activeOpacity={0.75}
          accessibilityRole="button"
            accessibilityLabel={collapsed ? `Show ${queueTitle.toLowerCase()}` : 'Maximize the map'}
          accessibilityHint={collapsed ? 'You can also drag upward' : 'You can also drag downward'}
          accessibilityState={{ expanded: !collapsed }}
        >
          <View style={styles.dragIndicator} />
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{queueTitle}</Text>
            <Text style={styles.headerSubtitle}>
              {collapsed ? 'Drag up to view the response queue' : 'Drag down to maximize the map'}
            </Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{reports.length}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading && reports.length === 0 ? (
          <View style={styles.stateBlock}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>{loadingLabel}</Text>
          </View>
        ) : error && reports.length === 0 ? (
          <View style={styles.stateBlock}>
            <Ionicons name="cloud-offline-outline" size={27} color={colors.textMuted} />
            <Text style={styles.stateTitle}>{queueTitle} unavailable</Text>
            <Text style={styles.stateText}>Check the connection and refresh the operational map.</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.stateBlock}>
            <View style={styles.emptyIcon}>
              <Ionicons name="checkmark-circle-outline" size={27} color={colors.primary} />
            </View>
            <Text style={styles.stateTitle}>{emptyTitle}</Text>
            <Text style={styles.stateText}>{emptyBody}</Text>
          </View>
        ) : (
          <>
            {reports.map((report, index) => {
              const isLatest = index === 0;
              const statusPresentation = reportPresentation?.(report) ?? getMapReportPresentation(report);
              return (
                <TouchableOpacity
                  key={report.id}
                  style={[styles.reportCard, isLatest && styles.latestReportCard]}
                  onPress={() => onLocateReport(report)}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={`Locate ${statusPresentation.label.toLowerCase()} report: ${report.title}`}
                >
                  <View style={styles.dateStatusRow}>
              <Ionicons name="warning-outline" size={18} color={statusPresentation.color} />
              <Text style={[styles.statusText, { color: statusPresentation.color }]}>
                {statusPresentation.label}
              </Text>
                    {isLatest ? <Text style={styles.latestBadge}>LATEST</Text> : null}
                  </View>

                  <Text style={[styles.reportTitle, isLatest && styles.latestReportTitle]}>
                    {report.title || 'Untitled report'}
                  </Text>
                  <IncidentTypeBadge
                    incidentType={report.incidentType}
                    incidentTypeOther={report.incidentTypeOther}
                  />
                  <Text style={styles.dateText}>{formatPublishedAt(report.created_at)}</Text>
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {formatReportLocation(report)}
                    </Text>
                  </View>
                  <Text style={styles.description} numberOfLines={isLatest ? 3 : 2}>
                    {report.description || 'No description provided.'}
                  </Text>

                  <View style={styles.cardFooter}>
                    <TouchableOpacity
                      style={styles.openAction}
                      onPress={(event) => {
                        event.stopPropagation();
                        onReviewReport(report);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${reviewAccessibilityVerb} report: ${report.title}`}
                    >
                      <Text style={styles.openActionText}>{reviewActionLabel}</Text>
                      <Ionicons name="arrow-forward" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <View style={styles.engagementSummary}>
                      <Ionicons name="arrow-up-outline" size={16} color={colors.textMuted} />
                      <Text style={styles.engagementText}>{report.upvoteCount}</Text>
                      <Ionicons name="chatbubble-outline" size={15} color={colors.textMuted} />
                      <Text style={styles.engagementText}>{report.commentCount}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            <View style={styles.summaryRow}>
              <View style={styles.summaryCopy}>
          <View style={[styles.summaryDot, { backgroundColor: summaryColor }]} />
                <Text style={styles.summaryText}>
                  {summaryText(reports.length)}
                </Text>
              </View>
            </View>
          </>
        )}
        {hasMore && onLoadMore && <TouchableOpacity onPress={onLoadMore} disabled={loadingMore} accessibilityRole="button"><Text style={styles.stateText}>{loadingMore ? 'Loading more reports...' : 'Load more reports'}</Text></TouchableOpacity>}
      </ScrollView>
    </View>
  );
}
