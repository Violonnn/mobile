import { supabase } from './supabase';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return fallback;
}

export type VerifyLoginInput = {
  phone: string;
  pin: string;
};

/**
 * Return login: phone + PIN checked on the server only.
 *
 * Flow:
 * 1. Edge function verify-login compares PIN with bcrypt (never sent to client DB).
 * 2. On success, server returns a one-time token_hash.
 * 3. Client exchanges token_hash for a normal Supabase session (no SMS OTP on return visits).
 */
export async function loginWithPin(
  input: VerifyLoginInput,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.functions.invoke('verify-login', {
    body: {
      phone: input.phone,
      pin: input.pin,
    },
  });

  if (error) {
    return { error: getErrorMessage(error, 'Login failed. Please try again.') };
  }

  if (data?.error) {
    return { error: String(data.error) };
  }

  const tokenHash = data?.token_hash;
  if (!tokenHash || typeof tokenHash !== 'string') {
    return { error: 'Login failed. Please try again.' };
  }

  // Exchange the server-issued token for a session. PIN is never stored client-side.
  const { error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  });

  if (sessionError) {
    return { error: getErrorMessage(sessionError, 'Login failed. Please try again.') };
  }

  return { error: null };
}
