export function formatLocalPH(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function formatPhoneDisplay(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3, 6)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/** Formats an 11-digit PH mobile number as 09XX XXX XXXX */
export function formatFullPHMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`;
}

export function sanitizePhoneInput(text: string): string {
  const cleaned = text.replace(/\D/g, '').slice(0, 10);
  return formatPhoneDisplay(cleaned);
}

/**
 * Carriers we can currently deliver OTP SMS to through IPROG's shared sender
 * name: Globe/TM and DITO. Prefixes are the first 3 digits of the 10-digit
 * local number (e.g. 0917... → 917). Smart/TNT/Sun numbers are still valid PH
 * numbers, just not deliverable yet — see the gate in validatePHNumber.
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
 * Philippine mobile contact check for official registration.
 * Accepts all major PH carriers (no IPROG SMS delivery gate).
 * Expects 10 local digits (without leading 0) or 11 digits starting with 09.
 */
export function validatePHContactNumber(raw: string): { valid: boolean; message: string } {
  const digits = raw.replace(/\D/g, '');
  const local =
    digits.length === 11 && digits.startsWith('0')
      ? digits.slice(1)
      : digits;

  if (!local) return { valid: false, message: 'Enter a Philippine mobile number.' };
  if (local.length < 10) {
    return { valid: false, message: 'Enter a 10-digit mobile number.' };
  }
  if (local.length > 10) {
    return { valid: false, message: 'Too many digits.' };
  }

  const prefix = parseInt(local.substring(0, 3), 10);
  const validPrefixes = [
    // Globe / TM
    817, 904, 905, 906, 915, 916, 917, 926, 927, 935, 936, 937,
    945, 954, 955, 956, 965, 966, 967, 975, 976, 977, 978, 979,
    995, 997,
    // Smart
    908, 911, 913, 914, 919, 920, 921, 928, 929, 939, 946, 947,
    949, 951, 961, 963, 968, 969, 970, 981, 998, 999,
    // TNT
    907, 909, 910, 912, 930, 938,
    // Sun
    931, 932, 933, 934, 940, 973, 974, 991,
    // DITO
    895, 896, 897, 898, 992, 993, 994,
  ];

  if (!validPrefixes.includes(prefix)) {
    return { valid: false, message: 'Enter a valid Philippine mobile number.' };
  }

  return { valid: true, message: '' };
}

/** Normalize contact input to 09XXXXXXXXX for storage. */
export function normalizePHContactNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `0${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return digits;
  if (digits.length === 12 && digits.startsWith('63')) return `0${digits.slice(2)}`;
  return digits;
}

export function validatePHNumber(digits: string): { valid: boolean; message: string } {
  const cleaned = digits.replace(/\s/g, ''); // ← strip spaces first

  if (!cleaned) return { valid: false, message: '' };
  if (cleaned.length < 10) return { valid: false, message: 'Enter a 10-digit mobile number' };
  if (cleaned.length > 10) return { valid: false, message: 'Too many digits' };

  const prefix = parseInt(cleaned.substring(0, 3), 10); // ← use cleaned
  const validPrefixes = [
  // Globe / TM
  817, 904, 905, 906, 915, 916, 917, 926, 927, 935, 936, 937,
  945, 954, 955, 956, 965, 966, 967, 975, 976, 977, 978, 979,
  995, 997,

  // Smart
  908, 911, 913, 914, 919, 920, 921, 928, 929, 939, 946, 947,
  949, 951, 961, 963, 968, 969, 970, 981, 998, 999,

  // TNT (Talk N Text)
  907, 909, 910, 912, 930, 938,

  // Sun Cellular (now under Smart)
  931, 932, 933, 934, 940, 973, 974, 991,

  // DITO
  895, 896, 897, 898, 992, 993, 994
];

  if (!validPrefixes.includes(prefix)) {
    return { valid: false, message: 'Enter a valid Philippine mobile number' };
  }

  // API constraint: IPROG's shared sender name can currently only deliver SMS to
  // Globe/TM and DITO numbers. Other valid PH carriers (Smart/TNT/Sun) are
  // recognized as real numbers above, but blocked here until a custom sender
  // name is approved. Remove this gate once all carriers are supported.
  if (!SUPPORTED_CARRIER_PREFIXES.includes(prefix)) {
    return { valid: false, message: 'Not supported yet. Try Globe, TM, or DITO' };
  }

  return { valid: true, message: '' };
}