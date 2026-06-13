-- Edge functions use the service_role key via PostgREST.
-- Table-level GRANTs are required even though service_role bypasses RLS.
-- Without these, complete-registration and verify-login fail at runtime.

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.login_attempts to service_role;
