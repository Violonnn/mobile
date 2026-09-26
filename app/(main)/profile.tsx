import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurTargetView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import LegalModal, {
  PRIVACY_NOTICE_CONTENT,
  TERMS_INFORMATION_CONTENT,
} from '../../components/register/LegalModal';
import ResidentProfileModal from '../../components/profile/ResidentProfileModal';
import ProfileAvatar from '../../components/profile/ProfileAvatar';
import ProfilePhotoModal from '../../components/profile/ProfilePhotoModal';
import { ProfileScreenSkeleton } from '../../components/ui/ResidentScreenSkeletons';
import { useResidentData } from '../../context/ResidentDataContext';
import { logout } from '../../lib/auth';
import {
  getResidentMapTheme,
  setResidentMapTheme,
  type ResidentMapTheme,
} from '../../lib/mapPreferences';
import {
  fetchProfileUpdateEligibility,
  type ProfileUpdateEligibility,
} from '../../lib/profile';
import { formatNameWithMiddleInitial } from '../../lib/validation/name';
import { profileStyles as styles } from '../../styles/screens/profile.styles';
import { getResidentBottomNavigationHeight } from '../../styles/components/bottomNav.styles';
import { colors } from '../../styles/theme';

type LegalDocument = 'privacy' | 'terms' | null;

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const localDigits = digits.startsWith('63') ? digits.slice(2) : digits.replace(/^0/, '');
  if (localDigits.length !== 10) return phone;
  return `+63 ${localDigits.slice(0, 3)} ${localDigits.slice(3, 6)} ${localDigits.slice(6)}`;
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
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const bottomNavigationPadding =
    getResidentBottomNavigationHeight(fontScale) + insets.bottom + 16;
  const blurTargetRef = useRef<View>(null);
  const {
    profile,
    profileInitialLoading,
    profileError,
    refreshProfile,
    updateProfile,
  } = useResidentData();
  const [eligibility, setEligibility] = useState<ProfileUpdateEligibility | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mapTheme, setMapTheme] = useState<ResidentMapTheme>('light');
  const [mapThemeSaving, setMapThemeSaving] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [profilePhotoVisible, setProfilePhotoVisible] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocument>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void refreshProfile();
      void getResidentMapTheme().then((storedTheme) => {
        if (active) setMapTheme(storedTheme);
      });

      return () => {
        active = false;
      };
    }, [refreshProfile]),
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

    // Logout should return directly to sign-in, without replaying the launch-only splash.
    router.replace('/(auth)/login' as Href);
  }

  function confirmLogout() {
    Alert.alert('Log out of DisasterLink?', 'You will need your phone number and PIN to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void handleLogout() },
    ]);
  }

  function openPinReset() {
    if (!profile) return;

    router.push({
      pathname: '/(auth)/forgot-password',
      params: { phone: profile.phone, source: 'settings' },
    });
  }

  function openPersonalInformation() {
    if (!profile) return;
    setProfileVisible(true);
    if (eligibility) return;

    // Eligibility is only needed by the editor, so avoid this RPC on every Settings visit.
    void fetchProfileUpdateEligibility().then((result) => {
      if (result.eligibility) setEligibility(result.eligibility);
    });
  }

  const documentTitle = legalDocument === 'privacy' ? 'Privacy & data' : 'Terms & policies';
  const documentContent =
    legalDocument === 'privacy' ? PRIVACY_NOTICE_CONTENT : TERMS_INFORMATION_CONTENT;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <BlurTargetView ref={blurTargetRef} style={styles.blurTarget}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomNavigationPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
        <Text style={styles.screenTitle}>Settings</Text>

        {profileInitialLoading ? (
          <ProfileScreenSkeleton />
        ) : profileError && !profile ? (
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />
            <Text style={styles.errorText}>{profileError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void refreshProfile({ force: true })}
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : profile ? (
          <>
            <View style={styles.identityRow}>
              <ProfileAvatar
                avatarPath={profile.avatar_path}
                firstName={profile.first_name}
                lastName={profile.last_name}
                size={92}
                style={styles.avatar}
                textStyle={styles.avatarText}
                accessibilityLabel="Your profile picture"
              />
              <View style={styles.identityCopy}>
                <Text style={styles.identityName}>
                  {formatNameWithMiddleInitial(
                    profile.first_name,
                    profile.middle_name,
                    profile.last_name,
                  )}
                </Text>
                <Text style={styles.identityPhone}>{formatPhone(profile.phone)}</Text>
                <TouchableOpacity
                  style={styles.viewProfileButton}
                  onPress={() => setProfilePhotoVisible(true)}
                  accessibilityRole="button"
                >
                  <Text style={styles.viewProfileText}>View profile picture</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ACCOUNT</Text>
              <SettingsRow
                title="Personal information"
                subtitle="Name, phone number, birth details, and barangay"
                onPress={openPersonalInformation}
              />
              <SettingsRow
                title="Security & PIN"
                subtitle="Change PIN and manage sign-in"
                onPress={openPinReset}
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
      </BlurTargetView>

      {profile ? (
        <>
          <ResidentProfileModal
            visible={profileVisible}
            profile={profile}
            eligibility={eligibility}
            onClose={() => setProfileVisible(false)}
            onSaved={(updatedProfile, updatedEligibility) => {
              updateProfile(updatedProfile);
              setEligibility(updatedEligibility);
            }}
          />
          <ProfilePhotoModal
            visible={profilePhotoVisible}
            firstName={profile.first_name}
            lastName={profile.last_name}
            avatarPath={profile.avatar_path}
            blurTarget={blurTargetRef}
            onClose={() => setProfilePhotoVisible(false)}
            onChanged={(avatarPath) => {
              updateProfile({ ...profile, avatar_path: avatarPath });
            }}
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
