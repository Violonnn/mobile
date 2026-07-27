-- Hide invite token hashes from direct client selects.
-- Listing goes through list_official_invites(), which never returns the hash.

revoke all on public.invites from authenticated;
grant select (
  id,
  role,
  barangay_id,
  created_by,
  expires_at,
  used_at,
  used_by,
  revoked_at,
  is_revoked,
  created_at
) on public.invites to authenticated;
