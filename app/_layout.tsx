import { useEffect, useState } from 'react';
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
import { colors } from '../styles/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const AUTH_BRAND_LOGO = require('../assets/images/splash_iconDL-transparent.png');

export default function RootLayout() {
  const pathname = usePathname();
  const [brandAssetLoaded, setBrandAssetLoaded] = useState(false);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Welcome (/) does a branded splash handoff itself.
  // Deep links (e.g. /invite?token=…) never mount index — hide splash here
  // or the native splash stays forever.
  useEffect(() => {
    let mounted = true;

    // Warm the shared auth logo before any auth screen needs to paint it.
    Asset.loadAsync(AUTH_BRAND_LOGO)
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setBrandAssetLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!fontsLoaded || !brandAssetLoaded || !pathname || pathname === '/') return;

    // Give the destination screen one frame to paint before releasing native splash.
    const animationFrame = requestAnimationFrame(() => {
      void hideNativeSplashOnce();
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [brandAssetLoaded, fontsLoaded, pathname]);

  // Keep the native splash up until the app font is ready so text never
  // flashes in the fallback system font.
  if (!fontsLoaded || !brandAssetLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <Stack
          initialRouteName="index"
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
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
