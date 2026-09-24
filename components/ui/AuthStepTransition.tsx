import React, { useEffect, useRef, type ReactNode } from 'react';
import { Animated } from 'react-native';

type AuthStepTransitionProps = {
  children: ReactNode;
};

/** Gives each authentication step the same brief, native-driven entrance. */
export default function AuthStepTransition({ children }: AuthStepTransitionProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}
