// app/admin/invitations.tsx — Official invite create / list / revoke.
// Same workflow as the former admin.tsx, restyled for the portal shell.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { StatusBar } from 'expo-status-bar';
import { adminStyles as styles } from '../../styles/screens/admin.styles';
import { colors } from '../../styles/theme';
import { fetchBarangays, type BarangayOption } from '../../lib/barangays';
import {
  buildInviteDeepLink,
  createOfficialInvite,
  formatInviteKind,
  listOfficialInvites,
  revokeOfficialInvite,
  type InviteListItem,
  type InviteRole,
} from '../../lib/invites';
import { maskInvitePhone } from '../../lib/officialRegistration';
import { sanitizePhoneInput } from '../../lib/validation/phone';
import LabeledInput from '../../components/register/LabeledInput';

type InviteKind = 'mayor' | 'mdrrmo' | 'bdrrmo';

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function StatusChip({ used }: { used: boolean }) {
  return (
    <View
      style={[
        styles.statusChip,
        used ? styles.statusChipUsed : styles.statusChipActive,
      ]}
    >
      <Text
        style={[
          styles.statusChipText,
          used ? styles.statusChipTextUsed : styles.statusChipTextActive,
        ]}
      >
        {used ? 'Used' : 'Active'}
      </Text>
    </View>
  );
}

