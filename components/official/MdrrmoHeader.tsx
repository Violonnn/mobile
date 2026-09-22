// Shared MDRRMO tab header: municipal seal + Name · Role (+ optional right controls).

import React, { useCallback, useState, type ReactNode } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import NotificationsModal from '../notifications/NotificationsModal';
import { useOfficialPortal } from '../../context/OfficialPortalContext';
import {
  fetchMyOfficialPublicProfile,
  type OfficialPublicProfile,
} from '../../lib/profile';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { colors } from '../../styles/theme';
import ProfileAvatar from '../profile/ProfileAvatar';

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
  /** Uses light controls when the header is placed over a dark image or map. */
  tone?: 'default' | 'overlay';
  /** Uses the Mayor Brief identity treatment shown in the executive dashboard. */
  variant?: 'default' | 'mayorHero';
  /** Replaces the seal with a back button for a Command extension screen. */
  showCommandBack?: boolean;
};

export default function MdrrmoHeader({
  title,
  right,
  showDefaultControls = false,
  tone = 'default',
  variant = 'default',
  showCommandBack = false,
}: MdrrmoHeaderProps) {
  const router = useRouter();
  const { officialKind, scope } = useOfficialPortal();
  const [profile, setProfile] = useState<OfficialPublicProfile | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      // Re-read the shared profile whenever this tab becomes active so a newly
      // saved profile photo is immediately reflected in the Command header.
      void fetchMyOfficialPublicProfile().then((result) => {
        if (!cancelled) setProfile(result.profile);
      });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const name = fullNameFromProfile(profile);
  const roleLabel =
    officialKind === 'BDRRMO' && scope?.barangay_name
      ? `BDRRMO — ${scope.barangay_name}`
      : officialKind || 'MDRRMO';
  const isMdrrmoCommand = title === 'Command' && officialKind === 'MDRRMO';
  const isMdrrmoCommunity = title === 'Community' && officialKind === 'MDRRMO';
  const commandGreeting = profile?.first_name?.trim() || 'there';
  // The MDRRMO Command dashboard is personal to the signed-in officer.
  // Community already identifies its workspace, so it does not repeat the officer name.
  const identityLine =
    isMdrrmoCommand || isMdrrmoCommunity
      ? null
      : name
        ? `${name} · ${roleLabel}`
        : roleLabel;

  const isOverlay = tone === 'overlay';

  function goBackToCommand() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/official' as Href);
  }

  if (variant === 'mayorHero') {
    const mayorFirstName = profile?.first_name?.trim() || 'Dee';

    return (
      <>
        <View style={styles.mayorHeroHeader}>
          <View style={styles.mayorHeroIdentity}>
            <View style={styles.mayorHeroSeal}>
              <Image
                source={require('../../assets/images/mingla.png')}
                style={styles.mayorHeroSealImage}
                accessibilityLabel="Minglanilla official seal"
              />
            </View>
            <View style={styles.mayorHeroCopy}>
              <Text style={styles.mayorHeroGreeting}>Good evening,</Text>
              <Text style={styles.mayorHeroName} numberOfLines={1}>
                Mayor {mayorFirstName}
              </Text>
              <Text style={styles.mayorHeroLocation} numberOfLines={1}>
                DISASTERLINK · MINGLANILLA, CEBU
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.mayorHeroNotification}
            onPress={() => setNotificationsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={29} color={colors.white} />
            {notificationUnreadCount > 0 ? (
              <View style={styles.mayorHeroNotificationDot} />
            ) : null}
          </TouchableOpacity>
        </View>
        <NotificationsModal
          visible={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          onUnreadCountChange={setNotificationUnreadCount}
        />
      </>
    );
  }

  const headerControls = right ?? (showDefaultControls ? (
    <>
      <TouchableOpacity
        style={[styles.headerNotificationButton, isOverlay && styles.headerControlOverlay]}
        onPress={() => setNotificationsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
      >
        <Ionicons
          name="notifications-outline"
          size={25}
          color={isOverlay ? colors.white : colors.text}
        />
        {notificationUnreadCount > 0 ? (
          <View style={styles.headerNotificationDot} />
        ) : null}
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          !name && styles.commandRoleBadge,
          isOverlay && !name && styles.commandRoleBadgeOverlay,
        ]}
        onPress={() => router.push('/official/settings' as Href)}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
      >
        {name ? (
          <ProfileAvatar
            avatarPath={profile?.avatar_path}
            firstName={profile?.first_name}
            lastName={profile?.last_name}
            size={44}
            style={[styles.commandAvatar, isOverlay && styles.commandAvatarOverlay]}
            textStyle={[
              styles.commandAvatarText,
              isOverlay && styles.commandControlTextOverlay,
            ]}
          />
        ) : (
          <Text
            style={[
              styles.commandRoleBadgeText,
              isOverlay && styles.commandControlTextOverlay,
            ]}
          >
            {officialKind || 'MDRRMO'}
          </Text>
        )}
      </TouchableOpacity>
    </>
  ) : null);

  return (
    <>
      <View style={styles.headerRow}>
        {isMdrrmoCommand ? (
          <View style={styles.headerIdentity}>
            <View style={styles.brandMark}>
              <Image
                source={require('../../assets/images/mingla.png')}
                style={styles.brandMarkImage}
                accessibilityLabel="Minglanilla official seal"
              />
            </View>
            <View style={styles.commandGreetingGroup}>
              <Text
                style={[styles.screenTitle, isOverlay && styles.screenTitleOverlay]}
                numberOfLines={1}
              >
                {`Hi, ${commandGreeting}`}
              </Text>
              <Text
                style={[styles.commandIdentitySubtitle, isOverlay && styles.screenSubtitleOverlay]}
                numberOfLines={1}
              >
                MDRRMO Minglanilla
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.headerIdentity}>
            {showCommandBack ? (
              <TouchableOpacity
                style={styles.resourceDirectoryBack}
                onPress={goBackToCommand}
                accessibilityRole="button"
                accessibilityLabel="Back to Command"
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={isOverlay ? colors.white : colors.text}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.brandMark}>
                <Image
                  source={require('../../assets/images/mingla.png')}
                  style={styles.brandMarkImage}
                  accessibilityLabel="Minglanilla official seal"
                />
              </View>
            )}
            <View style={styles.headerTextGroup}>
              <Text
                style={[styles.screenTitle, isOverlay && styles.screenTitleOverlay]}
                numberOfLines={1}
              >
                {title}
              </Text>
              {identityLine ? (
                <Text
                  style={[styles.screenSubtitle, isOverlay && styles.screenSubtitleOverlay]}
                  numberOfLines={1}
                >
                  {identityLine}
                </Text>
              ) : null}
            </View>
          </View>
        )}
        {headerControls ? <View style={styles.commandHeaderControls}>{headerControls}</View> : null}
      </View>
      {showDefaultControls ? (
        <NotificationsModal
          visible={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          onUnreadCountChange={setNotificationUnreadCount}
        />
      ) : null}
    </>
  );
}
