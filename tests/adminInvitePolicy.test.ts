import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_INVITE_EXPIRY_WINDOW_MS,
  ADMIN_INVITE_SNAPSHOT_TTL_MS,
  filterAdminInvites,
  inviteRecencyTimestamp,
  isAdminInviteSnapshotFresh,
  isAuthorizationFailure,
  isInviteActiveAt,
  isInviteExpiringSoon,
  nextInviteExpiryTransition,
  summarizeInvitesByRole,
  shouldApplyInviteListResult,
  type AdminInvitePolicyRecord,
} from '../lib/adminInvitePolicy.ts';

const now = Date.parse('2026-11-09T12:00:00.000Z');

test('snapshot freshness lasts 60 seconds and rejects missing or future timestamps', () => {
  assert.equal(ADMIN_INVITE_SNAPSHOT_TTL_MS, 60_000);
  assert.equal(isAdminInviteSnapshotFresh(null, now), false);
  assert.equal(isAdminInviteSnapshotFresh(now - 59_999, now), true);
  assert.equal(isAdminInviteSnapshotFresh(now - 60_000, now), false);
  assert.equal(isAdminInviteSnapshotFresh(now + 1, now), false);
});

test('only valid unexpired timestamps remain in the local active list', () => {
  assert.equal(isInviteActiveAt('2026-11-09T12:00:01.000Z', now), true);
  assert.equal(isInviteActiveAt('2026-11-09T11:59:59.000Z', now), false);
  assert.equal(isInviteActiveAt('not-a-date', now), false);
});

test('a list response started before a mutation cannot replace reconciled state', () => {
  assert.equal(shouldApplyInviteListResult(3, 4), false);
  assert.equal(shouldApplyInviteListResult(4, 4), true);
});

test('recency falls back to creation time and treats malformed dates as oldest', () => {
  assert.equal(
    inviteRecencyTimestamp({
      created_at: '2026-11-08T12:00:00.000Z',
      used_at: '2026-11-09T11:00:00.000Z',
    }),
    Date.parse('2026-11-09T11:00:00.000Z'),
  );
  assert.equal(inviteRecencyTimestamp({ created_at: 'invalid', used_at: null }), 0);
});

test('authorization failures use structured codes/statuses, not error prose', () => {
  assert.equal(isAuthorizationFailure('42501', null), true);
  assert.equal(isAuthorizationFailure(null, 403), true);
  assert.equal(isAuthorizationFailure('XX000', 500), false);
  assert.equal(isAuthorizationFailure(null, null), false);
});

const formatInviteKind = (role: 'mayor' | 'officer', barangayId: string | null) => {
  if (role === 'mayor') return 'Mayor';
  return barangayId ? 'BDRRMO' : 'MDRRMO';
};

function invite(
  overrides: Partial<AdminInvitePolicyRecord> = {},
): AdminInvitePolicyRecord {
  return {
    id: 'invite-1',
    role: 'officer',
    barangay_id: null,
    barangay_name: null,
    invited_email: 'person@example.com',
    expires_at: '2026-11-10T12:00:00.000Z',
    created_at: '2026-11-01T12:00:00.000Z',
    used_at: null,
    ...overrides,
  };
}

test('48-hour expiry categorization includes the boundary and ignores malformed or used dates', () => {
  const boundary = now + ADMIN_INVITE_EXPIRY_WINDOW_MS;
  assert.equal(isInviteExpiringSoon(new Date(boundary).toISOString(), now), true);
  assert.equal(
    isInviteExpiringSoon(new Date(boundary + 1).toISOString(), now),
    false,
  );
  assert.equal(
    isInviteExpiringSoon('2026-11-09T11:59:59.000Z', now),
    false,
  );
  assert.equal(isInviteExpiringSoon('not-a-date', now), false);
});

test('next local refresh boundary includes entry into the soon window and expiration', () => {
  const future = now + ADMIN_INVITE_EXPIRY_WINDOW_MS + 15_000;
  const soonBoundary = future - ADMIN_INVITE_EXPIRY_WINDOW_MS;
  assert.equal(
    nextInviteExpiryTransition(
      [invite({ expires_at: new Date(future).toISOString() })],
      now,
    ),
    soonBoundary,
  );
  assert.equal(
    nextInviteExpiryTransition([invite({ expires_at: 'invalid' })], now),
    null,
  );
});

test('role summary uses invite kind mapping and keeps registered records despite old expiry', () => {
  const roles = summarizeInvitesByRole(
    [
      invite({ id: 'mayor', role: 'mayor' }),
      invite({ id: 'municipal', role: 'officer' }),
      invite({ id: 'barangay', role: 'officer', barangay_id: 'b-1' }),
      invite({ id: 'expired', expires_at: '2026-11-01T00:00:00.000Z' }),
    ],
    [
      invite({
        id: 'used-mayor',
        role: 'mayor',
        used_at: '2026-10-01T00:00:00.000Z',
        expires_at: '2026-10-02T00:00:00.000Z',
      }),
      invite({ id: 'used-bdr', barangay_id: 'b-2', used_at: new Date(now).toISOString() }),
    ],
    now,
    formatInviteKind,
  );

  assert.deepEqual(roles, [
    { key: 'mayor', label: 'Mayor', pending: 1, registered: 1 },
    { key: 'mdrrmo', label: 'MDRRMO', pending: 1, registered: 0 },
    { key: 'bdrrmo', label: 'BDRRMO', pending: 1, registered: 1 },
  ]);
});

test('combined invite filtering applies status, role, soon expiry, and local search', () => {
  const pendingInvites = [
    invite({
      id: 'matching',
      role: 'officer',
      barangay_id: 'b-1',
      barangay_name: 'Central',
      invited_email: 'north@example.com',
      expires_at: new Date(now + 30 * 60 * 60 * 1000).toISOString(),
    }),
    invite({
      id: 'wrong-role',
      role: 'mayor',
      expires_at: new Date(now + 10 * 60 * 60 * 1000).toISOString(),
    }),
    invite({
      id: 'not-soon',
      barangay_id: 'b-2',
      barangay_name: 'North',
      expires_at: new Date(now + 60 * 60 * 60 * 1000).toISOString(),
    }),
  ];
  const registeredInvites = [
    invite({ id: 'registered', used_at: new Date(now).toISOString(), barangay_id: 'b-1' }),
  ];

  const result = filterAdminInvites({
    pendingInvites,
    registeredInvites,
    group: 'pending',
    role: 'bdrrmo',
    expiry: 'soon',
    search: 'NORTH@EXAMPLE.COM',
    now,
    formatInviteKind,
  });

  assert.deepEqual(result.map((item) => item.id), ['matching']);
  assert.deepEqual(
    filterAdminInvites({
      pendingInvites,
      registeredInvites,
      group: 'registered',
      role: 'all',
      expiry: 'soon',
      search: 'central',
      now,
      formatInviteKind,
    }),
    [],
  );
});
