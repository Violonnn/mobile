import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import BottomNav from '../../components/navigation/BottomNav';
import { startReportQueueWatcher } from '../../lib/reportQueueFlush';

// Tab order defines left→right layout in the custom bar:
// home | feed | (report action button) | map | profile
export default function MainLayout() {
  // Flush any queued reports on launch, reconnect, and app foreground.
  useEffect(() => {
    const stop = startReportQueueWatcher();
    return stop;
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'none',
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
