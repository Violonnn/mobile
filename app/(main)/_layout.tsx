import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import BottomNav from '../../components/navigation/BottomNav';
import { startReportQueueWatcher } from '../../lib/reportQueueFlush';
import { resolveSessionDestination } from '../../lib/portalAccess';
import { colors } from '../../styles/theme';

// Tab order defines left→right layout in the custom bar:
// home | feed | (report action button) | map | profile
export default function MainLayout() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  // Block admins/officials from the resident shell; restore them to their portal.
  useEffect(() => {
    let cancelled = false;

    resolveSessionDestination().then((destination) => {
      if (cancelled) return;

      if (!destination) {
        router.replace('/(auth)/login');
        return;
      }

      if (destination !== ('/(main)/home' as Href)) {
        router.replace(destination);
        return;
      }

      setAllowed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Flush any queued reports on launch, reconnect, and app foreground.
  useEffect(() => {
    if (!allowed) return;
    const stop = startReportQueueWatcher();
    return stop;
  }, [allowed]);

  if (!allowed) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'none',
        sceneStyle: { backgroundColor: colors.background },
      }}
      tabBar={(props) => <BottomNav {...props} />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
