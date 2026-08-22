import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { styles } from '../styles/screens/welcome.styles';
import { colors } from '../styles/theme';
import { hideNativeSplashOnce } from '../lib/nativeSplash';
import { resolveSessionDestination } from '../lib/portalAccess';

export default function WelcomeScreen() {
  const router = useRouter();
  const [loadingDone, setLoadingDone] = useState(false);
  const [phase, setPhase] = useState<'checking' | 'welcome'>('checking');
  const splashHiddenRef = useRef(false);

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.82);
  const taglineOpacity = useSharedValue(0);
  const taglineY = useSharedValue(10);
  const lineWidth = useSharedValue(0);
  const lineOpacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);

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
        <View style={styles.container}>
          <StatusBar style="light" />

          {/* ── Hero image with overlay text ── */}
          <View style={styles.heroImageWrapper}>
            <Image
              source={require('../assets/images/onboardingHeader.png')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.heroOverlay}>
              <Text style={styles.brandText}>DisasterLink</Text>
              <View style={styles.locationBlock}>
                <Text style={styles.locationName}>Minglanilla, Cebu</Text>
                <Text style={styles.locationCoords}>10.2443° N  ·  123.7964° E</Text>
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
        </View>
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
    ...StyleSheet.absoluteFillObject,
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
    color: '#111827',
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
