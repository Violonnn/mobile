import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import OfficialPasswordModal from './OfficialPasswordModal';
import LegalModal, {
  PRIVACY_NOTICE_CONTENT,
  TERMS_INFORMATION_CONTENT,
} from '../register/LegalModal';
import { logout } from '../../lib/auth';
import { changeOfficialPassword } from '../../lib/officialPassword';
import type { OfficialPublicProfile } from '../../lib/profile';
import { mdrrmoSettingsStyles as styles } from '../../styles/screens/mdrrmoSettings.styles';
import { colors } from '../../styles/theme';
import ProfileAvatar from '../profile/ProfileAvatar';
import ProfilePhotoModal from '../profile/ProfilePhotoModal';
import { SettingsScreenSkeleton } from '../ui/OfficialScreenSkeletons';

type LegalDocument = 'privacy' | 'terms' | null;

type Props = {
  profile: OfficialPublicProfile | null;
  profileError: string | null;
  profileLoading: boolean;
  onRetryProfile: () => void;
  onAvatarChanged: (avatarPath: string | null) => void;
  roleVariant?: 'mdrrmo' | 'mayor';
};

type SettingsRowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
};

function profileName(profile: OfficialPublicProfile | null, fallback: string): string {
  if (!profile) return fallback;
  return [profile.first_name, profile.middle_name, profile.last_name]
    .filter((part) => part?.trim())
    .join(' ')
    .trim() || fallback;
}

function initials(profile: OfficialPublicProfile | null): string {
  if (!profile) return 'M';
  return [profile.first_name, profile.last_name]
    .filter((part) => part?.trim())
    .map((part) => part!.trim().charAt(0).toUpperCase())
    .join('') || 'M';
}

function SettingsRow({ title, subtitle, value, onPress }: SettingsRowProps) {
  const content = (
    <>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={22} color={colors.textMuted} /> : null}
    </>
  );

  if (!onPress) {
    // Informational rows are intentionally not touchable because they have no action.
    return <View style={styles.settingsRow}>{content}</View>;
  }

  return (
    <TouchableOpacity
      style={styles.settingsRow}
      onPress={onPress}
      activeOpacity={0.65}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {content}
    </TouchableOpacity>
  );
}

