import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Platform } from 'react-native';
import Constants from 'expo-constants';
import { Stack, usePathname } from 'expo-router';
import { Asset } from 'expo-asset';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { hideNativeSplashOnce } from '../lib/nativeSplash';
import UpdateRequiredScreen from '../components/ui/UpdateRequiredScreen';
import { canEnforceNativeUpdate, evaluateUpdateRequirement, fetchReleasePolicy, getInstalledAppVersion, recordAppVersion } from '../lib/appVersion';
import type { ReleasePolicy } from '../lib/appVersion';
import { supabase } from '../lib/supabase';
import { colors } from '../styles/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const AUTH_LOGOS = [
  require('../assets/images/splash_iconDL-transparent.png'),
  require('../assets/images/mingla.png'),
];

export default function RootLayout() {
  const pathname = usePathname();
  const [brandAssetLoaded, setBrandAssetLoaded] = useState(false);
  const [requiredPolicy, setRequiredPolicy] = useState<ReleasePolicy | null>(null);
  const [checkingRelease, setCheckingRelease] = useState(false);
  const [initialReleaseChecked, setInitialReleaseChecked] = useState(
    () => !canEnforceNativeUpdate(Platform.OS, Constants.executionEnvironment),
  );
  const releaseCheckSequence = useRef(0);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const checkRelease = useCallback(async () => {
    if (!canEnforceNativeUpdate(Platform.OS, Constants.executionEnvironment)) return;
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    const sequence = ++releaseCheckSequence.current;
    const { policy } = await fetchReleasePolicy(Platform.OS);
    if (sequence !== releaseCheckSequence.current) return;
    setRequiredPolicy(evaluateUpdateRequirement(getInstalledAppVersion(), policy) === 'required' ? policy : null);
    setCheckingRelease(false);
    setInitialReleaseChecked(true);
  }, []);

  useEffect(() => {
    void checkRelease();
    void recordAppVersion();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void checkRelease();
      void recordAppVersion();
    });
    // Defer work until Supabase's synchronous auth notification finishes.
    const checkInTimers = new Set<ReturnType<typeof setTimeout>>();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' || !session) return;
      const timer = setTimeout(() => {
        checkInTimers.delete(timer);
        void recordAppVersion();
      }, 0);
      checkInTimers.add(timer);
    });
    return () => {
      releaseCheckSequence.current += 1;
      appStateSubscription.remove();
      subscription.unsubscribe();
      checkInTimers.forEach(clearTimeout);
    };
  }, [checkRelease]);

  // Welcome (/) does a branded splash handoff itself.
  // Deep links (e.g. /invite?token=…) never mount index — hide splash here
  // or the native splash stays forever.
  useEffect(() => {
    let mounted = true;

    // Warm both auth logos before either login screen needs to paint them.
    Asset.loadAsync(AUTH_LOGOS)
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setBrandAssetLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!fontsLoaded || !brandAssetLoaded || !initialReleaseChecked || !pathname || (pathname === '/' && !requiredPolicy)) return;

    // Give the destination screen one frame to paint before releasing native splash.
    const animationFrame = requestAnimationFrame(() => {
      void hideNativeSplashOnce();
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [brandAssetLoaded, fontsLoaded, initialReleaseChecked, pathname, requiredPolicy]);

  // Standalone startup also waits for the bounded policy check before any route
  // can read incompatible data. Offline checks release the splash after four seconds.
  if (!fontsLoaded || !brandAssetLoaded || !initialReleaseChecked) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
            // Protected portals must never reveal an older auth route via swipe-back.
            gestureEnabled: false,
            fullScreenGestureEnabled: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen
            name="(auth)/forgot-password"
            options={({ route }) => {
              const routeParams = route.params as { source?: string } | undefined;
              const openedFromSettings = routeParams?.source === 'settings';

              return {
                animation: openedFromSettings ? 'slide_from_right' : 'none',
                gestureEnabled: openedFromSettings,
              };
            }}
          />
          <Stack.Screen
            name="(auth)/official-login"
            options={{
              // The native shared-axis transition makes the access-mode change clear
              // without adding JavaScript-driven work during navigation.
              animation: 'slide_from_right',
            }}
          />
        </Stack>
        {requiredPolicy && (
          <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => undefined}>
            <UpdateRequiredScreen
              policy={requiredPolicy}
              isChecking={checkingRelease}
              onRetry={() => { setCheckingRelease(true); void checkRelease(); }}
            />
          </Modal>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
