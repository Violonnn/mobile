export const DEMO_AUTH_OTP = '123456';
export const DEMO_AUTH_INVALID_OTP_MESSAGE = 'Invalid or expired OTP. Please try again.';
// Keep the simulated metadata aligned with the shared production OTP UI limits.
const DEMO_OTP_COOLDOWN_SECONDS = 60;
const DEMO_OTP_MAX_SENDS = 3;

export type DemoOtpPurpose = 'registration' | 'password_reset';

export type DemoOtpResult = {
  error: string | null;
  sendCount?: number;
  maxSends?: number;
  cooldownSeconds?: number;
  limitReached?: boolean;
};

type DemoModeInputs = {
  isDevelopment: boolean;
  publicFlag: string | undefined;
};

type DemoOtpState = {
  sendCount: number;
};

const demoOtpStates = new Map<string, DemoOtpState>();

function otpStateKey(purpose: DemoOtpPurpose, phone: string): string {
  return `${purpose}:${phone}`;
}

/**
 * A public environment value alone must never enable the demo path in a
 * release build. Keeping this check pure also makes the release guard testable.
 */
export function isDemoAuthEnabledFor({ isDevelopment, publicFlag }: DemoModeInputs): boolean {
  return isDevelopment && publicFlag === 'true';
}

export function isDemoAuthEnabled(): boolean {
  return isDemoAuthEnabledFor({
    isDevelopment: typeof __DEV__ !== 'undefined' && __DEV__,
    publicFlag: process.env.EXPO_PUBLIC_DEMO_AUTH_MODE,
  });
}

export function getDemoOtpStatus(): DemoOtpResult {
  return {
    error: null,
    sendCount: 0,
    maxSends: DEMO_OTP_MAX_SENDS,
    cooldownSeconds: 0,
    limitReached: false,
  };
}

/** Returns local send metadata without contacting SMS or Supabase services. */
export function requestDemoOtp(purpose: DemoOtpPurpose, phone: string): DemoOtpResult {
  const key = otpStateKey(purpose, phone);
  const state = demoOtpStates.get(key) ?? { sendCount: 0 };

  if (state.sendCount >= DEMO_OTP_MAX_SENDS) {
    return {
      error: 'Too many OTP requests. Please try again later.',
      sendCount: state.sendCount,
      maxSends: DEMO_OTP_MAX_SENDS,
      cooldownSeconds: 0,
      limitReached: true,
    };
  }

  const sendCount = state.sendCount + 1;
  demoOtpStates.set(key, { sendCount });

  return {
    error: null,
    sendCount,
    maxSends: DEMO_OTP_MAX_SENDS,
    cooldownSeconds: DEMO_OTP_COOLDOWN_SECONDS,
    limitReached: sendCount >= DEMO_OTP_MAX_SENDS,
  };
}

export function verifyDemoOtp(token: string): { error: string | null } {
  return { error: token === DEMO_AUTH_OTP ? null : DEMO_AUTH_INVALID_OTP_MESSAGE };
}

/** Local completion result for registration; no Auth, database, or Storage write occurs. */
export function completeDemoRegistration(): { error: string | null } {
  return { error: null };
}

/** Local completion result for a PIN reset; no PIN is changed. */
export function completeDemoPinReset(): { error: string | null } {
  return { error: null };
}

/** Demo verification never creates a reset session, so cleanup is intentionally empty. */
export function endDemoResetSession(): void {}

/** Clears temporary local send state when a demo flow is abandoned. */
export function clearDemoOtpState(purpose: DemoOtpPurpose): void {
  for (const key of demoOtpStates.keys()) {
    if (key.startsWith(`${purpose}:`)) demoOtpStates.delete(key);
  }
}

/** Test-only reset for deterministic unit tests; it never touches device storage. */
export function resetDemoAuthStateForTests(): void {
  demoOtpStates.clear();
}
