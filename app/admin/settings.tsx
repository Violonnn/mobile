import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { AdminSettingsIdentitySkeleton } from '../../components/ui/AdminScreenSkeletons';
import LegalModal, {
  PRIVACY_NOTICE_CONTENT,
  TERMS_INFORMATION_CONTENT,
} from '../../components/register/LegalModal';
import OfficialPasswordModal from '../../components/official/OfficialPasswordModal';
import ProfileAvatar from '../../components/profile/ProfileAvatar';
import { getActiveSession, logout } from '../../lib/auth';
import { changeOfficialPassword } from '../../lib/officialPassword';
import {
  fetchMyOfficialPublicProfile,
  type OfficialPublicProfile,
} from '../../lib/profile';
import { adminStyles as styles } from '../../styles/screens/admin.styles';
import { colors } from '../../styles/theme';

type LegalDocument = 'privacy' | 'terms' | null;

type AdminIdentitySnapshot = {
  email: string | null;
  profile: OfficialPublicProfile | null;
  error: string | null;
};

async function fetchAdminIdentitySnapshot(): Promise<AdminIdentitySnapshot> {
  try {
    const [session, profileResult] = await Promise.all([
      getActiveSession(),
      fetchMyOfficialPublicProfile(),
    ]);
    return {
      email: session?.user.email ?? null,
      profile: profileResult.profile,
      error:
        profileResult.error ??
        (session ? null : 'Your administrator session is unavailable.'),
    };
  } catch {
    return {
      email: null,
      profile: null,
      error: 'Could not load administrator identity. Check your connection and retry.',
    };
  }
}

function profileName(profile: OfficialPublicProfile | null): string | null {
  if (!profile) return null;
  return [profile.first_name, profile.middle_name, profile.last_name]
    .filter((part) => part?.trim())
    .join(' ')
    .trim() || null;
}

