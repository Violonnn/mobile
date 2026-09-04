import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import {
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
import { resolveSessionDestination } from '../lib/portalAccess';
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
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const splashHiddenRef = useRef(false);

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.82);
  const taglineOpacity = useSharedValue(0);
  const taglineY = useSharedValue(10);
  const lineWidth = useSharedValue(0);
  const lineOpacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);
  const visibleImageIndex = useSharedValue(0);

  function onLoadingDone() {
    setLoadingDone(true);
  }

  useEffect(() => {
    let mounted = true;

    resolveSessionDestination().then((destination) => {
      if (!mounted) return;
      if (destination) {
        router.replace(destination);
        return;
      }
      setPhase('welcome');
    });

    return () => {
      mounted = false;
    };
  }, [router]);

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
    logoOpacity.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSpring(1, { damping: 14, stiffness: 120 });

    taglineOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
    taglineY.value = withDelay(400, withSpring(0, { damping: 16, stiffness: 140 }));

    lineOpacity.value = withDelay(600, withTiming(1, { duration: 200 }));
    lineWidth.value = withDelay(700, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }));

    overlayOpacity.value = withDelay(
      1800,
      withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onLoadingDone)();
      }),
    );
  }, []);

  function handleSplashOverlayReady() {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    void hideNativeSplashOnce();
  }

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineY.value }],
  }));

  const lineStyle = useAnimatedStyle(() => ({
    opacity: lineOpacity.value,
    width: lineWidth.value * 120,
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
          <View style={splashStyles.centerBlock}>
            <Animated.View style={logoStyle}>
              <Image
                source={require('../assets/images/AppLogo.png')}
                style={splashStyles.logo}
                resizeMode="contain"
              />
            </Animated.View>
            <Animated.Text style={[splashStyles.appName, taglineStyle]}>
              DisasterLink
            </Animated.Text>
            <Animated.View style={[splashStyles.line, lineStyle]} />
          </View>
          <Animated.Text style={[splashStyles.footer, taglineStyle]}>
            Minglanilla Disaster and Risk Report
          </Animated.Text>
        </Animated.View>
      )}
    </View>
  );
}

const splashStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBlock: {
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 88,
    height: 88,
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.8,
  },
  line: {
    height: 3,
    backgroundColor: '#1A56DB',
    borderRadius: 999,
    marginTop: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
