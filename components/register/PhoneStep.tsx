import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { registerStyles as styles, colors } from '../../styles/screens/register.styles';

type Props = {
  phoneDigits: string;
  onChangePhone: (text: string) => void;
  phoneFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onSubmit: () => void;
  isValid: boolean;
  sendingOTP: boolean;
};

export default function PhoneStep({
  phoneDigits,
  onChangePhone,
  phoneFocused,
  onFocus,
  onBlur,
  onSubmit,
  isValid,
  sendingOTP,
}: Props) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Verify Your Number</Text>
      <Text style={styles.stepSubtitle}>
        We will send you a <Text style={styles.stepSubtitleBold}>One Time Password (OTP)</Text>
      </Text>

      <Text style={styles.fieldLabel}>Enter Mobile Number</Text>
      <View style={[styles.phoneRow, phoneFocused && styles.phoneRowFocused]}>
        <View style={styles.phonePrefixBox}>
          <Text style={styles.phonePrefixText}>+63</Text>
        </View>
        <TextInput
          style={styles.phoneInput}
          value={phoneDigits}
          onChangeText={onChangePhone}
          onFocus={onFocus}
          onBlur={onBlur}
          keyboardType="number-pad"
          placeholder="9XX XXX XXXX"
          placeholderTextColor={colors.grayMuted}
          maxLength={12}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, (!isValid || sendingOTP) && styles.primaryButtonDisabled]}
        onPress={onSubmit}
        disabled={!isValid || sendingOTP}
        activeOpacity={0.8}
      >
        {sendingOTP ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={[styles.primaryButtonText, !isValid && styles.primaryButtonTextDisabled]}>
            <Ionicons name="chevron-forward-outline" size={18} color={colors.white} /> GET OTP
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}