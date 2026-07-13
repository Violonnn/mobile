import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import {
  endResetSession,
  requestPasswordResetOtp,
  submitNewPin,
  verifyPasswordResetOtp,
} from '../lib/resetPin';
import { setSavedPhone } from '../lib/savedPhone';
import {
  formatFullPHMobile,
  sanitizePhoneInput,
  validatePHNumber,
} from '../lib/validation/phone';
import {
  OTP_COOLDOWN_SECONDS,
  OTP_MAX_SENDS_PER_SESSION,
  OTP_MAX_VERIFY_ATTEMPTS,
} from '../types/registration';

/** Steps: 0 = phone, 1 = OTP, 2 = new PIN. */
export type ForgotStep = 0 | 1 | 2;

const OTP_RESEND_HINT =
  'Too many incorrect codes. Tap "Resend OTP" to get a new one.';

// Anti-enumeration: shown for every phone number, registered or not.
const GENERIC_SENT_MESSAGE =
  'If an account exists for this phone number, a verification code has been sent.';

/**
 * Forgot-PIN wizard. Reuses the shared OTP infrastructure (purpose=password_reset)
 * to verify phone ownership, then sets a new PIN via the reset-pin function.
 *
 * Security notes:
 * - The phone step never reveals whether an account exists.
 * - A verified OTP only authorizes the reset; it never logs the user into the app.
 *   The short-lived session is signed out after reset or when leaving the flow.
 */
