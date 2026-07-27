import { supabase } from './supabase';
import {
  parseEdgeFunctionMeta,
  readEdgeFunctionErrorMessage,
} from './edgeFunctionErrors';
import { isValidName } from './validation/name';
import { formatInviteKind, type InviteRole, type ValidatedInvite } from './invites';

export const OFFICIAL_PASSWORD_MIN_LENGTH = 12;

export type OfficialAccessScope = {
  role: InviteRole;
  barangay_id: string | null;
  barangay_name: string | null;
  email: string;
};

export type OfficialSmsSendResult = {
  error: string | null;
  sendCount?: number;
  maxSends?: number;
  cooldownSeconds?: number;
  limitReached?: boolean;
};

const GENERIC_REGISTER_ERROR =
  'Registration could not be completed. Check your details and invite, then try again.';

const GENERIC_OTP_ERROR = 'Invalid or expired code. Please try again.';

const GENERIC_ACCESS_ERROR =
  'Access disabled. This account cannot use official access.';

const GENERIC_INVITE_ERROR =
  'This invite is unavailable. It may be invalid, expired, used, or revoked.';

/** Mask an E.164 PH mobile for read-only display (+63 917 *** **67). */
export function maskInvitePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Expect 639XXXXXXXXX after stripping non-digits.
  const local =
    digits.startsWith('63') && digits.length === 12
      ? digits.slice(2)
      : digits.startsWith('0') && digits.length === 11
        ? digits.slice(1)
        : digits;

  if (local.length !== 10) {
    return '••••••••••';
  }

  return `+63 ${local.slice(0, 3)} *** **${local.slice(8)}`;
}

/** Mask an email for read-only display (j***@domain.gov.ph). */
export function maskInviteEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf('@');
  if (at <= 0) return '••••@••••';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

/** Field errors for the details step (names only — email/phone are invite-bound). */
export function validateOfficialDetailsForm(input: {
  lastName: string;
  firstName: string;
  middleName: string;
}): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (!isValidName(input.lastName)) {
    fieldErrors.lastName = 'Enter a valid last name.';
  }
  if (!isValidName(input.firstName)) {
    fieldErrors.firstName = 'Enter a valid first name.';
  }
  const middle = input.middleName.trim();
  if (middle && !isValidName(middle)) {
    fieldErrors.middleName = 'Enter a valid middle name, or leave it blank.';
  }

  return fieldErrors;
}

/** Field errors for the password step. */
export function validateOfficialPasswordForm(input: {
  password: string;
  confirmPassword: string;
}): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (!input.password) {
    fieldErrors.password = 'Enter a password.';
  } else if (input.password.length < OFFICIAL_PASSWORD_MIN_LENGTH) {
    fieldErrors.password = `Password must be at least ${OFFICIAL_PASSWORD_MIN_LENGTH} characters.`;
  }

  if (!input.confirmPassword) {
    fieldErrors.confirmPassword = 'Confirm your password.';
  } else if (input.password !== input.confirmPassword) {
    fieldErrors.confirmPassword = 'Passwords do not match.';
  }

  return fieldErrors;
}

/** Send (or resend) the invite-bound SMS OTP. */
export async function sendOfficialInviteSmsOtp(
  token: string,
): Promise<OfficialSmsSendResult> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { error: GENERIC_INVITE_ERROR };
  }

  const { data, error, response } = await supabase.functions.invoke(
    'official-invite-registration',
    { body: { action: 'send', token: trimmed } },
  );

  const meta = parseEdgeFunctionMeta(data);

  if (error) {
    const message = await readEdgeFunctionErrorMessage(
      error,
      response,
      'Unable to send verification code. Please try again.',
    );
    return { error: message, ...meta };
  }

  if (data?.error) {
    return { error: String(data.error), ...meta };
  }

  return { error: null, ...meta };
}

/** Verify the 6-digit SMS code for this invite. */
export async function verifyOfficialInviteSmsOtp(input: {
  token: string;
  code: string;
}): Promise<{ error: string | null }> {
  const token = input.token.trim();
  const code = input.code.trim();

  if (!token) {
    return { error: GENERIC_INVITE_ERROR };
  }
  if (code.length !== 6) {
    return { error: 'Enter the 6-digit code from your SMS.' };
  }

  const { data, error, response } = await supabase.functions.invoke(
    'official-invite-registration',
    { body: { action: 'verify', token, code } },
  );

  if (error) {
    const message = await readEdgeFunctionErrorMessage(
      error,
      response,
      GENERIC_OTP_ERROR,
    );
    return { error: message };
  }

  if (data?.error) {
    return { error: String(data.error) };
  }

  return { error: null };
}

/**
 * Create the official account after SMS verification.
 * Email/password Auth user is created server-side (no client service-role key).
 * Caller should send the user to official login — do not auto sign-in here.
 */
export async function registerOfficialAccount(input: {
  token: string;
  lastName: string;
  firstName: string;
  middleName: string;
  password: string;
  confirmPassword: string;
}): Promise<{ scope: OfficialAccessScope | null; error: string | null }> {
  const passwordErrors = validateOfficialPasswordForm({
    password: input.password,
    confirmPassword: input.confirmPassword,
  });
  if (Object.keys(passwordErrors).length > 0) {
    return { scope: null, error: Object.values(passwordErrors)[0] };
  }

  const detailErrors = validateOfficialDetailsForm({
    lastName: input.lastName,
    firstName: input.firstName,
    middleName: input.middleName,
  });
  if (Object.keys(detailErrors).length > 0) {
    return { scope: null, error: Object.values(detailErrors)[0] };
  }

  const token = input.token.trim();
  if (!token) {
    return { scope: null, error: GENERIC_INVITE_ERROR };
  }

  const { data, error, response } = await supabase.functions.invoke(
    'official-invite-registration',
    {
      body: {
        action: 'register',
        token,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        middleName: input.middleName.trim(),
        password: input.password,
      },
    },
  );

  if (error) {
    const message = await readEdgeFunctionErrorMessage(
      error,
      response,
      GENERIC_REGISTER_ERROR,
    );
    return { scope: null, error: message };
  }

  if (data?.error || !data?.success || !data?.email) {
    return {
      scope: null,
      error: data?.error ? String(data.error) : GENERIC_REGISTER_ERROR,
    };
  }

  const email = String(data.email).trim().toLowerCase();

  // Do not auto sign-in — caller redirects to official login so the user
  // authenticates explicitly with the credentials they just set.
  return {
    scope: {
      role: data.role as InviteRole,
      barangay_id: data.barangay_id ?? null,
      barangay_name: data.barangay_name ?? null,
      email,
    },
    error: null,
  };
}

export async function fetchActiveOfficialAccess(): Promise<{
  scope: OfficialAccessScope | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('check_active_official_access');
  if (error) {
    return { scope: null, error: GENERIC_ACCESS_ERROR };
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return { scope: null, error: null };
  }

  return {
    scope: {
      role: row.role as InviteRole,
      barangay_id: row.barangay_id ?? null,
      barangay_name: row.barangay_name ?? null,
      email: row.email as string,
    },
    error: null,
  };
}

export function scopeLabelFromAccess(
  scope: OfficialAccessScope | ValidatedInvite,
): string {
  const kind = formatInviteKind(scope.role, scope.barangay_id);
  if ('barangay_name' in scope && scope.barangay_name) {
    return `${kind} — ${scope.barangay_name}`;
  }
  return kind;
}
