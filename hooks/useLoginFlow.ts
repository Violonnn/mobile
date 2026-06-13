import { useCallback, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { loginWithPin } from '../lib/login';
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
  const [phoneError, setPhoneError] = useState('');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cleanedPhone = phoneDigits.replace(/\s/g, '');
  const e164Number = `+63${cleanedPhone.replace(/^0+/, '')}`;
  const displayNumber = formatFullPHMobile(`0${cleanedPhone.replace(/^0+/, '')}`);
  const phoneValidation = validatePHNumber(phoneDigits);
  const pinValid = /^\d{6}$/.test(pin);
  const canSubmit = phoneValidation.valid && pinValid && !submitting;

  const handlePhoneInput = useCallback((text: string) => {
    setPhoneError('');
    setPhoneDigits(sanitizePhoneInput(text));
  }, []);

  const handlePinChange = useCallback((text: string) => {
    setPinError('');
    setPin(text.replace(/\D/g, '').slice(0, 6));
  }, []);

  const submitLogin = useCallback(async () => {
    const result = validatePHNumber(phoneDigits);
    if (!result.valid) {
      setPhoneError(result.message || 'Enter a valid Philippine mobile number');
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

      Alert.alert('Welcome back!', `Signed in as ${displayNumber}`, [
        {
          text: 'OK',
          onPress: () => router.replace('/'),
        },
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setPinError(message);
      Alert.alert('Login failed', message);
    } finally {
      setSubmitting(false);
    }
  }, [displayNumber, e164Number, phoneDigits, pin, pinValid, router]);

  const goBack = useCallback(() => {
    router.back();
    return true;
  }, [router]);

  return {
    phoneDigits,
    phoneError,
    displayNumber,
    phoneValidation,
    pin,
    pinError,
    submitting,
    canSubmit,
    handlePhoneInput,
    handlePinChange,
    submitLogin,
    goBack,
  };
}