export default function AdminSettingsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<OfficialPublicProfile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [legalDocument, setLegalDocument] = useState<LegalDocument>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const identityRequestRef = useRef(0);
  const passwordLockRef = useRef(false);
  const logoutLockRef = useRef(false);

  const applyIdentitySnapshot = useCallback((snapshot: AdminIdentitySnapshot) => {
    setEmail(snapshot.email);
    setProfile(snapshot.profile);
    setIdentityError(snapshot.error);
  }, []);

  const loadIdentity = useCallback(async () => {
    const requestId = ++identityRequestRef.current;
    const snapshot = await fetchAdminIdentitySnapshot();
    if (!mountedRef.current || requestId !== identityRequestRef.current) return;
    applyIdentitySnapshot(snapshot);
    setIdentityLoading(false);
  }, [applyIdentitySnapshot]);

  useEffect(() => {
    mountedRef.current = true;
    const requestId = ++identityRequestRef.current;
    void fetchAdminIdentitySnapshot().then((snapshot) => {
      if (!mountedRef.current || requestId !== identityRequestRef.current) return;
      applyIdentitySnapshot(snapshot);
      setIdentityLoading(false);
    });
    return () => {
      mountedRef.current = false;
      identityRequestRef.current += 1;
    };
  }, [applyIdentitySnapshot]);

  const retryIdentity = useCallback(() => {
    if (identityLoading) return;
    setIdentityLoading(true);
    setIdentityError(null);
    void loadIdentity();
  }, [identityLoading, loadIdentity]);

  const submitPasswordChange = useCallback(
    async (input: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) => {
      if (passwordLockRef.current) return;
      passwordLockRef.current = true;
      setPasswordSubmitting(true);
      setPasswordError(null);

      try {
        const initiatingSession = await getActiveSession();
        const initiatingUserId = initiatingSession?.user.id;
        if (!initiatingUserId) {
          if (mountedRef.current) {
            setPasswordError('Your administrator session has expired. Sign in again and retry.');
          }
          return;
        }

        const result = await changeOfficialPassword(input);
        const currentSession = await getActiveSession();
        if (currentSession && currentSession.user.id !== initiatingUserId) return;
        if (result.error) {
          if (mountedRef.current) setPasswordError(result.error);
          return;
        }

        if (mountedRef.current) setPasswordVisible(false);
        Alert.alert(
          'Password changed',
          result.warning || 'Sign in again using your new administrator-account password.',
        );
        if (mountedRef.current) router.replace('/(auth)/official-login' as Href);
      } catch {
        if (mountedRef.current) {
          setPasswordError('Could not change the password. Check your connection and retry.');
        }
      } finally {
        passwordLockRef.current = false;
        if (mountedRef.current) setPasswordSubmitting(false);
      }
    },
    [router],
  );

  const performLogout = useCallback(async () => {
    if (!mountedRef.current || logoutLockRef.current) return;
    logoutLockRef.current = true;
    setLoggingOut(true);
    setLogoutError(null);

    try {
      const result = await logout();
      if (!mountedRef.current) return;
      if (result.error) {
        setLogoutError(result.error);
        return;
      }
      router.replace('/(auth)/official-login' as Href);
    } catch {
      if (mountedRef.current) {
        setLogoutError('Could not log out. Check your connection and retry.');
      }
    } finally {
      logoutLockRef.current = false;
      if (mountedRef.current) setLoggingOut(false);
    }
  }, [router]);

  const confirmLogout = useCallback(() => {
    if (!mountedRef.current || logoutLockRef.current || loggingOut) return;
    Alert.alert(
      'Log out of DisasterLink?',
      'You will need to sign in again to access the administrator workspace.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => {
            if (!mountedRef.current) return;
            void performLogout();
          },
        },
      ],
    );
  }, [loggingOut, performLogout]);

  const name = profileName(profile);
  const version = Constants.expoConfig?.version || 'Unavailable';
  const legalTitle = legalDocument === 'privacy' ? 'Privacy notice' : 'Terms and conditions';
  const legalContent = legalDocument === 'privacy'
    ? PRIVACY_NOTICE_CONTENT
    : TERMS_INFORMATION_CONTENT;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <AdminPageHeader title="Settings" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identityArea}>
          {identityLoading && !profile && !email ? (
            <AdminSettingsIdentitySkeleton />
          ) : (
            <>
              <View style={styles.identityRow}>
                <ProfileAvatar
                  avatarPath={profile?.avatar_path}
                  firstName={profile?.first_name}
                  lastName={profile?.last_name}
                  fallback={name ? undefined : 'A'}
                  size={56}
                  style={styles.identityAvatar}
                  textStyle={styles.identityAvatarText}
                  accessibilityLabel="Administrator profile"
                />
                <View style={styles.identityCopy}>
                  <Text style={styles.identityName}>
                    {name || 'Name unavailable'}
                  </Text>
                  <Text style={styles.identityEmail} selectable>
                    {email || 'Email unavailable'}
                  </Text>
                </View>
              </View>

              <Text style={styles.identityRole}>System administrator</Text>

            </>
          )}

          {identityError ? (
            <View style={styles.identityState}>
              <Text style={styles.identityStateText}>{identityError}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={retryIdentity}
                disabled={identityLoading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Retry loading administrator identity"
                accessibilityState={{ disabled: identityLoading, busy: identityLoading }}
              >
                <Text style={styles.retryButtonText}>
                  {identityLoading ? 'Loading…' : 'Retry'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.settingsGroup}>
          <Text style={styles.settingsGroupTitle}>Account</Text>
          <View style={styles.settingsPanel}>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => {
                setPasswordError(null);
                setPasswordVisible(true);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <View style={styles.settingsRowIcon}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.navigationActive} />
              </View>
              <View style={styles.settingsRowCopy}>
                <Text style={styles.settingsRowTitle}>Change password</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.settingsGroup}>
          <Text style={styles.settingsGroupTitle}>Legal</Text>
          <View style={styles.settingsPanel}>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => setLegalDocument('privacy')}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <View style={styles.settingsRowIcon}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.navigationActive} />
              </View>
              <View style={styles.settingsRowCopy}>
                <Text style={styles.settingsRowTitle}>Privacy notice</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingsRow, styles.settingsRowLast]}
              onPress={() => setLegalDocument('terms')}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <View style={styles.settingsRowIcon}>
                <Ionicons name="document-text-outline" size={20} color={colors.navigationActive} />
              </View>
              <View style={styles.settingsRowCopy}>
                <Text style={styles.settingsRowTitle}>Terms and conditions</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.settingsGroup}>
          <Text style={styles.settingsGroupTitle}>About</Text>
          <View style={styles.settingsPanel}>
            <View style={[styles.settingsRow, styles.settingsRowLast]}>
              <View style={styles.settingsRowIcon}>
                <Ionicons name="information-circle-outline" size={20} color={colors.navigationActive} />
              </View>
              <View style={styles.settingsRowCopy}>
                <Text style={styles.settingsRowTitle}>App version</Text>
              </View>
              <Text style={styles.settingsVersion}>{version}</Text>
            </View>
          </View>
        </View>

        <View style={styles.logoutArea}>
          {logoutError ? <Text style={styles.logoutError}>{logoutError}</Text> : null}
          <TouchableOpacity
            style={[styles.logoutButton, loggingOut && { opacity: 0.75 }]}
            onPress={confirmLogout}
            disabled={loggingOut}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Log out of administrator account"
            accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
          >
            {loggingOut ? (
              <ActivityIndicator color={colors.unverified} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={20} color={colors.unverified} />
                <Text style={styles.logoutButtonText}>Log out</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LegalModal
        visible={legalDocument !== null}
        title={legalTitle}
        content={legalContent}
        actionLabel="Close"
        requireRead={false}
        onAccept={() => setLegalDocument(null)}
        onClose={() => setLegalDocument(null)}
      />
      <OfficialPasswordModal
        visible={passwordVisible}
        submitting={passwordSubmitting}
        error={passwordError}
        onClose={() => {
          setPasswordError(null);
          setPasswordVisible(false);
        }}
        onSubmit={(input) => void submitPasswordChange(input)}
      />
    </SafeAreaView>
  );
}
