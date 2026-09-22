import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import {
    AccessibilityInfo,
    ActivityIndicator,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hideNativeSplashOnce } from '../lib/nativeSplash';
import { resolveSessionDestination, type PortalDestination } from '../lib/portalAccess';
import { styles } from '../styles/screens/welcome.styles';
import { colors } from '../styles/theme';

const ONBOARDING_IMAGES: ImageSourcePropType[] = [
  require('../assets/images/municipal.png'),
  require('../assets/images/police.png'),
  require('../assets/images/bombero3.png'),
  require('../assets/images/bombero4.png'),
];

type FadingHeroImageProps = {
  activeImageIndex: SharedValue<number>;
  imageIndex: number;
  source: ImageSourcePropType;
};

function FadingHeroImage({
  activeImageIndex,
  imageIndex,
  source,
}: FadingHeroImageProps) {
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: withTiming(activeImageIndex.value === imageIndex ? 1 : 0, {
      duration: 900,
      easing: Easing.inOut(Easing.cubic),
    }),
  }));

  return (
    <Animated.Image
      source={source}
      style={[styles.heroImage, styles.fadingHeroImage, fadeStyle]}
      resizeMode="cover"
      accessible={false}
    />
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const [loadingDone, setLoadingDone] = useState(false);
  const [phase, setPhase] = useState<'checking' | 'welcome'>('checking');
  const [sessionDestination, setSessionDestination] = useState<PortalDestination | null | undefined>(undefined);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState<boolean | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const splashHiddenRef = useRef(false);

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.62);
  const logoX = useSharedValue(0);
  const logoRotation = useSharedValue(0);
  const disasterOpacity = useSharedValue(0);
  const disasterX = useSharedValue(96);
  const linkOpacity = useSharedValue(0);
  const linkX = useSharedValue(72);
  const overlayOpacity = useSharedValue(1);
  const visibleImageIndex = useSharedValue(0);

  function finishSplashAnimation() {
    setLoadingDone(true);
  }

  useEffect(() => {
    let mounted = true;

    resolveSessionDestination().then((destination) => {
      if (!mounted) return;
      setSessionDestination(destination);
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((isEnabled) => {
        if (mounted) setReduceMotionEnabled(isEnabled);
      })
      .catch(() => {
        if (mounted) setReduceMotionEnabled(false);
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!loadingDone || sessionDestination === undefined) return;

    if (sessionDestination) {
      router.replace(sessionDestination);
      return;
    }

    setPhase('welcome');
  }, [loadingDone, router, sessionDestination]);

  useEffect(() => {
    if (phase !== 'welcome') return;

    const fadeTimer = setTimeout(() => {
      const nextImageIndex = (activeImageIndex + 1) % ONBOARDING_IMAGES.length;

      visibleImageIndex.value = nextImageIndex;
      setActiveImageIndex(nextImageIndex);
    }, 4000);

    return () => clearTimeout(fadeTimer);
  }, [activeImageIndex, phase, visibleImageIndex]);

  useEffect(() => {
    if (reduceMotionEnabled === null) return;

    if (reduceMotionEnabled) {
      // Reduced Motion shows the finished logo without bouncing or spinning.
      logoScale.value = 0.66;
      logoX.value = -100;
      logoRotation.value = 0;
      disasterX.value = 0;
      linkX.value = 0;
      logoOpacity.value = withTiming(1, { duration: 260 });
      disasterOpacity.value = withTiming(1, { duration: 260 });
      linkOpacity.value = withTiming(1, { duration: 260 });
      overlayOpacity.value = withDelay(
        900,
        withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(finishSplashAnimation)();
        }),
      );
      return;
    }

    logoOpacity.value = withTiming(1, { duration: 180 });
    // Keep the arrival visible while retaining the requested distant-to-near bounce.
    logoScale.value = withSpring(1.05, { damping: 11, stiffness: 100, mass: 0.9 });

    // After settling, the logo rotates gently into its final position on the left.
    logoX.value = withDelay(900, withTiming(-100, { duration: 550, easing: Easing.inOut(Easing.cubic) }));
    logoScale.value = withDelay(900, withTiming(0.66, { duration: 550, easing: Easing.inOut(Easing.cubic) }));
    logoRotation.value = withDelay(900, withTiming(360, { duration: 550, easing: Easing.inOut(Easing.cubic) }));

    disasterOpacity.value = withDelay(1450, withTiming(1, { duration: 380 }));
    disasterX.value = withDelay(1450, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
    linkOpacity.value = withDelay(1720, withTiming(1, { duration: 360 }));
    linkX.value = withDelay(1720, withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic) }));

    overlayOpacity.value = withDelay(
      2700,
      withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(finishSplashAnimation)();
      }),
    );
  }, [reduceMotionEnabled]);

  function handleSplashOverlayReady() {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    void hideNativeSplashOnce();
  }

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { translateX: logoX.value },
      { rotate: `${logoRotation.value}deg` },
      { scale: logoScale.value },
    ],
  }));

  const disasterStyle = useAnimatedStyle(() => ({
    opacity: disasterOpacity.value,
    transform: [{ translateX: disasterX.value }],
  }));

  const linkStyle = useAnimatedStyle(() => ({
    opacity: linkOpacity.value,
    transform: [{ translateX: linkX.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  return (
    <View style={{ flex: 1 }}>
      {phase === 'welcome' ? (
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <StatusBar style="light" />

          {/* ── Hero image with overlay text ── */}
          <View style={styles.heroImageWrapper}>
            {ONBOARDING_IMAGES.map((imageSource, imageIndex) => (
              <FadingHeroImage
                key={`onboarding-image-${imageIndex}`}
                source={imageSource}
                imageIndex={imageIndex}
                activeImageIndex={visibleImageIndex}
              />
            ))}
            <View style={styles.heroOverlay} pointerEvents="none">
              <Text style={styles.brandText}>DisasterLink</Text>
              <View style={styles.locationBlock}>
                <Text style={styles.locationName}>Minglanilla, Cebu</Text>
                <Text style={styles.locationCoords}>10.2443° N  ·  123.7964° E</Text>
              </View>
              <View
                style={styles.paginationDots}
                accessible
                accessibilityLabel={`Image ${activeImageIndex + 1} of ${ONBOARDING_IMAGES.length}`}
              >
                {ONBOARDING_IMAGES.map((_, index) => (
                  <View
                    key={`pagination-dot-${index}`}
                    style={[
                      styles.paginationDot,
                      index === activeImageIndex && styles.paginationDotActive,
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>

          {/* ── Content below the image ── */}
          <View style={styles.content}>
            <View>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>Local reports  ·  Verified updates</Text>
                <Text style={styles.metaText}>DisasterLink v1.0.0</Text>
              </View>

              <Text style={styles.headline}>
                Know sooner.{'\n'}Respond together.
              </Text>

              <Text style={styles.subtitle}>
                One clear place to report incidents,{'\n'}follow local advisories, and stay{'\n'}connected when conditions change.
              </Text>
            </View>

            {/* ── CTA buttons ── */}
            <View style={styles.ctaSection}>
              <TouchableOpacity
                style={styles.getStartedButton}
                onPress={() => router.push('/(auth)/register')}
                activeOpacity={0.85}
              >
                <Text style={styles.getStartedText}>Get started</Text>
                <View style={styles.arrowCircle}>
                  <Ionicons name="arrow-forward" size={20} color={colors.white} />
                </View>
              </TouchableOpacity>

              <View style={styles.loginRow}>
                <Text style={styles.loginPrompt}>Already have an account?</Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}>
                  <Text style={styles.loginLink}>Log in</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      ) : (
        <View style={splashStyles.overlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* ── Splash loading overlay — fades out when done ── */}
      {!loadingDone && (
        <Animated.View
          style={[splashStyles.overlay, overlayStyle]}
          onLayout={handleSplashOverlayReady}
        >
          <View style={splashStyles.brandLockup}>
            <Animated.View style={logoStyle}>
              <Image
                source={require('../assets/images/splash_iconDL-transparent.png')}
                style={splashStyles.logo}
                resizeMode="contain"
              />
            </Animated.View>
            <View style={splashStyles.wordmark}>
              <Animated.Text style={[splashStyles.disasterText, disasterStyle]}>
                DISASTER
              </Animated.Text>
              <Animated.Text style={[splashStyles.linkText, linkStyle]}>
                L<Text style={splashStyles.linkI}>i</Text>NK
              </Animated.Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const splashStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLockup: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 132,
    width: '100%',
  },
  wordmark: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'baseline',
    left: '50%',
    marginLeft: -50,
  },
  logo: {
    width: 124,
    height: 124,
  },
  disasterText: {
    fontSize: 29,
    fontWeight: '800',
    color: '#123B79',
    letterSpacing: -1.3,
  },
  linkText: {
    fontSize: 29,
    fontWeight: '800',
    color: '#1599F2',
    letterSpacing: -1.3,
  },
  linkI: {
    color: '#D41545',
  },
});
