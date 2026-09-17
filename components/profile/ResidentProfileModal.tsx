import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchBarangays, type BarangayOption } from '../../lib/barangays';
import {
  type ProfileUpdateEligibility,
  type PublicProfile,
  updateMyResidentProfile,
} from '../../lib/profile';
import { formatNameWithMiddleInitial } from '../../lib/validation/name';
import { colors, spacing } from '../../styles/theme';
import { residentProfileModalStyles as styles } from '../../styles/components/residentProfileModal.styles';
import ProfileAvatar from './ProfileAvatar';

type ResidentProfileModalProps = {
  visible: boolean;
  profile: PublicProfile;
  eligibility: ProfileUpdateEligibility | null;
  onClose: () => void;
  onSaved: (profile: PublicProfile, eligibility: ProfileUpdateEligibility | null) => void;
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatAvailableAfter(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Temporarily unavailable';
  return `Available after ${date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const localDigits = digits.startsWith('63') ? digits.slice(2) : digits.replace(/^0/, '');
  if (localDigits.length !== 10) return phone;
  return `+63 ${localDigits.slice(0, 3)} ${localDigits.slice(3, 6)} ${localDigits.slice(6)}`;
}

function InfoRow({ label, value, locked = false }: { label: string; value: string; locked?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || 'Not provided'}</Text>
      </View>
      {locked ? <Ionicons name="lock-closed-outline" size={17} color={colors.textMuted} /> : null}
    </View>
  );
}

function EditFieldLabel({
  label,
  availabilityText,
}: {
  label: string;
  availabilityText: string | null;
}) {
  return (
    <View style={styles.inputLabelRow}>
      <Text style={styles.inputLabel}>{label}</Text>
      {availabilityText ? <Text style={styles.inputAvailability}>{availabilityText}</Text> : null}
    </View>
  );
}

export default function ResidentProfileModal({
  visible,
  profile,
  eligibility,
  onClose,
  onSaved,
}: ResidentProfileModalProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [slideTranslateX] = useState(() => new Animated.Value(screenWidth));
  const [isClosing, setIsClosing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [barangaysLoading, setBarangaysLoading] = useState(false);
  const [barangaysError, setBarangaysError] = useState<string | null>(null);
  const [barangayListOpen, setBarangayListOpen] = useState(false);
  const [firstName, setFirstName] = useState(profile.first_name);
  const [middleName, setMiddleName] = useState(profile.middle_name);
  const [lastName, setLastName] = useState(profile.last_name);
  const [barangay, setBarangay] = useState(profile.barangay);
  const [previousVisible, setPreviousVisible] = useState(visible);
  const [previousProfile, setPreviousProfile] = useState(profile);

  if (visible !== previousVisible || profile !== previousProfile) {
    setPreviousVisible(visible);
    setPreviousProfile(profile);
    if (visible) {
      setEditing(false);
      setBarangayListOpen(false);
      setFirstName(profile.first_name);
      setMiddleName(profile.middle_name);
      setLastName(profile.last_name);
      setBarangay(profile.barangay);
    }
  }

  // React Native's built-in modal slide enters from the bottom, so animate the screen horizontally.
  useEffect(() => {
    if (!visible) return;

    slideTranslateX.setValue(screenWidth);
    const animationFrame = requestAnimationFrame(() => {
      Animated.timing(slideTranslateX, {
        toValue: 0,
        duration: 270,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      slideTranslateX.stopAnimation();
    };
  }, [screenWidth, slideTranslateX, visible]);

  const loadBarangays = useCallback(async () => {
    setBarangaysLoading(true);
    setBarangaysError(null);
    const result = await fetchBarangays();
    setBarangaysLoading(false);

    if (result.error) {
      setBarangaysError('Barangays could not be loaded. Please try again.');
      return;
    }

    setBarangays(result.barangays);
  }, []);

  const canEditName = eligibility?.canUpdateName ?? false;
  const canEditBarangay = eligibility?.canUpdateBarangay ?? false;
  const nameAvailabilityText = canEditName
    ? null
    : eligibility?.nameNextUpdateAt
      ? formatAvailableAfter(eligibility.nameNextUpdateAt)
      : 'Availability unavailable';
  const barangayAvailabilityText = canEditBarangay
    ? null
    : eligibility?.barangayNextUpdateAt
      ? formatAvailableAfter(eligibility.barangayNextUpdateAt)
      : 'Availability unavailable';
  const hasNameChanges =
    firstName.trim() !== profile.first_name ||
    middleName.trim() !== profile.middle_name ||
    lastName.trim() !== profile.last_name;
  const hasBarangayChange = barangay.trim() !== profile.barangay;
  const hasChanges = hasNameChanges || hasBarangayChange;
  const hasUnavailableChanges =
    (hasNameChanges && !canEditName) || (hasBarangayChange && !canEditBarangay);

  function toggleBarangayList() {
    if (!canEditBarangay) return;

    const nextOpenState = !barangayListOpen;
    setBarangayListOpen(nextOpenState);
    if (nextOpenState && barangays.length === 0 && !barangaysLoading) {
      void loadBarangays();
    }
  }

  function cancelEditing() {
    if (saving) return;
    setFirstName(profile.first_name);
    setMiddleName(profile.middle_name);
    setLastName(profile.last_name);
    setBarangay(profile.barangay);
    setBarangayListOpen(false);
    setEditing(false);
  }

  function closeModal() {
    if (saving || isClosing) return;

    setEditing(false);
    setIsClosing(true);
    Animated.timing(slideTranslateX, {
      toValue: screenWidth,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      setIsClosing(false);
      if (finished) onClose();
    });
  }

  async function saveProfile() {
    if (saving || !hasChanges || hasUnavailableChanges) return;

    setSaving(true);
    const result = await updateMyResidentProfile({
      firstName,
      middleName,
      lastName,
      barangay,
    });
    setSaving(false);

    if (result.error || !result.profile) {
      Alert.alert('Profile not updated', result.error || 'Please try again.');
      return;
    }

    setEditing(false);
    onSaved(result.profile, result.eligibility);
    Alert.alert('Profile updated', 'Your name and barangay are now updated across DisasterLink.');
  }

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={closeModal}
    >
      <Animated.View
        style={[styles.screen, { transform: [{ translateX: slideTranslateX }] }]}
      >
      <SafeAreaView style={styles.screen} edges={['bottom']}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={editing ? cancelEditing : closeModal}
            disabled={saving || isClosing}
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Cancel editing' : 'Back'}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{editing ? 'Edit Profile' : 'Your Profile'}</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <ProfileAvatar
              avatarPath={profile.avatar_path}
              firstName={profile.first_name}
              lastName={profile.last_name}
              size={88}
              style={styles.avatar}
              textStyle={styles.avatarText}
              accessibilityLabel="Your profile picture"
            />
            <Text style={styles.name}>
              {formatNameWithMiddleInitial(
                editing ? firstName : profile.first_name,
                editing ? middleName : profile.middle_name,
                editing ? lastName : profile.last_name,
              )}
            </Text>
            <Text style={styles.phone}>{formatPhone(profile.phone)}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
            {editing ? (
              <>
                <View style={styles.editableInfoRow}>
                  <EditFieldLabel label="First name" availabilityText={nameAvailabilityText} />
                  <TextInput
                    style={[styles.inlineInput, !canEditName && styles.inputDisabled]}
                    value={firstName}
                    onChangeText={setFirstName}
                    maxLength={100}
                    autoCapitalize="words"
                    autoCorrect={false}
                    editable={canEditName}
                  />
                </View>
                <View style={styles.editableInfoRow}>
                  <EditFieldLabel
                    label="Middle name (optional)"
                    availabilityText={nameAvailabilityText}
                  />
                  <TextInput
                    style={[styles.inlineInput, !canEditName && styles.inputDisabled]}
                    value={middleName}
                    onChangeText={setMiddleName}
                    maxLength={100}
                    autoCapitalize="words"
                    autoCorrect={false}
                    editable={canEditName}
                  />
                </View>
                <View style={styles.editableInfoRow}>
                  <EditFieldLabel label="Last name" availabilityText={nameAvailabilityText} />
                  <TextInput
                    style={[styles.inlineInput, !canEditName && styles.inputDisabled]}
                    value={lastName}
                    onChangeText={setLastName}
                    maxLength={100}
                    autoCapitalize="words"
                    autoCorrect={false}
                    editable={canEditName}
                  />
                </View>
              </>
            ) : (
              <>
                <InfoRow label="First name" value={profile.first_name} />
                <InfoRow label="Middle name" value={profile.middle_name} />
                <InfoRow label="Last name" value={profile.last_name} />
              </>
            )}
            <InfoRow label="Mobile number" value={formatPhone(profile.phone)} locked />
            <InfoRow
              label="Birth month and year"
              value={`${MONTH_NAMES[profile.birth_month - 1] ?? 'Unknown'} ${profile.birth_year}`}
              locked
            />
            {editing ? (
              <View style={styles.editableInfoRow}>
                <EditFieldLabel label="Barangay" availabilityText={barangayAvailabilityText} />
                <TouchableOpacity
                  style={[styles.dropdownButton, !canEditBarangay && styles.inputDisabled]}
                  onPress={toggleBarangayList}
                  disabled={!canEditBarangay}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canEditBarangay, expanded: barangayListOpen }}
                >
                  <Text style={styles.dropdownValue}>{barangay}</Text>
                  <Ionicons
                    name={barangayListOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
                {barangayListOpen ? (
                  <View style={styles.dropdownList}>
                    {barangaysLoading ? (
                      <View style={styles.dropdownStatus}>
                        <ActivityIndicator color={colors.primary} />
                        <Text style={styles.dropdownStatusText}>Loading barangays…</Text>
                      </View>
                    ) : barangaysError ? (
                      <View style={styles.dropdownStatus}>
                        <Text style={styles.dropdownStatusText}>{barangaysError}</Text>
                        <TouchableOpacity
                          onPress={() => void loadBarangays()}
                          accessibilityRole="button"
                        >
                          <Text style={styles.dropdownRetryText}>Try again</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <ScrollView
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator
                      >
                        {barangays.map((option) => (
                          <TouchableOpacity
                            key={option.id}
                            style={styles.dropdownOption}
                            onPress={() => {
                              setBarangay(option.name);
                              setBarangayListOpen(false);
                            }}
                          >
                            <Text style={styles.dropdownOptionText}>{option.name}</Text>
                            {option.name === barangay ? (
                              <Ionicons name="checkmark" size={20} color={colors.primary} />
                            ) : null}
                          </TouchableOpacity>
                        ))}
                        {barangays.length === 0 ? (
                          <View style={styles.dropdownStatus}>
                            <Text style={styles.dropdownStatusText}>No barangays are available.</Text>
                          </View>
                        ) : null}
                      </ScrollView>
                    )}
                  </View>
                ) : null}
              </View>
            ) : (
              <InfoRow label="Barangay" value={profile.barangay} />
            )}
            <InfoRow label="Municipality" value={profile.municipality} locked />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACCOUNT DETAILS</Text>
            <InfoRow
              label="Registration completed"
              value={formatDate(profile.registration_completed_at)}
              locked
            />
            <InfoRow label="Last profile update" value={formatDate(profile.updated_at)} locked />
          </View>

          <View style={styles.securityNotice}>
            <View style={styles.securityNoticeCopy}>
              <View style={styles.securityNoticeTitleRow}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.navigationActive} />
                <Text style={styles.securityNoticeTitle}>Profile changes &amp; account security</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.securityNoticeText}>
                  Name and barangay changes each have a 30-day cooldown.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.securityNoticeText}>
                  If your old mobile number is unavailable, contact support for account recovery.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.unavailableCard}>
            <View style={styles.unavailableCardCopy}>
              <Text style={styles.unavailableCardTitle}>Account number change process</Text>
              <Text style={styles.unavailableCardText}>For verified mobile number changes</Text>
            </View>
            <Text style={styles.unavailableBadge}>Not yet implemented</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              editing &&
                (saving || !hasChanges || hasUnavailableChanges) &&
                styles.disabledButton,
            ]}
            onPress={editing ? () => void saveProfile() : () => setEditing(true)}
            disabled={editing && (saving || !hasChanges || hasUnavailableChanges)}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons
                  name={editing ? 'checkmark-circle-outline' : 'create-outline'}
                  size={19}
                  color={colors.white}
                />
                <Text style={styles.primaryButtonText}>
                  {editing ? 'Save changes' : 'Edit Profile'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}
