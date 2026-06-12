export function formatLocalPH(raw: string): string {
  return raw.replace(/\D/g, '');
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