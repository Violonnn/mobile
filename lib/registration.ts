import { AuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import {
  parseEdgeFunctionMeta,
  readEdgeFunctionErrorMessage,
} from './edgeFunctionErrors';
import { RegistrationDetails } from '../types/registration';

export type CompleteRegistrationInput = {
  phone: string;
  details: RegistrationDetails;
  pin: string;
};

export type OtpRequestResult = {
  error: string | null;
  sendCount?: number;
  maxSends?: number;
  cooldownSeconds?: number;
  limitReached?: boolean;
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

function getAuthErrorMessage(error: unknown, fallback: string): string {
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

  if (error instanceof Error && error.message && !looksLikeRawHttpDump(error.message)) {
    return error.message;
  }

  return fallback;
}

export async function fetchRegistrationOtpStatus(phone: string): Promise<OtpRequestResult> {
  const { data, error, response } = await supabase.functions.invoke(
    'request-registration-otp',
    {
      body: { phone, statusOnly: true },
    },
  );

  if (error) {
    const message = await readEdgeFunctionErrorMessage(
      error,
      response,
      'Unable to check OTP status.',
    );
    const meta = parseEdgeFunctionMeta(data);
    return { error: message, ...meta };
  }

  if (data?.error) {
    return { error: String(data.error), ...parseEdgeFunctionMeta(data) };
  }

  return {
    error: null,
    ...parseEdgeFunctionMeta(data),
  };
}

export async function requestRegistrationOtp(phone: string): Promise<OtpRequestResult> {
  const { data, error, response } = await supabase.functions.invoke(
    'request-registration-otp',
    {
      body: { phone },
    },
  );

  const meta = parseEdgeFunctionMeta(data);

  if (error) {
    const message = await readEdgeFunctionErrorMessage(
      error,
      response,
      'Unable to send OTP. Please try again.',
    );
    return { error: message, ...meta };
  }

  if (data?.error) {
    return { error: String(data.error), ...meta };
  }

  return { error: null, ...meta };
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
    return { error: getAuthErrorMessage(error, 'Invalid or expired OTP. Please try again.') };
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
