import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';
import { OTP_MAX_SENDS_PER_SESSION } from '../../types/registration';
import NumericKeyboardAccessory, { NUMERIC_ACCESSORY_ID } from '../ui/NumericKeyboardAccessory';

type Props = {
  phoneDigits: string;
  onChangePhone: (text: string) => void;
  phoneFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onSubmit: () => void;
  onContinueVerification: () => void;
  isValid: boolean;
  sendingOTP: boolean;
  resendCooldown: number;
  canRequestOtp: boolean;
  hasPendingOtp: boolean;
  otpLimitReached: boolean;
  otpSendCount: number;
  phoneError?: string;
};

export default function PhoneStep({
  phoneDigits,
  onChangePhone,
  phoneFocused,
  onFocus,
  onBlur,
  onSubmit,
  onContinueVerification,
  isValid,
  sendingOTP,
  resendCooldown,
  canRequestOtp,
  hasPendingOtp,
  otpLimitReached,
  otpSendCount,
  phoneError = '',
}: Props) {
  const getOtpDisabled = !isValid || sendingOTP || !canRequestOtp;

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Verify Your Number</Text>
      <Text style={styles.stepSubtitle}>
        We will send you a{' '}
        <Text style={styles.stepSubtitleBold}>One Time Password (OTP)</Text>
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
          placeholderTextColor={registerColors.grayMuted}
          maxLength={12}
          returnKeyType="done"
          inputAccessoryViewID={NUMERIC_ACCESSORY_ID}
          onSubmitEditing={() => {
            onBlur();
            if (!getOtpDisabled) onSubmit();
          }}
        />
      </View>

      {!!phoneError && (
        <Text style={[styles.phoneHint, styles.phoneHintLarge, styles.phoneHintError]}>
          {phoneError}
        </Text>
      )}

      {!phoneError && resendCooldown > 0 && (
        <Text style={[styles.phoneHint, styles.phoneHintLarge]}>
          Wait {resendCooldown}s before requesting another OTP.
        </Text>
      )}

      {!phoneError && otpLimitReached && (
        <Text style={[styles.phoneHint, styles.phoneHintLarge, styles.phoneHintError]}>
          OTP limit reached ({OTP_MAX_SENDS_PER_SESSION} requests). Try again later.
        </Text>
      )}

      {!phoneError && !otpLimitReached && otpSendCount > 0 && (
        <Text style={[styles.phoneHint, styles.phoneHintLarge]}>
          OTP requests used: {otpSendCount}/{OTP_MAX_SENDS_PER_SESSION}
        </Text>
      )}

      <TouchableOpacity
        style={[styles.primaryButton, getOtpDisabled && styles.primaryButtonDisabled]}
        onPress={onSubmit}
        disabled={getOtpDisabled}
        activeOpacity={0.8}
      >
        {sendingOTP ? (
          <ActivityIndicator color={registerColors.white} />
        ) : (
          <>
            <Ionicons name="chevron-forward-outline" size={18} color={registerColors.white} />
            <Text style={[styles.primaryButtonText, !isValid && styles.primaryButtonTextDisabled]}>
              GET OTP
            </Text>
          </>
        )}
      </TouchableOpacity>

      {hasPendingOtp && (
        <TouchableOpacity
          style={styles.continueVerificationButton}
          onPress={onContinueVerification}
          activeOpacity={0.7}
        >
          <Text style={styles.continueVerificationText}>
            Already have a code? Continue verification →
          </Text>
        </TouchableOpacity>
      )}

      <NumericKeyboardAccessory />
    </View>
  );
}
