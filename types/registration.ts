export type RegistrationStep = 0 | 1 | 2 | 3;

/** Frontend OTP abuse limits (UX layer — real limits must also live on the server). */
export const OTP_COOLDOWN_SECONDS = 60;
export const OTP_MAX_SENDS_PER_SESSION = 3;

/**
 * After this many wrong OTP entries we stop showing the confusing "invalid or
 * expired" message and tell the user to request a fresh code. Supabase itself
 * invalidates an OTP after too many failed attempts, so guiding a resend early
 * avoids a dead-end where even the correct code fails.
 */
export const OTP_MAX_VERIFY_ATTEMPTS = 3;

export type RegistrationDetails = {
  lastName: string;
  firstName: string;
  middleName: string;
  birthYear: string;
  birthMonth: number | null;
  barangay: string;
  agreedToTerms: boolean;
};

export const EMPTY_DETAILS: RegistrationDetails = {
  lastName: '',
  firstName: '',
  middleName: '',
  birthYear: '',
  birthMonth: null,
  barangay: '',
  agreedToTerms: false,
};
