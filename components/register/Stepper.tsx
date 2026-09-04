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

const DEFAULT_STEP_LABELS = ['Phone', 'Verify', 'Details', 'PIN'];
const ACTIVE_MARKER_SIZE = 36;

type AnimatedConnectorProps = {
  filled: boolean;
};

function AnimatedConnector({ filled }: AnimatedConnectorProps) {
  const progress = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(filled ? 1 : 0, { duration: 420 }));
  }, [filled, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.get() }],
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

type StepperProps = {
  current: RegistrationStep;
  /** Optional labels — defaults to resident registration (Phone / Verify / Details / PIN). */
  labels?: [string, string, string, string];
};

export default function Stepper({
  current,
  labels = DEFAULT_STEP_LABELS as [string, string, string, string],
}: StepperProps) {
  const stepLabels = labels;
  const [markerCenters, setMarkerCenters] = useState<number[]>([]);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const leap = useSharedValue(0);

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

    leap.set(withSequence(
      withTiming(10, { duration: 80 }),
      withTiming(-22, { duration: 180 }),
      withTiming(-22, { duration: 80 }),
      withSpring(0, { damping: 10, stiffness: 160 }),
    ));

    translateX.set(withSpring(target, {
      damping: 16,
      stiffness: 170,
      mass: 0.9,
    }));

    scale.set(withSequence(
      withSpring(1.22, { damping: 8, stiffness: 200 }),
      withSpring(1, { damping: 13, stiffness: 170 }),
    ));
  }, [current, markerCenters, translateX, scale, leap]);

  useEffect(() => {
    scale.set(withSequence(
      withTiming(1, { duration: 420 }),
      withSpring(1.4, { damping: 4, stiffness: 180 }),
      withSpring(1.0, { damping: 6, stiffness: 120 }),
      withSpring(1.4, { damping: 4, stiffness: 180 }),
      withSpring(1.0, { damping: 6, stiffness: 120 }),
      withSpring(1.4, { damping: 4, stiffness: 180 }),
      withSpring(1.0, { damping: 6, stiffness: 120 }),
      withSpring(1.4, { damping: 4, stiffness: 180 }),
      withSpring(1.0, { damping: 6, stiffness: 120 }),
      withSpring(1.4, { damping: 4, stiffness: 180 }),
      withSpring(1.0, { damping: 6, stiffness: 120 }),
      withSpring(1.4, { damping: 4, stiffness: 180 }),
      withSpring(1.0, { damping: 6, stiffness: 120 }),
      withSpring(1.4, { damping: 4, stiffness: 180 }),
      withSpring(1.0, { damping: 6, stiffness: 120 }),
      withSpring(1.4, { damping: 4, stiffness: 180 }),
      withSpring(1.0, { damping: 6, stiffness: 120 }),
    ));
  }, [current, scale]);

  const activeMarkerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: leap.get() },
      { scale: scale.get() },
    ],
  }));

  return (
    <View style={styles.stepperWrapper}>
      <View style={styles.stepperRow}>
        {stepLabels.map((label, i) => {
          const isDone = i < current;
          const isLast = i === stepLabels.length - 1;

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
          <Animated.View
            pointerEvents="none"
            style={[styles.activeMarkerLayer, activeMarkerStyle]}
          >
            <Ionicons
              name="location-sharp"
              size={ACTIVE_MARKER_SIZE}
              color={registerColors.accent}
            />
          </Animated.View>
        )}
      </View>

      <View style={styles.stepLabelsRow}>
        {stepLabels.map((label, i) => {
          const isLast = i === stepLabels.length - 1;
          return (
            <React.Fragment key={label}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
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
              {!isLast && <View style={styles.stepLabelSpacer} />}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}
