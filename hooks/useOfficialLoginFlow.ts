import { useCallback, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { loginOfficialWithPassword } from '../lib/officialLogin';

/**
 * Official sign-in only (email + password).
 * Registration is invite-URL only — no email OTP resume path.
 */
export function useOfficialLoginFlow() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailChange = useCallback((text: string) => {
    setEmailError('');
    setFormError('');
    setEmail(text);
  }, []);

  const handlePasswordChange = useCallback((text: string) => {
    setPasswordError('');
    setFormError('');
    setPassword(text);
  }, []);

  const submitLogin = useCallback(async () => {
    if (submitting) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError('Enter your email address.');
      return;
    }
    if (!password) {
      setPasswordError('Enter your password.');
      return;
    }

    setSubmitting(true);
    setEmailError('');
    setPasswordError('');
    setFormError('');
    Keyboard.dismiss();

    try {
      const result = await loginOfficialWithPassword({
        email: trimmedEmail,
        password,
      });

      if (result.error || !result.destination) {
        setFormError(result.error ?? 'Access disabled.');
        Alert.alert('Login failed', result.error ?? 'Access disabled.');
        return;
      }

      router.replace(result.destination);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not sign in. Please try again.';
      setFormError(message);
      Alert.alert('Login failed', message);
    } finally {
      setSubmitting(false);
    }
  }, [email, password, router, submitting]);

  const goBack = useCallback(() => {
    router.back();
    return true;
  }, [router]);

  return {
    email,
    password,
    emailError,
    passwordError,
    formError,
    submitting,
    showPassword,
    handleEmailChange,
    handlePasswordChange,
    toggleShowPassword: () => setShowPassword((prev) => !prev),
    submitLogin,
    goBack,
  };
}
