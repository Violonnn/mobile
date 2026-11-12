import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractInviteToken,
  MAX_INVITE_INPUT_LENGTH,
} from '../lib/inviteToken.ts';

const token = 'aB'.repeat(32);

test('accepts a raw opaque token without changing its case', () => {
  assert.deepEqual(extractInviteToken(`  ${token}  `), {
    token,
    error: null,
  });
});

test('accepts encoded custom, Expo Go, and HTTPS invitation URLs', () => {
  const encodedToken = [...token]
    .map((character) => `%${character.charCodeAt(0).toString(16)}`)
    .join('');
  const links = [
    `disasterlink://invite?token=${encodedToken}`,
    `exp://192.168.1.20:8081/--/invite?token=${encodeURIComponent(token)}`,
    `https://links.example.test/invite?token=${encodeURIComponent(token)}`,
  ];

  for (const link of links) {
    assert.deepEqual(extractInviteToken(link), { token, error: null });
  }
});

test('rejects malformed, missing, duplicate, and oversized token input', () => {
  const malformed = [
    'not-a-token',
    `https://links.example.test/invite?token=${'g'.repeat(64)}`,
    'disasterlink://invite',
    `disasterlink://invite?token=${token}&token=${token}`,
    `https://links.example.test/unrelated?token=${token}`,
  ];

  for (const input of malformed) {
    assert.equal(extractInviteToken(input).token, null);
  }

  const oversized = 'x'.repeat(MAX_INVITE_INPUT_LENGTH + 1);
  assert.match(extractInviteToken(oversized).error ?? '', /2048/);
});

test('URL claims do not change the opaque token returned for server validation', () => {
  const link =
    `https://untrusted.example.test/anything/invite?role=mayor&barangay_id=all&token=${token}`;

  assert.deepEqual(extractInviteToken(link), { token, error: null });
});
