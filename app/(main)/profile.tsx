// app/(main)/profile.tsx — profile tab.
// Layout follows the reference design: "My Profile" title with a gear icon,
// identity block (avatar, name, phone), then a menu list. Only the
// Contributions and Log out entries exist for now.
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { profileStyles as styles } from '../../styles/screens/profile.styles';
import { colors } from '../../styles/theme';
import { logout } from '../../lib/auth';
import { fetchMyProfile, type PublicProfile } from '../../lib/profile';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { profile: myProfile, error } = await fetchMyProfile();
      if (cancelled) return;
      if (error) {
        Alert.alert('Profile', 'Could not load your profile. Please try again.');
      }
      setProfile(myProfile);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

  function handleContributionsPress() {
    // Placeholder until the contributions screen exists.
    Alert.alert('Contributions', 'Your contributions will show up here soon.');
  }

  function handleSettingsPress() {
    // Placeholder until the settings screen exists.
    Alert.alert('Settings', 'Settings will be available soon.');
  }

  function handleEditProfilePress() {
    // Placeholder — will navigate to the edit-profile screen once it exists.
    Alert.alert('Edit Profile', 'Profile editing will be available soon.');
  }

  const fullName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : '';
  const avatarInitial =
    profile?.first_name.trim().charAt(0).toUpperCase() || 'U';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Dark status bar icons — this screen has a light background. */}
      <StatusBar style="dark" />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.themeSoft} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleRow}>
            <Text style={styles.titleText}>My Profile</Text>
            <TouchableOpacity
              style={styles.gearButton}
              activeOpacity={0.8}
              onPress={handleSettingsPress}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              {/* Filled icon reads bolder than the outline variant. */}
              <Ionicons name="settings" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.identityRow}>
            {/* No profile photos yet — same initial-avatar format as the app. */}
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{avatarInitial}</Text>
            </View>
            <View style={styles.identityTextWrap}>
              {/* Shrinks the font slightly instead of wrapping or cutting off. */}
              <Text
                style={styles.nameText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {fullName || 'DisasterLink user'}
              </Text>
              <Text style={styles.phoneText} numberOfLines={1}>
                {profile?.phone ?? ''}
              </Text>
              <TouchableOpacity
                style={styles.editProfileButton}
                activeOpacity={0.85}
                onPress={handleEditProfilePress}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
              >
                <Text style={styles.editProfileText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.menuList}>
            <TouchableOpacity
              style={styles.menuRow}
              activeOpacity={0.7}
              onPress={handleContributionsPress}
              accessibilityRole="button"
              accessibilityLabel="Contributions"
            >
              <Ionicons name="albums-outline" size={24} color={colors.text} />
              <Text style={styles.menuRowLabel}>Contributions</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={handleLogout}
              disabled={loggingOut}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Log out"
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Ionicons name="log-out-outline" size={24} color={colors.danger} />
              )}
              <Text style={[styles.menuRowLabel, styles.menuRowLabelDanger]}>
                Log out
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
