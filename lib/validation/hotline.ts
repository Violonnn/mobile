// lib/validation/hotline.ts
// Dial-string validation for emergency/resource hotlines.
// Broader than resident mobile validation: allows 911, short codes,
// Philippine mobiles, landlines, and extensions.

const MAX_HOTLINE_LENGTH = 32;

/** Strip spaces, dashes, parentheses, and dots for comparison. */
function digitsAndPlus(raw: string): string {
  return raw.replace(/[\s\-().]/g, '');
}

/**
 * Validate a hotline dial string for directory storage.
 * Accepts: 911, short codes (3–6 digits), PH mobiles, landlines, extensions.
 */
export function validateHotlineNumber(raw: string): {
  normalized: string | null;
  error: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { normalized: null, error: 'Enter a hotline number.' };
  }
  if (trimmed.length > MAX_HOTLINE_LENGTH) {
    return {
      normalized: null,
      error: `Hotline must be ${MAX_HOTLINE_LENGTH} characters or fewer.`,
    };
  }

  // Reject letters and unexpected symbols early.
  if (!/^[0-9+\-().\s#*,extEXT]+$/.test(trimmed)) {
    return { normalized: null, error: 'Hotline contains invalid characters.' };
  }

  const compact = digitsAndPlus(trimmed);

  // National emergency / short emergency codes.
  if (compact === '911' || compact === '117' || compact === '8888') {
    return { normalized: compact, error: null };
  }

  // Short codes: 3–6 digits (local emergency / LGU short numbers).
  if (/^\d{3,6}$/.test(compact)) {
    return { normalized: compact, error: null };
  }

  // Extension form: base + "x" / "ext" / "#" + digits.
  const extensionMatch = trimmed.match(
    /^(.+?)\s*(?:ext\.?|x|#|,)\s*(\d{1,6})$/i,
  );
  if (extensionMatch) {
    const baseResult = validateHotlineNumber(extensionMatch[1]);
    if (baseResult.error || !baseResult.normalized) {
      return {
        normalized: null,
        error: baseResult.error || 'Invalid base number before extension.',
      };
    }
    return {
      normalized: `${baseResult.normalized}x${extensionMatch[2]}`,
      error: null,
    };
  }

  // Philippine mobile: +639XXXXXXXXX / 09XXXXXXXXX / 9XXXXXXXXX
  const mobileDigits = compact.replace(/^\+/, '');
  if (
    (mobileDigits.startsWith('639') && mobileDigits.length === 12) ||
    (mobileDigits.startsWith('09') && mobileDigits.length === 11) ||
    (mobileDigits.startsWith('9') && mobileDigits.length === 10)
  ) {
    let local = mobileDigits;
    if (local.startsWith('63')) local = `0${local.slice(2)}`;
    if (local.length === 10 && local.startsWith('9')) local = `0${local}`;
    if (!/^09\d{9}$/.test(local)) {
      return { normalized: null, error: 'Enter a valid Philippine mobile number.' };
    }
    return { normalized: local, error: null };
  }

  // Landline: optional +63 / 0 trunk, area code, 7–8 subscriber digits.
  // Examples: (032) 123-4567, 0321234567, +63321234567
  const landlineDigits = compact.replace(/^\+/, '');
  let national = landlineDigits;
  if (national.startsWith('63') && national.length >= 10 && national.length <= 12) {
    national = `0${national.slice(2)}`;
  }
  if (/^0\d{8,10}$/.test(national) || /^\d{7,8}$/.test(national)) {
    return { normalized: national, error: null };
  }

  return {
    normalized: null,
    error:
      'Enter a valid hotline (911, short code, mobile, landline, or extension).',
  };
}

/** True when the dial string passes validateHotlineNumber. */
export function isValidHotlineNumber(raw: string): boolean {
  return validateHotlineNumber(raw).error === null;
}
