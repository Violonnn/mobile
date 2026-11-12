/**
 * Extract an opaque invite token from a raw token or an invite URL.
 * The token is never interpreted for role, coverage, or identity information.
 */

export const MAX_INVITE_INPUT_LENGTH = 2048;
const INVITE_TOKEN_PATTERN = /^[0-9a-fA-F]{64}$/;

export type ExtractInviteTokenResult =
  | { token: string; error: null }
  | { token: null; error: string };

function inviteInputError(): ExtractInviteTokenResult {
  return { token: null, error: 'This invite link or token is not valid.' };
}

function isInviteUrlPath(url: URL): boolean {
  const pathname = url.pathname.replace(/\/+$/, '').toLowerCase();

  // disasterlink://invite?token=... stores "invite" in the URL host.
  if (url.protocol === 'disasterlink:' && url.hostname.toLowerCase() === 'invite') {
    return pathname === '';
  }

  const pathSegments = pathname.split('/').filter(Boolean);
  return pathSegments.at(-1) === 'invite';
}

function readInviteUrlToken(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const supportedScheme =
      url.protocol === 'disasterlink:' ||
      url.protocol === 'exp:' ||
      url.protocol === 'https:';
    if (!supportedScheme || !isInviteUrlPath(url)) return null;
    if (url.username || url.password) return null;

    const tokens = url.searchParams.getAll('token');
    if (tokens.length !== 1 || !INVITE_TOKEN_PATTERN.test(tokens[0])) return null;
    return tokens[0];
  } catch {
    return null;
  }
}

/**
 * Accept the existing 64-character hex token or a complete invite URL.
 * URL host/path content only identifies a supported link shape. The server
 * remains the authority for whether the extracted token grants access.
 */
export function extractInviteToken(input: string): ExtractInviteTokenResult {
  if (input.length > MAX_INVITE_INPUT_LENGTH) {
    return { token: null, error: 'Invite links and tokens must be 2048 characters or fewer.' };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { token: null, error: 'Paste your invite token or link.' };
  }

  if (INVITE_TOKEN_PATTERN.test(trimmed)) {
    return { token: trimmed, error: null };
  }

  const looksLikeUrl = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  if (!looksLikeUrl) return inviteInputError();

  const token = readInviteUrlToken(trimmed);
  if (!token) return inviteInputError();
  return { token, error: null };
}

/** Mask an opaque invite token for display without exposing the full value. */
export function maskInviteToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}\u2026${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 4)}\u2026${trimmed.slice(-4)}`;
}
