// Official Settings: read-only identity, legal information, and logout.
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useOfficialPortal } from '../../context/OfficialPortalContext';
import { logout } from '../../lib/auth';
import {
  fetchMyOfficialPublicProfile,
  type OfficialPublicProfile,
} from '../../lib/profile';
import LegalModal, {
  PRIVACY_NOTICE_CONTENT,
  TERMS_INFORMATION_CONTENT,
} from '../../components/register/LegalModal';
import MdrrmoHeader from '../../components/official/MdrrmoHeader';
import MdrrmoSettingsWorkspace from '../../components/official/MdrrmoSettingsWorkspace';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { colors } from '../../styles/theme';

type LegalDocument = 'privacy' | 'terms' | null;

function profileName(profile: OfficialPublicProfile | null): string | null {
  if (!profile) return null;

  return [profile.first_name, profile.middle_name, profile.last_name]
    .filter((part) => part?.trim())
    .join(' ')
    .trim() || null;
}

function initialsFromName(name: string | null): string {
  if (!name) return 'M';

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function OfficialSettingsScreen() {
  const router = useRouter();
  const { scope, officialKind, loading: scopeLoading } = useOfficialPortal();
  const [profile, setProfile] = useState<OfficialPublicProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocument>(null);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    const result = await fetchMyOfficialPublicProfile();
    setProfile(result.profile);
    setProfileError(result.error);
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    if (
      officialKind === 'MDRRMO' ||
      officialKind === 'BDRRMO' ||
      officialKind === 'Mayor'
    ) {
      void loadProfile();
    }
  }, [officialKind, loadProfile]);

  useEffect(() => {
    if (
      !scopeLoading &&
      officialKind &&
      officialKind !== 'MDRRMO' &&
      officialKind !== 'BDRRMO' &&
      officialKind !== 'Mayor'
    ) {
      router.replace('/official' as Href);
    }
  }, [officialKind, router, scopeLoading]);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    const result = await logout();
    if (result.error) {
      Alert.alert('Logout failed', result.error);
      setLoggingOut(false);
      return;
    }

    router.replace('/' as Href);
  }

  function confirmLogout() {
    Alert.alert(
      'Log out of DisasterLink?',
      'You will need to sign in again to access the official portal.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => void handleLogout(),
        },
      ],
    );
  }

  function showEmergencyDisclaimer() {
    Alert.alert(
      'Emergency disclaimer',
      'DisasterLink supports local disaster coordination. It does not replace emergency services. Follow local emergency procedures when immediate help is needed.',
    );
  }

  function showAppInformation() {
    const version = Constants.expoConfig?.version || 'Unavailable';
    const environment = __DEV__ ? 'Development build' : 'Production build';
    Alert.alert('App information', `DisasterLink ${version}\n${environment}`);
  }

  const isOfficial =
    officialKind === 'MDRRMO' ||
    officialKind === 'BDRRMO' ||
    officialKind === 'Mayor';

  if (scopeLoading || !isOfficial) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.themeSoft} />
        </View>
      </SafeAreaView>
    );
  }

  if (officialKind === 'MDRRMO') {
    return (
      <MdrrmoSettingsWorkspace
        profile={profile}
        profileError={profileError}
        profileLoading={profileLoading}
        onRetryProfile={() => void loadProfile()}
      />
    );
  }

  const name = profileName(profile);
  const scopeDisplay =
    officialKind === 'BDRRMO'
      ? `BDRRMO${scope?.barangay_name ? ` - ${scope.barangay_name}` : ''}`
      : officialKind === 'Mayor'
        ? 'Mayor'
        : 'MDRRMO';
  const documentTitle =
    legalDocument === 'privacy' ? 'Privacy notice' : 'Terms and conditions';
  const documentContent =
    legalDocument === 'privacy'
      ? PRIVACY_NOTICE_CONTENT
      : TERMS_INFORMATION_CONTENT;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <MdrrmoHeader
          title="Settings"
          showDefaultControls={officialKind === 'Mayor'}
        />

        <View style={styles.card}>
          <View style={styles.settingsIdentityRow}>
            <View style={styles.initialAvatar}>
              <Text style={styles.initialAvatarText}>{initialsFromName(name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scopeValue}>
                {name || `${officialKind} account`}
              </Text>
              <Text style={styles.screenSubtitle}>{scopeDisplay}</Text>
            </View>
          </View>

          {profileLoading ? (
            <ActivityIndicator color={colors.themeSoft} />
          ) : null}
          {profileError ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateBody}>{profileError}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => void loadProfile()}
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Help and legal</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.settingsAction}
              onPress={() => setLegalDocument('privacy')}
            >
              <View style={styles.settingsActionCopy}>
                <Text style={styles.settingsActionTitle}>Privacy notice</Text>
                <Text style={styles.settingsActionMeta}>
                  How DisasterLink handles personal data
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsAction}
              onPress={() => setLegalDocument('terms')}
            >
              <View style={styles.settingsActionCopy}>
                <Text style={styles.settingsActionTitle}>Terms and conditions</Text>
                <Text style={styles.settingsActionMeta}>
                  Acceptable use for DisasterLink
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsAction}
              onPress={showEmergencyDisclaimer}
            >
              <View style={styles.settingsActionCopy}>
                <Text style={styles.settingsActionTitle}>Emergency disclaimer</Text>
                <Text style={styles.settingsActionMeta}>
                  Supports local coordination, not emergency services
                </Text>
              </View>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={colors.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsAction}
              onPress={showAppInformation}
            >
              <View style={styles.settingsActionCopy}>
                <Text style={styles.settingsActionTitle}>App information</Text>
                <Text style={styles.settingsActionMeta}>
                  Version and build environment
                </Text>
              </View>
              <Ionicons
                name="phone-portrait-outline"
                size={20}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, loggingOut && styles.actionDisabled]}
          onPress={confirmLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.logoutButtonText}>Log out</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

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