export default function AdminInvitationsScreen() {
  const [loadingLists, setLoadingLists] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  const [inviteKind, setInviteKind] = useState<InviteKind>('mayor');
  const [invitedEmail, setInvitedEmail] = useState('');
  const [invitedPhone, setInvitedPhone] = useState('');
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [selectedBarangayId, setSelectedBarangayId] = useState<string | null>(
    null,
  );
  const [barangayError, setBarangayError] = useState('');

  const [activeInvites, setActiveInvites] = useState<InviteListItem[]>([]);
  const [usedInvites, setUsedInvites] = useState<InviteListItem[]>([]);
  const [listError, setListError] = useState('');
  const [createError, setCreateError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');

  const loadInvites = useCallback(async () => {
    const { active, used, error } = await listOfficialInvites();
    if (error) {
      setListError(error);
      setActiveInvites([]);
      setUsedInvites([]);
      return;
    }
    setListError('');
    setActiveInvites(active);
    setUsedInvites(used);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [barangayResult] = await Promise.all([
        fetchBarangays(),
        loadInvites(),
      ]);

      if (cancelled) return;

      if (barangayResult.error) {
        setBarangayError(barangayResult.error);
      } else {
        setBarangays(barangayResult.barangays);
      }
      setLoadingLists(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadInvites]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadInvites();
    setRefreshing(false);
  }

  async function handleCreateInvite() {
    if (creating) return;

    setCreateError('');
    setEmailError('');
    setPhoneError('');
    setCopyFeedback('');
    setGeneratedLink('');

    const email = invitedEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setEmailError('Enter the invitee government email address.');
      return;
    }

    const phoneDigits = invitedPhone.replace(/\D/g, '');
    if (!phoneDigits) {
      setPhoneError(
        'Enter a Globe, TM, or DITO mobile number for SMS verification.',
      );
      return;
    }

    let role: InviteRole = 'mayor';
    let barangayId: string | null = null;

    if (inviteKind === 'mayor') {
      role = 'mayor';
    } else if (inviteKind === 'mdrrmo') {
      role = 'officer';
      barangayId = null;
    } else {
      role = 'officer';
      if (!selectedBarangayId) {
        setCreateError('Select a barangay for the BDRRMO invite.');
        return;
      }
      barangayId = selectedBarangayId;
    }

    setCreating(true);
    try {
      const result = await createOfficialInvite({
        role,
        invitedEmail: email,
        invitedPhone: phoneDigits,
        barangayId,
      });

      if (result.emailError) setEmailError(result.emailError);
      if (result.phoneError) setPhoneError(result.phoneError);

      if (result.error || !result.token) {
        if (!result.emailError && !result.phoneError) {
          setCreateError(result.error ?? 'Could not create invite.');
        } else if (result.requiresManualReview) {
          setCreateError(
            'Manual review required. See docs/admin-invite-recovery.md before issuing a new invite.',
          );
        }
        return;
      }

      const link = buildInviteDeepLink(result.token);
      setGeneratedLink(link);
      setInvitedEmail('');
      setInvitedPhone('');
      await loadInvites();
      Alert.alert(
        'Invite created',
        'Copy the link now. The raw token is only shown once. Only the invited email and phone can register with it.',
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleCopyLink() {
    if (!generatedLink) return;
    await Clipboard.setStringAsync(generatedLink);
    setCopyFeedback('Link copied to clipboard.');
  }

  function handleRevoke(invite: InviteListItem) {
    Alert.alert(
      'Revoke invite?',
      `Revoke the ${formatInviteKind(invite.role, invite.barangay_id)} invite? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            const { error } = await revokeOfficialInvite(invite.id);
            if (error) {
              Alert.alert('Revoke failed', error);
              return;
            }
            await loadInvites();
          },
        },
      ],
    );
  }

  if (loadingLists) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.themeSoft} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerTextGroup}>
            <Text style={styles.title}>Invitations</Text>
            <Text style={styles.subtitle}>
              Create and manage official invite links
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Create invitation</Text>
            <View style={styles.listGap}>
              <Text style={styles.sectionHint}>
                1. Link is only visible after first creation. Copy it immediately.
              </Text>
              <Text style={styles.sectionHint}>
                2. No domain — any email is accepted.
              </Text>
              <Text style={styles.sectionHint}>
                3. Phone number limited to Globe / TM / DITO.
              </Text>
            </View>

            <LabeledInput
              label="Invited government email"
              leadingIcon="mail-outline"
              value={invitedEmail}
              onChangeText={(text) => {
                setInvitedEmail(text);
                if (emailError) setEmailError('');
                if (createError) setCreateError('');
              }}
              placeholder="name@minglanilla.gov.ph"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!creating}
              error={emailError}
            />

            <LabeledInput
              label="Invited mobile (Globe / TM / DITO)"
              leadingPrefix="+63"
              value={invitedPhone}
              onChangeText={(text) => {
                setInvitedPhone(sanitizePhoneInput(text));
                if (phoneError) setPhoneError('');
                if (createError) setCreateError('');
              }}
              placeholder="9XX XXX XXXX"
              keyboardType="phone-pad"
              editable={!creating}
              error={phoneError}
            />

            <View style={styles.roleRow}>
              {(
                [
                  { key: 'mayor', label: 'Mayor' },
                  { key: 'mdrrmo', label: 'MDRRMO' },
                  { key: 'bdrrmo', label: 'BDRRMO' },
                ] as const
              ).map((option) => {
                const selected = inviteKind === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.roleChip, selected && styles.roleChipSelected]}
                    onPress={() => setInviteKind(option.key)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={option.label}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        selected && styles.roleChipTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {inviteKind === 'bdrrmo' && (
              <View style={styles.listGap}>
                <Text style={styles.fieldLabel}>Barangay</Text>
                {barangayError ? (
                  <Text style={styles.errorText}>{barangayError}</Text>
                ) : (
                  <View style={styles.selectBox}>
                    {barangays.map((barangay) => {
                      const selected = selectedBarangayId === barangay.id;
                      return (
                        <TouchableOpacity
                          key={barangay.id}
                          style={[
                            styles.selectOption,
                            selected && styles.selectOptionSelected,
                          ]}
                          onPress={() => setSelectedBarangayId(barangay.id)}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={barangay.name}
                        >
                          <Text style={styles.selectOptionText}>
                            {barangay.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {!!createError && <Text style={styles.errorText}>{createError}</Text>}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                creating && styles.primaryButtonDisabled,
              ]}
              onPress={handleCreateInvite}
              disabled={creating}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Generate invite link"
            >
              {creating ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Generate invite link</Text>
              )}
            </TouchableOpacity>

            {!!generatedLink && (
              <View style={styles.successBox}>
                <Text style={styles.successTitle}>One-time invite link</Text>
                <Text style={styles.successLink} selectable>
                  {generatedLink}
                </Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={handleCopyLink}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Copy invite link"
                >
                  <Text style={styles.copyButtonText}>Copy link</Text>
                </TouchableOpacity>
                {!!copyFeedback && (
                  <Text style={styles.successTitle}>{copyFeedback}</Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Active invitations</Text>
            {listError ? (
              <View style={styles.listGap}>
                <Text style={styles.errorText}>{listError}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleRefresh}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading invites"
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : activeInvites.length === 0 ? (
              <Text style={styles.emptyText}>No active invite links.</Text>
            ) : (
              <View style={styles.listGap}>
                {activeInvites.map((invite) => (
                  <View
                    key={invite.id}
                    style={[styles.inviteRow, styles.inviteRowActive]}
                  >
                    <View style={styles.inviteRowTop}>
                      <Text style={styles.inviteKind}>
                        {formatInviteKind(invite.role, invite.barangay_id)}
                      </Text>
                      <StatusChip used={false} />
                    </View>
                    <Text style={styles.inviteMeta}>
                      Email: {invite.invited_email}
                    </Text>
                    <Text style={styles.inviteMeta}>
                      Phone: {maskInvitePhone(invite.invited_phone)}
                    </Text>
                    {!!invite.barangay_name && (
                      <Text style={styles.inviteMeta}>
                        Barangay: {invite.barangay_name}
                      </Text>
                    )}
                    <Text style={styles.inviteMeta}>
                      Created: {formatDate(invite.created_at)}
                    </Text>
                    <Text style={styles.inviteMeta}>
                      Expires: {formatDate(invite.expires_at)}
                    </Text>
                    <TouchableOpacity
                      style={styles.revokeButton}
                      onPress={() => handleRevoke(invite)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="Revoke invite"
                    >
                      <Text style={styles.revokeButtonText}>Revoke</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Used invitations</Text>
            {listError ? (
              <Text style={styles.errorText}>{listError}</Text>
            ) : usedInvites.length === 0 ? (
              <Text style={styles.emptyText}>No used invite links yet.</Text>
            ) : (
              <View style={styles.listGap}>
                {usedInvites.map((invite) => (
                  <View
                    key={invite.id}
                    style={[styles.inviteRow, styles.inviteRowUsed]}
                  >
                    <View style={styles.inviteRowTop}>
                      <Text style={styles.inviteKind}>
                        {formatInviteKind(invite.role, invite.barangay_id)}
                      </Text>
                      <StatusChip used />
                    </View>
                    <Text style={styles.inviteMeta}>
                      Email: {invite.invited_email}
                    </Text>
                    <Text style={styles.inviteMeta}>
                      Phone: {maskInvitePhone(invite.invited_phone)}
                    </Text>
                    {!!invite.barangay_name && (
                      <Text style={styles.inviteMeta}>
                        Barangay: {invite.barangay_name}
                      </Text>
                    )}
                    <Text style={styles.inviteMeta}>
                      Created: {formatDate(invite.created_at)}
                    </Text>
                    <Text style={styles.inviteMeta}>
                      Used: {invite.used_at ? formatDate(invite.used_at) : '—'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
