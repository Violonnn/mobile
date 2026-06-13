import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';
import OTPInput from './OTPInput';

const OTP_LENGTH = 6;

type Props = {
  displayNumber: string;
  otp: string;
  onChangeOtp: (value: string) => void;
  resendCooldown: number;
  sendingOTP: boolean;
  onResend: () => void;
  onVerify: () => void;
};

export default function OTPStep({
  displayNumber,
  otp,
  onChangeOtp,
  resendCooldown,
  sendingOTP,
  onResend,
  onVerify,
}: Props) {
  const otpComplete = otp.replace(/\s/g, '').length === OTP_LENGTH;

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>OTP Verification</Text>
      <Text style={styles.otpTargetText}>
        Enter the OTP sent to{' '}
        <Text style={styles.otpTargetNumber}>{displayNumber}</Text>
      </Text>

      <OTPInput value={otp} onChange={onChangeOtp} />

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
        style={[styles.primaryButton, !otpComplete && styles.primaryButtonDisabled]}
        onPress={onVerify}
        disabled={!otpComplete}
        activeOpacity={0.8}
      >
        {sendingOTP ? (
          <ActivityIndicator color={registerColors.white} />
        ) : (
          <Text style={[styles.primaryButtonText, !otpComplete && styles.primaryButtonTextDisabled]}>
            VERIFY & PROCEED
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
