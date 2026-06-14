import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import {
  completeRegistrationProfile,
  fetchRegistrationOtpStatus,
  requestRegistrationOtp,
  signOutAfterRegistrationFailure,
  verifyRegistrationOtp,
} from '../lib/registration';
import { clearOtpSession, loadOtpSession, saveOtpSession } from '../lib/otpSession';
import { formatPhoneRegistrationError } from '../lib/registrationErrors';
import { setSavedPhone } from '../lib/savedPhone';
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

type OtpLimitMeta = {
  sendCount?: number;
  cooldownSeconds?: number;
  limitReached?: boolean;
};

/**
 * Single source of truth for the registration wizard.
 *
 * OTP limits are enforced on the server (request-registration-otp) and mirrored
 * locally via AsyncStorage so counters survive app restarts.
 */
export function useRegistrationFlow() {
  const router = useRouter();

  const [step, setStep] = useState<RegistrationStep>(0);
  const [isComplete, setIsComplete] = useState(false);

  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otp, setOtp] = useState('');
  const [details, setDetails] = useState<RegistrationDetails>(EMPTY_DETAILS);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpSendCount, setOtpSendCount] = useState(0);
  const [otpSentPhone, setOtpSentPhone] = useState('');
  const [sendingOTP, setSendingOTP] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [submittingRegistration, setSubmittingRegistration] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hydratedPhoneRef = useRef('');

  const cleanedPhone = phoneDigits.replace(/\s/g, '');
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
  }, [clearCooldownTimer]);

  const applyOtpLimits = useCallback(
    async (phone: string, meta: OtpLimitMeta) => {
      if (meta.sendCount !== undefined) {
        setOtpSendCount(meta.sendCount);
        if (meta.sendCount > 0) {
          setOtpSentPhone(phone);
        }
      }

      if (meta.cooldownSeconds && meta.cooldownSeconds > 0) {
        startCooldown(meta.cooldownSeconds);
      } else if (meta.cooldownSeconds === 0) {
        clearCooldownTimer();
      }

      if (meta.sendCount !== undefined) {
        await saveOtpSession(phone, meta.sendCount, meta.cooldownSeconds ?? 0);
      }
    },
    [clearCooldownTimer, startCooldown],
  );

  const resetOtpSession = useCallback(() => {
    setOtpSendCount(0);
    setOtpSentPhone('');
    setOtp('');
    clearCooldownTimer();
    clearOtpSession();
    hydratedPhoneRef.current = '';
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

      if (nextClean !== prevClean) {
        hydratedPhoneRef.current = '';
      }

      setPhoneDigits(next);
    },
    [phoneDigits, otpSentPhone, resetOtpSession],
  );

  useEffect(() => {
    if (!phoneValidation.valid) return;
    if (hydratedPhoneRef.current === cleanedPhone) return;

    let mounted = true;
    hydratedPhoneRef.current = cleanedPhone;

    async function hydrateOtpState() {
      const cached = await loadOtpSession(cleanedPhone);
      if (!mounted) return;

      if (cached) {
        setOtpSendCount(cached.sendCount);
        if (cached.hasPendingOtp) {
          setOtpSentPhone(cleanedPhone);
        }
        if (cached.cooldownSeconds > 0) {
          startCooldown(cached.cooldownSeconds);
        }
      }

      const status = await fetchRegistrationOtpStatus(e164Number);
      if (!mounted) return;

      if (status.error) {
        if (/already registered/i.test(status.error)) {
          setPhoneError(formatPhoneRegistrationError(status.error));
          setOtpSendCount(0);
          setOtpSentPhone('');
          clearCooldownTimer();
          await clearOtpSession();
        } else if (status.sendCount !== undefined) {
          await applyOtpLimits(cleanedPhone, status);
        }
        return;
      }

      await applyOtpLimits(cleanedPhone, {
        sendCount: status.sendCount ?? 0,
        cooldownSeconds: status.cooldownSeconds ?? 0,
        limitReached: status.limitReached,
      });
    }

    hydrateOtpState();

    return () => {
      mounted = false;
    };
  }, [applyOtpLimits, cleanedPhone, clearCooldownTimer, e164Number, phoneValidation.valid, startCooldown]);

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
      const result = await requestRegistrationOtp(e164Number);

      if (result.error) {
        setPhoneError(formatPhoneRegistrationError(result.error));
        await applyOtpLimits(cleanedPhone, {
          sendCount: result.sendCount,
          cooldownSeconds: result.cooldownSeconds,
          limitReached: result.limitReached,
        });
        return;
      }

      setOtp('');
      setOtpSentPhone(cleanedPhone);

      const sendCount = result.sendCount ?? otpSendCount + 1;
      const cooldownSeconds = result.cooldownSeconds ?? OTP_COOLDOWN_SECONDS;

      await applyOtpLimits(cleanedPhone, {
        sendCount,
        cooldownSeconds,
        limitReached: result.limitReached,
      });

      setStep(1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      setPhoneError(message);
    } finally {
      setSendingOTP(false);
    }
  }, [
    applyOtpLimits,
    cleanedPhone,
    e164Number,
    otpSendCount,
    phoneValidation.valid,
    resendCooldown,
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
      const { error } = await verifyRegistrationOtp(e164Number, otp);
      if (error) throw new Error(error);

      setStep(2);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid or expired OTP. Please try again.';
      setOtpError(message);
    } finally {
      setVerifyingOTP(false);
    }
  }, [otp, e164Number]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;

    if (otpSendCount >= OTP_MAX_SENDS_PER_SESSION) {
      setPhoneError('Too many OTP requests. Please try again later.');
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
      setSubmittingRegistration(true);
      try {
        const { error } = await completeRegistrationProfile({
          phone: e164Number,
          details,
          pin: submittedPin,
        });

        if (error) throw new Error(error);

        await setSavedPhone(phoneDigits);
        await clearOtpSession();
        setIsComplete(true);
        router.replace({ pathname: '/(main)/home', params: { welcome: '1' } });
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
      } finally {
        setSubmittingRegistration(false);
      }
    },
    [router, details, e164Number, phoneDigits],
  );

  return {
    step,
    isComplete,
    phoneDigits,
    phoneError,
    phoneValidation,
    displayNumber,
    otp,
    otpError,
    details,
    pin,
    confirmPin,
    resendCooldown,
    otpSendCount,
    otpLimitReached,
    hasPendingOtp,
    canRequestOtp,
    sendingOTP,
    verifyingOTP,
    submittingRegistration,
    setOtp: handleOtpChange,
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
