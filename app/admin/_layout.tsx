// app/admin/_layout.tsx
// Protected Expo Router Tabs shell for the system-admin portal.
// Access is gated once here so Dashboard / Invites / Settings never render
// protected content for non-admins.

import { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import AdminBottomNav from '../../components/navigation/AdminBottomNav';
import { AdminShellSkeleton } from '../../components/ui/AdminScreenSkeletons';
import { AdminInvitesProvider } from '../../context/AdminInvitesContext';
import {
  checkActiveAdminAccess,
  resolveSessionDestination,
} from '../../lib/portalAccess';
import { supabase } from '../../lib/supabase';
import { adminColors, adminStyles as styles } from '../../styles/screens/admin.styles';

type AccessState = 'checking' | 'allowed' | 'error' | 'denied';

async function leaveProtectedAdminRoute(router: ReturnType<typeof useRouter>) {
  let destination: Href | null = null;
  try {
    destination = await resolveSessionDestination();
  } catch {
    destination = null;
  }

  router.replace(
    (destination && destination !== '/admin'
      ? destination
      : '/(auth)/official-login') as Href,
  );
}

export default function AdminLayout() {
  const router = useRouter();
  const [accessState, setAccessState] = useState<AccessState>('checking');
  const [accessError, setAccessError] = useState('');
  const [userId, setUserId] = useState('');
  const [accessAttempt, setAccessAttempt] = useState(0);
  const seenUserIdRef = useRef<string | null>(null);

  const handleAdminAccessDenied = useCallback(async () => {
    setAccessState('denied');
    setUserId('');
    await leaveProtectedAdminRoute(router);
  }, [router]);

  // Session changes unmount the scoped invitation cache before checking again.
  // Supabase auth callbacks stay synchronous; the access check runs in an effect.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (event === 'INITIAL_SESSION') {
        seenUserIdRef.current = nextUserId;
        return;
      }

      const userChanged = nextUserId !== seenUserIdRef.current;
      seenUserIdRef.current = nextUserId;
      if (event !== 'SIGNED_OUT' && !userChanged) return;

      setAccessState('checking');
      setAccessError('');
      setUserId('');
      setAccessAttempt((currentAttempt) => currentAttempt + 1);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  // Shared admin access gate for every child route under /admin.
  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      setAccessState('checking');
      setAccessError('');
      const result = await checkActiveAdminAccess();
      if (cancelled) return;

      if (result.status === 'error') {
        setAccessError(result.message);
        setAccessState('error');
        return;
      }

      if (result.status === 'denied') {
        setAccessState('denied');
        await leaveProtectedAdminRoute(router);
        return;
      }

      seenUserIdRef.current = result.userId;
      setUserId(result.userId);
      setAccessState('allowed');
    };

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, [accessAttempt, router]);

  if (accessState === 'checking') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <AdminShellSkeleton />
      </SafeAreaView>
    );
  }

  if (accessState !== 'allowed') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Couldn&apos;t check admin access</Text>
          <Text style={styles.emptyStateBody}>
            {accessError || 'Try again to continue to the admin workspace.'}
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setAccessAttempt((currentAttempt) => currentAttempt + 1)}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AdminInvitesProvider
      key={userId}
      userId={userId}
      onAccessDenied={() => void handleAdminAccessDenied()}
    >
      <Tabs
        screenOptions={{
          headerShown: false,
          animation: 'none',
          sceneStyle: { backgroundColor: adminColors.canvas },
        }}
        tabBar={(props) => <AdminBottomNav {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
        <Tabs.Screen name="invitations" options={{ title: 'Invites' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
        {/* SDK 58 redirects away from href: null. The custom nav omits this
            compatibility route; its screen redirects to Settings. */}
        <Tabs.Screen name="accounts" options={{ title: 'Accounts redirect' }} />
      </Tabs>
    </AdminInvitesProvider>
  );
}
