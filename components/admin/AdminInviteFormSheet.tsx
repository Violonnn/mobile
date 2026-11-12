import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import LabeledInput from '../register/LabeledInput';
import { fetchBarangays, type BarangayOption } from '../../lib/barangays';
import {
  buildInviteDeepLink,
  createOfficialInvite,
  type InviteRole,
} from '../../lib/invites';
import { maskInviteEmail, maskInvitePhone } from '../../lib/officialRegistration';
import { maskInviteToken } from '../../lib/inviteToken';
import { sanitizePhoneInput } from '../../lib/validation/phone';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

type InviteKind = 'mayor' | 'mdrrmo' | 'bdrrmo';

type AdminInviteFormSheetProps = {
  visible: boolean;
  onRequestClose: () => void;
  onPresented?: () => void;
  onCreated: () => Promise<void>;
};

const ROLE_OPTIONS: { key: InviteKind; label: string }[] = [
  { key: 'mayor', label: 'Mayor' },
  { key: 'mdrrmo', label: 'MDRRMO' },
  { key: 'bdrrmo', label: 'BDRRMO' },
];

export default function AdminInviteFormSheet({
  visible,
  onRequestClose,
  onPresented,
  onCreated,
}: AdminInviteFormSheetProps) {
  const [inviteKind, setInviteKind] = useState<InviteKind>('mayor');
  const [invitedEmail, setInvitedEmail] = useState('');
  const [invitedPhone, setInvitedPhone] = useState('');
  const [selectedBarangayId, setSelectedBarangayId] = useState<string | null>(null);
  const [barangayPickerOpen, setBarangayPickerOpen] = useState(false);
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [barangaysLoading, setBarangaysLoading] = useState(false);
  const [barangaysError, setBarangaysError] = useState('');
  const [barangaysLoaded, setBarangaysLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [maskedLink, setMaskedLink] = useState('');
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const createLockRef = useRef(false);
  const copyLockRef = useRef(false);
  const mountedRef = useRef(true);

  const selectedBarangay = barangays.find((barangay) => barangay.id === selectedBarangayId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadBarangays = useCallback(async (force = false) => {
    setBarangaysLoading(true);
    setBarangaysError('');
    try {
      const result = await fetchBarangays(force ? { force: true } : undefined);
      if (!mountedRef.current) return;
      if (result.error) {
        setBarangaysError('Could not load barangays. Check your connection and retry.');
        return;
      }
      setBarangays(result.barangays);
      setBarangaysLoaded(true);
    } catch {
      if (mountedRef.current) {
        setBarangaysError('Could not load barangays. Check your connection and retry.');
      }
    } finally {
      if (mountedRef.current) setBarangaysLoading(false);
    }
  }, []);

  const selectInviteKind = useCallback((kind: InviteKind) => {
    setInviteKind(kind);
    if (
      kind === 'bdrrmo' &&
      !barangaysLoaded &&
      !barangaysLoading &&
      !barangaysError
    ) {
      void loadBarangays();
    }
  }, [barangaysError, barangaysLoaded, barangaysLoading, loadBarangays]);

  const requestClose = useCallback(() => {
    if (createLockRef.current || copyLockRef.current) return;
    Keyboard.dismiss();
    if (barangayPickerOpen) {
      setBarangayPickerOpen(false);
      return;
    }

    if (generatedLink && !isCopied) {
      Alert.alert(
        'Discard invite link?',
        'This is the only time the link can be copied. Close and discard it?',
        [
          { text: 'Keep link', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: onRequestClose,
          },
        ],
      );
      return;
    }

    onRequestClose();
  }, [barangayPickerOpen, generatedLink, isCopied, onRequestClose]);

  const handleCreateInvite = useCallback(async () => {
    if (createLockRef.current) return;

    const email = invitedEmail.trim().toLowerCase();
    const phoneDigits = invitedPhone.replace(/\D/g, '');
    setEmailError('');
    setPhoneError('');
    setCreateError('');

    if (!email || !email.includes('@')) {
      setEmailError('Enter a valid office email address.');
      return;
    }
    if (!phoneDigits) {
      setPhoneError('Enter a mobile number for SMS verification.');
      return;
    }

    let role: InviteRole = 'mayor';
    let barangayId: string | null = null;
    if (inviteKind === 'mdrrmo') {
      role = 'officer';
    } else if (inviteKind === 'bdrrmo') {
      role = 'officer';
      if (!selectedBarangayId) {
        setCreateError('Select a barangay for this BDRRMO invite.');
        return;
      }
      barangayId = selectedBarangayId;
    }

    createLockRef.current = true;
    setCreating(true);
    try {
      const result = await createOfficialInvite({
        role,
        invitedEmail: email,
        invitedPhone: phoneDigits,
        barangayId,
      });
      if (!mountedRef.current) return;

      if (result.emailError) setEmailError(result.emailError);
      if (result.phoneError) setPhoneError(result.phoneError);
      if (result.emailError || result.phoneError) {
        setCreateError(
          result.requiresManualReview
            ? 'Manual review is required before issuing another invite. Follow the recovery guide.'
            : '',
        );
        return;
      }
      if (result.error || !result.token) {
        setCreateError(result.error ?? 'Could not create invite. Please try again.');
        return;
      }

      const link = buildInviteDeepLink(result.token);
      setGeneratedLink(link);
      setMaskedLink(`disasterlink://invite?token=${maskInviteToken(result.token)}`);
      setCopyError('');
      setIsCopied(false);
      void onCreated().catch(() => undefined);
    } catch {
      if (mountedRef.current) {
        setCreateError('Could not create invite. Check your connection and try again.');
      }
    } finally {
      createLockRef.current = false;
      if (mountedRef.current) setCreating(false);
    }
  }, [inviteKind, invitedEmail, invitedPhone, onCreated, selectedBarangayId]);

  const handleCopyLink = useCallback(async () => {
    if (!generatedLink || copyLockRef.current) return;
    copyLockRef.current = true;
    setCopying(true);
    setCopyError('');
    try {
      await Clipboard.setStringAsync(generatedLink);
      if (!mountedRef.current) return;
      setIsCopied(true);
    } catch {
      if (mountedRef.current) {
        setCopyError('Could not copy the link. Check clipboard access and retry.');
      }
    } finally {
      copyLockRef.current = false;
      if (mountedRef.current) setCopying(false);
    }
  }, [generatedLink]);

  const inviteScope = inviteKind === 'mayor'
    ? 'Mayor'
    : inviteKind === 'mdrrmo'
      ? 'MDRRMO'
      : `BDRRMO · ${selectedBarangay?.name ?? 'Barangay'}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onShow={onPresented}
      onRequestClose={requestClose}
    >
      <View style={sheetStyles.overlay}>
        <TouchableOpacity
          style={sheetStyles.backdrop}
          onPress={requestClose}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Close invite sheet"
        />
        <KeyboardAvoidingView
          style={sheetStyles.keyboardWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={sheetStyles.sheet} edges={['bottom']}>
            <View style={sheetStyles.sheetHeader}>
              <View style={sheetStyles.sheetTitleGroup}>
                <Text style={sheetStyles.sheetEyebrow}>Admin</Text>
                <Text style={sheetStyles.sheetTitle}>
                  {generatedLink ? 'Invite ready' : 'New invite'}
                </Text>
              </View>
              <TouchableOpacity
                style={sheetStyles.closeButton}
                onPress={requestClose}
                disabled={creating || copying}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Close invite sheet"
                accessibilityState={{ disabled: creating || copying }}
              >
                <Ionicons name="close-outline" size={24} color={colors.navigationActive} />
              </TouchableOpacity>
            </View>

            {generatedLink ? (
              <ScrollView
                contentContainerStyle={sheetStyles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={sheetStyles.successIcon}>
                  <Ionicons name="checkmark-outline" size={25} color="#166534" />
                </View>
                <View style={sheetStyles.summaryCard}>
                  <Text style={sheetStyles.summaryLabel}>Role and scope</Text>
                  <Text style={sheetStyles.summaryValue}>{inviteScope}</Text>
                  <Text style={sheetStyles.summaryText}>{maskInviteEmail(invitedEmail)}</Text>
                  <Text style={sheetStyles.summaryText}>{maskInvitePhone(invitedPhone)}</Text>
                </View>
                <View style={sheetStyles.maskedLinkCard}>
                  <Text style={sheetStyles.summaryLabel}>One-time invite link</Text>
                  <Text style={sheetStyles.maskedLink} selectable={false}>{maskedLink}</Text>
                </View>
                <Text style={sheetStyles.body}>Copy now. This link cannot be retrieved later.</Text>
                {!!copyError && <Text style={sheetStyles.errorText}>{copyError}</Text>}
                <TouchableOpacity
                  style={sheetStyles.primaryButton}
                  onPress={() => void handleCopyLink()}
                  disabled={copying || isCopied}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={isCopied ? 'Invite link copied' : 'Copy invite link'}
                  accessibilityState={{ disabled: copying || isCopied, busy: copying }}
                >
                  {copying ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <>
                      <Ionicons
                        name={isCopied ? 'checkmark-outline' : 'copy-outline'}
                        size={19}
                        color={colors.white}
                      />
                      <Text style={sheetStyles.primaryButtonText}>
                        {isCopied ? 'Copied' : 'Copy link'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={sheetStyles.secondaryButton}
                  onPress={requestClose}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={sheetStyles.secondaryButtonText}>Done</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ScrollView
                contentContainerStyle={sheetStyles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              >
                <Text style={sheetStyles.fieldLabel}>Role</Text>
                <View style={sheetStyles.roleRow}>
                  {ROLE_OPTIONS.map((option) => {
                    const selected = inviteKind === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[sheetStyles.roleChip, selected && sheetStyles.roleChipSelected]}
                        onPress={() => {
                          selectInviteKind(option.key);
                          setCreateError('');
                          if (option.key !== 'bdrrmo') setBarangayPickerOpen(false);
                        }}
                        disabled={creating}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled: creating }}
                        accessibilityLabel={option.label}
                      >
                        <Text
                          style={[
                            sheetStyles.roleChipText,
                            selected && sheetStyles.roleChipTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {inviteKind === 'bdrrmo' && (
                  <View style={sheetStyles.fieldGroup}>
                    <Text style={sheetStyles.fieldLabel}>Barangay</Text>
                    <TouchableOpacity
                      style={sheetStyles.selectorButton}
                      onPress={() => setBarangayPickerOpen((currentValue) => !currentValue)}
                      disabled={creating || barangaysLoading || !!barangaysError}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: creating || barangaysLoading || !!barangaysError,
                        expanded: barangayPickerOpen,
                      }}
                    >
                      <Text style={selectedBarangay ? sheetStyles.selectorValue : sheetStyles.selectorPlaceholder}>
                        {selectedBarangay?.name ?? 'Select a barangay'}
                      </Text>
                      {barangaysLoading ? (
                        <ActivityIndicator size="small" color={colors.navigationActive} />
                      ) : (
                        <Ionicons
                          name={barangayPickerOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
                          size={18}
                          color={colors.navigationActive}
                        />
                      )}
                    </TouchableOpacity>
                    {barangaysError ? (
                      <View style={sheetStyles.inlineErrorRow}>
                        <Text style={sheetStyles.errorText}>{barangaysError}</Text>
                        <TouchableOpacity
                          style={sheetStyles.retryButton}
                          onPress={() => void loadBarangays(true)}
                          accessibilityRole="button"
                        >
                          <Text style={sheetStyles.secondaryButtonText}>Retry</Text>
                        </TouchableOpacity>
                      </View>
                    ) : barangayPickerOpen && barangays.length > 0 ? (
                      <ScrollView
                        style={sheetStyles.barangayList}
                        contentContainerStyle={sheetStyles.barangayListContent}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                      >
                        {barangays.map((barangay) => {
                          const selected = selectedBarangayId === barangay.id;
                          return (
                            <TouchableOpacity
                              key={barangay.id}
                              style={[
                                sheetStyles.barangayOption,
                                selected && sheetStyles.barangayOptionSelected,
                              ]}
                              onPress={() => {
                                setSelectedBarangayId(barangay.id);
                                setBarangayPickerOpen(false);
                                setCreateError('');
                              }}
                              disabled={creating}
                              accessibilityRole="button"
                              accessibilityState={{ selected, disabled: creating }}
                            >
                              <Text style={sheetStyles.barangayOptionText}>{barangay.name}</Text>
                              {selected && (
                                <Ionicons
                                  name="checkmark-outline"
                                  size={18}
                                  color={colors.navigationActive}
                                />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    ) : barangayPickerOpen ? (
                      <View style={sheetStyles.emptyBarangays}>
                        <Text style={sheetStyles.helperText}>No barangays are available.</Text>
                        <TouchableOpacity
                          style={sheetStyles.retryButton}
                          onPress={() => void loadBarangays(true)}
                          accessibilityRole="button"
                        >
                          <Text style={sheetStyles.secondaryButtonText}>Retry</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                )}

                <LabeledInput
                  label="Email"
                  leadingIcon="mail-outline"
                  value={invitedEmail}
                  onChangeText={(value) => {
                    setInvitedEmail(value);
                    setEmailError('');
                    setCreateError('');
                  }}
                  placeholder="name@office.gov.ph"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!creating}
                  error={emailError}
                  style={sheetStyles.inputText}
                />
                <LabeledInput
                  label="Mobile number"
                  leadingPrefix="+63"
                  value={invitedPhone}
                  onChangeText={(value) => {
                    setInvitedPhone(sanitizePhoneInput(value));
                    setPhoneError('');
                    setCreateError('');
                  }}
                  placeholder="9XX XXX XXXX"
                  keyboardType="phone-pad"
                  editable={!creating}
                  error={phoneError}
                  style={sheetStyles.inputText}
                />
                <Text style={sheetStyles.helperText}>
                  The invitee must use a supported Globe, TM, or DITO number to receive SMS.
                </Text>

                {!!createError && <Text style={sheetStyles.errorText}>{createError}</Text>}
                <TouchableOpacity
                  style={[
                    sheetStyles.primaryButton,
                    creating && sheetStyles.disabledButton,
                  ]}
                  onPress={() => void handleCreateInvite()}
                  disabled={creating}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: creating, busy: creating }}
                >
                  {creating ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="add-outline" size={20} color={colors.white} />
                      <Text style={sheetStyles.primaryButtonText}>Create invite</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,32,68,0.32)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  keyboardWrapper: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    maxHeight: '94%',
  },
  sheet: {
    maxHeight: '100%',
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
  },
  sheetHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitleGroup: {
    flex: 1,
    gap: 2,
  },
  sheetEyebrow: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  sheetTitle: {
    fontFamily: fonts.semibold,
    fontSize: 21,
    color: colors.navigationActive,
  },
  closeButton: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.navigationActive,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  roleChip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
  },
  roleChipSelected: {
    borderWidth: 1.5,
    borderColor: colors.navigationActive,
  },
  roleChipText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  roleChipTextSelected: {
    fontFamily: fonts.semibold,
    color: colors.navigationActive,
  },
  selectorButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  selectorValue: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  selectorPlaceholder: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  barangayList: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  barangayListContent: {
    paddingVertical: spacing.xs,
  },
  emptyBarangays: {
    gap: spacing.xs,
  },
  barangayOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  barangayOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
  barangayOptionText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    color: colors.navigationActive,
  },
  inputText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  helperText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 19,
  },
  inlineErrorRow: {
    gap: spacing.sm,
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.unverified,
    lineHeight: 20,
  },
  retryButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  primaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.navigationActive,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.white,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.55,
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.navigationActive,
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    lineHeight: 21,
  },
  summaryCard: {
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
  },
  summaryLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  summaryValue: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.navigationActive,
  },
  summaryText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  maskedLinkCard: {
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  maskedLink: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.navigationActive,
    lineHeight: 19,
  },
});
