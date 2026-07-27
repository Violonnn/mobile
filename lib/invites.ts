import { supabase } from './supabase';
import { normalizePHContactNumber, validatePHNumber } from './validation/phone';

export type InviteRole = 'mayor' | 'officer';

export type InviteListItem = {
  id: string;
  list_group: 'active' | 'used';
  role: InviteRole;
  barangay_id: string | null;
  barangay_name: string | null;
  invited_email: string;
  invited_phone: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  reserved_at: string | null;
};

export type ValidatedInvite = {
  role: InviteRole;
  barangay_id: string | null;
  barangay_name: string | null;
  /** Email bound to this invite — login identifier (read-only). */
  invited_email: string;
  /** Phone bound to this invite — SMS verification target (read-only). */
  invited_phone: string;
};

/** Deep-link format for a one-time invite (raw token, shown once). */
export function buildInviteDeepLink(rawToken: string): string {
  return `disasterlink://invite?token=${encodeURIComponent(rawToken)}`;
}

/** Human-readable invite kind for list rows. */
export function formatInviteKind(
  role: InviteRole,
  barangayId: string | null,
): string {
  if (role === 'mayor') return 'Mayor';
  if (barangayId) return 'BDRRMO';
  return 'MDRRMO';
}

/** Locked scope label shown on Official Access after token validation. */
export function formatInviteScopeLabel(invite: ValidatedInvite): string {
  const kind = formatInviteKind(invite.role, invite.barangay_id);
  if (invite.role === 'officer' && invite.barangay_name) {
    return `${kind} — ${invite.barangay_name}`;
  }
  return kind;
}

/** Normalize admin phone input to E.164 (+639…) for the create_invite RPC. */
function toE164FromContactInput(raw: string): string | null {
  const local09 = normalizePHContactNumber(raw);
  if (!/^09\d{9}$/.test(local09)) return null;
  return `+63${local09.slice(1)}`;
}

export type CreateOfficialInviteResult = {
  token: string | null;
  /** Non-field fallback (auth, format, or unexpected RPC failure). */
  error: string | null;
  emailError: string | null;
  phoneError: string | null;
  /** Auth email exists without a valid official profile — admin recovery needed. */
  requiresManualReview: boolean;
};

type CreateInviteRpcResult = {
  ok?: boolean;
  token?: string | null;
  email_error?: string | null;
  phone_error?: string | null;
  requires_manual_review?: boolean;
};

function emptyCreateInviteResult(
  overrides: Partial<CreateOfficialInviteResult> = {},
): CreateOfficialInviteResult {
  return {
    token: null,
    error: null,
    emailError: null,
    phoneError: null,
    requiresManualReview: false,
    ...overrides,
  };
}

export async function createOfficialInvite(input: {
  role: InviteRole;
  invitedEmail: string;
  invitedPhone: string;
  barangayId?: string | null;
}): Promise<CreateOfficialInviteResult> {
  const invitedEmail = input.invitedEmail.trim().toLowerCase();
  if (!invitedEmail || !invitedEmail.includes('@')) {
    return emptyCreateInviteResult({
      emailError: 'Enter a valid government email for this invite.',
    });
  }

  // Admin invite phones must pass the IPROG carrier gate (Globe/TM/DITO).
  const digits = input.invitedPhone.replace(/\D/g, '');
  const local10 =
    digits.length === 11 && digits.startsWith('0')
      ? digits.slice(1)
      : digits.length === 12 && digits.startsWith('63')
        ? digits.slice(2)
        : digits;

  const phoneCheck = validatePHNumber(local10);
  if (!phoneCheck.valid) {
    return emptyCreateInviteResult({
      phoneError:
        phoneCheck.message || 'Enter a valid Philippine mobile number.',
    });
  }

  const invitedPhone = toE164FromContactInput(input.invitedPhone);
  if (!invitedPhone) {
    return emptyCreateInviteResult({
      phoneError: 'Enter a valid Philippine mobile number.',
    });
  }

  const { data, error } = await supabase.rpc('create_official_invite', {
    p_role: input.role,
    p_invited_email: invitedEmail,
    p_invited_phone: invitedPhone,
    p_barangay_id: input.barangayId ?? null,
  });

  if (error) {
    return emptyCreateInviteResult({ error: error.message });
  }

  const result = (data ?? null) as CreateInviteRpcResult | null;
  if (!result || typeof result !== 'object') {
    return emptyCreateInviteResult({
      error: 'Could not create invite. Please try again.',
    });
  }

  if (result.ok === true && typeof result.token === 'string' && result.token) {
    return emptyCreateInviteResult({ token: result.token });
  }

  const emailError =
    typeof result.email_error === 'string' && result.email_error.trim()
      ? result.email_error.trim()
      : null;
  const phoneError =
    typeof result.phone_error === 'string' && result.phone_error.trim()
      ? result.phone_error.trim()
      : null;

  if (emailError || phoneError) {
    return emptyCreateInviteResult({
      emailError,
      phoneError,
      requiresManualReview: result.requires_manual_review === true,
    });
  }

  return emptyCreateInviteResult({
    error: 'Could not create invite. Please try again.',
  });
}

export async function listOfficialInvites(): Promise<{
  active: InviteListItem[];
  used: InviteListItem[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('list_official_invites');

  if (error) {
    return { active: [], used: [], error: error.message };
  }

  const rows = (data ?? []) as InviteListItem[];
  const active = rows.filter((row) => row.list_group === 'active');
  const used = rows.filter((row) => row.list_group === 'used');
  return { active, used, error: null };
}

export async function revokeOfficialInvite(
  inviteId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('revoke_official_invite', {
    p_invite_id: inviteId,
  });

  return { error: error?.message ?? null };
}

/**
 * Validate an opaque invite token without consuming it.
 * Returns null for any invalid/expired/used/revoked/reserved token (generic UI).
 */
export async function validateInviteToken(
  token: string,
): Promise<{ invite: ValidatedInvite | null; error: string | null }> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { invite: null, error: null };
  }

  const { data, error } = await supabase.rpc('validate_invite_token', {
    p_token: trimmed,
  });

  if (error) {
    return { invite: null, error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return { invite: null, error: null };
  }

  const invitedEmail =
    typeof row.invited_email === 'string'
      ? row.invited_email.trim().toLowerCase()
      : '';
  const invitedPhone =
    typeof row.invited_phone === 'string' ? row.invited_phone.trim() : '';

  if (!invitedEmail || !invitedPhone) {
    return {
      invite: null,
      error: 'Could not validate this invite. Please try again.',
    };
  }

  return {
    invite: {
      role: row.role as InviteRole,
      barangay_id: row.barangay_id ?? null,
      barangay_name: row.barangay_name ?? null,
      invited_email: invitedEmail,
      invited_phone: invitedPhone,
    },
    error: null,
  };
}
