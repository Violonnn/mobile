// app/admin/_layout.tsx
// Protected Expo Router Tabs shell for the system-admin portal.
// Access is gated once here so Overview / Invites / Accounts never render
// protected content for non-admins.

import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Tabs, useRouter, type Href } from 'expo-router';
import AdminBottomNav from '../../components/navigation/AdminBottomNav';
import {
  requireActiveAdmin,
  resolveSessionDestination,
} from '../../lib/portalAccess';
import { colors } from '../../styles/theme';

export default function AdminLayout() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  // Shared admin access gate for every child route under /admin.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const isAdmin = await requireActiveAdmin();
      if (cancelled) return;

      if (!isAdmin) {
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
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
      tabBar={(props) => <AdminBottomNav {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Overview' }} />
      <Tabs.Screen name="invitations" options={{ title: 'Invites' }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts' }} />
    </Tabs>
  );
}
