export type SmsChallengeProof = {
  verified_at: unknown;
  expires_at: unknown;
};

function timestampMilliseconds(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isTimestampInFuture(
  value: unknown,
  nowMilliseconds = Date.now(),
): boolean {
  const timestamp = timestampMilliseconds(value);
  return timestamp !== null && timestamp > nowMilliseconds;
}

/** A proof must be recorded before its expiry and remain valid at use time. */
export function isVerifiedSmsChallengeUsable(
  challenge: SmsChallengeProof | null | undefined,
  nowMilliseconds = Date.now(),
): boolean {
  if (!challenge) return false;

  const verifiedAt = timestampMilliseconds(challenge.verified_at);
  const expiresAt = timestampMilliseconds(challenge.expires_at);
  if (verifiedAt === null || expiresAt === null) return false;

  return verifiedAt <= nowMilliseconds && verifiedAt < expiresAt && expiresAt > nowMilliseconds;
}
