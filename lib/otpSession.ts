import AsyncStorage from '@react-native-async-storage/async-storage';
import { OTP_MAX_SENDS_PER_SESSION } from '../types/registration';

const OTP_SESSION_KEY = 'disasterlink_otp_session';

/** How long send_count stays valid on-device (matches server window). */
const OTP_WINDOW_MS = 60 * 60 * 1000;

export type OtpSessionState = {
  phone: string;
  sendCount: number;
  cooldownEndsAt: number | null;
  windowExpiresAt: number;
};

function isExpired(state: OtpSessionState): boolean {
  return Date.now() >= state.windowExpiresAt;
}

function cooldownRemaining(state: OtpSessionState): number {
  if (!state.cooldownEndsAt) return 0;
  return Math.max(0, Math.ceil((state.cooldownEndsAt - Date.now()) / 1000));
}

export async function loadOtpSession(phoneClean: string): Promise<{
  sendCount: number;
  cooldownSeconds: number;
  hasPendingOtp: boolean;
  limitReached: boolean;
} | null> {
  if (!phoneClean) return null;

  try {
    const raw = await AsyncStorage.getItem(OTP_SESSION_KEY);
    if (!raw) return null;

    const state = JSON.parse(raw) as OtpSessionState;
    if (state.phone !== phoneClean || isExpired(state)) {
      await AsyncStorage.removeItem(OTP_SESSION_KEY);
      return null;
    }

    const limitReached = state.sendCount >= OTP_MAX_SENDS_PER_SESSION;

    return {
      sendCount: state.sendCount,
      cooldownSeconds: cooldownRemaining(state),
      hasPendingOtp: state.sendCount > 0,
      limitReached,
    };
  } catch {
    return null;
  }
}

export async function saveOtpSession(
  phoneClean: string,
  sendCount: number,
  cooldownSeconds: number,
): Promise<void> {
  if (!phoneClean) return;

  const now = Date.now();
  let windowExpiresAt = now + OTP_WINDOW_MS;

  try {
    const raw = await AsyncStorage.getItem(OTP_SESSION_KEY);
    if (raw) {
      const existing = JSON.parse(raw) as OtpSessionState;
      if (existing.phone === phoneClean && !isExpired(existing)) {
        windowExpiresAt = existing.windowExpiresAt;
      }
    }
  } catch {
    // use fresh window
  }

  const state: OtpSessionState = {
    phone: phoneClean,
    sendCount,
    cooldownEndsAt: cooldownSeconds > 0 ? now + cooldownSeconds * 1000 : null,
    windowExpiresAt,
  };

  try {
    await AsyncStorage.setItem(OTP_SESSION_KEY, JSON.stringify(state));
  } catch {
    // Non-critical UX cache
  }
}

export async function clearOtpSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OTP_SESSION_KEY);
  } catch {
    // ignore
  }
}
