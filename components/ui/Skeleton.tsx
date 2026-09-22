import React, { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '../../styles/theme';

const SkeletonOpacityContext = createContext<Animated.Value | null>(null);

export function SkeletonGroup({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const [opacity] = useState(() => new Animated.Value(0.48));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.48, duration: 650, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <SkeletonOpacityContext.Provider value={opacity}>
      <View style={style} accessibilityLabel="Loading content" accessibilityRole="progressbar">
        {children}
      </View>
    </SkeletonOpacityContext.Provider>
  );
}

export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const opacity = useContext(SkeletonOpacityContext);
  return <Animated.View style={[styles.block, style, opacity ? { opacity } : undefined]} />;
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.border,
    borderRadius: radius.md,
  },
});
