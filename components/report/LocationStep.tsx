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
  onRetry: () => void;
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

export default function LocationStep({ loading, error, onRetry }: Props) {
  const showError = !loading && !!error;

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
