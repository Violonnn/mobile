import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  scopedLifecyclePresentation,
  type ScopedLifecyclePresentationContext,
} from '../../lib/reportPresentation';
import type { LifecycleSummary } from '../../lib/reportLifecycle';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

type Props = {
  summary: LifecycleSummary;
  context: ScopedLifecyclePresentationContext;
  compact?: boolean;
  operationMode?: boolean;
};

/** Shared factual status and coordination summary for operational report views. */
export default function ReportStatusSummary({
  summary,
  context,
  compact = false,
  operationMode = false,
}: Props) {
  const presentation = scopedLifecyclePresentation(summary, context);
  const metadata = [
    presentation.coordinationLabel
      ? `Coordination: ${presentation.coordinationLabel}`
      : null,
    presentation.leadLabel,
    presentation.reviewLabel,
    presentation.note,
  ].filter((value): value is string => Boolean(value));

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.primaryRow}>
        <View
          style={[
            styles.stageTag,
            compact && styles.stageTagCompact,
            { backgroundColor: presentation.tone.softColor },
          ]}
        >
          <Text style={[styles.stageText, compact && styles.stageTextCompact, operationMode && styles.operationText, { color: presentation.tone.color }]} numberOfLines={1}>
            {presentation.stageLabel}
          </Text>
        </View>
      </View>
      {metadata.map((item, index) => (
        <Text
          key={`${index}-${item}`}
          style={[
            styles.metadataText,
            compact && styles.metadataTextCompact,
            operationMode && styles.operationText,
            item === presentation.note && styles.noteText,
          ]}
        >
          {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  containerCompact: {
    gap: 2,
  },
  primaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '100%',
  },
  stageTag: {
    maxWidth: '100%',
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  stageTagCompact: {
    paddingVertical: 3,
  },
  stageText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
  },
  stageTextCompact: {
    fontSize: fontSizes.sm,
  },
  metadataText: {
    maxWidth: '100%',
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    lineHeight: 20,
    color: colors.textMuted,
  },
  metadataTextCompact: {
    fontSize: fontSizes.sm,
    lineHeight: 18,
  },
  noteText: {
    color: colors.text,
  },
  operationText: {
    fontSize: fontSizes.lg,
    lineHeight: 22,
  },
});
