import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
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
  error: string;
};

function parseInitialInviteToken(
  value: string | string[] | undefined,
): InitialInviteTokenState {
  const paramToken = firstParam(value);
  if (!paramToken) return { rawToken: '', error: '' };

  const extracted = extractInviteToken(paramToken);
  if (extracted.error || !extracted.token) {
    return { rawToken: '', error: extracted.error ?? 'This invite link or token is not valid.' };
  }

  return { rawToken: extracted.token, error: '' };
}

type TokenErrorKind = 'retry' | 'unavailable' | null;

/** Invite-only official registration with explicit, user-controlled SMS actions. */
export function useOfficialRegistrationFlow() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const [initialRouteToken] = useState(() => parseInitialInviteToken(params.token));

  const [step, setStep] = useState<RegistrationStep>(0);
  const [entryVisible, setEntryVisible] = useState(!initialRouteToken.rawToken);
  const [entryValue, setEntryValue] = useState('');
  const [entryError, setEntryError] = useState(initialRouteToken.error);
  const [rawToken, setRawToken] = useState(initialRouteToken.rawToken);
  const [maskedToken, setMaskedToken] = useState(
    initialRouteToken.rawToken ? maskInviteToken(initialRouteToken.rawToken) : '',
  );
  const [validatedInvite, setValidatedInvite] = useState<ValidatedInvite | null>(null);
  const [validatingToken, setValidatingToken] = useState(!!initialRouteToken.rawToken);
  const [inviteUnavailable, setInviteUnavailable] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [tokenErrorKind, setTokenErrorKind] = useState<TokenErrorKind>(null);
  const [validationNonce, setValidationNonce] = useState(0);
  const [flowVersion, setFlowVersion] = useState(0);

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
  const [otpMaxSends, setOtpMaxSends] = useState(OTP_MAX_SENDS_PER_SESSION);
  const [serverLimitReached, setServerLimitReached] = useState(false);

  // Generation changes invalidate every response from a previous token/screen.
  const requestGenerationRef = useRef(0);
  const sendLockRef = useRef<number | null>(null);
  const verifyLockRef = useRef<number | null>(null);
  const submitLockRef = useRef<number | null>(null);
  const routeParamRef = useRef(firstParam(params.token));

  const otpLimitReached = serverLimitReached || otpSendCount >= otpMaxSends;
  const canProceedFromInvite =
    !!validatedInvite && !validatingToken && !inviteUnavailable && !tokenError;

  const maskedPhone = validatedInvite
    ? maskInvitePhone(validatedInvite.invited_phone)
    : '';
  const maskedEmail = validatedInvite
    ? maskInviteEmail(validatedInvite.invited_email)
    : '';

  const resetSensitiveFlowState = useCallback(() => {
    setStep(0);
    setRawToken('');
    setMaskedToken('');
    setValidatedInvite(null);
    setValidatingToken(false);
    setInviteUnavailable(false);
    setTokenError('');
    setTokenErrorKind(null);
    setPhoneVerified(false);
    setLastName('');
    setFirstName('');
    setMiddleName('');
    setPassword('');
    setConfirmPassword('');
    setOtp('');
    setLastNameError('');
    setFirstNameError('');
    setMiddleNameError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setOtpError('');
    setFormError('');
    setSubmitting(false);
    setVerifyingOtp(false);
    setSendingOtp(false);
    setResendCooldown(0);
    setOtpSendCount(0);
    setOtpMaxSends(OTP_MAX_SENDS_PER_SESSION);
    setServerLimitReached(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    sendLockRef.current = null;
    verifyLockRef.current = null;
    submitLockRef.current = null;
    setEntryValue('');
    setEntryError('');
  }, []);

  const resetToEntry = useCallback((message = '') => {
    requestGenerationRef.current += 1;
    setFlowVersion(requestGenerationRef.current);
    resetSensitiveFlowState();
    setEntryVisible(true);
    setEntryError(message);
  }, [resetSensitiveFlowState]);

  const beginTokenValidation = useCallback((token: string) => {
    requestGenerationRef.current += 1;
    setFlowVersion(requestGenerationRef.current);
    resetSensitiveFlowState();
    setEntryVisible(false);
    setRawToken(token);
    setMaskedToken(maskInviteToken(token));
    setValidatingToken(true);
    setValidationNonce((current) => current + 1);
  }, [resetSensitiveFlowState]);

  // Accept a new Router token as a complete flow replacement, including when
  // this route stays mounted while a different invitation is opened.
  useEffect(() => {
    const routeToken = firstParam(params.token);
    if (routeToken === routeParamRef.current) return;
    routeParamRef.current = routeToken;

    if (!routeToken) {
      resetToEntry();
      return;
    }

    const extracted = extractInviteToken(routeToken);
    if (extracted.error || !extracted.token) {
      resetToEntry(extracted.error ?? 'This invite link or token is not valid.');
      return;
    }

    beginTokenValidation(extracted.token);
  }, [beginTokenValidation, params.token, resetToEntry]);

  useEffect(() => {
    if (!rawToken) return;

    let cancelled = false;
    const requestGeneration = requestGenerationRef.current;
    const token = rawToken;

    const validateCurrentToken = async () => {
      try {
        const result = await validateInviteToken(token);
        if (cancelled || requestGeneration !== requestGenerationRef.current) return;

        if (result.error) {
          setValidatedInvite(null);
          setInviteUnavailable(false);
          setTokenError('Could not validate this invite. Check your connection and retry.');
          setTokenErrorKind('retry');
          return;
        }

        if (!result.invite) {
          setValidatedInvite(null);
          setInviteUnavailable(true);
          setTokenError(
            'This invite is unavailable. It may be invalid, expired, used, or revoked.',
          );
          setTokenErrorKind('unavailable');
          return;
        }

        setValidatedInvite(result.invite);
        setInviteUnavailable(false);
        setTokenError('');
        setTokenErrorKind(null);
      } catch {
        if (cancelled || requestGeneration !== requestGenerationRef.current) return;
        setValidatedInvite(null);
        setInviteUnavailable(false);
        setTokenError('Could not validate this invite. Check your connection and retry.');
        setTokenErrorKind('retry');
      } finally {
        if (!cancelled && requestGeneration === requestGenerationRef.current) {
          setValidatingToken(false);
        }
      }
    };

    void validateCurrentToken();
    return () => {
      cancelled = true;
    };
  }, [rawToken, validationNonce]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((previous) => Math.max(0, previous - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    return () => {
      requestGenerationRef.current += 1;
    };
  }, []);

  const handleEntryValueChange = useCallback((value: string) => {
    setEntryValue(value);
    setEntryError('');
  }, []);

  const acceptInviteInput = useCallback(() => {
    const extracted = extractInviteToken(entryValue);
    if (extracted.error || !extracted.token) {
      setEntryError(extracted.error ?? 'This invite link or token is not valid.');
      return;
    }
    beginTokenValidation(extracted.token);
  }, [beginTokenValidation, entryValue]);

  const retryValidation = useCallback(() => {
    if (!rawToken) return;
    setValidatingToken(true);
    setInviteUnavailable(false);
    setTokenError('');
    setTokenErrorKind(null);
    setValidationNonce((current) => current + 1);
  }, [rawToken]);

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
    if (sendLockRef.current !== null) return false;
    if (resendCooldown > 0 || otpLimitReached) {
      setStep(1);
      return false;
    }
    if (!rawToken || !validatedInvite) {
      setOtpError('This invite is unavailable.');
      return false;
    }

    const requestGeneration = requestGenerationRef.current;
    sendLockRef.current = requestGeneration;
    setSendingOtp(true);
    setOtpError('');
    const token = rawToken;

    try {
      const result = await sendOfficialInviteSmsOtp(token);
      if (requestGeneration !== requestGenerationRef.current) return false;

      if (typeof result.sendCount === 'number') setOtpSendCount(result.sendCount);
      if (typeof result.maxSends === 'number') setOtpMaxSends(result.maxSends);
      if (typeof result.cooldownSeconds === 'number') {
        setResendCooldown(result.cooldownSeconds);
      }
      if (typeof result.limitReached === 'boolean') {
        setServerLimitReached(result.limitReached);
      }

      if (result.error) {
        setOtpError(result.error);
        return false;
      }

      if (typeof result.sendCount !== 'number') {
        setOtpSendCount((current) => current + 1);
      }
      if (typeof result.cooldownSeconds !== 'number') {
        setResendCooldown(OTP_COOLDOWN_SECONDS);
      }
      return true;
    } catch {
      if (requestGeneration === requestGenerationRef.current) {
        setOtpError('Could not send the verification code. Check your connection and retry.');
      }
      return false;
    } finally {
      if (sendLockRef.current === requestGeneration) {
        sendLockRef.current = null;
        if (requestGeneration === requestGenerationRef.current) {
          setSendingOtp(false);
        }
      }
    }
  }, [otpLimitReached, rawToken, resendCooldown, validatedInvite]);

  const goToVerifyStep = useCallback(async (): Promise<boolean> => {
    if (!canProceedFromInvite) return false;
    if (phoneVerified) {
      setStep(2);
      return true;
    }

    setStep(1);
    setOtp('');
    setOtpError('');
    if (sendLockRef.current !== null || resendCooldown > 0 || otpLimitReached) {
      return false;
    }
    return sendSmsCode();
  }, [canProceedFromInvite, otpLimitReached, phoneVerified, resendCooldown, sendSmsCode]);

  const submitOtp = useCallback(async (): Promise<boolean> => {
    if (verifyLockRef.current !== null || sendingOtp) return false;
    if (phoneVerified) {
      setStep(2);
      return true;
    }
    if (!rawToken) {
      setOtpError('This invite is unavailable.');
      return false;
    }
    if (otp.length !== 6) {
      setOtpError('Enter the 6-digit code from your SMS.');
      return false;
    }

    const requestGeneration = requestGenerationRef.current;
    verifyLockRef.current = requestGeneration;
    setVerifyingOtp(true);
    setOtpError('');
    Keyboard.dismiss();
    const token = rawToken;
    const code = otp;

    try {
      const result = await verifyOfficialInviteSmsOtp({ token, code });
      if (requestGeneration !== requestGenerationRef.current) return false;
      if (result.error) {
        setOtpError(result.error);
        return false;
      }

      setPhoneVerified(true);
      setStep(2);
      return true;
    } catch {
      if (requestGeneration === requestGenerationRef.current) {
        setOtpError('Could not verify the code. Check your connection and retry.');
      }
      return false;
    } finally {
      if (verifyLockRef.current === requestGeneration) {
        verifyLockRef.current = null;
        if (requestGeneration === requestGenerationRef.current) {
          setVerifyingOtp(false);
        }
      }
    }
  }, [otp, phoneVerified, rawToken, sendingOtp]);

  const resendOtp = useCallback(async () => {
    if (
      phoneVerified ||
      sendLockRef.current !== null ||
      resendCooldown > 0 ||
      otpLimitReached
    ) {
      return false;
    }
    return sendSmsCode();
  }, [otpLimitReached, phoneVerified, resendCooldown, sendSmsCode]);

  const submitDetails = useCallback(() => {
    if (!phoneVerified) {
      setFormError('Verify your mobile number before continuing.');
      setStep(1);
      return;
    }

    const fieldErrors = validateOfficialDetailsForm({ lastName, firstName, middleName });
    setLastNameError(fieldErrors.lastName ?? '');
    setFirstNameError(fieldErrors.firstName ?? '');
    setMiddleNameError(fieldErrors.middleName ?? '');
    setFormError('');

    if (Object.keys(fieldErrors).length > 0) return;
    setStep(3);
  }, [firstName, lastName, middleName, phoneVerified]);

  const submitPassword = useCallback(async (): Promise<boolean> => {
    if (submitLockRef.current !== null) return false;
    if (!validatedInvite || !rawToken || !phoneVerified) {
      setFormError('This invite is unavailable. Verify your mobile number again.');
      setStep(1);
      return false;
    }

    const passwordErrors = validateOfficialPasswordForm({ password, confirmPassword });
    setPasswordError(passwordErrors.password ?? '');
    setConfirmPasswordError(passwordErrors.confirmPassword ?? '');
    setFormError('');
    if (Object.keys(passwordErrors).length > 0) return false;

    const requestGeneration = requestGenerationRef.current;
    submitLockRef.current = requestGeneration;
    setSubmitting(true);
    Keyboard.dismiss();
    const token = rawToken;

    try {
      const result = await registerOfficialAccount({
        token,
        lastName,
        firstName,
        middleName,
        password,
        confirmPassword,
      });

      if (requestGeneration !== requestGenerationRef.current) return false;
      if (result.error || !result.scope) {
        if (result.verificationRequired) {
          setPhoneVerified(false);
          setOtp('');
          setOtpError(
            'Your verification expired. Send a new code, then continue with your saved details.',
          );
          setPassword('');
          setConfirmPassword('');
          setPasswordError('');
          setConfirmPasswordError('');
          setStep(1);
          return false;
        }

        setFormError(result.error ?? 'Registration could not be completed.');
        return false;
      }

      return true;
    } catch {
      if (requestGeneration === requestGenerationRef.current) {
        setFormError('Registration could not be completed. Check your connection and try again.');
      }
      return false;
    } finally {
      if (submitLockRef.current === requestGeneration) {
        submitLockRef.current = null;
        if (requestGeneration === requestGenerationRef.current) {
          setSubmitting(false);
        }
      }
    }
  }, [
    confirmPassword,
    firstName,
    lastName,
    middleName,
    password,
    phoneVerified,
    rawToken,
    validatedInvite,
  ]);

  const goBack = useCallback(() => {
    if (step === 3) {
      setStep(2);
      return true;
    }
    if (step === 2) {
      setStep(1);
      return true;
    }
    if (step === 1) {
      setStep(0);
      return true;
    }
    return false;
  }, [step]);

  return {
    step,
    entryVisible,
    entryValue,
    entryError,
    flowVersion,
    handleEntryValueChange,
    acceptInviteInput,
    resetToEntry,
    retryValidation,
    inviteUnavailable,
    validatingToken,
    maskedToken,
    tokenError,
    tokenErrorKind,
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
    otpSendCount,
    otpMaxSends,
    otpLimitReached,
    passwordMinLength: OFFICIAL_PASSWORD_MIN_LENGTH,
    canProceedFromInvite,
    handleLastNameChange,
    handleFirstNameChange,
    handleMiddleNameChange,
    handlePasswordChange,
    handleConfirmPasswordChange,
    handleOtpChange,
    toggleShowPassword: () => setShowPassword((previous) => !previous),
    toggleShowConfirmPassword: () =>
      setShowConfirmPassword((previous) => !previous),
    goToVerifyStep,
    submitDetails,
    submitPassword,
    submitOtp,
    resendOtp,
    goBack,
  };
}
