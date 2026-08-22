import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import MdrrmoHeader from './MdrrmoHeader';
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

type LegalDocument = 'privacy' | 'terms' | null;
type IoniconName = keyof typeof Ionicons.glyphMap;

type Props = {
  profile: OfficialPublicProfile | null;
  profileError: string | null;
  profileLoading: boolean;
  onRetryProfile: () => void;
};

type SettingsRowProps = {
  icon: IoniconName;
  title: string;
  subtitle: string;
  iconColor?: string;
  rightIcon?: IoniconName;
  onPress?: () => void;
};

function profileName(profile: OfficialPublicProfile | null): string {
  if (!profile) return 'MDRRMO account';
  return [profile.first_name, profile.middle_name, profile.last_name]
    .filter((part) => part?.trim())
    .join(' ')
    .trim() || 'MDRRMO account';
}

function initials(profile: OfficialPublicProfile | null): string {
  if (!profile) return 'M';
  return [profile.first_name, profile.last_name]
    .filter((part) => part?.trim())
    .map((part) => part!.trim().charAt(0).toUpperCase())
    .join('') || 'M';
}

function SettingsRow({
  icon,
  title,
  subtitle,
  iconColor = '#53617A',
  rightIcon = 'chevron-forward',
  onPress,
}: SettingsRowProps) {
  const content = (
    <>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={29} color={iconColor} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name={rightIcon} size={22} color={colors.textMuted} />
    </>
  );

  if (!onPress) {
    // These rows deliberately mirror the planned settings without implying a live control.
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {content}
    </TouchableOpacity>
  );
}

function StaticAlertRow({
  color,
  title,
  subtitle,
}: {
  color: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.row} accessibilityLabel={`${title}, enabled`}>
      <View style={styles.rowIcon}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <View style={[styles.staticToggle, { backgroundColor: color }]}>
        <View style={styles.staticToggleKnob} />
      </View>
    </View>
  );
}

export default function MdrrmoSettingsWorkspace({
  profile,
  profileError,
  profileLoading,
  onRetryProfile,
}: Props) {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const [securityVisible, setSecurityVisible] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [legalDocument, setLegalDocument] = useState<LegalDocument>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const compactHero = windowWidth < 380;

  const version = Constants.expoConfig?.version || 'Unavailable';
  const name = profileName(profile);
  const documentTitle = legalDocument === 'privacy' ? 'Privacy notice' : 'Terms and conditions';
  const documentContent = legalDocument === 'privacy'
    ? PRIVACY_NOTICE_CONTENT
    : TERMS_INFORMATION_CONTENT;

  const openPasswordAccess = () => {
    setPasswordError(null);
    setSecurityVisible(true);
  };

  const submitPasswordChange = async (input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
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
  };

  const confirmLogout = () => {
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
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.horizontalContent}>
          <MdrrmoHeader title="Settings" />
        </View>

        {profileLoading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Loading official account…</Text>
          </View>
        ) : profileError && !profile ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>{profileError}</Text>
            <TouchableOpacity onPress={onRetryProfile}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.hero}>
            <View style={styles.contourOne} pointerEvents="none" />
            <View style={styles.contourTwo} pointerEvents="none" />
            <View style={styles.heroAvatar}>
              <Text style={styles.heroAvatarText}>{initials(profile)}</Text>
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroName} numberOfLines={2}>{name}</Text>
              <Text style={styles.heroRole}>MDRRMO · Official account</Text>
            </View>
            {!compactHero ? (
              <TouchableOpacity
                style={styles.heroAction}
                onPress={openPasswordAccess}
                accessibilityRole="button"
                accessibilityLabel="Open account security"
              >
                <Text style={styles.heroActionText} numberOfLines={2}>Account & security</Text>
                <Ionicons name="arrow-forward" size={21} color="#70A4FF" />
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ALERT DELIVERY</Text>
          <StaticAlertRow
            color="#F0524A"
            title="Critical incident alerts"
            subtitle="Escalations and urgent reports"
          />
          <StaticAlertRow
            color="#2F6FED"
            title="Operations updates"
            subtitle="Assignments, comments and center status"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WORKSPACE</Text>
          <SettingsRow icon="location-outline" title="Default area" subtitle="Minglanilla" />
          <SettingsRow icon="locate-outline" title="Map & location" subtitle="Enabled" />
          <SettingsRow
            icon="shield-checkmark-outline"
            title="Password & access"
            subtitle="Review official account security"
            onPress={openPasswordAccess}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HELP & LEGAL</Text>
          <SettingsRow
            icon="document-outline"
            title="Privacy notice"
            subtitle="How DisasterLink handles personal data"
            onPress={() => setLegalDocument('privacy')}
          />
          <SettingsRow
            icon="scale-outline"
            title="Terms and conditions"
            subtitle="Acceptable use for DisasterLink"
            onPress={() => setLegalDocument('terms')}
          />
          <SettingsRow
            icon="information-circle-outline"
            title="Emergency disclaimer"
            subtitle="Supports local coordination, not emergency services"
            rightIcon="information-circle-outline"
            onPress={() => Alert.alert(
              'Emergency disclaimer',
              'DisasterLink supports local disaster coordination. It does not replace emergency services. Follow local emergency procedures when immediate help is needed.',
            )}
          />
          <SettingsRow
            icon="phone-portrait-outline"
            title="App information"
            subtitle={`DisasterLink · Version ${version}`}
            onPress={() => Alert.alert('App information', `DisasterLink ${version}`)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SESSION</Text>
          <TouchableOpacity
            style={styles.row}
            onPress={confirmLogout}
            disabled={loggingOut}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <View style={styles.rowIcon}>
              {loggingOut ? (
                <ActivityIndicator color="#F0524A" />
              ) : (
                <Ionicons name="log-out-outline" size={29} color="#F0524A" />
              )}
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.logoutTitle}>Log out</Text>
              <Text style={styles.rowSubtitle}>Sign out of this official account</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.footerVersion}>DisasterLink {version}</Text>
        </View>
      </ScrollView>

      <OfficialPasswordModal
        visible={securityVisible}
        submitting={passwordSubmitting}
        error={passwordError}
        onClose={() => {
          setPasswordError(null);
          setSecurityVisible(false);
        }}
        onSubmit={(input) => void submitPasswordChange(input)}
      />

      <LegalModal
        visible={legalDocument !== null}
        title={documentTitle}
        content={documentContent}
        actionLabel="Close"
        requireRead={false}
        onAccept={() => setLegalDocument(null)}
        onClose={() => setLegalDocument(null)}
      />
    </SafeAreaView>
  );
}
