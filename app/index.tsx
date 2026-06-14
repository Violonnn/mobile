import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { styles } from '../styles/screens/welcome.styles';
import { colors } from '../styles/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const [loadingDone, setLoadingDone] = useState(false);
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
    SplashScreen.hideAsync();
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
      {/* Welcome screen underneath */}
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Image source={require('../assets/images/AppLogo.png')} style={styles.logo} />
          </View>
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Disaster Report and</Text>
            <Text style={styles.heroTitleAccent}>Risk Management.</Text>
            <Text style={styles.heroSubtitle}>
              Report and connect with your community.{'\n'}
              Stay informed. Keep everyone safe.
            </Text>
          </View>
          <View style={styles.conceptSection}>
            <View style={styles.conceptImageWrapper}>
              <Image source={require('../assets/images/Concept.png')} style={styles.conceptImage} />
            </View>
          </View>
          <View style={styles.buttonsSection}>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')} activeOpacity={0.85}>
              <LinearGradient
                colors={['#000000', '#000000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.getStartedButton}
              >
                <Ionicons name="return-down-forward-outline" size={18} color={colors.white} />
                <Text style={styles.getStartedText}>Get Started</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/(auth)/login')} activeOpacity={0.85}>
              <Text style={styles.loginText}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Loading overlay on top — fades out when done */}
      {!loadingDone && (
        <Animated.View
          style={[loadingStyles.overlay, overlayStyle]}
          onLayout={handleSplashOverlayReady}
        >
          <View style={loadingStyles.centerBlock}>
            <Animated.View style={logoStyle}>
              <Image
                source={require('../assets/images/AppLogo.png')}
                style={loadingStyles.logo}
                resizeMode="contain"
              />
            </Animated.View>
            <Animated.Text style={[loadingStyles.appName, taglineStyle]}>
              DisasterLink
            </Animated.Text>
            <Animated.View style={[loadingStyles.line, lineStyle]} />
          </View>
          <Animated.Text style={[loadingStyles.footer, taglineStyle]}>
            Minglanilla Disaster and Risk Report
          </Animated.Text>
        </Animated.View>
      )}
    </View>
  );
}

const loadingStyles = StyleSheet.create({
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