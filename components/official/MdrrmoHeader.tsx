// Shared MDRRMO tab header: municipal seal + Name · Role (+ optional right controls).

import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { NotificationsPlaceholder } from '../../components/navigation/AppHeader';
import { useOfficialPortal } from '../../context/OfficialPortalContext';
import {
  fetchMyOfficialPublicProfile,
  type OfficialPublicProfile,
} from '../../lib/profile';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { colors } from '../../styles/theme';

function fullNameFromProfile(profile: OfficialPublicProfile | null): string | null {
  if (!profile) return null;
  return [profile.first_name, profile.middle_name, profile.last_name]
    .filter((part) => part?.trim())
    .join(' ')
    .trim() || null;
}

type MdrrmoHeaderProps = {
  /** Bold navigation title (e.g. Command, Community). */
  title: string;
  /** Optional right-side actions (notifications, settings avatar, etc.). */
  right?: ReactNode;
  /** Shows the standard notifications and profile controls. */
  showDefaultControls?: boolean;
};

export default function MdrrmoHeader({
  title,
  right,
  showDefaultControls = false,
}: MdrrmoHeaderProps) {
  const router = useRouter();
  const { officialKind, scope } = useOfficialPortal();
  const [profile, setProfile] = useState<OfficialPublicProfile | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    const result = await fetchMyOfficialPublicProfile();
    setProfile(result.profile);
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const name = fullNameFromProfile(profile);
  const roleLabel =
    officialKind === 'BDRRMO' && scope?.barangay_name
      ? `BDRRMO — ${scope.barangay_name}`
      : officialKind || 'MDRRMO';
  // Identity line: "Full Name · MDRRMO" (role alone while the name is loading).
  const identityLine = name ? `${name} · ${roleLabel}` : roleLabel;

  const headerControls = right ?? (showDefaultControls ? (
    <>
      <TouchableOpacity
        style={styles.headerNotificationButton}
        onPress={() => setNotificationsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
      >
        <Ionicons name="notifications-outline" size={21} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={name ? styles.commandAvatar : styles.commandRoleBadge}
        onPress={() => router.push('/official/settings' as Href)}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
      >
        <Text style={name ? styles.commandAvatarText : styles.commandRoleBadgeText}>
          {name?.charAt(0).toUpperCase() || officialKind || 'MDRRMO'}
        </Text>
      </TouchableOpacity>
    </>
  ) : null);

  return (
    <>
      <View style={styles.headerRow}>
        <View style={styles.headerIdentity}>
          <View style={styles.brandMark}>
            <Image
              source={require('../../assets/images/mingla.png')}
              style={styles.brandMarkImage}
              accessibilityLabel="Minglanilla official seal"
            />
          </View>
          <View style={styles.headerTextGroup}>
            <Text style={styles.screenTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.screenSubtitle} numberOfLines={1}>
              {identityLine}
            </Text>
          </View>
        </View>
        {headerControls ? <View style={styles.commandHeaderControls}>{headerControls}</View> : null}
      </View>
      {showDefaultControls ? (
        <NotificationsPlaceholder
          visible={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
        />
      ) : null}
    </>
  );
}
