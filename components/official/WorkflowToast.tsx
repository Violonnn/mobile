import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../styles/theme';
import { reportOperationsStyles as styles } from '../../styles/components/reportOperations.styles';

/** Mount with a new key for each success, including repeated identical messages. */
export default function WorkflowToast({ message, onDismiss, topOffset = 0 }: {
  message: string;
  onDismiss: () => void;
  topOffset?: number;
}) {
  const [translateY] = useState(() => new Animated.Value(-100));
  const [opacity] = useState(() => new Animated.Value(0));
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);
  const close = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closing = false;
    async function show() {
      const [reducedMotion, duration] = await Promise.all([
        AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
        Platform.OS === 'android'
          ? AccessibilityInfo.getRecommendedTimeoutMillis(5000).catch(() =>
            5000
          )
          : Promise.resolve(5000),
      ]);
      if (!active) return;
      close.current = () => {
        if (closing) return;
        closing = true;
        clearTimeout(timer);
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: reducedMotion ? 0 : -100,
            duration: reducedMotion ? 0 : 180,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: reducedMotion ? 0 : 180,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished && active) dismiss.current();
        });
      };
      if (reducedMotion) translateY.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: reducedMotion ? 0 : 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: reducedMotion ? 0 : 250,
          useNativeDriver: true,
        }),
      ]).start();
      AccessibilityInfo.announceForAccessibility(message);
      timer = setTimeout(() => close.current(), duration);
    }
    void show();
    return () => {
      active = false;
      clearTimeout(timer);
      translateY.stopAnimation();
      opacity.stopAnimation();
    };
  }, [message, opacity, translateY]);
  return (
    <View
      pointerEvents='box-none'
      style={[styles.toastLayer, { top: spacing.sm + topOffset }]}
    >
      <Animated.View
        style={[styles.toastCard, { opacity, transform: [{ translateY }] }]}
      >
        <Ionicons name='checkmark-circle' size={22} color={colors.success} />
        <Text style={styles.bannerText}>{message}</Text>
        <TouchableOpacity
          style={styles.toastClose}
          accessibilityRole='button'
          accessibilityLabel='Dismiss confirmation'
          onPress={() => close.current()}
        >
          <Ionicons name='close' size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
