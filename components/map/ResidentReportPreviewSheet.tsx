import React, { useMemo } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  formatReportLocation,
  getReportStatusPresentation,
  type MapReportMarker,
} from '../../lib/reports';
import { formatIncidentType } from '../../lib/incidentTypes';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
import { CollageCellContent } from '../report/ReportDetailCard';

type ResidentReportPreviewContentProps = {
  report: MapReportMarker;
  onClose: () => void;
  onOpenFullReport: () => void;
  primaryActionLabel?: string;
};

const STATUS_STEPS = [
  { key: 'unverified', label: 'Under review' },
  { key: 'verified', label: 'Verified' },
  { key: 'escalated', label: 'Escalated' },
  { key: 'resolved', label: 'Resolved' },
] as const;

function formatReportCode(reportId: string): string {
  return `DL-${reportId.replaceAll('-', '').slice(-6).toLocaleUpperCase()}`;
}

function formatMapDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ReportMediaStrip({ report }: { report: MapReportMarker }) {
  const visibleMedia = report.media.slice(0, 2);
  const hiddenCount = Math.max(0, report.media.length - 2);

  if (visibleMedia.length === 0) {
    return (
      <View style={styles.emptyMedia}>
        <Ionicons name="image-outline" size={28} color={colors.textMuted} />
        <Text style={styles.emptyMediaText}>No attachments</Text>
      </View>
    );
  }

  return (
    <View style={styles.mediaRow}>
      {visibleMedia.map((media, index) => (
        <View
          key={media.id}
          style={[styles.mediaCell, index === 0 ? styles.primaryMedia : styles.secondaryMedia]}
        >
          <CollageCellContent item={media} />
          {media.type === 'video' ? (
            <View style={styles.videoBadge}>
              <Ionicons name="play" size={12} color={colors.white} />
            </View>
          ) : null}
          {index === 1 && hiddenCount > 0 ? (
            <View style={styles.mediaCountBadge}>
              <Text style={styles.mediaCountText}>{`${report.media.length} items`}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function StatusJourney({ activeStep }: { activeStep: number }) {
  return (
    <View style={styles.journey}>
      <View style={styles.journeyTrack} pointerEvents="none" />
      {STATUS_STEPS.map((step, index) => {
        const completed = index <= activeStep;
        return (
          <View key={step.key} style={styles.journeyStep}>
            <View style={[styles.journeyDot, completed && styles.journeyDotCompleted]}>
              {completed ? (
                <Ionicons name="checkmark" size={13} color={colors.white} />
              ) : null}
            </View>
            <Text
              style={[styles.journeyLabel, completed && styles.journeyLabelCompleted]}
              numberOfLines={2}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function ResidentReportPreviewContent({
  report,
  onClose,
  onOpenFullReport,
  primaryActionLabel = 'Open full report',
}: ResidentReportPreviewContentProps) {
  const status = useMemo(
    () => getReportStatusPresentation(report.status),
    [report.status],
  );

  const showOptions = () => {
    Alert.alert('Report options', undefined, [
      { text: primaryActionLabel, onPress: onOpenFullReport },
      { text: 'Close preview', onPress: onClose },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <Text style={styles.reportCode}>{`REPORT #${formatReportCode(report.id)}`}</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {report.title || 'Untitled report'}
          </Text>
          <View
            style={[
              styles.statusPill,
              { borderColor: status.color, backgroundColor: status.backgroundColor },
            ]}
          >
            <Ionicons name="checkmark-circle-outline" size={14} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <TouchableOpacity
            style={styles.moreButton}
            onPress={showOptions}
            accessibilityRole="button"
            accessibilityLabel="Report options"
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ReportMediaStrip report={report} />

        <View style={styles.metadataGrid}>
          <View style={styles.metadataItem}>
            <Ionicons name="location-outline" size={18} color={colors.navigationActive} />
            <Text style={styles.metadataText} numberOfLines={2}>
              {formatReportLocation(report)}
            </Text>
          </View>
          <View style={styles.metadataItem}>
            <Ionicons name="calendar-outline" size={18} color={colors.navigationActive} />
            <Text style={styles.metadataText}>{formatMapDateTime(report.created_at)}</Text>
          </View>
          <View style={styles.metadataItem}>
            <Ionicons name="warning-outline" size={18} color={colors.navigationActive} />
            <Text style={styles.metadataText} numberOfLines={1}>
              {formatIncidentType(report.incidentType, report.incidentTypeOther)}
            </Text>
          </View>
          <View style={styles.metadataItem}>
            <Ionicons name="person-outline" size={18} color={colors.navigationActive} />
            <Text style={styles.metadataText}>Community report</Text>
          </View>
        </View>

        <StatusJourney activeStep={status.activeStep} />

        <Text style={styles.updatedText}>
          Status updates are synchronized across response teams
        </Text>
        <View style={styles.nextActionCard}>
          <Text style={styles.nextActionLabel}>Next:</Text>
          <Text style={styles.nextActionText}>{status.nextAction}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.navigationActive}
          />
          <Text style={styles.infoText}>
            Reports can be escalated to the Municipal DRRMO when barangay resources are insufficient.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.fullReportButton}
          onPress={onOpenFullReport}
          accessibilityRole="button"
          accessibilityLabel={primaryActionLabel}
        >
          <Text style={styles.fullReportButtonText}>{primaryActionLabel}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: spacing.md,
  },
  reportCode: {
    marginTop: spacing.xs,
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    letterSpacing: 0.45,
    color: colors.textMuted,
  },
  titleRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.navigationActive,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: radius.full,
  },
  statusText: {
    fontFamily: fonts.medium,
    fontSize: 10,
  },
  moreButton: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaRow: {
    height: 112,
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.sm,
    overflow: 'hidden',
    borderRadius: 10,
  },
  mediaCell: {
    overflow: 'hidden',
    backgroundColor: '#E6E9EE',
  },
  primaryMedia: {
    flex: 2.1,
  },
  secondaryMedia: {
    flex: 1,
  },
  emptyMedia: {
    height: 86,
    marginTop: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 10,
    backgroundColor: '#F0F2F5',
  },
  emptyMediaText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  videoBadge: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: 'rgba(15, 32, 68, 0.78)',
  },
  mediaCountBadge: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(15, 32, 68, 0.78)',
  },
  mediaCountText: {
    fontFamily: fonts.medium,
    fontSize: 9,
    color: colors.white,
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
    marginTop: spacing.md,
  },
  metadataItem: {
    width: '50%',
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  metadataText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.text,
  },
  journey: {
    position: 'relative',
    flexDirection: 'row',
    marginTop: 22,
    marginBottom: spacing.sm,
  },
  journeyTrack: {
    position: 'absolute',
    top: 12,
    left: '11%',
    right: '11%',
    height: 2,
    backgroundColor: '#D7DAE1',
  },
  journeyStep: {
    width: '25%',
    alignItems: 'center',
    gap: 7,
  },
  journeyDot: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#C4C8D0',
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  journeyDotCompleted: {
    borderColor: '#244D5B',
    backgroundColor: '#244D5B',
  },
  journeyLabel: {
    minHeight: 28,
    fontFamily: fonts.regular,
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
    color: colors.textMuted,
  },
  journeyLabelCompleted: {
    fontFamily: fonts.medium,
    color: colors.navigationActive,
  },
  updatedText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  nextActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#F1F5FB',
  },
  nextActionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.navigationActive,
  },
  nextActionText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.navigationActive,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 12,
  },
  infoText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 9,
    lineHeight: 14,
    color: colors.text,
  },
  footer: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: 12,
    paddingBottom: spacing.md,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  fullReportButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.navigationActive,
  },
  fullReportButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.white,
  },
});
