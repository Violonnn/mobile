-- Storage policies are evaluated for every private-object read. The
-- announcement-media policy checks this table, so authenticated callers need
-- SELECT privilege in addition to the existing RLS policy.
grant select on table public.announcement_media to authenticated;
