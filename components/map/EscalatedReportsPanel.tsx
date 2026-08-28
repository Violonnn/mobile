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
import { formatReportLocation, type MapReportMarker } from '../../lib/reports';
import { contributionStyles as styles } from '../../styles/components/yourContributions.styles';
import { colors } from '../../styles/theme';

type Props = {
  reports: MapReportMarker[];
  loading: boolean;
  error: string | null;
  bottomInset: number;
  collapsed: boolean;
  onLocateReport: (report: MapReportMarker) => void;
  onReviewReport: (report: MapReportMarker) => void;
  onRetry: () => void;
  onToggleCollapsed: () => void;
  dragHandlePanHandlers: GestureResponderHandlers;
};

export default function EscalatedReportsPanel({
  reports,
  loading,
  error,
  bottomInset,
  collapsed,
  onLocateReport,
  onReviewReport,
  onRetry,
  onToggleCollapsed,
  dragHandlePanHandlers,
}: Props) {
  return (
    <View style={styles.panel}>
      <View style={styles.dragHandleArea} {...dragHandlePanHandlers}>
        <TouchableOpacity
          style={styles.handleButton}
          onPress={onToggleCollapsed}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Show escalated reports' : 'Maximize the map'}
          accessibilityHint={collapsed ? 'You can also drag upward' : 'You can also drag downward'}
          accessibilityState={{ expanded: !collapsed }}
        >
          <View style={styles.dragIndicator} />
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ESCALATED REPORTS</Text>
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
            <Text style={styles.stateText}>Loading escalated reports…</Text>
          </View>
        ) : error && reports.length === 0 ? (
          <View style={styles.stateBlock}>
            <Ionicons name="cloud-offline-outline" size={27} color={colors.textMuted} />
            <Text style={styles.stateTitle}>Escalated reports unavailable</Text>
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
            <Text style={styles.stateTitle}>No escalated reports</Text>
            <Text style={styles.stateText}>New barangay escalations will appear here automatically.</Text>
          </View>
        ) : (
          <>
            {reports.map((report, index) => {
              const isLatest = index === 0;
              return (
                <TouchableOpacity
                  key={report.id}
                  style={[styles.reportCard, isLatest && styles.latestReportCard]}
                  onPress={() => onLocateReport(report)}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={`Locate escalated report: ${report.title}`}
                >
                  <View style={styles.statusRow}>
                    <Ionicons name="warning-outline" size={18} color={colors.danger} />
                    <Text style={[styles.statusText, { color: colors.danger }]}>Escalated</Text>
                    {isLatest ? <Text style={styles.latestBadge}>LATEST</Text> : null}
                  </View>

                  <Text style={[styles.reportTitle, isLatest && styles.latestReportTitle]}>
                    {report.title || 'Untitled report'}
                  </Text>
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
                      accessibilityLabel={`Review report: ${report.title}`}
                    >
                      <Text style={styles.openActionText}>Review report</Text>
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
                <View style={[styles.summaryDot, { backgroundColor: colors.danger }]} />
                <Text style={styles.summaryText}>
                  {reports.length} awaiting MDRRMO coordination
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
