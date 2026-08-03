// app/official/_layout.tsx
// Protected Expo Router Tabs for the official portal.
// Access is gated once; OfficialPortalProvider loads scope for role-aware UI.

import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Tabs, useRouter, type Href } from 'expo-router';
import OfficialBottomNav from '../../components/navigation/OfficialBottomNav';
import { OfficialPortalProvider } from '../../context/OfficialPortalContext';
import {
  requireActiveOfficialPortal,
  resolveSessionDestination,
} from '../../lib/portalAccess';
import { colors } from '../../styles/theme';

function OfficialTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
      tabBar={(props) => <OfficialBottomNav {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Command' }} />
      <Tabs.Screen name="incidents" options={{ title: 'Incidents' }} />
      <Tabs.Screen name="community" options={{ title: 'Community' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="resources" options={{ title: 'Resources' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      {/* Detail + log-incident stay reachable but off the tab bar. */}
      <Tabs.Screen
        name="[id]"
        options={{ href: null, title: 'Report detail' }}
      />
      <Tabs.Screen
        name="log-incident"
        options={{ href: null, title: 'Log incident' }}
      />
    </Tabs>
  );
}

export default function OfficialLayout() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const isOfficial = await requireActiveOfficialPortal();
      if (cancelled) return;

      if (!isOfficial) {
        const destination = await resolveSessionDestination();
        if (cancelled) return;
        router.replace((destination ?? '/(auth)/official-login') as Href);
        return;
      }

      setAllowed(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!allowed) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.themeSoft} />
      </View>
    );
  }

  return (
    <OfficialPortalProvider>
      <OfficialTabs />
    </OfficialPortalProvider>
  );
}
