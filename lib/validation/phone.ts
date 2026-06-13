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

export function validatePHNumber(digits: string): { valid: boolean; message: string } {
  const cleaned = digits.replace(/\s/g, ''); // ← strip spaces first

  if (!cleaned) return { valid: false, message: '' };
  if (cleaned.length < 10) return { valid: false, message: 'Enter a 10-digit mobile number' };
  if (cleaned.length > 10) return { valid: false, message: 'Too many digits' };

  const prefix = parseInt(cleaned.substring(0, 3), 10); // ← use cleaned
  const validPrefixes = [
    917, 926, 927, 935, 936, 937, 945, 955, 956, 965, 966, 967, 975, 976, 977,
    978, 979, 995, 996, 997, 908, 918, 919, 920, 921, 928, 929, 930, 938, 939,
    940, 946, 947, 948, 949, 950, 951, 961, 998, 999, 895, 896, 897, 898, 991,
    992, 993, 994,
  ];

  if (!validPrefixes.includes(prefix)) {
    return { valid: false, message: 'Enter a valid Philippine mobile number' };
  }
  return { valid: true, message: '' };
}