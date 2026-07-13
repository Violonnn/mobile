import { supabase } from './supabase';
import {
  parseEdgeFunctionMeta,
  readEdgeFunctionErrorMessage,
} from './edgeFunctionErrors';

export type VerifyLoginInput = {
  phone: string;
  pin: string;
};

/**
 * Single generic message for wrong phone, wrong PIN, or unknown account.
 * WHY: Never reveal which credential was wrong (prevents account enumeration).
 */
const GENERIC_LOGIN_ERROR = 'Invalid phone number or PIN. Please try again.';

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
    const message = await readEdgeFunctionErrorMessage(error, response, GENERIC_LOGIN_ERROR);
    return { error: normalizeLoginError(message) };
  }

  if (data?.error) {
    return { error: normalizeLoginError(String(data.error)) };
  }

  const tokenHash = data?.token_hash;
  if (!tokenHash || typeof tokenHash !== 'string') {
    return { error: GENERIC_LOGIN_ERROR };
  }

  const { error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  });

  if (sessionError) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  return { error: null };
}

/**
 * Keep the lockout message (it's not credential-specific), but collapse every
 * other failure into the generic message so we never say "wrong PIN".
 */
function normalizeLoginError(message: string): string {
  if (/too many failed attempts/i.test(message)) {
    return message;
  }
  return GENERIC_LOGIN_ERROR;
}
