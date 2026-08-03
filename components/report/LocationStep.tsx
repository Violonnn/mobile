import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { reportStyles as styles, reportColors } from '../../styles/screens/report.styles';

type Props = {
  loading: boolean;
  error: string | null;
  /** Low-confidence GPS awaiting map confirmation (accuracy worse than 100 m). */
  needsConfirmation?: boolean;
  accuracyMeters?: number | null;
  onRetry: () => void;
  onConfirmOnMap?: () => void;
};

/** Radar-style pulse ring behind a pin while GPS resolves. */
function PulsePin({ active }: { active: boolean }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
  }, [active, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulse.value),
    transform: [{ scale: 0.6 + pulse.value * 0.8 }],
  }));

  return (
    <View style={styles.pulseStage}>
      <Animated.View style={[styles.pulseRing, ringStyle]} />
      <View style={styles.pinBadge}>
        <Ionicons name="location-sharp" size={30} color={reportColors.white} />
      </View>
    </View>
  );
}

function formatAccuracyLabel(accuracyMeters: number | null | undefined): string {
  if (typeof accuracyMeters === 'number' && Number.isFinite(accuracyMeters)) {
    return `Location accuracy is about ±${Math.round(accuracyMeters)} m.`;
  }
  return 'Location accuracy could not be measured.';
}

export default function LocationStep({
  loading,
  error,
  needsConfirmation = false,
  accuracyMeters = null,
  onRetry,
  onConfirmOnMap,
}: Props) {
  const showError = !loading && !!error && !needsConfirmation;
  // Prefer map confirmation when accuracy is poor, even if label resolution failed.
  const showLowConfidence = !loading && needsConfirmation;

  return (
    <View style={styles.stepContent}>
      <View style={styles.locationCenter}>
        <PulsePin active={loading} />

        {showError ? (
          <>
            <Text style={styles.locationErrorText}>{error}</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="Retry getting location"
            >
              <Text style={styles.secondaryButtonText}>Try again</Text>
            </TouchableOpacity>
          </>
        ) : showLowConfidence ? (
          <>
            <Text style={styles.locationLabel}>Confirm your location</Text>
            <Text style={styles.locationHint}>
              {formatAccuracyLabel(accuracyMeters)}
            </Text>
            <Text style={styles.locationHint}>
              This may point to a nearby barangay. Try again outdoors, or confirm
              the pin on the map before continuing.
            </Text>
            <View style={styles.locationActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel="Retry getting location"
              >
                <Text style={styles.secondaryButtonText}>Try again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onConfirmOnMap}
                accessibilityRole="button"
                accessibilityLabel="Confirm location on map"
              >
                <Text style={styles.primaryButtonText}>Confirm on map</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.locationLabel}>Getting location…</Text>
            <Text style={styles.locationHint}>
              Pinpointing where this report is happening.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
