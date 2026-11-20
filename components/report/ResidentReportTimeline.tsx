import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { formatPublishedAt } from '../../lib/formatTime';
import type { ResidentTimelineEntry } from '../../lib/reports';
import { newestActivityFirst } from '../../lib/reportPresentation';
import { RESIDENT_STAGE_TONES, type StageTone } from '../../lib/reportLifecycle';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

export default function ResidentReportTimeline({
  entries,
  currentStatusTone = RESIDENT_STAGE_TONES.received,
}: {
  entries: ResidentTimelineEntry[];
  currentStatusTone?: StageTone;
}): React.JSX.Element {
  const orderedEntries = newestActivityFirst(entries);
  const gradientProgress = useSharedValue(0);
  const hasCurrentActivity = orderedEntries.length > 0;
  const [currentCardWidth, setCurrentCardWidth] = useState(0);

  useEffect(() => {
    if (!hasCurrentActivity) {
      cancelAnimation(gradientProgress);
      gradientProgress.set(0);
      return;
    }

    gradientProgress.set(withRepeat(
      withTiming(1, {
        duration: 7200,
        easing: Easing.inOut(Easing.sin),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      true,
      undefined,
      ReduceMotion.System,
    ));

    return () => cancelAnimation(gradientProgress);
  }, [gradientProgress, hasCurrentActivity]);

  const gradientMotionStyle = useAnimatedStyle(() => {
    const movement = (gradientProgress.get() - 0.5) * currentCardWidth * 0.6;
    return {
      transform: [{ translateX: movement }, { translateY: movement * 0.12 }, { scale: 1.1 }],
    };
  }, [currentCardWidth]);
  const gradientColors = [
    withColorAlpha(currentStatusTone.color, 0.1),
    withColorAlpha(currentStatusTone.color, 0.3),
    withColorAlpha(currentStatusTone.color, 0.04),
    withColorAlpha(currentStatusTone.color, 0.24),
    withColorAlpha(currentStatusTone.color, 0.1),
  ] as const;

  return <View style={styles.container}>
    <Text style={styles.heading}>Report activity</Text>
    {orderedEntries.length === 0 && <Text style={styles.empty}>No activity has been posted yet.</Text>}
    {orderedEntries.map((entry, index) => {
      const isCurrentActivity = index === 0;
      const activityTextStyles = isCurrentActivity ? styles.currentText : styles.pastText;
      const dateTextStyles = isCurrentActivity ? styles.currentDate : styles.pastDate;
      const officeTextStyles = isCurrentActivity ? styles.currentOffice : styles.pastOffice;
      const activityContainerStyles = isCurrentActivity
        ? [styles.currentEntry, {
          backgroundColor: currentStatusTone.softColor,
          borderColor: withColorAlpha(currentStatusTone.color, 0.38),
        }]
        : [styles.pastEntry];

      return <View
        key={`${entry.occurredAt}-${entry.entryType}-${index}`}
        onLayout={isCurrentActivity ? (event) => {
          const cardWidth = event.nativeEvent.layout.width;
          setCurrentCardWidth((previousWidth) => Math.abs(previousWidth - cardWidth) < 1 ? previousWidth : cardWidth);
        } : undefined}
        style={[styles.entry, activityContainerStyles]}
      >
        {isCurrentActivity && <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.gradientLayer, gradientMotionStyle]}
        >
          <LinearGradient
            colors={gradientColors}
            locations={[0, 0.25, 0.5, 0.75, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientFill}
          />
        </Animated.View>}
        <View style={styles.entryContent}>
          <View style={styles.activityRow}>
            <Text style={[styles.activity, activityTextStyles]}>
              {entry.publicText}
            </Text>
            <Text style={[styles.date, dateTextStyles]}>
              {formatPublishedAt(entry.occurredAt)}
            </Text>
          </View>
          <Text style={[styles.office, officeTextStyles]}>
            {entry.responsibleOfficeLabel || 'Awaiting assignment'}
          </Text>
        </View>
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  heading: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  entry: { position: 'relative', overflow: 'hidden', borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  currentEntry: {
    padding: spacing.md,
    borderWidth: 1,
  },
  pastEntry: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.offWhite,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  entryContent: { gap: spacing.xs },
  gradientLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  gradientFill: { flex: 1 },
  activity: { flex: 1, flexShrink: 1, fontFamily: fonts.medium },
  date: { flexShrink: 1, maxWidth: '45%', fontFamily: fonts.regular, textAlign: 'right' },
  office: { fontFamily: fonts.regular },
  currentText: { fontSize: fontSizes.lg, color: colors.text },
  pastText: { fontSize: fontSizes.sm, color: colors.textMuted },
  currentDate: { fontSize: fontSizes.sm, color: colors.text },
  pastDate: { fontSize: fontSizes.xs, color: colors.textMuted },
  currentOffice: { fontSize: fontSizes.sm, color: colors.text },
  pastOffice: { fontSize: fontSizes.sm, color: colors.textMuted },
  empty: { fontFamily: fonts.regular, fontSize: fontSizes.md, color: colors.textMuted },
});

function withColorAlpha(hexColor: string, opacity: number): string {
  const colorMatch = hexColor.match(/^#([\da-f]{6})$/i);
  if (!colorMatch) return hexColor;

  const colorValue = Number.parseInt(colorMatch[1], 16);
  const red = (colorValue >> 16) & 255;
  const green = (colorValue >> 8) & 255;
  const blue = colorValue & 255;
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}