export function useForgotPasswordFlow() {
  const router = useRouter();

  const [step, setStep] = useState<ForgotStep>(0);

  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpSendCount, setOtpSendCount] = useState(0);
  const [otpSentPhone, setOtpSentPhone] = useState('');
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // True once verifyOtp has minted a session that must be signed out on exit.
  const hasResetSessionRef = useRef(false);

  const cleanedPhone = phoneDigits.replace(/\s/g, '');
  const e164Number = `+63${cleanedPhone.replace(/^0+/, '')}`;
  const displayNumber = formatFullPHMobile(`0${cleanedPhone.replace(/^0+/, '')}`);

  const phoneValidation = validatePHNumber(phoneDigits);
  const otpLimitReached = otpSendCount >= OTP_MAX_SENDS_PER_SESSION;
  const hasPendingOtp =
    otpSentPhone === cleanedPhone &&
    otpSendCount > 0 &&
    cleanedPhone.replace(/^0+/, '').length === 10;
  const canRequestOtp = resendCooldown === 0 && !otpLimitReached;

  const displayPhoneError =
    phoneError ||
    (cleanedPhone.length === 10 && !phoneValidation.valid ? phoneValidation.message : '');

  const clearCooldownTimer = useCallback(() => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = null;
    setResendCooldown(0);
  }, []);

  const startCooldown = useCallback(
    (seconds = OTP_COOLDOWN_SECONDS) => {
      if (seconds <= 0) {
        clearCooldownTimer();
        return;
      }

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
    },
    [clearCooldownTimer],
  );

  // Clean up the timer and sign out any lingering reset session on unmount.
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (hasResetSessionRef.current) {
        endResetSession();
        hasResetSessionRef.current = false;
      }
    };
  }, []);

  const handlePhoneInput = useCallback((text: string) => {
    setPhoneError('');
    setPhoneDigits(sanitizePhoneInput(text));
  }, []);

  const sendResetOtp = useCallback(async () => {
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
      const result = await requestPasswordResetOtp(e164Number);

      // Mirror server-enforced counters/cooldown for accurate UX.
      if (result.sendCount !== undefined) {
        setOtpSendCount(result.sendCount);
        setOtpSentPhone(cleanedPhone);
      }
      if (result.cooldownSeconds && result.cooldownSeconds > 0) {
        startCooldown(result.cooldownSeconds);
      }

      // Only carrier/validation/rate-limit errors surface here — the server
      // never returns an "account not found" error, so existence stays hidden.
      if (result.error) {
        setPhoneError(result.error);
        return;
      }

      setOtp('');
      setOtpAttempts(0);
      setOtpSentPhone(cleanedPhone);
      if (result.sendCount === undefined) {
        setOtpSendCount((prev) => prev + 1);
      }

      setStep(1);
      Alert.alert('Check your messages', GENERIC_SENT_MESSAGE);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      setPhoneError(message);
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
    sendResetOtp();
  }, [phoneDigits, sendResetOtp]);

  const continueToOtpVerification = useCallback(() => {
    if (!hasPendingOtp) return;
    setPhoneError('');
    setStep(1);
  }, [hasPendingOtp]);

  const handleOtpChange = useCallback((value: string) => {
    setOtpError('');
    setOtp(value);
  }, []);

  const verifyOTP = useCallback(async () => {
    if (otp.length < 6) {
      setOtpError('Enter the complete 6-digit OTP.');
      return;
    }

    setVerifyingOTP(true);
    setOtpError('');
    try {
      const { error } = await verifyPasswordResetOtp(e164Number, otp);
      if (error) throw new Error(error);

      // Session now exists only to authorize the PIN reset — never the app.
      hasResetSessionRef.current = true;
      setOtpAttempts(0);
      setStep(2);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid or expired OTP. Please try again.';

      const nextAttempts = otpAttempts + 1;
      setOtpAttempts(nextAttempts);
      setOtpError(nextAttempts >= OTP_MAX_VERIFY_ATTEMPTS ? OTP_RESEND_HINT : message);
    } finally {
      setVerifyingOTP(false);
    }
  }, [otp, e164Number, otpAttempts]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;

    if (otpSendCount >= OTP_MAX_SENDS_PER_SESSION) {
      setPhoneError('Too many OTP requests. Please try again later.');
      return;
    }

    setOtp('');
    await sendResetOtp();
  }, [otpSendCount, resendCooldown, sendResetOtp]);

  const submitReset = useCallback(
    async (submittedPin: string) => {
      setSubmitting(true);
      try {
        const { error } = await submitNewPin({ phone: e164Number, pin: submittedPin });
        if (error) throw new Error(error);

        // Reset succeeded: drop the session and send the user to log in fresh.
        hasResetSessionRef.current = false;
        await endResetSession();
        await setSavedPhone(phoneDigits);

        Alert.alert('PIN updated', 'Your PIN has been reset. Please log in with your new PIN.');
        router.replace('/(auth)/login');
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Could not reset your PIN. Please try again.';
        Alert.alert('Reset failed', message);

        // A dead session means the reset proof expired — re-verify with a code.
        const needsReverify = /session expired|verify your phone/i.test(message);
        if (needsReverify) {
          hasResetSessionRef.current = false;
          await endResetSession();
          setOtp('');
          setStep(1);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [e164Number, phoneDigits, router],
  );

  const goBack = useCallback((): boolean => {
    Keyboard.dismiss();

    if (step > 0) {
      setStep((prev) => (prev - 1) as ForgotStep);
      return true;
    }

    // Leaving the flow entirely: never leave a reset session behind.
    if (hasResetSessionRef.current) {
      endResetSession();
      hasResetSessionRef.current = false;
    }
    router.back();
    return true;
  }, [router, step]);

  return {
    step,
    phoneDigits,
    phoneError: displayPhoneError,
    phoneValidation,
    displayNumber,
    otp,
    otpError,
    pin,
    confirmPin,
    resendCooldown,
    otpSendCount,
    otpLimitReached,
    hasPendingOtp,
    canRequestOtp,
    sendingOTP,
    verifyingOTP,
    submitting,
    setOtp: handleOtpChange,
    setPin,
    setConfirmPin,
    handlePhoneInput,
    handleGetOTP,
    continueToOtpVerification,
    verifyOTP,
    handleResend,
    submitReset,
    goBack,
  };
}
