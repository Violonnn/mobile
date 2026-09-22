import { useEffect } from 'react';
import { Stack, usePathname } from 'expo-router';
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

export default function RootLayout() {
  const pathname = usePathname();
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
    if (!fontsLoaded) return;
    if (pathname === '/' || pathname === '/index') return;
    void hideNativeSplashOnce();
  }, [fontsLoaded, pathname]);

  // Keep the native splash up until the app font is ready so text never
  // flashes in the fallback system font.
  if (!fontsLoaded) return null;

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
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
