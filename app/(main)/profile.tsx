// app/(main)/profile.tsx — minimal profile tab. Only the logout action for now.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../../components/navigation/AppHeader';
import { logout } from '../../lib/auth';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const { error } = await logout();
      if (error) throw new Error(error);
      router.replace('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not log out. Please try again.';
      Alert.alert('Logout failed', message);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <AppHeader title="Profile" showProfile={false} />
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color={colors.primary} />
              <Text style={styles.logoutButtonText}>Log out</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: 132,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  logoutButtonText: {
    fontFamily: fonts.semibold,
    color: colors.primary,
    fontSize: fontSizes.lg,
  },
});
