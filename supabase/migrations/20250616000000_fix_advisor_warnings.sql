-- Supabase Security Advisor fixes (forward-only migration).
-- WHY: Clear two actionable Advisor warnings without editing migration history.
--   1. Function Search Path Mutable on public.handle_profiles_updated_at
--   2. Public / signed-in EXECUTE on the SECURITY DEFINER helper rls_auto_enable()
-- NOTE: Leaked Password Protection is a Pro+ dashboard setting; on the Free
--       plan that Advisor warning is expected to remain. See mobile/SECURITY.md.

-- ---------------------------------------------------------------------------
-- 1. Pin search_path on the updated_at trigger function.
--    Recreating with `create or replace` keeps the existing trigger wired.
-- ---------------------------------------------------------------------------
create or replace function public.handle_profiles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Remove client EXECUTE on rls_auto_enable() (not called by the app).
--    Only privileged roles (postgres / service_role / owner) keep access.
--    Guarded so this migration is a no-op if the helper is absent.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public;
    revoke execute on function public.rls_auto_enable() from anon, authenticated;
  end if;
end;
$$;
