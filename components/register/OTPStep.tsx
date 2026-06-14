import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';
import OTPInput from './OTPInput';
import FieldError from './FieldError';

type Props = {
  displayNumber: string;
  otp: string;
  otpError?: string;
  onChangeOtp: (value: string) => void;
  resendCooldown: number;
  sendingOTP: boolean;
  verifyingOTP: boolean;
  onResend: () => void;
  onVerify: () => void;
};

export default function OTPStep({
  displayNumber,
  otp,
  otpError = '',
  onChangeOtp,
  resendCooldown,
  sendingOTP,
  verifyingOTP,
  onResend,
  onVerify,
}: Props) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>OTP Verification</Text>
      <Text style={styles.otpTargetText}>
        Enter the OTP sent to{' '}
        <Text style={styles.otpTargetNumber}>{displayNumber}</Text>
      </Text>

      <View style={styles.loginFieldWrap}>
        <Text style={styles.loginFieldLabel}>6-digit code</Text>
        <OTPInput value={otp} onChange={onChangeOtp} hasError={!!otpError} />
        <FieldError message={otpError} />
      </View>

      <View style={styles.resendRow}>
        <Text style={styles.resendLabel}>Didn't receive the OTP? </Text>
        {resendCooldown > 0 ? (
          <Text style={styles.resendTimer}>Resend in {resendCooldown}s</Text>
        ) : (
          <TouchableOpacity onPress={onResend} disabled={sendingOTP}>
            <Text style={[styles.resendButton, sendingOTP && styles.resendButtonDisabled]}>
              RESEND OTP
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, verifyingOTP && styles.primaryButtonDisabled]}
        onPress={onVerify}
        disabled={verifyingOTP}
        activeOpacity={0.8}
      >
        {verifyingOTP ? (
          <ActivityIndicator color={registerColors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>VERIFY & PROCEED</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
