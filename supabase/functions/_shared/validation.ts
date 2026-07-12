/** Shared input checks for edge functions. Keep rules simple and explicit. */

export const MAX_NAME_LENGTH = 100;
export const MAX_BARANGAY_LENGTH = 100;

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export function isValidBirthYear(year: string): boolean {
  const value = Number(year);
  const currentYear = new Date().getFullYear();
  return Number.isInteger(value) && value >= currentYear - 100 && value <= currentYear;
}

export function isValidBirthMonth(month: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

/** Reject unknown JSON keys so clients cannot smuggle extra fields. */
export function rejectExtraKeys(
  obj: Record<string, unknown>,
  allowed: string[],
): string | null {
  const extras = Object.keys(obj).filter((key) => !allowed.includes(key));
  if (extras.length > 0) {
    return `Unexpected fields: ${extras.join(", ")}`;
  }
  return null;
}

export function trimText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Allow letters (incl. common accented Latin), spaces, hyphens, apostrophes,
// and periods so names like "Dela Cruz", "O'Brien", and "Jr." pass while digits
// and other symbols are rejected. Mirrors isValidName in lib/validation/name.ts.
const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]*$/;

/** True when the value is a plausible human name within the length limit. */
export function isValidName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return false;
  return NAME_PATTERN.test(trimmed);
}

/** Basic E.164 PH mobile check (+639xxxxxxxxx). */
export function isValidE164Phone(phone: string): boolean {
  return /^\+639\d{9}$/.test(phone);
}

/**
 * Carriers IPROG's shared sender name can currently deliver to: Globe/TM and
 * DITO. Mirrors SUPPORTED_CARRIER_PREFIXES in lib/validation/phone.ts. Prefixes
 * are the first 3 digits of the local number (e.g. +639171234567 → 917).
 * Keep this list in sync with the client until all carriers are supported.
 */
const SUPPORTED_CARRIER_PREFIXES = [
  // Globe / TM
  817, 904, 905, 906, 915, 916, 917, 926, 927, 935, 936, 937,
  945, 954, 955, 956, 965, 966, 967, 975, 976, 977, 978, 979,
  995, 997,

  // DITO
  895, 896, 897, 898, 991, 992, 993, 994,
];

/**
 * Whether we can deliver an OTP SMS to this number right now. Expects an E.164
 * PH mobile (+639XXXXXXXXX); validate with isValidE164Phone first.
 */
export function isSupportedCarrier(phone: string): boolean {
  const match = phone.match(/^\+63(9\d{9})$/);
  if (!match) return false;
  const prefix = parseInt(match[1].substring(0, 3), 10);
  return SUPPORTED_CARRIER_PREFIXES.includes(prefix);
}

/** Normalize PH mobiles to +639XXXXXXXXX for reliable comparisons. */
export function normalizePhilippinePhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";

  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `+63${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith("9")) {
    return `+63${digits}`;
  }
  if (trimmed.startsWith("+")) return trimmed;
  return trimmed;
}
