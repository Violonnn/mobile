export type RegistrationStep = 0 | 1 | 2 | 3;

/** Frontend OTP abuse limits (UX layer — real limits must also live on the server). */
export const OTP_COOLDOWN_SECONDS = 60;
export const OTP_MAX_SENDS_PER_SESSION = 3;

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
