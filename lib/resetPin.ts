import { supabase } from './supabase';
import { readEdgeFunctionErrorMessage } from './edgeFunctionErrors';
import {
  getActiveSession,
  requestRegistrationOtp,
  verifyRegistrationOtp,
  OtpRequestResult,
} from './registration';

export type ResetPinInput = {
  phone: string;
  pin: string;
};

/**
 * Forgot-PIN OTP request. Reuses the shared OTP Edge Function with
 * purpose='password_reset'. The server always returns the same success shape,
 * so the caller can NEVER tell whether the phone is actually registered.
 */
export async function requestPasswordResetOtp(phone: string): Promise<OtpRequestResult> {
  return requestRegistrationOtp(phone, 'password_reset');
}

/**
 * Verify the reset OTP. Reuses the same verification as registration — this
 * creates a short-lived Supabase session that ONLY authorizes the PIN reset.
 * It must not be used to enter the app.
 */
export async function verifyPasswordResetOtp(
  phone: string,
  token: string,
): Promise<{ error: string | null }> {
  return verifyRegistrationOtp(phone, token);
}

/**
 * Overwrite the PIN via the reset-pin Edge Function using the OTP-verified
 * session. The session is signed out afterwards (success or failure) so a
 * verified reset never lingers as an app login.
 */
export async function submitNewPin(input: ResetPinInput): Promise<{ error: string | null }> {
  const session = await getActiveSession();

  if (!session) {
    return { error: 'Your session expired. Please verify your phone again.' };
  }

  const { data, error, response } = await supabase.functions.invoke('reset-pin', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: {
      phone: input.phone,
      pin: input.pin,
    },
  });

  if (error) {
    const message = await readEdgeFunctionErrorMessage(
      error,
      response,
      'Could not reset your PIN. Please try again.',
    );
    return { error: message };
  }

  if (data?.error) {
    return { error: String(data.error) };
  }

  return { error: null };
}

/** End the reset session so a verified-but-abandoned reset can't stay logged in. */
export async function endResetSession(): Promise<void> {
  await supabase.auth.signOut();
}
