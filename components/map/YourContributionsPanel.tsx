import React, { useMemo } from 'react';
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

type ContributionDateGroup = {
  key: string;
  label: string;
  reports: MapReportMarker[];
};

function formatContributionTime(isoDate: string): string {
  const parsedDate = new Date(isoDate);
  if (Number.isNaN(parsedDate.getTime())) return 'Date unavailable';

  return parsedDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatContributionTitle(title: string): string {
  const normalizedTitle = title.trim().toLocaleLowerCase();
  if (!normalizedTitle) return 'Untitled report';

  return `${normalizedTitle.charAt(0).toLocaleUpperCase()}${normalizedTitle.slice(1)}`;
}

function getContributionDateKey(isoDate: string): string {
  const parsedDate = new Date(isoDate);
  if (Number.isNaN(parsedDate.getTime())) return 'date-unavailable';

  return `${parsedDate.getFullYear()}-${parsedDate.getMonth()}-${parsedDate.getDate()}`;
}

function formatContributionGroupLabel(isoDate: string, now: Date): string {
  const parsedDate = new Date(isoDate);
  if (Number.isNaN(parsedDate.getTime())) return 'Date unavailable';

  // UTC day numbers compare local calendar dates safely across daylight-saving changes.
  const todayDayNumber = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const reportDayNumber = Date.UTC(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
  );
  const calendarDaysAgo = Math.round((todayDayNumber - reportDayNumber) / 86_400_000);

  if (calendarDaysAgo === 0) return 'Today';
  if (calendarDaysAgo === 1) return 'Yesterday';

  return parsedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function groupContributionsByDate(
  reports: MapReportMarker[],
  now: Date,
): ContributionDateGroup[] {
  const groups: ContributionDateGroup[] = [];
  const groupByKey = new Map<string, ContributionDateGroup>();

  reports.forEach((report) => {
    const key = getContributionDateKey(report.created_at);
    const existingGroup = groupByKey.get(key);
    if (existingGroup) {
      existingGroup.reports.push(report);
      return;
    }

    const newGroup: ContributionDateGroup = {
      key,
      label: formatContributionGroupLabel(report.created_at, now),
      reports: [report],
    };
    groupByKey.set(key, newGroup);
    groups.push(newGroup);
  });

  return groups;
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
  const contributionGroups = useMemo(
    () => groupContributionsByDate(reports, new Date()),
    [reports],
  );

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
          <View style={styles.dragIndicator} />
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
            {contributionGroups.map((group) => (
              <View key={group.key} style={styles.dateGroup}>
                <Text style={styles.dateGroupTitle}>{group.label}</Text>

                {group.reports.map((report) => {
                  const status = contributionStatus(report);
                  const isLatest = report.id === reports[0]?.id;

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
                        <Text style={[styles.statusText, { color: status.color }]}>
                          {status.label}
                        </Text>
                        {isLatest ? <Text style={styles.latestBadge}>LATEST</Text> : null}
                      </View>

                      <Text style={[styles.reportTitle, isLatest && styles.latestReportTitle]}>
                        {formatContributionTitle(report.title)}
                      </Text>
                      <Text style={styles.metadataText} numberOfLines={1}>
                        {formatContributionTime(report.created_at)} | {formatReportLocation(report)}
                      </Text>
                      <Text style={styles.description} numberOfLines={isLatest ? 3 : 2}>
                        {report.description || 'No description provided.'}
                      </Text>

                      <View style={styles.cardFooter}>
                        <View style={styles.engagementSummary}>
                          <Ionicons name="arrow-up-outline" size={16} color={colors.textMuted} />
                          <Text style={styles.engagementText}>{report.upvoteCount}</Text>
                          <Ionicons name="chatbubble-outline" size={15} color={colors.textMuted} />
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
              </View>
            ))}

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
