import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { registerStyles as styles } from '../../styles/screens/register.styles';
import { RegistrationStep } from '../../types/registration';

const DEFAULT_STEP_LABELS = ['Phone', 'Verify', 'Details', 'PIN'];
const STEP_PERCENTAGES = [10, 40, 70, 98] as const;
const LINE_DURATION = 520;

type AnimatedTimelineLineProps = {
  direction?: 'forward' | 'reverse';
  delay: number;
  startPercentage?: number;
  endPercentage?: number;
  showPercentage?: boolean;
};

function AnimatedTimelineLine({
  direction = 'forward',
  delay,
  startPercentage = 0,
  endPercentage = 0,
  showPercentage = false,
}: AnimatedTimelineLineProps) {
  const lineProgress = useSharedValue(0);
  const trackWidth = useSharedValue(0);
  const [displayPercentage, setDisplayPercentage] = useState(startPercentage);

  useEffect(() => {
    lineProgress.set(withDelay(delay, withTiming(1, { duration: LINE_DURATION })));

    if (!showPercentage) return;

    const animationStartsAt = Date.now() + delay;
    const percentageTimer = setInterval(() => {
      const elapsedTime = Date.now() - animationStartsAt;
      const progress = Math.min(1, Math.max(0, elapsedTime / LINE_DURATION));
      const nextPercentage = Math.round(
        startPercentage + (endPercentage - startPercentage) * progress,
      );

      setDisplayPercentage(nextPercentage);

      if (progress === 1) {
        clearInterval(percentageTimer);
      }
    }, 32);

    return () => {
      clearInterval(percentageTimer);
    };
  }, [delay, endPercentage, lineProgress, showPercentage, startPercentage]);

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: lineProgress.get() }],
  }));
  const percentageTipStyle = useAnimatedStyle(() => {
    const progress = lineProgress.get();

    if (direction === 'reverse') {
      const availableTravelWidth = Math.max(0, trackWidth.get() - 60);
      return {
        transform: [{ translateX: (1 - progress) * availableTravelWidth + 4 }],
      };
    }

    // Shift behind the incoming tip while retaining a safe gap from the pulse ring.
    const labelOffset = 16 + 42 * progress;

    return {
      transform: [{ translateX: progress * trackWidth.get() - labelOffset }],
    };
  });

  function recordTrackWidth(event: LayoutChangeEvent) {
    trackWidth.set(event.nativeEvent.layout.width);
  }

  return (
    <View style={styles.singleStepLineTrack} onLayout={recordTrackWidth}>
      <Animated.View
        style={[
          styles.singleStepLine,
          direction === 'reverse' && styles.singleStepLineReverse,
          lineStyle,
        ]}
      />
      {showPercentage && (
        <Animated.Text style={[styles.singleStepMovingPercentage, percentageTipStyle]}>
          {displayPercentage}%
        </Animated.Text>
      )}
    </View>
  );
}

function CurrentStepNode({ entryDelay }: { entryDelay: number }) {
  const entryOpacity = useSharedValue(0);
  const entryScale = useSharedValue(0.9);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    entryOpacity.set(withDelay(entryDelay, withTiming(1, { duration: 220 })));
    entryScale.set(withDelay(entryDelay, withTiming(1, { duration: 220 })));
    pulseScale.set(
      withRepeat(
        withSequence(
          withTiming(1.55, { duration: 900 }),
          withTiming(1, { duration: 900 }),
        ),
        -1,
        false,
      ),
    );

    return () => {
      cancelAnimation(pulseScale);
    };
  }, [entryDelay, entryOpacity, entryScale, pulseScale]);

  const nodeEntryStyle = useAnimatedStyle(() => ({
    opacity: entryOpacity.get(),
    transform: [{ scale: entryScale.get() }],
  }));
  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.get() }],
  }));

  return (
    <Animated.View style={[styles.singleStepNodeContent, nodeEntryStyle]}>
      <View style={styles.stepCurrentNodeWrap}>
        <Animated.View style={[styles.stepCurrentPulseRing, pulseRingStyle]} />
        <View style={styles.stepCurrentNode} />
      </View>
    </Animated.View>
  );
}

