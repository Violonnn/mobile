import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { colors, fonts } from '../../styles/theme';

type LoginSplashTransitionProps = {
  onComplete: () => void;
};

const LOGO_SOURCE = require('../../assets/images/splash_iconDL-transparent.png');
const SKY_BLUE = '#009EF9';
const LINK_RED = '#D71945';

/** Plays before the resident sign-in form is revealed. */
export default function LoginSplashTransition({ onComplete }: LoginSplashTransitionProps) {
  const { height, width } = useWindowDimensions();
  const [logoScale] = useState(() => new Animated.Value(0.16));
  const [logoTranslateY] = useState(() => new Animated.Value(0));
  const [wordmarkOpacity] = useState(() => new Animated.Value(0));
  const [disasterTranslateX] = useState(() => new Animated.Value(width * 0.45));
  const [linkTranslateX] = useState(() => new Animated.Value(width * 0.45));

  const dimensions = useMemo(() => {
    const logoSize = Math.min(Math.max(width * 0.38, 132), 172);

    return {
      // Enlarging while moving upward makes the logo clear the phone's top edge.
      exitLogoScale: Math.max(width / logoSize + 0.8, 2.8),
      exitLogoTranslateY: -(height / 2 + logoSize),
      logoSize,
    };
  }, [height, width]);

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 85,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(logoTranslateY, {
          toValue: -30,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(disasterTranslateX, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(linkTranslateX, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(280),
      Animated.parallel([
        Animated.timing(wordmarkOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(logoScale, {
          toValue: dimensions.exitLogoScale,
          duration: 420,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoTranslateY, {
          toValue: dimensions.exitLogoTranslateY,
          duration: 420,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start(({ finished }) => {
      if (finished) onComplete();
    });

    return () => animation.stop();
  }, [
    disasterTranslateX,
    dimensions.exitLogoScale,
    dimensions.exitLogoTranslateY,
    linkTranslateX,
    logoScale,
    logoTranslateY,
    onComplete,
    wordmarkOpacity,
  ]);

  return (
    <Animated.View pointerEvents="none" style={styles.container}>
      <Animated.View
        style={[
          styles.logoAndWordmark,
          { transform: [{ translateY: logoTranslateY }, { scale: logoScale }] },
        ]}
      >
        <Image source={LOGO_SOURCE} style={{ height: dimensions.logoSize, width: dimensions.logoSize }} />
        <Animated.View style={[styles.wordmark, { opacity: wordmarkOpacity }]}>
          <Animated.Text style={[styles.disasterText, { transform: [{ translateX: disasterTranslateX }] }]}>
            DISASTER
          </Animated.Text>
          <Animated.Text style={[styles.linkText, { transform: [{ translateX: linkTranslateX }] }]}>
            L<Text style={styles.linkI}>i</Text>NK
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: colors.background,
    justifyContent: 'center',
    zIndex: 20,
  },
  logoAndWordmark: { alignItems: 'center' },
  wordmark: { flexDirection: 'row', marginTop: 14, overflow: 'hidden' },
  disasterText: {
    color: colors.navigationActive,
    fontFamily: fonts.extrabold,
    fontSize: 32,
    letterSpacing: -1.2,
  },
  linkText: {
    color: SKY_BLUE,
    fontFamily: fonts.extrabold,
    fontSize: 32,
    letterSpacing: -1.2,
  },
  linkI: { color: LINK_RED, fontFamily: fonts.extrabold },
});
