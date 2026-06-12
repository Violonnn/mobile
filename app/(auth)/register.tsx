// lib
import React, { useState, useRef, useEffect } from 'react'; 
import { validatePHNumber } from '../../lib/validation/phone';
// components
import Stepper from '../../components/register/Stepper';
import OTPInput from '../../components/register/OTPInput';
import PhoneStep from '../../components/register/PhoneStep'; // 💡 Your newly extracted component!

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { registerStyles as styles } from '../../styles/screens/register.styles';
import { Image } from 'react-native';

type Step = 0 | 1 | 2;
const OTP_LENGTH = 6;

export default function RegisterScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);

  // Step 1 States
  const [phoneDigits, setPhoneDigits] = useState(''); 
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // Step 2 States
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sendingOTP, setSendingOTP] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const displayNumber = `0${phoneDigits}`;
  const validation = validatePHNumber(phoneDigits);

  // ─── Cooldown timer ────────────────────────────────────────────────────
  function startCooldown(seconds = 60) {
    setResendCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // ─── Supabase OTP send ─────────────────────────────────────────────────
  async function sendOTP() {
    if (!validation.valid) return;
    setSendingOTP(true);

    try {
      await new Promise((res) => setTimeout(res, 1200)); // placeholder delay
      setOtp('');
      startCooldown(60);
      setStep(1);
    } catch (err: any) {
      Alert.alert('Failed to send OTP', err?.message || 'Please try again.');
    } finally {
      setSendingOTP(false);
    }
  }

  // ─── Supabase OTP verify ───────────────────────────────────────────────
  async function verifyOTP() {
    if (otp.length < OTP_LENGTH) return;

    try {
      await new Promise((res) => setTimeout(res, 900)); // placeholder delay
      setStep(2);
    } catch (err: any) {
      Alert.alert('Invalid OTP', err?.message || 'Please check the code and try again.');
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setOtp('');
    await sendOTP();
  }

  // ─── Input handler ─────────────────────────────────────────────────────
  const handlePhoneInput = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 10);
    setPhoneDigits(formatPhone(cleaned));
  };

  const formatPhone = (digits: string) => {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3, 6)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  };

  function handleGetOTP() {
    const v = validatePHNumber(phoneDigits);
    if (!v.valid) {
      setPhoneError(v.message || 'Enter a valid Philippine mobile number');
      return;
    }
    sendOTP();
  }

  function handleBack() {
    if (step > 0) {
      setStep((prev) => (prev - 1) as Step);
    } else {
      router.back();
    }
  }

 const imageSource =
  step === 0
    ? require('../../assets/images/inputPhone.png')
    : step === 1
    ? require('../../assets/images/inputVerify.png')
    : require('../../assets/images/inputDetails.png');

  // ─── Render remaining steps inline until you extract them ───────────────

  function renderOTPStep() {
    const otpComplete = otp.replace(/\s/g, '').length === OTP_LENGTH;
    return (
      <>
        <Text style={styles.stepTitle}>OTP Verification</Text>
        <Text style={styles.otpTargetText}>
          Enter the OTP sent to{' '}
          <Text style={styles.otpTargetNumber}>{displayNumber}</Text>
        </Text>

        <OTPInput value={otp} onChange={setOtp} />

        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn't receive the OTP? </Text>
          {resendCooldown > 0 ? (
            <Text style={styles.resendTimer}>Resend in {resendCooldown}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={sendingOTP}>
              <Text style={[styles.resendButton, sendingOTP && styles.resendButtonDisabled]}>
                RESEND OTP
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            !otpComplete && styles.primaryButtonDisabled,
          ]}
          onPress={verifyOTP}
          disabled={!otpComplete}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryButtonText, !otpComplete && styles.primaryButtonTextDisabled]}>
            VERIFY &amp; PROCEED
          </Text>
        </TouchableOpacity>
      </>
    );
  }

  function renderDetailsStep() {
    return (
      <>
        <Text style={styles.stepTitle}>Enter Your Details</Text>
        <Text style={styles.stepSubtitle}>
          Almost there. Fill in your information to complete registration.
        </Text>
      </>
    );
  }

  // ─── Main View Template ─────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
    >
      <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.8}>
        <Text style={styles.backButtonText}>‹</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
              <Text style={styles.stepTitle}>Registration</Text>
            
        <View style={styles.imageContainer}>
          <Image source={imageSource} style={styles.imagePlaceholder} resizeMode="contain" />
        </View>

        <Stepper current={step} />

        <View style={styles.card}>
          {/* 💡 Step 0 calls your clean component directly instead of a local layout function */}
          {step === 0 && (
            <PhoneStep
              phoneDigits={phoneDigits}
              onChangePhone={handlePhoneInput}
              phoneFocused={phoneFocused}
              onFocus={() => setPhoneFocused(true)}
              onBlur={() => setPhoneFocused(false)}
              onSubmit={handleGetOTP}
              isValid={validation.valid}
              sendingOTP={sendingOTP}
            />
          )}
          {step === 1 && renderOTPStep()}
          {step === 2 && renderDetailsStep()}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}