export default function MdrrmoSettingsWorkspace({
  profile,
  profileError,
  profileLoading,
  onRetryProfile,
  onAvatarChanged,
  roleVariant = 'mdrrmo',
}: Props) {
  const router = useRouter();
  const [securityVisible, setSecurityVisible] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [legalDocument, setLegalDocument] = useState<LegalDocument>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profilePhotoVisible, setProfilePhotoVisible] = useState(false);

  const version = Constants.expoConfig?.version || 'Unavailable';
  const isMayor = roleVariant === 'mayor';
  const name = profileName(profile, isMayor ? 'Mayor account' : 'MDRRMO account');
  const documentTitle = legalDocument === 'privacy' ? 'Privacy notice' : 'Terms and conditions';
  const documentContent =
    legalDocument === 'privacy' ? PRIVACY_NOTICE_CONTENT : TERMS_INFORMATION_CONTENT;

  function openPasswordAccess() {
    setPasswordError(null);
    setSecurityVisible(true);
  }

  async function submitPasswordChange(input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    if (passwordSubmitting) return;
    setPasswordSubmitting(true);
    setPasswordError(null);
    const result = await changeOfficialPassword(input);
    setPasswordSubmitting(false);
    if (result.error) {
      setPasswordError(result.error);
      return;
    }
    setSecurityVisible(false);
    Alert.alert(
      'Password changed',
      result.warning || 'Sign in again using your new official-account password.',
    );
    router.replace('/(auth)/official-login' as Href);
  }

  function confirmLogout() {
    Alert.alert('Log out of DisasterLink?', 'You will need to sign in again to access the official portal.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          if (loggingOut) return;
          setLoggingOut(true);
          const result = await logout();
          if (result.error) {
            Alert.alert('Logout failed', result.error);
            setLoggingOut(false);
            return;
          }
          router.replace('/' as Href);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Settings</Text>

        {profileLoading && !profile ? (
          <SettingsScreenSkeleton />
        ) : profileError && !profile ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>{profileError}</Text>
            <TouchableOpacity onPress={onRetryProfile} accessibilityRole="button"><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
          </View>
        ) : (
          <View style={styles.identityRow}>
            <TouchableOpacity onPress={() => setProfilePhotoVisible(true)} accessibilityRole="button" accessibilityLabel="View profile picture">
              <ProfileAvatar avatarPath={profile?.avatar_path} firstName={profile?.first_name} lastName={profile?.last_name} fallback={initials(profile)} size={92} style={styles.avatar} textStyle={styles.avatarText} />
            </TouchableOpacity>
            <View style={styles.identityCopy}>
              <Text style={styles.identityName} numberOfLines={2}>{name}</Text>
              <Text style={styles.identityRole}>{isMayor ? 'Mayor · Executive account' : 'MDRRMO · Official account'}</Text>
              <TouchableOpacity style={styles.viewProfileButton} onPress={() => setProfilePhotoVisible(true)} accessibilityRole="button" accessibilityLabel="View profile picture">
                <Text style={styles.viewProfileText}>View profile picture</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <SettingsRow title="Password & access" subtitle="Change your official account password" onPress={openPasswordAccess} />
          <SettingsRow title="Official coverage" subtitle={isMayor ? 'Municipal executive account' : 'Municipal disaster operations'} value="Minglanilla" />
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{isMayor ? 'EXECUTIVE WORKSPACE' : 'MDRRMO WORKSPACE'}</Text>
          <SettingsRow title={isMayor ? 'Executive brief alerts' : 'Command alerts'} subtitle={isMayor ? 'Municipal decisions and urgent reports' : 'Escalations and urgent reports'} value="On" />
          <SettingsRow title={isMayor ? 'Municipal updates' : 'Operations updates'} subtitle={isMayor ? 'Barangay activity and shelter readiness' : 'Assignments, comments, and center status'} value="On" />
          <SettingsRow title={isMayor ? 'Municipal map' : 'Map & location'} subtitle={isMayor ? 'All barangays · Read-only awareness' : 'Command map and incident location access'} value="Enabled" />
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PRIVACY & SUPPORT</Text>
          <SettingsRow title="Privacy notice" subtitle="How DisasterLink handles personal data" onPress={() => setLegalDocument('privacy')} />
          <SettingsRow title="Terms and conditions" subtitle="Acceptable use for DisasterLink" onPress={() => setLegalDocument('terms')} />
          <SettingsRow title="Emergency disclaimer" subtitle="Supports local coordination, not emergency services" onPress={() => Alert.alert('Emergency disclaimer', 'DisasterLink supports local disaster coordination. It does not replace emergency services. Follow local emergency procedures when immediate help is needed.')} />
          <SettingsRow title="App information" subtitle={`DisasterLink · Version ${version}`} onPress={() => Alert.alert('App information', `DisasterLink ${version}`)} />
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SESSION</Text>
          <TouchableOpacity style={styles.logoutRow} onPress={confirmLogout} disabled={loggingOut} accessibilityRole="button" accessibilityLabel="Log out">
            <View style={styles.rowCopy}>
              <Text style={styles.logoutTitle}>Log out</Text>
              <Text style={styles.rowSubtitle}>Sign out of this official account</Text>
            </View>
            {loggingOut ? <ActivityIndicator color={colors.unverified} /> : <Ionicons name="log-out-outline" size={28} color={colors.unverified} />}
          </TouchableOpacity>
          <Text style={styles.footerVersion}>DisasterLink {version}</Text>
        </View>
      </ScrollView>

      <OfficialPasswordModal visible={securityVisible} submitting={passwordSubmitting} error={passwordError} onClose={() => { setPasswordError(null); setSecurityVisible(false); }} onSubmit={(input) => void submitPasswordChange(input)} />
      <LegalModal visible={legalDocument !== null} title={documentTitle} content={documentContent} actionLabel="Close" requireRead={false} onAccept={() => setLegalDocument(null)} onClose={() => setLegalDocument(null)} />
      {profile ? <ProfilePhotoModal visible={profilePhotoVisible} firstName={profile.first_name} lastName={profile.last_name} avatarPath={profile.avatar_path} onClose={() => setProfilePhotoVisible(false)} onChanged={onAvatarChanged} /> : null}
    </SafeAreaView>
  );
}
