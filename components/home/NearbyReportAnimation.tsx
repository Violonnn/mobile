import React, { useCallback, useRef } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import LottieView from 'lottie-react-native';

import { homeStyles as styles } from '../../styles/screens/home.styles';

const nearbyReportAnimation = require('../../assets/lottie/nearbyReport.json');

// Matches the trimmed composition: skip the pop-in (0-30) and the
// mismatched outro pose so the look-left / look-right cycle joins cleanly.
const LOOP_START_FRAME = 31;
const LOOP_END_FRAME = 72;

export default function NearbyReportAnimation() {
  const animationRef = useRef<LottieView>(null);
  const isFocusedRef = useRef(false);

  const playLoop = useCallback(() => {
    if (!isFocusedRef.current) return;
    animationRef.current?.play(LOOP_START_FRAME, LOOP_END_FRAME);
  }, []);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      playLoop();
      return () => {
        isFocusedRef.current = false;
        animationRef.current?.pause();
      };
    }, [playLoop]),
  );

  return (
    <View
      style={styles.nearbyReportAnimationWrap}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <LottieView
        ref={animationRef}
        source={nearbyReportAnimation}
        loop
        resizeMode="contain"
        cacheComposition
        onAnimationLoaded={playLoop}
        style={styles.nearbyReportAnimation}
      />
    </View>
  );
}
