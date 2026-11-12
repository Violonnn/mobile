import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAccessibilityLayout } from '../../hooks/useAccessibilityLayout';
import { formatPublishedAt } from '../../lib/formatTime';
import { formatIncidentType } from '../../lib/incidentTypes';
import { publicIncidentBarangayLabel, publicIncidentStatusLabel, publicIncidentTone, type PublicIncident } from '../../lib/publicIncidents';
import type { StageTone } from '../../lib/reportLifecycle';
import { formatReportLocation, getMapReportPresentation, type MapReportMarker, type ReportMediaAttachment, type ReportStatusPresentation } from '../../lib/reports';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
import {
  publicIncidentCaption,
  publicIncidentLatestUpdate,
  publicIncidentMedia,
  publicIncidentTitle,
} from '../report/PublicIncidentPost';
import { CollageCellContent, IncidentTagRow } from '../report/ReportDetailCard';

type CalloutContent = {
  statusLabel: string;
  tone: StageTone;
  incidentType: string | null;
  incidentTypeLabel: string;
  title: string;
  caption: string;
  update: { label: string; text: string } | null;
  meta: string;
  photo: ReportMediaAttachment | null;
};

type Props = {
  /** Either the resident's own report or a public incident post. */
  report?: MapReportMarker;
  incident?: PublicIncident;
  bottomOffset: number;
  onClose: () => void;
  onOpenDetails: () => void;
  /** Steps through incidents that share one rounded public map point. */
  pager?: { index: number; total: number; onPrevious: () => void; onNext: () => void };
  /** Preserves an official map's workflow label while keeping the resident map tone. */
  statusPresentation?: Pick<ReportStatusPresentation, 'label' | 'color' | 'backgroundColor'>;
};

function ownReportContent(
  report: MapReportMarker,
  statusPresentation?: Props['statusPresentation'],
): CalloutContent {
  const presentation = statusPresentation ?? getMapReportPresentation(report);
  return {
    statusLabel: presentation.label,
    tone: { color: presentation.color, softColor: presentation.backgroundColor },
    incidentType: report.incidentType,
    incidentTypeLabel: formatIncidentType(report.incidentType, report.incidentTypeOther),
    title: report.title || 'Untitled report',
    caption: report.description || 'No description provided.',
    update: null,
    meta: `${formatReportLocation(report)} · ${formatPublishedAt(report.created_at)}`,
    photo: report.media[0] ?? null,
  };
}

function publicIncidentContent(incident: PublicIncident): CalloutContent {
  const postedAt = incident.lastPublicUpdateAt ?? incident.confirmedAt;
  return {
    statusLabel: publicIncidentStatusLabel(incident.publicStatus),
    tone: publicIncidentTone(incident.publicStatus),
    incidentType: incident.incidentType,
    incidentTypeLabel: incident.publicTypeLabel,
    title: publicIncidentTitle(incident),
    caption: publicIncidentCaption(incident),
    update: publicIncidentLatestUpdate(incident),
    meta: postedAt
      ? `${publicIncidentBarangayLabel(incident)} · ${formatPublishedAt(postedAt)}`
      : publicIncidentBarangayLabel(incident),
    photo: publicIncidentMedia(incident)[0] ?? null,
  };
}

/**
 * Floating summary paired with the selected marker on the resident map. Colors
 * follow the report's stage; a thumbnail appears only when a real photo exists.
 */
export default function ResidentMapCallout({ report, incident, bottomOffset, onClose, onOpenDetails, pager, statusPresentation }: Props) {
  const { isLargeText } = useAccessibilityLayout();
  const content = incident ? publicIncidentContent(incident) : report ? ownReportContent(report, statusPresentation) : null;
  if (!content) return null;

  return (
    <View pointerEvents="box-none" style={[styles.positioner, { bottom: bottomOffset }]}>
      <View style={[styles.container, { borderColor: content.tone.softColor }]}>
        <View style={[styles.accentBar, { backgroundColor: content.tone.color }]} />
        <View style={styles.topRow}>
          <View style={styles.tags}>
            <IncidentTagRow
              statusLabel={content.statusLabel}
              statusColor={content.tone.color}
              statusBackgroundColor={content.tone.softColor}
              incidentType={content.incidentType}
              incidentTypeLabel={content.incidentTypeLabel}
            />
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.72}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close selected report"
          >
            <Ionicons name="close" size={19} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={[styles.body, isLargeText && styles.bodyLargeText]}>
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={2}>{content.title}</Text>
            <Text style={styles.caption} numberOfLines={isLargeText ? 4 : 2}>{content.caption}</Text>
            {content.update ? (
              <Text style={styles.update} numberOfLines={1}>
                <Text style={[styles.updateLabel, { color: content.tone.color }]}>{content.update.label}: </Text>
                {content.update.text}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color={colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={2}>{content.meta}</Text>
            </View>
          </View>
          {content.photo && !isLargeText ? (
            <View style={styles.thumbnail}>
              <CollageCellContent item={content.photo} />
            </View>
          ) : null}
        </View>

        {pager && pager.total > 1 ? (
          <View style={styles.pagerRow}>
            <TouchableOpacity
              style={styles.pagerButton}
              onPress={pager.onPrevious}
              accessibilityRole="button"
              accessibilityLabel="Previous report at this spot"
            >
              <Ionicons name="chevron-back" size={16} color={colors.navigationActive} />
            </TouchableOpacity>
            <Text style={styles.pagerText}>
              {pager.index + 1} of {pager.total} reports near this spot
            </Text>
            <TouchableOpacity
              style={styles.pagerButton}
              onPress={pager.onNext}
              accessibilityRole="button"
              accessibilityLabel="Next report at this spot"
            >
              <Ionicons name="chevron-forward" size={16} color={colors.navigationActive} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.detailsButton, { backgroundColor: content.tone.color }]}
        onPress={onOpenDetails}
        activeOpacity={0.84}
        accessibilityRole="button"
        accessibilityLabel="Open report details"
      >
        <Text style={styles.detailsButtonText}>View report details</Text>
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
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md + 4,
    paddingRight: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 10,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  tags: {
    maxWidth: '100%',
    flex: 1,
    minWidth: 0,
  },
  closeButton: {
    flexShrink: 0,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bodyLargeText: {
    alignItems: 'flex-start',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    lineHeight: 18,
    color: colors.text,
  },
  update: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
  },
  updateLabel: {
    fontFamily: fonts.semibold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
  },
  thumbnail: {
    width: 64,
    height: 64,
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pagerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
  },
  pagerText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  detailsButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  detailsButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.white,
  },
});
