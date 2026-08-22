import React, { useState } from 'react';
import {
  ActivityIndicator,
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

import { OFFICIAL_PASSWORD_MIN_LENGTH } from '../../lib/officialRegistration';
import { mdrrmoSettingsStyles as styles } from '../../styles/screens/mdrrmoSettings.styles';
import { colors } from '../../styles/theme';

type Props = {
  visible: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => void;
};

type PasswordFieldProps = {
  label: string;
  value: string;
  visible: boolean;
  onChangeText: (value: string) => void;
  onToggleVisible: () => void;
};

function PasswordField({
  label,
  value,
  visible,
  onChangeText,
  onToggleVisible,
}: PasswordFieldProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.passwordInputRow}>
        <TextInput
          style={styles.passwordInput}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={label === 'Current password' ? 'password' : 'newPassword'}
          autoComplete={label === 'Current password' ? 'current-password' : 'new-password'}
        />
        <TouchableOpacity
          style={styles.passwordEye}
          onPress={onToggleVisible}
          accessibilityLabel={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OfficialPasswordModal({
  visible,
  submitting,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const closeAndReset = () => {
    if (submitting) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    onClose();
  };

  const canSubmit = currentPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeAndReset}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.securityCard}>
          <View style={styles.securityHeader}>
            <Text style={styles.securityTitle}>Password & access</Text>
            <TouchableOpacity style={styles.closeButton} onPress={closeAndReset} accessibilityLabel="Close">
              <Ionicons name="close" size={23} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 16 }}>
              <Text style={styles.securityIntro}>
                Confirm the current password before setting a new official-account password.
              </Text>
              <View style={styles.securityNotice}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
                <Text style={styles.securityNoticeText}>
                  Use at least {OFFICIAL_PASSWORD_MIN_LENGTH} characters. A successful change signs this account out so the new password is required.
                </Text>
              </View>
              <PasswordField
                label="Current password"
                value={currentPassword}
                visible={showCurrent}
                onChangeText={setCurrentPassword}
                onToggleVisible={() => setShowCurrent((current) => !current)}
              />
              <PasswordField
                label="New password"
                value={newPassword}
                visible={showNew}
                onChangeText={setNewPassword}
                onToggleVisible={() => setShowNew((current) => !current)}
              />
              <PasswordField
                label="Confirm new password"
                value={confirmPassword}
                visible={showConfirm}
                onChangeText={setConfirmPassword}
                onToggleVisible={() => setShowConfirm((current) => !current)}
              />
              {error ? <Text style={styles.passwordError}>{error}</Text> : null}
              <TouchableOpacity
                style={[styles.securitySubmit, (!canSubmit || submitting) && styles.securitySubmitDisabled]}
                onPress={() => onSubmit({ currentPassword, newPassword, confirmPassword })}
                disabled={!canSubmit || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.securitySubmitText}>Change password securely</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
