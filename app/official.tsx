import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { officialStyles as styles } from '../styles/screens/official.styles';
import { colors } from '../styles/theme';
import { logout } from '../lib/auth';
import {
  requireActiveOfficialPortal,
  resolveSessionDestination,
} from '../lib/portalAccess';
import {
  fetchActiveOfficialAccess,
  scopeLabelFromAccess,
  type OfficialAccessScope,
} from '../lib/officialRegistration';

/**
 * Registration-success / active-official panel.
 * No official dashboard in this pass — Logout only.
 */
export default function OfficialAccessSuccessScreen() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [scope, setScope] = useState<OfficialAccessScope | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const allowed = await requireActiveOfficialPortal();
      if (cancelled) return;

      if (!allowed) {
        const destination = await resolveSessionDestination();
        if (cancelled) return;
        router.replace((destination ?? '/(auth)/official-login') as Href);
        return;
      }

      const { scope: accessScope } = await fetchActiveOfficialAccess();
      if (cancelled) return;

      if (!accessScope) {
        router.replace('/(auth)/official-login' as Href);
        return;
      }

      setScope(accessScope);
      setCheckingAccess(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const { error } = await logout();
      if (error) throw new Error(error);
      router.replace('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not log out.';
      Alert.alert('Logout failed', message);
    } finally {
      setLoggingOut(false);
    }
  }

  if (checkingAccess || !scope) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.themeSoft} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Official account active</Text>
          </View>
          <Text style={styles.title}>You&apos;re signed in</Text>
          <Text style={styles.subtitle}>
            Your government account is confirmed. The official workspace will be
            added in a later pass. For now you can verify sign-in works, then log
            out.
          </Text>

          <View style={styles.scopeBox}>
            <Text style={styles.scopeLabel}>Locked role</Text>
            <Text style={styles.scopeValue}>{scopeLabelFromAccess(scope)}</Text>
            <Text style={styles.scopeLabel}>Account email</Text>
            <Text style={styles.scopeMeta}>{scope.email}</Text>
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.85}
          >
            {loggingOut ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.logoutButtonText}>Log out</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
