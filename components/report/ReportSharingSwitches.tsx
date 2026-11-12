import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts, fontSizes, spacing } from '../../styles/theme';

type Props = {
  showReporterName: boolean;
  onToggleReporterName: (value: boolean) => void;
  showReporterAvatar: boolean;
  onToggleReporterAvatar: (value: boolean) => void;
  allowExactLocation: boolean;
  onToggleExactLocation: (value: boolean) => void;
  disabled?: boolean;
};

function SharingSwitchRow({
  label,
  accessibilityLabel,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  accessibilityLabel: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled: boolean;
}) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(value ? 1 : 0, {
      duration: 160,
      easing: Easing.out(Easing.quad),
      reduceMotion: ReduceMotion.System,
    }));
  }, [progress, value]);

  const trackStyle = useAnimatedStyle(() => {
    const trackColor = interpolateColor(progress.get(), [0, 1], [colors.border, colors.navigationActive]);
    return { backgroundColor: trackColor, borderColor: trackColor };
  });
  const thumbStyle = useAnimatedStyle(() => ({
    // 36px track minus border, padding and 16px thumb leaves 14px of travel.
    transform: [{ translateX: progress.get() * 14 }],
  }));

  // The row owns interaction and accessibility; a fixed-size indicator avoids
  // native switch measurements extending beyond the narrow timeline column.
  return (
    <Pressable
      style={styles.row}
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
    >
      <Text style={styles.label}>{label}</Text>
      <View
        style={styles.switchContainer}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View style={[styles.switchTrack, trackStyle, disabled && styles.switchDisabled]}>
          <Animated.View style={[styles.switchThumb, thumbStyle]} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

/** Shared owner consent controls for submission and later report edits. */
export default function ReportSharingSwitches({
  showReporterName,
  onToggleReporterName,
  showReporterAvatar,
  onToggleReporterAvatar,
  allowExactLocation,
  onToggleExactLocation,
  disabled = false,
}: Props) {
  // Older reports may have separate saved choices. Keep those choices intact
  // until the resident uses the combined control, then update both together.
  const hasPartialIdentityChoice = showReporterName !== showReporterAvatar;

  function toggleIdentitySharing(value: boolean) {
    onToggleReporterName(value);
    onToggleReporterAvatar(value);
  }

  return (
    <View style={styles.group}>
      <SharingSwitchRow
        label="Name & profile picture"
        accessibilityLabel="Show my name and profile picture publicly"
        value={showReporterName || showReporterAvatar}
        onValueChange={toggleIdentitySharing}
        disabled={disabled}
      />
      {hasPartialIdentityChoice ? (
        <Text style={styles.hint}>
          Saved: {showReporterName ? 'name' : 'profile picture'} only. This switch changes both.
        </Text>
      ) : null}
      <SharingSwitchRow
        label="Exact incident location"
        accessibilityLabel="Show exact incident location publicly"
        value={allowExactLocation}
        onValueChange={onToggleExactLocation}
        disabled={disabled}
      />
      <Text style={styles.hint}>
        Report and media need BDRRMO approval. Responders receive full details and location.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    alignSelf: 'stretch',
    maxWidth: '100%',
    minWidth: 0,
    paddingBottom: spacing.xs,
  },
  row: {
    alignSelf: 'stretch',
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  switchContainer: {
    width: 44,
    minHeight: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchTrack: {
    width: 36,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.border,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  switchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  switchDisabled: {
    opacity: 0.55,
  },
  label: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    lineHeight: 17,
  },
  hint: {
    alignSelf: 'stretch',
    flexShrink: 1,
    marginTop: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    lineHeight: 17,
    color: colors.textMuted,
  },
});
