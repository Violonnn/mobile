import { useCallback, useEffect, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { loginWithPin } from '../lib/login';
import { getSavedPhone, setSavedPhone } from '../lib/savedPhone';
import {
  formatFullPHMobile,
  sanitizePhoneInput,
  validatePHNumber,
} from '../lib/validation/phone';

/**
 * Login flow: phone + 6-digit PIN.
 * PIN is sent to verify-login once; comparison happens only on the server.
 */
export function useLoginFlow() {
  const router = useRouter();

  const [phoneDigits, setPhoneDigits] = useState('');
  const [savedPhoneDigits, setSavedPhoneDigits] = useState('');
  const [phoneLocked, setPhoneLocked] = useState(false);
  const [phoneLoaded, setPhoneLoaded] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    getSavedPhone().then((saved) => {
      if (!mounted) return;
      if (saved) {
        setPhoneDigits(saved);
        setSavedPhoneDigits(saved);
        setPhoneLocked(true);
      }
      setPhoneLoaded(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const cleanedPhone = phoneDigits.replace(/\s/g, '');
  const e164Number = `+63${cleanedPhone.replace(/^0+/, '')}`;
  const displayNumber = formatFullPHMobile(`0${cleanedPhone.replace(/^0+/, '')}`);
  const phoneValidation = validatePHNumber(phoneDigits);
  const pinValid = /^\d{6}$/.test(pin);
  const hasSavedPhone = savedPhoneDigits.length > 0;

  const handlePhoneInput = useCallback((text: string) => {
    if (phoneLocked) return;
    setPhoneError('');
    setPhoneDigits(sanitizePhoneInput(text));
  }, [phoneLocked]);

  const clearPhoneForEdit = useCallback(() => {
    setPhoneError('');
    setPhoneDigits('');
    setPhoneLocked(false);
  }, []);

  const handlePinChange = useCallback((text: string) => {
    setPinError('');
    setPin(text.replace(/\D/g, '').slice(0, 6));
  }, []);

  const submitLogin = useCallback(async () => {
    if (submitting) return;

    const result = validatePHNumber(phoneDigits);
    if (!result.valid) {
      setPhoneError(result.message || 'Enter a valid Philippine mobile number');
      return;
    }

    if (pin.length === 0) {
      setPinError('Enter your 6-digit PIN.');
      return;
    }

    if (!pinValid) {
      setPinError('PIN must be 6 digits.');
      return;
    }

    setSubmitting(true);
    setPhoneError('');
    setPinError('');
    Keyboard.dismiss();

    try {
      const { error } = await loginWithPin({
        phone: e164Number,
        pin,
      });

      if (error) throw new Error(error);

      await setSavedPhone(phoneDigits);
      setSavedPhoneDigits(phoneDigits);
      setPhoneLocked(true);

      router.replace('/(main)/home');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setPinError(message);
      Alert.alert('Login failed', message);
    } finally {
      setSubmitting(false);
    }
  }, [e164Number, phoneDigits, pin, pinValid, router, submitting]);

  const goBack = useCallback(() => {
    router.back();
    return true;
  }, [router]);

  const goToForgotPassword = useCallback(() => {
    router.push('/(auth)/forgot-password');
  }, [router]);

  const goToRegister = useCallback(() => {
    router.push('/(auth)/register');
  }, [router]);

  return {
    phoneDigits,
    phoneError,
    displayNumber,
    phoneValidation,
    pin,
    pinError,
    submitting,
    phoneLocked,
    phoneLoaded,
    hasSavedPhone,
    handlePhoneInput,
    clearPhoneForEdit,
    handlePinChange,
    submitLogin,
    goBack,
    goToForgotPassword,
    goToRegister,
  };
}
