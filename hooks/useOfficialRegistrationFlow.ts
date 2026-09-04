import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { extractInviteToken, maskInviteToken } from '../lib/inviteToken';
import {
  formatInviteScopeLabel,
  validateInviteToken,
  type ValidatedInvite,
} from '../lib/invites';
import {
  OFFICIAL_PASSWORD_MIN_LENGTH,
  maskInviteEmail,
  maskInvitePhone,
  registerOfficialAccount,
  sendOfficialInviteSmsOtp,
  validateOfficialDetailsForm,
  validateOfficialPasswordForm,
  verifyOfficialInviteSmsOtp,
} from '../lib/officialRegistration';
import { OTP_COOLDOWN_SECONDS, OTP_MAX_SENDS_PER_SESSION } from '../types/registration';
import type { RegistrationStep } from '../types/registration';

export const OFFICIAL_REGISTER_STEP_LABELS: [string, string, string, string] = [
  'Invite',
  'Verify',
  'Details',
  'Password',
];

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

type InitialInviteTokenState = {
  rawToken: string;
  maskedToken: string;
  inviteUnavailable: boolean;
  validatingToken: boolean;
  tokenError: string;
};

function parseInitialInviteToken(
  value: string | string[] | undefined,
): InitialInviteTokenState {
  const paramToken = firstParam(value).trim();
  if (!paramToken) {
    return {
      rawToken: '',
      maskedToken: '',
      inviteUnavailable: true,
      validatingToken: false,
      tokenError: 'This invite is unavailable. Open a valid invite link to register.',
    };
  }

  const extracted = extractInviteToken(paramToken);
  if (extracted.error || !extracted.token) {
    return {
      rawToken: '',
      maskedToken: '',
      inviteUnavailable: true,
      validatingToken: false,
      tokenError:
        extracted.error ??
        'This invite is unavailable. It may be invalid, expired, used, or revoked.',
    };
  }

  return {
    rawToken: extracted.token,
    maskedToken: maskInviteToken(extracted.token),
    inviteUnavailable: false,
    validatingToken: true,
    tokenError: '',
  };
}

/**
 * Invite-only official registration (4 steps):
 * Invite → SMS verify → Details → Password/create account.
 * Raw token stays in memory — never rendered or persisted.
 */
