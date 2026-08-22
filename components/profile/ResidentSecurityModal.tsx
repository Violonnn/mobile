import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/theme';
import { residentProfileModalStyles as styles } from '../../styles/components/residentProfileModal.styles';

type ResidentSecurityModalProps = {
  visible: boolean;
  phone: string;
  onClose: () => void;
  onChangePin: () => void;
};

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const localDigits = digits.startsWith('63') ? digits.slice(2) : digits.replace(/^0/, '');
  if (localDigits.length !== 10) return phone;
  return `+63 ${localDigits.slice(0, 3)} ${localDigits.slice(3, 6)} ${localDigits.slice(6)}`;
}

export default function ResidentSecurityModal({
  visible,
  phone,
  onClose,
  onChangePin,
}: ResidentSecurityModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dialogBackdrop}>
        <View style={styles.dialogCard}>
          <View style={styles.dialogIcon}>
            <Ionicons name="key-outline" size={25} color={colors.primary} />
          </View>
          <Text style={styles.dialogTitle}>Security & PIN</Text>
          <Text style={styles.dialogBody}>
            Your six-digit PIN protects the account linked to {formatPhone(phone)}.
          </Text>
          <View style={styles.dialogNotice}>
            <Ionicons name="shield-checkmark-outline" size={19} color={colors.primary} />
            <Text style={styles.dialogNoticeText}>
              Changing your PIN requires an OTP sent to your registered number. You will be signed out after the change.
            </Text>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={onChangePin}>
            <Text style={styles.primaryButtonText}>Change PIN securely</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