function CurrentStepLabel({ entryDelay, label }: { entryDelay: number; label: string }) {
  const entryOpacity = useSharedValue(0);
  const entryScale = useSharedValue(0.96);

  useEffect(() => {
    entryOpacity.set(withDelay(entryDelay, withTiming(1, { duration: 220 })));
    entryScale.set(withDelay(entryDelay, withTiming(1, { duration: 220 })));
  }, [entryDelay, entryOpacity, entryScale]);

  const labelEntryStyle = useAnimatedStyle(() => ({
    opacity: entryOpacity.get(),
    transform: [{ scale: entryScale.get() }],
  }));

  return (
    <Animated.Text style={[styles.singleStepLabel, labelEntryStyle]}>
      {label}
    </Animated.Text>
  );
}

type StepperProps = {
  current: RegistrationStep;
  direction?: 'forward' | 'backward';
  hasPhoneInput?: boolean;
  /** Optional labels — defaults to resident registration (Phone / Verify / Details / PIN). */
  labels?: [string, string, string, string];
};

export default function Stepper({
  current,
  direction = 'forward',
  hasPhoneInput = false,
  labels = DEFAULT_STEP_LABELS as [string, string, string, string],
}: StepperProps) {
  const finalStepIndex = labels.length - 1;
  const hasIncomingLine = current > 0;
  const hasOutgoingLine = current < finalStepIndex;
  const isGoingBack = direction === 'backward';
  const isReverseTransition = isGoingBack && current > 0;
  const nodeEntryDelay = hasIncomingLine || isGoingBack ? LINE_DURATION : 100;
  const currentPercentage = current === 0
    ? hasPhoneInput ? STEP_PERCENTAGES[0] : 0
    : STEP_PERCENTAGES[current];
  const previousPercentage = current > 0 ? STEP_PERCENTAGES[current - 1] : 0;
  const nextPercentage = current < finalStepIndex
    ? STEP_PERCENTAGES[current + 1]
    : currentPercentage;

  return (
    <View
      style={styles.stepperWrapper}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: currentPercentage, min: 0, max: 100 }}
      accessibilityLabel={`${labels[current]} step, ${currentPercentage}% complete`}
    >
      <View style={styles.singleStepTimelineRow}>
        <View style={styles.singleStepIncomingArea}>
          {isReverseTransition && (
            <AnimatedTimelineLine
              key={`back-continuation-${current}`}
              direction="reverse"
              delay={nodeEntryDelay + 220}
            />
          )}
          {hasIncomingLine && !isReverseTransition && (
            <AnimatedTimelineLine
              key={`incoming-${current}`}
              delay={0}
              startPercentage={previousPercentage}
              endPercentage={currentPercentage}
              showPercentage
            />
          )}
        </View>

        <View style={styles.singleStepNodeSlot}>
          <CurrentStepNode key={current} entryDelay={nodeEntryDelay} />
        </View>

        <View style={styles.singleStepOutgoingArea}>
          {current === 0 && (
            <Text style={styles.singleStepPhonePercentage}>{currentPercentage}%</Text>
          )}
          {hasOutgoingLine && isGoingBack && (
            <AnimatedTimelineLine
              key={`reverse-${current}`}
              direction="reverse"
              delay={0}
              startPercentage={nextPercentage}
              endPercentage={currentPercentage}
              showPercentage={current > 0}
            />
          )}
          {hasOutgoingLine && !isGoingBack && (
            <AnimatedTimelineLine
              key={`outgoing-${current}`}
              delay={nodeEntryDelay + 180}
            />
          )}
        </View>
      </View>

      <View style={styles.singleStepLabelRow}>
        <View style={styles.singleStepIncomingArea} />
        <CurrentStepLabel key={current} entryDelay={nodeEntryDelay} label={labels[current]} />
        <View style={styles.singleStepOutgoingArea} />
      </View>
    </View>
  );
}
