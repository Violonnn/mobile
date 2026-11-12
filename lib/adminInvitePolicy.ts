export const ADMIN_INVITE_SNAPSHOT_TTL_MS = 60_000;
export const ADMIN_INVITE_EXPIRY_WINDOW_MS = 48 * 60 * 60 * 1000;

export type AdminInviteGroupFilter = 'pending' | 'registered';
export type AdminInviteRoleFilter = 'all' | 'mayor' | 'mdrrmo' | 'bdrrmo';
export type AdminInviteExpiryFilter = 'any' | 'soon';

export type AdminInvitePolicyRecord = {
  id: string;
  role: 'mayor' | 'officer';
  barangay_id: string | null;
  barangay_name: string | null;
  invited_email: string;
  expires_at: string;
  created_at: string;
  used_at: string | null;
};

export type InviteKindFormatter = (
  role: 'mayor' | 'officer',
  barangayId: string | null,
) => string;

type InviteDateFields = {
  created_at: string;
  used_at?: string | null;
};

export function isAdminInviteSnapshotFresh(
  lastLoadedAt: number | null,
  now = Date.now(),
): boolean {
  if (lastLoadedAt === null || !Number.isFinite(lastLoadedAt)) return false;
  const age = now - lastLoadedAt;
  return age >= 0 && age < ADMIN_INVITE_SNAPSHOT_TTL_MS;
}

export function isInviteActiveAt(expiresAt: string, now = Date.now()): boolean {
  const expiryTime = Date.parse(expiresAt);
  return Number.isFinite(expiryTime) && expiryTime > now;
}

export function isInviteExpiringSoon(expiresAt: string, now: number): boolean {
  const expiryTime = Date.parse(expiresAt);
  return (
    Number.isFinite(expiryTime) &&
    expiryTime > now &&
    expiryTime <= now + ADMIN_INVITE_EXPIRY_WINDOW_MS
  );
}

/** Return the next local time when an active invite enters or leaves the 48h window. */
export function nextInviteExpiryTransition(
  invites: Pick<AdminInvitePolicyRecord, 'expires_at'>[],
  now: number,
): number | null {
  let nextTransition = Number.POSITIVE_INFINITY;

  for (const invite of invites) {
    const expiryTime = Date.parse(invite.expires_at);
    if (!Number.isFinite(expiryTime) || expiryTime <= now) continue;

    if (expiryTime < nextTransition) nextTransition = expiryTime;

    const entersSoonWindowAt = expiryTime - ADMIN_INVITE_EXPIRY_WINDOW_MS;
    if (entersSoonWindowAt > now && entersSoonWindowAt < nextTransition) {
      nextTransition = entersSoonWindowAt;
    }
  }

  return Number.isFinite(nextTransition) ? nextTransition : null;
}

export type AdminInviteRoleCounts = {
  key: Exclude<AdminInviteRoleFilter, 'all'>;
  label: 'Mayor' | 'MDRRMO' | 'BDRRMO';
  pending: number;
  registered: number;
};

function roleKeyFromLabel(label: string): AdminInviteRoleCounts['key'] | null {
  switch (label) {
    case 'Mayor':
      return 'mayor';
    case 'MDRRMO':
      return 'mdrrmo';
    case 'BDRRMO':
      return 'bdrrmo';
    default:
      return null;
  }
}

export function summarizeInvitesByRole(
  pendingInvites: AdminInvitePolicyRecord[],
  registeredInvites: AdminInvitePolicyRecord[],
  now: number,
  formatInviteKind: InviteKindFormatter,
): AdminInviteRoleCounts[] {
  const counts: AdminInviteRoleCounts[] = [
    { key: 'mayor', label: 'Mayor', pending: 0, registered: 0 },
    { key: 'mdrrmo', label: 'MDRRMO', pending: 0, registered: 0 },
    { key: 'bdrrmo', label: 'BDRRMO', pending: 0, registered: 0 },
  ];

  const countPending = (invite: AdminInvitePolicyRecord) => {
    if (!isInviteActiveAt(invite.expires_at, now)) return;
    const key = roleKeyFromLabel(formatInviteKind(invite.role, invite.barangay_id));
    const roleCounts = counts.find((entry) => entry.key === key);
    if (roleCounts) roleCounts.pending += 1;
  };
  const countRegistered = (invite: AdminInvitePolicyRecord) => {
    const key = roleKeyFromLabel(formatInviteKind(invite.role, invite.barangay_id));
    const roleCounts = counts.find((entry) => entry.key === key);
    if (roleCounts) roleCounts.registered += 1;
  };

  for (const invite of pendingInvites) countPending(invite);
  for (const invite of registeredInvites) countRegistered(invite);
  return counts;
}

export function filterAdminInvites<TInvite extends AdminInvitePolicyRecord>(input: {
  pendingInvites: TInvite[];
  registeredInvites: TInvite[];
  group: AdminInviteGroupFilter;
  role: AdminInviteRoleFilter;
  expiry: AdminInviteExpiryFilter;
  search: string;
  now: number;
  formatInviteKind: InviteKindFormatter;
}): TInvite[] {
  const source =
    input.group === 'pending' ? input.pendingInvites : input.registeredInvites;
  const normalizedSearch = input.search.trim().toLowerCase();

  return source.filter((invite) => {
    if (
      input.group === 'pending' &&
      !isInviteActiveAt(invite.expires_at, input.now)
    ) {
      return false;
    }

    const kind = input.formatInviteKind(invite.role, invite.barangay_id);
    const normalizedKind = kind.toLowerCase();
    if (input.role !== 'all' && normalizedKind !== input.role) return false;

    if (
      input.group === 'pending' &&
      input.expiry === 'soon' &&
      !isInviteExpiringSoon(invite.expires_at, input.now)
    ) {
      return false;
    }

    if (!normalizedSearch) return true;
    const searchableText = [invite.invited_email, invite.barangay_name, kind]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchableText.includes(normalizedSearch);
  });
}

/** A request that began before a successful mutation cannot reconcile it. */
export function shouldApplyInviteListResult(
  requestMutationVersion: number,
  currentMutationVersion: number,
): boolean {
  return requestMutationVersion === currentMutationVersion;
}

export function inviteRecencyTimestamp(invite: InviteDateFields): number {
  const rawTimestamp = invite.used_at ?? invite.created_at;
  const timestamp = Date.parse(rawTimestamp);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/** Use structured Supabase/PostgREST status only; never infer authorization from message text. */
export function isAuthorizationFailure(
  code: string | null | undefined,
  status: number | null | undefined,
): boolean {
  if (status === 401 || status === 403) return true;
  return code === '42501' || code === '28000' || code === 'PGRST301' || code === 'PGRST302';
}
