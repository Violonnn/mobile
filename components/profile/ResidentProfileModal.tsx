import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchBarangays, type BarangayOption } from '../../lib/barangays';
import {
  type ProfileUpdateEligibility,
  type PublicProfile,
  updateMyResidentProfile,
} from '../../lib/profile';
import { colors } from '../../styles/theme';
import { residentProfileModalStyles as styles } from '../../styles/components/residentProfileModal.styles';

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

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const localDigits = digits.startsWith('63') ? digits.slice(2) : digits.replace(/^0/, '');
  if (localDigits.length !== 10) return phone;
  return `+63 ${localDigits.slice(0, 3)} ${localDigits.slice(3, 6)} ${localDigits.slice(6)}`;
}

function fullName(profile: PublicProfile): string {
  return [profile.first_name, profile.middle_name, profile.last_name]
    .filter((part) => part.trim())
    .join(' ');
}

function initials(profile: PublicProfile): string {
  return `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase() || 'R';
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

export default function ResidentProfileModal({
  visible,
  profile,
  eligibility,
  onClose,
  onSaved,
}: ResidentProfileModalProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [barangayListOpen, setBarangayListOpen] = useState(false);
  const [firstName, setFirstName] = useState(profile.first_name);
  const [middleName, setMiddleName] = useState(profile.middle_name);
  const [lastName, setLastName] = useState(profile.last_name);
  const [barangay, setBarangay] = useState(profile.barangay);

  useEffect(() => {
    if (!visible) return;

    setEditing(false);
    setBarangayListOpen(false);
    setFirstName(profile.first_name);
    setMiddleName(profile.middle_name);
    setLastName(profile.last_name);
    setBarangay(profile.barangay);

    void fetchBarangays().then((result) => {
      if (result.error) return;
      setBarangays(result.barangays);
    });
  }, [profile, visible]);

  const nextUpdateDate = useMemo(() => {
    if (!eligibility?.nextUpdateAt) return null;
    return formatDate(eligibility.nextUpdateAt);
  }, [eligibility]);

  const canEdit = eligibility?.canUpdate ?? false;
  const hasChanges =
    firstName.trim() !== profile.first_name ||
    middleName.trim() !== profile.middle_name ||
    lastName.trim() !== profile.last_name ||
    barangay.trim() !== profile.barangay;

  function closeModal() {
    if (saving) return;
    setEditing(false);
    onClose();
  }

  async function saveProfile() {
    if (saving || !canEdit || !hasChanges) return;

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
    <Modal visible={visible} animationType="slide" onRequestClose={closeModal}>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={editing ? () => setEditing(false) : closeModal}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Cancel editing' : 'Close profile'}
          >
            <Ionicons name={editing ? 'arrow-back' : 'close'} size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{editing ? 'Edit profile' : 'Your profile'}</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!editing ? (
            <>
              <View style={styles.hero}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(profile)}</Text>
                </View>
                <Text style={styles.name}>{fullName(profile)}</Text>
                <Text style={styles.phone}>{formatPhone(profile.phone)}</Text>
                <View style={styles.residentBadge}>
                  <Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} />
                  <Text style={styles.residentBadgeText}>Resident account</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PERSONAL INFORMATION</Text>
                <InfoRow label="First name" value={profile.first_name} />
                <InfoRow label="Middle name" value={profile.middle_name} />
                <InfoRow label="Last name" value={profile.last_name} />
                <InfoRow label="Mobile number" value={formatPhone(profile.phone)} locked />
                <InfoRow
                  label="Birth month and year"
                  value={`${MONTH_NAMES[profile.birth_month - 1] ?? 'Unknown'} ${profile.birth_year}`}
                  locked
                />
                <InfoRow label="Barangay" value={profile.barangay} />
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
                <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
                <Text style={styles.securityNoticeText}>
                  For account security, your mobile number and birth details cannot be changed in the app.
                  Contact an authorized DisasterLink administrator for a verified correction. Name and
                  barangay changes are limited to once every 30 days.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, !canEdit && styles.disabledButton]}
                onPress={() => setEditing(true)}
                disabled={!canEdit}
                accessibilityRole="button"
              >
                <Ionicons name="create-outline" size={19} color={colors.white} />
                <Text style={styles.primaryButtonText}>Edit profile</Text>
              </TouchableOpacity>
              {!canEdit ? (
                <Text style={styles.limitText}>
                  {nextUpdateDate
                    ? `You can edit your profile again on ${nextUpdateDate}.`
                    : 'Profile editing is temporarily unavailable.'}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.editIntro}>
                <Ionicons name="information-circle-outline" size={21} color={colors.primary} />
                <Text style={styles.editIntroText}>
                  Review carefully. Saving starts a 30-day waiting period before these fields can be edited again.
                </Text>
              </View>

              <Text style={styles.inputLabel}>First name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                maxLength={100}
                autoCapitalize="words"
                autoCorrect={false}
              />
              <Text style={styles.inputLabel}>Middle name (optional)</Text>
              <TextInput
                style={styles.input}
                value={middleName}
                onChangeText={setMiddleName}
                maxLength={100}
                autoCapitalize="words"
                autoCorrect={false}
              />
              <Text style={styles.inputLabel}>Last name</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                maxLength={100}
                autoCapitalize="words"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>Barangay</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setBarangayListOpen((open) => !open)}
                accessibilityRole="button"
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
                </View>
              ) : null}

              <View style={styles.lockedCard}>
                <Text style={styles.lockedCardTitle}>Locked account details</Text>
                <Text style={styles.lockedCardText}>{formatPhone(profile.phone)}</Text>
                <Text style={styles.lockedCardText}>
                  {MONTH_NAMES[profile.birth_month - 1] ?? 'Unknown'} {profile.birth_year}
                </Text>
                <Text style={styles.lockedCardHint}>
                  Mobile number and birth details require administrator verification to correct.
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (saving || !hasChanges) && styles.disabledButton,
                ]}
                onPress={() => void saveProfile()}
                disabled={saving || !hasChanges}
                accessibilityRole="button"
              >
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={19} color={colors.white} />
                    <Text style={styles.primaryButtonText}>Save changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
