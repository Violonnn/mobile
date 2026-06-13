import { AuthError, FunctionsHttpError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { RegistrationDetails } from '../types/registration';

export type CompleteRegistrationInput = {
  phone: string;
  details: RegistrationDetails;
  pin: string;
};

function looksLikeRawHttpDump(message: string): boolean {
  return message.startsWith('{') && message.includes('"headers"') && message.includes('"status"');
}

function extractMessageFromHttpDump(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as {
      msg?: string;
      message?: string;
      error?: { message?: string };
    };
    if (typeof parsed.msg === 'string' && parsed.msg.trim()) return parsed.msg.trim();
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim();
    }
    if (parsed.error?.message) return String(parsed.error.message);
  } catch {
    // not JSON
  }
  return null;
}

const GENERIC_EDGE_FUNCTION_ERROR = 'Edge Function returned a non-2xx status code';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AuthError) {
    const message = error.message?.trim();
    if (message && looksLikeRawHttpDump(message)) {
      const extracted = extractMessageFromHttpDump(message);
      if (extracted) return extracted;
    }
    if (message && !looksLikeRawHttpDump(message)) {
      return message;
    }
    if (error.status === 502 || error.status === 504) {
      if (isAuthRetryableFetchError(error)) {
        return 'SMS hook failed (server timeout or UniSMS error). Check Supabase → Edge Functions → unisms-hook → Logs.';
      }
      return 'SMS could not be sent. Check UniSMS API secret key and account credits.';
    }
    return fallback;
  }

  if (error instanceof Error && error.message) {
    if (looksLikeRawHttpDump(error.message)) return fallback;
    if (
      error.message === GENERIC_EDGE_FUNCTION_ERROR ||
      error.name === 'FunctionsHttpError'
    ) {
      return fallback;
    }
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0 && !looksLikeRawHttpDump(message)) {
      return message;
    }
  }

  return fallback;
}

export async function requestRegistrationOtp(phone: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      channel: 'sms',
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { error: getErrorMessage(error, 'Unable to send OTP. Please try again.') };
  }

  return { error: null };
}

export async function verifyRegistrationOtp(
  phone: string,
  token: string,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });

  if (error) {
    return { error: getErrorMessage(error, 'Invalid or expired OTP. Please try again.') };
  }

  if (!data.session?.access_token) {
    return {
      error: 'Could not start your session after OTP verification. Please request a new code.',
    };
  }

  return { error: null };
}

async function getActiveSession() {
  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    console.warn('refreshSession failed during registration:', refreshError.message);
  }

  const session = refreshData.session ?? (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) {
    return null;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(session.access_token);
  if (userError || !userData.user) {
    return null;
  }

  return session;
}

async function getEdgeFunctionErrorMessage(
  response: Response | undefined,
  fallback: string,
): Promise<string> {
  if (!response) return fallback;

  try {
    const body = (await response.clone().json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error.trim()) {
      return body.error.trim();
    }
  } catch {
    // response body was not JSON
  }

  return fallback;
}

async function readEdgeFunctionErrorMessage(
  error: unknown,
  response: Response | undefined,
  fallback: string,
): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      const body = (await error.context.clone().json()) as { error?: unknown };
      if (typeof body.error === 'string' && body.error.trim()) {
        return body.error.trim();
      }
    } catch {
      // response body was not JSON
    }
  }

  return getEdgeFunctionErrorMessage(response, fallback);
}

export async function completeRegistrationProfile(
  input: CompleteRegistrationInput,
): Promise<{ error: string | null }> {
  const session = await getActiveSession();

  if (!session) {
    return { error: 'Your session expired. Please verify your phone again.' };
  }

  const { data, error, response } = await supabase.functions.invoke('complete-registration', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: {
      phone: input.phone,
      details: input.details,
      pin: input.pin,
    },
  });

  if (error) {
    const message = await readEdgeFunctionErrorMessage(
      error,
      response,
      'Registration could not be completed.',
    );
    return { error: message };
  }

  if (data?.error) {
    return { error: String(data.error) };
  }

  return { error: null };
}

export async function signOutAfterRegistrationFailure(): Promise<void> {
  await supabase.auth.signOut();
}
