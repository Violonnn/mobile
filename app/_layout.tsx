import { useEffect } from 'react';
import { Stack, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora';
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed';
import { hideNativeSplashOnce } from '../lib/nativeSplash';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const pathname = usePathname();
  const [fontsLoaded] = useFonts({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
    BarlowCondensed_600SemiBold,
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
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      />
    </SafeAreaProvider>
  );
}
