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

/** Basic E.164 PH mobile check (+639xxxxxxxxx). */
export function isValidE164Phone(phone: string): boolean {
  return /^\+639\d{9}$/.test(phone);
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
