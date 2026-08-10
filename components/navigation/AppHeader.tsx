// components/navigation/AppHeader.tsx — reusable blue header bar.
// Three variants, chosen by props:
//  - greetingName set   -> greeting header: "Hi, {name}" + "Your Location"
//    block on the left and a plain notification bell on the right (home).
//  - title set          -> legacy layout: "DisasterLink" brand, centered
//    title, bell + avatar (still used by the profile tab — do not restyle).
//  - neither            -> no top row; only the search bar renders (map).
//
// The bell opens a minimalist placeholder sheet until notifications exist.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { headerStyles as styles, headerColors } from '../../styles/components/header.styles';
import { colors, spacing } from '../../styles/theme';
import { fetchMyProfile } from '../../lib/profile';

type AppHeaderProps = {
  /** Legacy centered screen label (kept for the profile tab). */
  title?: string;
  /** Renders the greeting variant: "Hi, {greetingName}". */
  greetingName?: string;
  /** Location value shown under the greeting ("Your Location"). */
  locationLabel?: string;
  /** Overrides the avatar letter (legacy variant only). */
  avatarInitial?: string;
  /** Shows the orange unread dot on the bell (legacy variant only). */
  showNotificationDot?: boolean;
  /** Hide the profile avatar (legacy variant only). */
  showProfile?: boolean;
  /** When set, renders a search bar with this placeholder below the top row. */
  searchPlaceholder?: string;
  /** Home can opt out of the themed blue header without affecting other screens. */
  tone?: 'themed' | 'light';
  onSearchPress?: () => void;
  /** Overrides the default placeholder sheet when the bell is tapped. */
  onNotificationsPress?: () => void;
  /** Defaults to navigating to the profile tab. */
  onProfilePress?: () => void;
  /** Extra content rendered below the search bar. */
  children?: React.ReactNode;
};

/** Minimalist placeholder shown when notifications are tapped (no data yet). */
export function NotificationsPlaceholder({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.notifOverlay}>
        <Pressable style={styles.notifBackdrop} onPress={onClose} />
        <View style={styles.notifCard}>
          <View style={styles.notifIconCircle}>
            <Ionicons name="notifications-outline" size={26} color={colors.themeSoft} />
          </View>
          <Text style={styles.notifTitle}>Notifications</Text>
          <Text style={styles.notifSubtitle}>
            You&apos;re all caught up. Nothing here yet.
          </Text>
          <TouchableOpacity
            style={styles.notifCloseButton}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Close notifications"
          >
            <Text style={styles.notifCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function AppHeader({
  title,
  greetingName,
  locationLabel,
  avatarInitial,
  showNotificationDot = true,
  showProfile = true,
  searchPlaceholder,
  tone = 'themed',
  onSearchPress,
  onNotificationsPress,
  onProfilePress,
  children,
}: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isGreetingVariant = greetingName !== undefined;
  const isLegacyVariant = !isGreetingVariant && title !== undefined;
  const usesLightTone = tone === 'light';

  const [resolvedInitial, setResolvedInitial] = useState(avatarInitial ?? 'U');
  const [notifOpen, setNotifOpen] = useState(false);

  // Only self-fetch the avatar initial when the legacy variant needs it.
  useEffect(() => {
    if (!isLegacyVariant || avatarInitial !== undefined || !showProfile) return;

    let cancelled = false;
    (async () => {
      const { profile } = await fetchMyProfile();
      if (cancelled || !profile) return;
      setResolvedInitial(profile.first_name.trim().charAt(0).toUpperCase() || 'U');
    })();

    return () => {
      cancelled = true;
    };
  }, [isLegacyVariant, avatarInitial, showProfile]);

  const initial = avatarInitial ?? resolvedInitial;

  const handleProfilePress =
    onProfilePress ?? (() => router.push('/(main)/profile'));

  const handleNotificationsPress =
    onNotificationsPress ?? (() => setNotifOpen(true));

  return (
    <View
      style={[
        styles.header,
        usesLightTone && styles.headerLight,
        { paddingTop: insets.top + spacing.sm },
      ]}
    >
      {isGreetingVariant ? (
        <View style={styles.greetingRow}>
          <View style={styles.greetingTextWrap}>
            <Text
              style={[styles.greetingTitle, usesLightTone && styles.greetingTitleLight]}
              numberOfLines={1}
            >
              Hi, {greetingName || 'there'}
            </Text>
            {locationLabel ? (
              <View style={styles.greetingLocationWrap}>
                <Text
                  style={[
                    styles.greetingLocationLabel,
                    usesLightTone && styles.greetingLocationLabelLight,
                  ]}
                >
                  Your Location
                </Text>
                <Text
                  style={[
                    styles.greetingLocationValue,
                    usesLightTone && styles.greetingLocationValueLight,
                  ]}
                  numberOfLines={1}
                >
                  {locationLabel}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.greetingActions}>
            <TouchableOpacity
              style={styles.plainBellButton}
              activeOpacity={0.7}
              onPress={handleNotificationsPress}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons
                name="notifications-outline"
                size={24}
                color={usesLightTone ? colors.text : colors.white}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.greetingAvatar,
                usesLightTone && styles.greetingAvatarLight,
              ]}
              activeOpacity={0.85}
              onPress={handleProfilePress}
              accessibilityRole="button"
              accessibilityLabel="Profile"
            >
              {/* No profile pictures yet — same initial-avatar format as the app. */}
              <Text style={styles.greetingAvatarText}>
                {(greetingName ?? '').trim().charAt(0).toUpperCase() || 'U'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : isLegacyVariant ? (
        <View style={styles.topRow}>
          <Text style={styles.brandTitle}>DisasterLink</Text>

          <View style={styles.centerTitleWrap} pointerEvents="none">
            <Text style={styles.centerTitle}>{title}</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.8}
              onPress={handleNotificationsPress}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={20} color={headerColors.ink} />
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
      ) : null}

      {searchPlaceholder ? (
        <TouchableOpacity
          style={[styles.searchBar, usesLightTone && styles.searchBarLight]}
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

      <NotificationsPlaceholder visible={notifOpen} onClose={() => setNotifOpen(false)} />
    </View>
  );
}
