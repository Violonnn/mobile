import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import {
  completeRegistrationProfile,
  requestRegistrationOtp,
  signOutAfterRegistrationFailure,
  verifyRegistrationOtp,
} from '../lib/registration';
import {
  formatFullPHMobile,
  sanitizePhoneInput,
  validatePHNumber,
} from '../lib/validation/phone';
import {
  EMPTY_DETAILS,
  OTP_COOLDOWN_SECONDS,
  OTP_MAX_SENDS_PER_SESSION,
  RegistrationDetails,
  RegistrationStep,
} from '../types/registration';

/**
 * Single source of truth for the registration wizard.
 *
 * OTP frontend guards (not a substitute for server rate limits):
 * - Shared cooldown on GET OTP and RESEND OTP
 * - Max sends per phone number per registration session
 * - "Continue verification" so users can go back without triggering a new send
 */
export function useRegistrationFlow() {
  const router = useRouter();

  const [step, setStep] = useState<RegistrationStep>(0);
  const [isComplete, setIsComplete] = useState(false);

  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otp, setOtp] = useState('');
  const [details, setDetails] = useState<RegistrationDetails>(EMPTY_DETAILS);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpSendCount, setOtpSendCount] = useState(0);
  const [otpSentPhone, setOtpSentPhone] = useState('');
  const [sendingOTP, setSendingOTP] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanedPhone = phoneDigits.replace(/\s/g, '');
  // Safely format to E.164 for Supabase (+639xxxxxxxxx)
  const e164Number = `+63${cleanedPhone.replace(/^0+/, '')}`;
  const displayNumber = formatFullPHMobile(`0${cleanedPhone.replace(/^0+/, '')}`);
  
  const phoneValidation = validatePHNumber(phoneDigits);
  const otpLimitReached = otpSendCount >= OTP_MAX_SENDS_PER_SESSION;
  const hasPendingOtp =
    otpSentPhone === cleanedPhone && otpSendCount > 0 && cleanedPhone.replace(/^0+/, '').length === 10;
  const canRequestOtp = resendCooldown === 0 && !otpLimitReached;

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const clearCooldownTimer = useCallback(() => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = null;
    setResendCooldown(0);
  }, []);

  const startCooldown = useCallback((seconds = OTP_COOLDOWN_SECONDS) => {
    setResendCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const resetOtpSession = useCallback(() => {
    setOtpSendCount(0);
    setOtpSentPhone('');
    setOtp('');
    clearCooldownTimer();
  }, [clearCooldownTimer]);

  const updateDetails = useCallback((patch: Partial<RegistrationDetails>) => {
    setDetails((prev) => ({ ...prev, ...patch }));
  }, []);

  const handlePhoneInput = useCallback(
    (text: string) => {
      setPhoneError('');
      const next = sanitizePhoneInput(text);
      const nextClean = next.replace(/\s/g, '');
      const prevClean = phoneDigits.replace(/\s/g, '');

      if (nextClean !== prevClean && otpSentPhone && nextClean !== otpSentPhone) {
        resetOtpSession();
      }

      setPhoneDigits(next);
    },
    [phoneDigits, otpSentPhone, resetOtpSession],
  );

  const sendOTP = useCallback(async () => {
    if (!phoneValidation.valid) return;

    if (resendCooldown > 0) {
      setPhoneError(`Please wait ${resendCooldown}s before requesting another OTP.`);
      return;
    }

    if (otpSendCount >= OTP_MAX_SENDS_PER_SESSION) {
      setPhoneError('Too many OTP requests. Please try again later.');
      return;
    }

    setSendingOTP(true);
    setPhoneError('');

    try {
      const { error } = await requestRegistrationOtp(e164Number);
      if (error) throw new Error(error);

      setOtp('');
      setOtpSentPhone(cleanedPhone);
      setOtpSendCount((count) => count + 1);
      startCooldown(OTP_COOLDOWN_SECONDS);
      setStep(1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      Alert.alert('Failed to send OTP', message);
    } finally {
      setSendingOTP(false);
    }
  }, [
    cleanedPhone,
    e164Number,
    otpSendCount,
    phoneValidation.valid,
    resendCooldown,
    startCooldown,
  ]);

  const handleGetOTP = useCallback(() => {
    const result = validatePHNumber(phoneDigits);
    if (!result.valid) {
      setPhoneError(result.message || 'Enter a valid Philippine mobile number');
      return;
    }
    sendOTP();
  }, [phoneDigits, sendOTP]);

  const continueToOtpVerification = useCallback(() => {
    if (!hasPendingOtp) return;
    setPhoneError('');
    setStep(1);
  }, [hasPendingOtp]);

  const verifyOTP = useCallback(async () => {
    if (otp.length < 6) return;

    try {
      const { error } = await verifyRegistrationOtp(e164Number, otp);
      if (error) throw new Error(error);

      setStep(2);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please check the code and try again.';
      Alert.alert('Invalid OTP', message);
    }
  }, [otp, e164Number]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;

    if (otpSendCount >= OTP_MAX_SENDS_PER_SESSION) {
      Alert.alert(
        'OTP limit reached',
        `You can only request ${OTP_MAX_SENDS_PER_SESSION} codes per session. Please try again later.`,
      );
      return;
    }

    setOtp('');
    await sendOTP();
  }, [otpSendCount, resendCooldown, sendOTP]);

  const goToDetailsNext = useCallback(() => {
    setStep(3);
  }, []);

  const goBack = useCallback((): boolean => {
    if (isComplete) return true;

    Keyboard.dismiss();

    if (step > 0) {
      setStep((prev) => (prev - 1) as RegistrationStep);
      return true;
    }

    router.back();
    return true;
  }, [isComplete, router, step]);

  const completeRegistration = useCallback(
    async (submittedPin: string) => {
      try {
        const { error } = await completeRegistrationProfile({
          phone: e164Number,
          details,
          pin: submittedPin,
        });

        if (error) throw new Error(error);

        setIsComplete(true);

        Alert.alert('Success!', 'Account created successfully!', [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/');
            },
          },
        ]);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Registration could not be completed.';
        Alert.alert('Registration failed', message);

        const needsReauth = /unauthorized|session expired|verify your phone/i.test(message);
        const alreadyRegistered = /already registered/i.test(message);

        if (alreadyRegistered) {
          await signOutAfterRegistrationFailure();
          router.replace('/(auth)/login');
          return;
        }

        if (needsReauth) {
          await signOutAfterRegistrationFailure();
          setOtp('');
          setStep(1);
          return;
        }
      }
    },
    [router, details, e164Number],
  );

  return {
    step,
    isComplete,
    phoneDigits,
    phoneError,
    phoneValidation,
    displayNumber,
    otp,
    details,
    pin,
    confirmPin,
    resendCooldown,
    otpSendCount,
    otpLimitReached,
    hasPendingOtp,
    canRequestOtp,
    sendingOTP,
    setOtp,
    setPin,
    setConfirmPin,
    updateDetails,
    handlePhoneInput,
    handleGetOTP,
    continueToOtpVerification,
    verifyOTP,
    handleResend,
    goToDetailsNext,
    goBack,
    completeRegistration,
  };
}