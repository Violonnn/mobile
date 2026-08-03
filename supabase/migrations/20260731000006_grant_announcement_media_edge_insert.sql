-- The create-official-announcement Edge Function inserts attachment rows with
-- service_role after it has verified the caller, role, path, and media limits.
grant select, insert on table public.announcement_media to service_role;
