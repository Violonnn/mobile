import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isTimestampInFuture,
  isVerifiedSmsChallengeUsable,
} from '../supabase/functions/_shared/official-invite-policy.ts';

const now = Date.parse('2026-11-09T12:00:00.000Z');

test('rejects missing, invalid, and expired challenge expiry timestamps', () => {
  assert.equal(isTimestampInFuture(null, now), false);
  assert.equal(isTimestampInFuture('not-a-date', now), false);
  assert.equal(isTimestampInFuture('2026-11-09T11:59:59.000Z', now), false);
  assert.equal(isTimestampInFuture('2026-11-09T12:00:01.000Z', now), true);
});

test('requires a current, valid verification timestamp and unexpired latest proof', () => {
  const futureExpiry = '2026-11-09T12:10:00.000Z';

  assert.equal(
    isVerifiedSmsChallengeUsable(
      { verified_at: null, expires_at: futureExpiry },
      now,
    ),
    false,
  );
  assert.equal(
    isVerifiedSmsChallengeUsable(
      { verified_at: 'invalid', expires_at: futureExpiry },
      now,
    ),
    false,
  );
  assert.equal(
    isVerifiedSmsChallengeUsable(
      {
        verified_at: '2026-11-09T11:59:00.000Z',
        expires_at: '2026-11-09T11:59:59.000Z',
      },
      now,
    ),
    false,
  );
  assert.equal(
    isVerifiedSmsChallengeUsable(
      {
        verified_at: '2026-11-09T11:59:00.000Z',
        expires_at: futureExpiry,
      },
      now,
    ),
    true,
  );
});
