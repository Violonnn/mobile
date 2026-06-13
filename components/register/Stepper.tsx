import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';
import { RegistrationStep } from '../../types/registration';

const STEP_LABELS = ['Phone', 'Verify', 'Details', 'PIN'];
const ACTIVE_MARKER_SIZE = 36;

type AnimatedConnectorProps = {
  filled: boolean;
};

function AnimatedConnector({ filled }: AnimatedConnectorProps) {
  const progress = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(filled ? 1 : 0, { duration: 420 });
  }, [filled, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <View style={styles.stepConnectorTrack}>
      <View style={[styles.stepConnector, styles.stepConnectorInactive]} />
      <Animated.View
        style={[
          styles.stepConnector,
          styles.stepConnectorDone,
          styles.stepConnectorFill,
          fillStyle,
        ]}
      />
    </View>
  );
}

export default function Stepper({ current }: { current: RegistrationStep }) {
  const [markerCenters, setMarkerCenters] = useState<number[]>([]);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const bounce = useSharedValue(0);

  const recordMarkerCenter = useCallback((index: number, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    const center = x + width / 2 - ACTIVE_MARKER_SIZE / 2;
    setMarkerCenters((prev) => {
      const next = [...prev];
      next[index] = center;
      return next;
    });
  }, []);

  useEffect(() => {
    const target = markerCenters[current];
    if (target == null) return;

    translateX.value = withSpring(target, {
      damping: 16,
      stiffness: 170,
      mass: 0.9,
    });
    scale.value = withSequence(
      withSpring(1.18, { damping: 9, stiffness: 220 }),
      withSpring(1, { damping: 14, stiffness: 180 }),
    );
    bounce.value = withSequence(
      withTiming(-4, { duration: 140 }),
      withSpring(0, { damping: 12, stiffness: 200 }),
    );
  }, [current, markerCenters, translateX, scale, bounce]);

  const activeMarkerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: bounce.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.stepperWrapper}>
      <View style={styles.stepperRow}>
        {STEP_LABELS.map((label, i) => {
          const isDone = i < current;
          const isLast = i === STEP_LABELS.length - 1;

          return (
            <React.Fragment key={label}>
              <View
                style={styles.stepMarkerSlot}
                onLayout={(event) => recordMarkerCenter(i, event)}
              >
                {isDone ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={32}
                    color={registerColors.primary}
                  />
                ) : i === current ? (
                  <View style={styles.stepMarkerPlaceholder} />
                ) : (
                  <Ionicons
                    name="location-outline"
                    size={28}
                    color={registerColors.grayMuted}
                  />
                )}
              </View>
              {!isLast && <AnimatedConnector filled={i < current} />}
            </React.Fragment>
          );
        })}

        {markerCenters[current] != null && (
          <Animated.View style={[styles.activeMarkerLayer, activeMarkerStyle]}>
            <Ionicons
              name="location-sharp"
              size={ACTIVE_MARKER_SIZE}
              color={registerColors.accent}
            />
          </Animated.View>
        )}
      </View>

      <View style={styles.stepLabelsRow}>
        {STEP_LABELS.map((label, i) => (
          <Text
            key={label}
            style={[
              styles.stepLabel,
              i < current
                ? styles.stepLabelDone
                : i === current
                  ? styles.stepLabelActive
                  : styles.stepLabelInactive,
            ]}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}
