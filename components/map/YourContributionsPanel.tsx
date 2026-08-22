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

import { formatReportLocation, type MapReportMarker } from '../../lib/reports';
import { contributionStyles as styles } from '../../styles/components/yourContributions.styles';
import { colors } from '../../styles/theme';

function formatContributionDate(isoDate: string): string {
  const parsedDate = new Date(isoDate);
  if (Number.isNaN(parsedDate.getTime())) return 'Date unavailable';

  const datePart = parsedDate.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });
  const timePart = parsedDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} · ${timePart}`;
}

function contributionStatus(report: MapReportMarker): {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
} {
  if (report.isPending) {
    return { label: 'Uploading', icon: 'cloud-upload-outline', color: colors.primary };
  }
  if (report.status === 'resolved') {
    return { label: 'Resolved', icon: 'checkmark-circle-outline', color: colors.success };
  }
  if (report.status === 'escalated') {
    return { label: 'Escalated', icon: 'warning-outline', color: colors.danger };
  }
  if (report.status === 'verified') {
    return { label: 'Received', icon: 'shield-checkmark-outline', color: colors.primary };
  }
  return { label: 'Under review', icon: 'time-outline', color: '#F05B4F' };
}

export default function YourContributionsPanel({
  reports,
  loading,
  error,
  bottomInset,
  onReportPress,
  onRetry,
  collapsed,
  onToggleCollapsed,
  dragHandlePanHandlers,
}: {
  reports: MapReportMarker[];
  loading: boolean;
  error: string | null;
  bottomInset: number;
  onReportPress: (report: MapReportMarker) => void;
  onRetry: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  dragHandlePanHandlers: GestureResponderHandlers;
}) {
  const resolvedCount = reports.filter((report) => report.status === 'resolved').length;

  return (
    <View style={styles.panel}>
      <View style={styles.dragHandleArea} {...dragHandlePanHandlers}>
        <TouchableOpacity
          style={styles.handleButton}
          onPress={onToggleCollapsed}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Show your contributions' : 'Maximize the map'}
          accessibilityHint={collapsed ? 'You can also drag upward' : 'You can also drag downward'}
          accessibilityState={{ expanded: !collapsed }}
        >
          <Ionicons
            name={collapsed ? 'chevron-up' : 'chevron-down'}
            size={19}
            color={colors.primary}
          />
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>YOUR CONTRIBUTIONS</Text>
            <Text style={styles.headerSubtitle}>
              {collapsed ? 'Drag up to view your reports' : 'Drag down to maximize the map'}
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
            <Text style={styles.stateText}>Loading your reports…</Text>
          </View>
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
            {reports.map((report, index) => {
              const status = contributionStatus(report);
              const isLatest = index === 0;

              return (
                <TouchableOpacity
                  key={report.id}
                  style={[styles.reportCard, isLatest && styles.latestReportCard]}
                  onPress={() => onReportPress(report)}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={`Open report: ${report.title}`}
                >
                  <View style={styles.statusRow}>
                    <Ionicons name={status.icon} size={18} color={status.color} />
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    {isLatest ? <Text style={styles.latestBadge}>LATEST</Text> : null}
                  </View>

                  <Text style={[styles.reportTitle, isLatest && styles.latestReportTitle]}>
                    {report.title || 'Untitled report'}
                  </Text>
                  <Text style={styles.dateText}>{formatContributionDate(report.created_at)}</Text>
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
                    <View style={styles.openAction}>
                      <Text style={styles.openActionText}>View report</Text>
                      <Ionicons name="arrow-forward" size={18} color={colors.primary} />
                    </View>
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
    </View>
  );
}
