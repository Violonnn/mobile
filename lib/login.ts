import { supabase } from './supabase';
import {
  parseEdgeFunctionMeta,
  readEdgeFunctionErrorMessage,
} from './edgeFunctionErrors';

export type VerifyLoginInput = {
  phone: string;
  pin: string;
};

const WRONG_CREDENTIALS_MESSAGE = 'Invalid phone number or PIN. Please try again.';

/**
 * Return login: phone + PIN checked on the server only.
 */
export async function loginWithPin(
  input: VerifyLoginInput,
): Promise<{ error: string | null }> {
  const { data, error, response } = await supabase.functions.invoke('verify-login', {
    body: {
      phone: input.phone,
      pin: input.pin,
    },
  });

  if (error) {
    const message = await readEdgeFunctionErrorMessage(
      error,
      response,
      'Login failed. Please try again.',
    );
    return { error: normalizeLoginError(message) };
  }

  if (data?.error) {
    return { error: normalizeLoginError(String(data.error)) };
  }

  const tokenHash = data?.token_hash;
  if (!tokenHash || typeof tokenHash !== 'string') {
    return { error: 'Login failed. Please try again.' };
  }

  const { error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  });

  if (sessionError) {
    const message = sessionError.message?.trim() || 'Login failed. Please try again.';
    return { error: message };
  }

  return { error: null };
}

function normalizeLoginError(message: string): string {
  if (/invalid phone number or pin/i.test(message)) {
    return 'Incorrect PIN. Please try again.';
  }
  if (/too many failed attempts/i.test(message)) {
    return message;
  }
  if (message === WRONG_CREDENTIALS_MESSAGE) {
    return 'Incorrect PIN. Please try again.';
  }
  return message;
}