export function useOfficialRegistrationFlow() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const [initialInviteToken] = useState(() => parseInitialInviteToken(params.token));

  const [step, setStep] = useState<RegistrationStep>(0);
  const [inviteUnavailable, setInviteUnavailable] = useState(
    initialInviteToken.inviteUnavailable,
  );

  // Raw opaque token — in-memory only.
  const [rawToken] = useState(initialInviteToken.rawToken);
  const [maskedToken] = useState(initialInviteToken.maskedToken);
  const [validatedInvite, setValidatedInvite] = useState<ValidatedInvite | null>(
    null,
  );
  const [validatingToken, setValidatingToken] = useState(
    initialInviteToken.validatingToken,
  );
  const [tokenError, setTokenError] = useState(initialInviteToken.tokenError);

  const [phoneVerified, setPhoneVerified] = useState(false);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');

  const [lastNameError, setLastNameError] = useState('');
  const [firstNameError, setFirstNameError] = useState('');
  const [middleNameError, setMiddleNameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [formError, setFormError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpSendCount, setOtpSendCount] = useState(0);
  /** null = inactive; 1–10 = counting down on Invite step. */
  const [autoContinueSeconds, setAutoContinueSeconds] = useState<number | null>(
    null,
  );

  /** Auto-continue runs only on the first successful Invite open — not when returning. */
  const autoContinueUsedRef = useRef(false);
  /** First SMS send is triggered when entering the Verify step. */
  const initialSmsSentRef = useRef(false);

  const otpLimitReached = otpSendCount >= OTP_MAX_SENDS_PER_SESSION;

  const canProceedFromInvite =
    !!validatedInvite && !validatingToken && !inviteUnavailable && !tokenError;

  const maskedPhone = validatedInvite
    ? maskInvitePhone(validatedInvite.invited_phone)
    : '';
  const maskedEmail = validatedInvite
    ? maskInviteEmail(validatedInvite.invited_email)
    : '';

  // Parse + validate the incoming invite token once on mount.
  useEffect(() => {
    if (!rawToken) return;

    let cancelled = false;
    (async () => {
      const { invite, error } = await validateInviteToken(rawToken);
      if (cancelled) return;

      setValidatingToken(false);
      if (error) {
        setInviteUnavailable(true);
        setTokenError('Could not validate this invite. Please try again.');
        return;
      }
      if (!invite) {
        setInviteUnavailable(true);
        setTokenError(
          'This invite is unavailable. It may be invalid, expired, used, or revoked.',
        );
        return;
      }

      setValidatedInvite(invite);
      setTokenError('');
    })();

    return () => {
      cancelled = true;
    };
  }, [rawToken]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleLastNameChange = useCallback((text: string) => {
    setLastNameError('');
    setFormError('');
    setLastName(text);
  }, []);

  const handleFirstNameChange = useCallback((text: string) => {
    setFirstNameError('');
    setFormError('');
    setFirstName(text);
  }, []);

  const handleMiddleNameChange = useCallback((text: string) => {
    setMiddleNameError('');
    setFormError('');
    setMiddleName(text);
  }, []);

  const handlePasswordChange = useCallback((text: string) => {
    setPasswordError('');
    setFormError('');
    setPassword(text);
  }, []);

  const handleConfirmPasswordChange = useCallback((text: string) => {
    setConfirmPasswordError('');
    setFormError('');
    setConfirmPassword(text);
  }, []);

  const handleOtpChange = useCallback((text: string) => {
    setOtpError('');
    setOtp(text.replace(/\D/g, '').slice(0, 6));
  }, []);

  const sendSmsCode = useCallback(async (): Promise<boolean> => {
    if (!rawToken) {
      setOtpError('This invite is unavailable.');
      return false;
    }

    setSendingOtp(true);
    setOtpError('');

    try {
      const result = await sendOfficialInviteSmsOtp(rawToken);
      if (result.error) {
        setOtpError(result.error);
        if (result.cooldownSeconds) {
          setResendCooldown(result.cooldownSeconds);
        }
        if (typeof result.sendCount === 'number') {
          setOtpSendCount(result.sendCount);
        }
        return false;
      }

      setOtpSendCount(result.sendCount ?? otpSendCount + 1);
      setResendCooldown(result.cooldownSeconds ?? OTP_COOLDOWN_SECONDS);
      return true;
    } finally {
      setSendingOtp(false);
    }
  }, [otpSendCount, rawToken]);

  const goToVerifyStep = useCallback(async () => {
    if (!validatedInvite || inviteUnavailable || validatingToken) return;
    setAutoContinueSeconds(null);
    setStep(1);
    setOtp('');
    setOtpError('');
    setPhoneVerified(false);

    if (!initialSmsSentRef.current) {
      initialSmsSentRef.current = true;
      await sendSmsCode();
    }
  }, [
    inviteUnavailable,
    sendSmsCode,
    validatedInvite,
    validatingToken,
  ]);

  // Soft auto-continue on Invite step: once only, on first ready open.
  useEffect(() => {
    if (step !== 0 || !canProceedFromInvite) {
      const resetTimer = setTimeout(() => setAutoContinueSeconds(null), 0);
      return () => clearTimeout(resetTimer);
    }

    if (autoContinueUsedRef.current) {
      const resetTimer = setTimeout(() => setAutoContinueSeconds(null), 0);
      return () => clearTimeout(resetTimer);
    }

    autoContinueUsedRef.current = true;
    const startTimer = setTimeout(() => setAutoContinueSeconds(10), 0);
    const timer = setInterval(() => {
      setAutoContinueSeconds((prev) => {
        if (prev == null) return null;
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(startTimer);
      clearInterval(timer);
    };
  }, [step, canProceedFromInvite]);

  // When countdown reaches 0, advance automatically to SMS verify.
  useEffect(() => {
    if (step !== 0 || !canProceedFromInvite) return;
    if (autoContinueSeconds !== 0) return;
    const continueTimer = setTimeout(() => void goToVerifyStep(), 0);
    return () => clearTimeout(continueTimer);
  }, [autoContinueSeconds, canProceedFromInvite, goToVerifyStep, step]);

  const submitOtp = useCallback(async () => {
    if (verifyingOtp) return;
    if (otp.length !== 6) {
      setOtpError('Enter the 6-digit code from your SMS.');
      return;
    }

    setVerifyingOtp(true);
    setOtpError('');
    Keyboard.dismiss();

    try {
      const result = await verifyOfficialInviteSmsOtp({
        token: rawToken,
        code: otp,
      });

      if (result.error) {
        setOtpError(result.error);
        return;
      }

      setPhoneVerified(true);
      setStep(2);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not verify the code.';
      setOtpError(message);
    } finally {
      setVerifyingOtp(false);
    }
  }, [otp, rawToken, verifyingOtp]);

  const resendOtp = useCallback(async () => {
    if (sendingOtp || resendCooldown > 0 || otpLimitReached) return;
    await sendSmsCode();
  }, [otpLimitReached, resendCooldown, sendSmsCode, sendingOtp]);

  const submitDetails = useCallback(() => {
    if (!phoneVerified) {
      setFormError('Verify your mobile number before continuing.');
      setStep(1);
      return;
    }

    const fieldErrors = validateOfficialDetailsForm({
      lastName,
      firstName,
      middleName,
    });

    setLastNameError(fieldErrors.lastName ?? '');
    setFirstNameError(fieldErrors.firstName ?? '');
    setMiddleNameError(fieldErrors.middleName ?? '');
    setFormError('');

    if (Object.keys(fieldErrors).length > 0) return;
    setStep(3);
  }, [firstName, lastName, middleName, phoneVerified]);

  const submitPassword = useCallback(async (): Promise<boolean> => {
    if (submitting) return false;
    if (!validatedInvite || !rawToken || !phoneVerified) {
      setFormError('This invite is unavailable.');
      setInviteUnavailable(true);
      setStep(0);
      return false;
    }

    const passwordErrors = validateOfficialPasswordForm({
      password,
      confirmPassword,
    });
    setPasswordError(passwordErrors.password ?? '');
    setConfirmPasswordError(passwordErrors.confirmPassword ?? '');
    setFormError('');
    if (Object.keys(passwordErrors).length > 0) return false;

    setSubmitting(true);
    Keyboard.dismiss();

    try {
      const result = await registerOfficialAccount({
        token: rawToken,
        lastName,
        firstName,
        middleName,
        password,
        confirmPassword,
      });

      if (result.error || !result.scope) {
        setFormError(result.error ?? 'Registration could not be completed.');
        Alert.alert('Registration failed', result.error ?? 'Please try again.');
        return false;
      }

      // Navigation is handled by the screen so beforeRemove can allow the leave.
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Registration could not be completed.';
      setFormError(message);
      Alert.alert('Registration failed', message);
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [
    confirmPassword,
    firstName,
    lastName,
    middleName,
    password,
    phoneVerified,
    rawToken,
    submitting,
    validatedInvite,
  ]);

  const goBack = useCallback(() => {
    if (step === 3) {
      setStep(2);
      return true;
    }
    if (step === 2) {
      // Leaving details after SMS verify — stay verified, return to OTP step.
      setStep(1);
      return true;
    }
    if (step === 1) {
      setStep(0);
      return true;
    }

    // Step 0 (Invite root) — screen confirms leave so splash/stack can exit cleanly.
    return false;
  }, [step]);

  return {
    step,
    inviteUnavailable,
    validatingToken,
    maskedToken,
    tokenError,
    validatedInvite,
    scopeLabel: validatedInvite ? formatInviteScopeLabel(validatedInvite) : '',
    maskedPhone,
    maskedEmail,
    phoneVerified,
    lastName,
    firstName,
    middleName,
    password,
    confirmPassword,
    otp,
    lastNameError,
    firstNameError,
    middleNameError,
    passwordError,
    confirmPasswordError,
    otpError,
    formError,
    submitting,
    verifyingOtp,
    sendingOtp,
    showPassword,
    showConfirmPassword,
    resendCooldown,
    otpLimitReached,
    autoContinueSeconds,
    passwordMinLength: OFFICIAL_PASSWORD_MIN_LENGTH,
    canProceedFromInvite,
    handleLastNameChange,
    handleFirstNameChange,
    handleMiddleNameChange,
    handlePasswordChange,
    handleConfirmPasswordChange,
    handleOtpChange,
    toggleShowPassword: () => setShowPassword((prev) => !prev),
    toggleShowConfirmPassword: () => setShowConfirmPassword((prev) => !prev),
    goToVerifyStep,
    submitDetails,
    submitPassword,
    submitOtp,
    resendOtp,
    goBack,
  };
}
