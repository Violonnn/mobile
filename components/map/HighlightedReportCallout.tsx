import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatPublishedAt } from '../../lib/formatTime';
import {
  formatReportLocation,
  getReportStatusPresentation,
  type MapReportMarker,
} from '../../lib/reports';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
import { useAccessibilityLayout } from '../../hooks/useAccessibilityLayout';
import { CollageCellContent } from '../report/ReportDetailCard';

type Props = {
  report: MapReportMarker;
  bottomOffset: number;
  onClose: () => void;
  onOpenDetails: () => void;
};

/** Floating map summary paired with the selected pulsing report marker. */
export default function HighlightedReportCallout({
  report,
  bottomOffset,
  onClose,
  onOpenDetails,
}: Props) {
  const { isLargeText } = useAccessibilityLayout();
  const previewMedia = report.media[0] ?? null;
  const status = getReportStatusPresentation(report.status);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.positioner, { bottom: bottomOffset }]}
    >
      <View
        style={[
          styles.container,
          isLargeText && styles.containerLargeText,
          { borderColor: status.backgroundColor },
        ]}
      >
        <View style={[styles.iconBadge, { backgroundColor: status.color }]}>
          <Ionicons name="warning" size={18} color={colors.white} />
        </View>

        <View style={styles.copy}>
          <View style={styles.eyebrowRow}>
            <Text style={[styles.eyebrow, { color: status.color }]}>SELECTED REPORT</Text>
            <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
          </View>
          <Text style={styles.title}>
            {report.title || 'Untitled report'}
          </Text>
          <Text style={styles.description}>
            {report.description || 'No description provided.'}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>
              {formatReportLocation(report)} · {formatPublishedAt(report.created_at)}
            </Text>
          </View>
        </View>

        {previewMedia ? (
          <View style={styles.thumbnail}>
            <CollageCellContent item={previewMedia} />
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel="Close selected report"
        >
          <Ionicons name="close" size={19} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.detailsButton, { backgroundColor: status.color }]}
        onPress={onOpenDetails}
        activeOpacity={0.84}
        accessibilityRole="button"
        accessibilityLabel="Open selected report details"
      >
        <Text style={styles.detailsButtonText}>View map details</Text>
        <Ionicons name="arrow-forward" size={17} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  positioner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 4,
  },
  container: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    paddingTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(179, 52, 67, 0.18)',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 10,
  },
  containerLargeText: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  iconBadge: {
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.danger,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.danger,
  },
  status: {
    fontFamily: fonts.semibold,
    fontSize: 9,
    color: colors.navigationActive,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    lineHeight: 18,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  metaText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textMuted,
  },
  thumbnail: {
    width: 58,
    height: 58,
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  closeButton: {
    width: 28,
    height: 28,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  detailsButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    backgroundColor: colors.navigationActive,
  },
  detailsButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.white,
  },
});
