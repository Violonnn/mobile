/**
 * Extract an opaque invite token from either a raw token or a full invite URL.
 * Never parses role/barangay from the token — only the `token` query value.
 */

export type ExtractInviteTokenResult =
  | { token: string; error: null }
  | { token: null; error: string };

function looksLikeUrl(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes('://') ||
    lower.startsWith('http:') ||
    lower.startsWith('https:') ||
    lower.startsWith('disasterlink:') ||
    lower.startsWith('exp:') ||
    lower.includes('invite?') ||
    lower.includes('token=')
  );
}

function readTokenQueryParam(rawUrl: string): string | null {
  try {
    // Some Expo Go / custom schemes parse more reliably with a https base.
    const normalized =
      rawUrl.includes('://') ? rawUrl : `https://placeholder.local/${rawUrl.replace(/^\//, '')}`;
    const url = new URL(normalized);
    const token = url.searchParams.get('token');
    if (token && token.trim()) return token.trim();
  } catch {
    // Fall through to manual parse.
  }

  const match = rawUrl.match(/[?&]token=([^&]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    return match[1].trim();
  }
}

/**
 * Accept a raw opaque token or a complete invite URL.
 * Unrelated / malformed URLs are rejected locally.
 */
export function extractInviteToken(input: string): ExtractInviteTokenResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { token: null, error: 'Paste your invite token or link.' };
  }

  if (!looksLikeUrl(trimmed)) {
    // Raw opaque token (hex from create_official_invite).
    if (/\s/.test(trimmed)) {
      return { token: null, error: 'This invite link or token is not valid.' };
    }
    return { token: trimmed, error: null };
  }

  const lower = trimmed.toLowerCase();
  const isInviteShaped =
    lower.includes('invite') ||
    lower.includes('token=') ||
    lower.startsWith('disasterlink:');

  if (!isInviteShaped) {
    return { token: null, error: 'This invite link or token is not valid.' };
  }

  const token = readTokenQueryParam(trimmed);
  if (!token) {
    return { token: null, error: 'This invite link or token is not valid.' };
  }

  return { token, error: null };
}

/**
 * Mask an opaque invite token for display (e.g. a3f1…9b7c).
 * Never show the full raw token in the UI.
 */
export function maskInviteToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}…${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}
