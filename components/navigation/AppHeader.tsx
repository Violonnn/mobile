// components/navigation/AppHeader.tsx — reusable blue header bar.
// Shows the "DisasterLink" brand, a centered screen title, a notification bell,
// and the profile avatar. Optionally renders a search bar below the top row.
// Shared across the home, feed, map, and profile tabs.
//
// The avatar letter defaults to the signed-in user's first initial (self-loaded)
// so the header can be dropped into any screen. Screens that already have this
// value can pass `avatarInitial` to skip the fetch.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { headerStyles as styles } from '../../styles/components/header.styles';
import { colors, spacing } from '../../styles/theme';
import { fetchMyProfile } from '../../lib/profile';

type AppHeaderProps = {
  /** Centered screen label (e.g. "Home", "Feed", "Map", "Profile"). */
  title?: string;
  /** Overrides the avatar letter. Falls back to the user's first initial. */
  avatarInitial?: string;
  /** Shows the orange unread dot on the bell. */
  showNotificationDot?: boolean;
  /** Hide the profile avatar (e.g. when already on the profile screen). */
  showProfile?: boolean;
  /** When set, renders a search bar with this placeholder below the top row. */
  searchPlaceholder?: string;
  onSearchPress?: () => void;
  onNotificationsPress?: () => void;
  /** Defaults to navigating to the profile tab. */
  onProfilePress?: () => void;
  /** Extra content rendered inside the blue block, below the search bar. */
  children?: React.ReactNode;
};

export default function AppHeader({
  title,
  avatarInitial,
  showNotificationDot = true,
  showProfile = true,
  searchPlaceholder,
  onSearchPress,
  onNotificationsPress,
  onProfilePress,
  children,
}: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [resolvedInitial, setResolvedInitial] = useState(avatarInitial ?? 'U');

  // Only self-fetch the avatar initial when it's needed and not provided.
  useEffect(() => {
    if (avatarInitial !== undefined || !showProfile) return;

    let cancelled = false;
    (async () => {
      const { profile } = await fetchMyProfile();
      if (cancelled || !profile) return;
      setResolvedInitial(profile.first_name.trim().charAt(0).toUpperCase() || 'U');
    })();

    return () => {
      cancelled = true;
    };
  }, [avatarInitial, showProfile]);

  const initial = avatarInitial ?? resolvedInitial;

  const handleProfilePress =
    onProfilePress ?? (() => router.push('/(main)/profile'));

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topRow}>
        <Text style={styles.brandTitle}>DisasterLink</Text>

        {title ? (
          <View style={styles.centerTitleWrap} pointerEvents="none">
            <Text style={styles.centerTitle}>{title}</Text>
          </View>
        ) : null}

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.8}
            onPress={onNotificationsPress}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color={colors.white} />
            {showNotificationDot && <View style={styles.bellDot} />}
          </TouchableOpacity>

          {showProfile && (
            <TouchableOpacity
              style={styles.avatar}
              activeOpacity={0.85}
              onPress={handleProfilePress}
              accessibilityRole="button"
              accessibilityLabel="Profile"
            >
              <Text style={styles.avatarText}>{initial}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {searchPlaceholder ? (
        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.9}
          onPress={onSearchPress}
          accessibilityRole="search"
          accessibilityLabel={searchPlaceholder}
        >
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <Text style={styles.searchPlaceholder}>{searchPlaceholder}</Text>
        </TouchableOpacity>
      ) : null}

      {children}
    </View>
  );
}
