import React, { useEffect } from 'react';
import { TextInput, View, Text } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { reportStyles as styles } from '../../styles/screens/report.styles';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Props = {
  /** Target progress 0–100. Changes animate the bar fill + counting number. */
  progress: number;
  label: string;
};

/**
 * Animated progress bar with a percentage that counts up to each checkpoint.
 * The count-up is the rewarding beat, so we drive both the fill scale and the
 * number from one shared value (no per-frame React re-renders).
 */
export default function ReportProgress({ progress, label }: Props) {
  const value = useSharedValue(0);

  useEffect(() => {
    value.value = withTiming(progress, {
      duration: 650,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, value]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(0.0001, value.value / 100) }],
  }));

  const animatedProps = useAnimatedProps(() => {
    const text = `${Math.round(value.value)}%`;
    return { text, defaultValue: text } as any;
  });

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, fillStyle]} />
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>{label}</Text>
        <AnimatedTextInput
          style={styles.progressPercent}
          editable={false}
          underlineColorAndroid="transparent"
          animatedProps={animatedProps}
        />
      </View>
    </View>
  );
}
