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
import ProfileAvatar from '../profile/ProfileAvatar';
import ProfilePhotoModal from '../profile/ProfilePhotoModal';
import { SettingsScreenSkeleton } from '../ui/OfficialScreenSkeletons';
import { logout } from '../../lib/auth';
import { changeOfficialPassword } from '../../lib/officialPassword';
import type { OfficialPublicProfile } from '../../lib/profile';
import { mdrrmoSettingsStyles as styles } from '../../styles/screens/mdrrmoSettings.styles';
import { colors } from '../../styles/theme';

type LegalDocument = 'privacy' | 'terms' | null;

type Props = {
  profile: OfficialPublicProfile | null;
  profileError: string | null;
  profileLoading: boolean;
  assignedBarangay: string | null;
  onRetryProfile: () => void;
  onAvatarChanged: (avatarPath: string | null) => void;
};

function SettingsRow({
  title,
  subtitle,
  value,
  onPress,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
}) {
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

  if (!onPress) return <View style={styles.settingsRow}>{content}</View>;
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

function profileName(profile: OfficialPublicProfile | null): string {
  if (!profile) return 'BDRRMO account';
  return [profile.first_name, profile.middle_name, profile.last_name]
    .filter((part) => part?.trim())
    .join(' ')
    .trim() || 'BDRRMO account';
}

function initials(profile: OfficialPublicProfile | null): string {
  if (!profile) return 'BD';
  return [profile.first_name, profile.last_name]
    .filter((part) => part?.trim())
    .map((part) => part!.trim().charAt(0).toUpperCase())
    .join('') || 'BD';
}

export default function BdrrmoSettingsWorkspace({
  profile,
  profileError,
  profileLoading,
  assignedBarangay,
  onRetryProfile,
  onAvatarChanged,
}: Props) {
  const router = useRouter();
  const [securityVisible, setSecurityVisible] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [legalDocument, setLegalDocument] = useState<LegalDocument>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profilePhotoVisible, setProfilePhotoVisible] = useState(false);
  const version = Constants.expoConfig?.version || 'Unavailable';

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
    Alert.alert('Password changed', result.warning || 'Sign in again with your new password.');
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
          router.replace('/(auth)/official-login' as Href);
        },
      },
    ]);
  }

  const documentTitle = legalDocument === 'privacy' ? 'Privacy notice' : 'Terms and conditions';
  const documentContent = legalDocument === 'privacy' ? PRIVACY_NOTICE_CONTENT : TERMS_INFORMATION_CONTENT;

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
            <TouchableOpacity onPress={onRetryProfile}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
          </View>
        ) : (
          <View style={styles.identityRow}>
            <TouchableOpacity onPress={() => setProfilePhotoVisible(true)} accessibilityLabel="View profile picture">
              <ProfileAvatar avatarPath={profile?.avatar_path} firstName={profile?.first_name} lastName={profile?.last_name} fallback={initials(profile)} size={92} style={styles.avatar} textStyle={styles.avatarText} />
            </TouchableOpacity>
            <View style={styles.identityCopy}>
              <Text style={styles.identityName} numberOfLines={2}>{profileName(profile)}</Text>
              <Text style={styles.identityRole}>BDRRMO · {assignedBarangay || 'Assigned barangay'}</Text>
              <TouchableOpacity style={styles.viewProfileButton} onPress={() => setProfilePhotoVisible(true)}>
                <Text style={styles.viewProfileText}>View profile picture</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.divider} />
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <SettingsRow title="Password & access" subtitle="Change your official account password" onPress={() => { setPasswordError(null); setSecurityVisible(true); }} />
          <SettingsRow title="Official coverage" subtitle="Assigned barangay · Read-only" value={assignedBarangay || 'Unavailable'} />
        </View>

        <View style={styles.divider} />
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BDRRMO WORKSPACE</Text>
          <SettingsRow title="Local intake" subtitle="Unverified reports and local response" value="On" />
          <SettingsRow title="Community updates" subtitle="Barangay announcements and resident reports" value="On" />
          <SettingsRow title="Map & resources" subtitle="Assigned-barangay operational access" value="Enabled" />
        </View>

        <View style={styles.divider} />
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PRIVACY & SUPPORT</Text>
          <SettingsRow title="Privacy notice" subtitle="How DisasterLink handles personal data" onPress={() => setLegalDocument('privacy')} />
          <SettingsRow title="Terms and conditions" subtitle="Acceptable use for DisasterLink" onPress={() => setLegalDocument('terms')} />
          <SettingsRow title="Emergency disclaimer" subtitle="Supports local coordination, not emergency services" onPress={() => Alert.alert('Emergency disclaimer', 'DisasterLink supports local disaster coordination. It does not replace emergency services.')} />
          <SettingsRow title="App information" subtitle={`DisasterLink · Version ${version}`} onPress={() => Alert.alert('App information', `DisasterLink ${version}`)} />
        </View>

        <View style={styles.divider} />
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SESSION</Text>
          <TouchableOpacity style={styles.logoutRow} onPress={confirmLogout} disabled={loggingOut}>
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
