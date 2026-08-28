import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import LegalModal, {
  PRIVACY_NOTICE_CONTENT,
  TERMS_INFORMATION_CONTENT,
} from '../../components/register/LegalModal';
import ResidentProfileModal from '../../components/profile/ResidentProfileModal';
import ResidentSecurityModal from '../../components/profile/ResidentSecurityModal';
import { logout } from '../../lib/auth';
import {
  getResidentMapTheme,
  setResidentMapTheme,
  type ResidentMapTheme,
} from '../../lib/mapPreferences';
import {
  fetchMyProfile,
  fetchProfileUpdateEligibility,
  type ProfileUpdateEligibility,
  type PublicProfile,
} from '../../lib/profile';
import { profileStyles as styles } from '../../styles/screens/profile.styles';
import { colors } from '../../styles/theme';

type LegalDocument = 'privacy' | 'terms' | null;

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const localDigits = digits.startsWith('63') ? digits.slice(2) : digits.replace(/^0/, '');
  if (localDigits.length !== 10) return phone;
  return `+63 ${localDigits.slice(0, 3)} ${localDigits.slice(3, 6)} ${localDigits.slice(6)}`;
}

function fullName(profile: PublicProfile | null): string {
  if (!profile) return '';
  return [profile.first_name, profile.middle_name, profile.last_name]
    .filter((part) => part.trim())
    .join(' ');
}

function initials(profile: PublicProfile | null): string {
  if (!profile) return 'R';
  return `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase() || 'R';
}

type SettingsRowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  switchValue?: boolean;
  switchDisabled?: boolean;
  onSwitchChange?: (value: boolean) => void;
};

function SettingsRow({
  title,
  subtitle,
  value,
  onPress,
  switchValue,
  switchDisabled,
  onSwitchChange,
}: SettingsRowProps) {
  const content = (
    <>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {typeof switchValue === 'boolean' && onSwitchChange ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          disabled={switchDisabled}
          trackColor={{ false: '#CBD5E1', true: colors.primary }}
          thumbColor={colors.white}
          ios_backgroundColor="#CBD5E1"
          accessibilityLabel={`${title}: ${switchValue ? 'dark' : 'light'}`}
        />
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={22} color={colors.textMuted} /> : null}
    </>
  );

  if (!onPress) {
    // Intentionally a plain View: these preference rows are informational only.
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

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [eligibility, setEligibility] = useState<ProfileUpdateEligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mapTheme, setMapTheme] = useState<ResidentMapTheme>('light');
  const [mapThemeSaving, setMapThemeSaving] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [securityVisible, setSecurityVisible] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocument>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [profileResult, eligibilityResult] = await Promise.all([
      fetchMyProfile(),
      fetchProfileUpdateEligibility(),
    ]);

    if (profileResult.error || !profileResult.profile) {
      setLoadError(profileResult.error || 'Your resident profile could not be found.');
      setLoading(false);
      return;
    }

    setProfile(profileResult.profile);
    setEligibility(eligibilityResult.eligibility);
    setLoadError(eligibilityResult.error);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void getResidentMapTheme().then((storedTheme) => {
        if (active) setMapTheme(storedTheme);
      });

      return () => {
        active = false;
      };
    }, []),
  );

  async function handleMapThemeChange(useDarkMap: boolean) {
    if (mapThemeSaving) return;

    const previousTheme = mapTheme;
    const nextTheme: ResidentMapTheme = useDarkMap ? 'dark' : 'light';
    if (nextTheme === previousTheme) return;

    setMapTheme(nextTheme);
    setMapThemeSaving(true);

    try {
      await setResidentMapTheme(nextTheme);
    } catch {
      setMapTheme(previousTheme);
      Alert.alert('Map setting not saved', 'Please try changing the map appearance again.');
    } finally {
      setMapThemeSaving(false);
    }
  }

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
    Alert.alert('Log out of DisasterLink?', 'You will need your phone number and PIN to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void handleLogout() },
    ]);
  }

  function openPinReset() {
    if (!profile) return;
    setSecurityVisible(false);
    router.push({
      pathname: '/(auth)/forgot-password',
      params: { phone: profile.phone, source: 'settings' },
    });
  }

  const documentTitle = legalDocument === 'privacy' ? 'Privacy & data' : 'Terms & policies';
  const documentContent =
    legalDocument === 'privacy' ? PRIVACY_NOTICE_CONTENT : TERMS_INFORMATION_CONTENT;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Settings</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : loadError && !profile ? (
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => void loadProfile()}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : profile ? (
          <>
            <View style={styles.identityRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(profile)}</Text>
              </View>
              <View style={styles.identityCopy}>
                <Text style={styles.identityName} numberOfLines={2}>
                  {fullName(profile)}
                </Text>
                <Text style={styles.identityPhone}>{formatPhone(profile.phone)}</Text>
                <TouchableOpacity
                  style={styles.viewProfileButton}
                  onPress={() => setProfileVisible(true)}
                  accessibilityRole="button"
                >
                  <Text style={styles.viewProfileText}>View profile</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ACCOUNT</Text>
              <SettingsRow
                title="Personal information"
                subtitle="Name, phone number, birth details, and barangay"
                onPress={() => setProfileVisible(true)}
              />
              <SettingsRow
                title="Security & PIN"
                subtitle="Change PIN and manage sign-in"
                onPress={() => setSecurityVisible(true)}
              />
              <SettingsRow
                title="Location"
                subtitle={`${profile.barangay}, ${profile.municipality}`}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PREFERENCES</Text>
              <SettingsRow
                title="Notifications"
                subtitle="Alerts, advisories, and report updates"
                value="On"
              />
              <SettingsRow
                title="Dark map"
                subtitle="Use a dark map for low-light viewing"
                switchValue={mapTheme === 'dark'}
                switchDisabled={mapThemeSaving}
                onSwitchChange={(useDarkMap) => void handleMapThemeChange(useDarkMap)}
              />
              <SettingsRow title="Language" subtitle="App language" value="English" />
              <SettingsRow title="Accessibility" subtitle="Text size and motion" />
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PRIVACY & SUPPORT</Text>
              <SettingsRow
                title="Privacy & data"
                subtitle="Permissions and account data"
                onPress={() => setLegalDocument('privacy')}
              />
              <SettingsRow title="Help & safety guide" subtitle="Get help using DisasterLink" />
              <SettingsRow
                title="Terms & policies"
                onPress={() => setLegalDocument('terms')}
              />
            </View>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.logoutRow}
              onPress={confirmLogout}
              disabled={loggingOut}
              accessibilityRole="button"
              accessibilityLabel="Log out"
            >
              <View style={styles.rowCopy}>
                <Text style={styles.logoutTitle}>Log out</Text>
                <Text style={styles.rowSubtitle}>Sign out of this device</Text>
              </View>
              {loggingOut ? (
                <ActivityIndicator color={colors.unverified} />
              ) : (
                <Ionicons name="log-out-outline" size={28} color={colors.unverified} />
              )}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>

      {profile ? (
        <>
          <ResidentProfileModal
            visible={profileVisible}
            profile={profile}
            eligibility={eligibility}
            onClose={() => setProfileVisible(false)}
            onSaved={(updatedProfile, updatedEligibility) => {
              setProfile(updatedProfile);
              setEligibility(updatedEligibility);
            }}
          />
          <ResidentSecurityModal
            visible={securityVisible}
            phone={profile.phone}
            onClose={() => setSecurityVisible(false)}
            onChangePin={openPinReset}
          />
        </>
      ) : null}

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
