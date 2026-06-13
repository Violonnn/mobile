-- Security hardening for registration profiles.
-- WHY: The mobile app must never write pin_hash or read it directly.
--      Only edge functions (service role) may insert/update the full row.

-- ---------------------------------------------------------------------------
-- 1. Remove client INSERT/UPDATE — blocks RLS bypass for pin_hash
-- ---------------------------------------------------------------------------
drop policy if exists "Users can insert own profile once" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

-- ---------------------------------------------------------------------------
-- 2. Safe view without pin_hash (preferred read path for the mobile app)
-- ---------------------------------------------------------------------------
create or replace view public.profiles_public
with (security_invoker = true) as
select
  id,
  phone,
  last_name,
  first_name,
  middle_name,
  birth_year,
  birth_month,
  barangay,
  municipality,
  registration_completed_at,
  created_at,
  updated_at
from public.profiles;

comment on view public.profiles_public is
  'Client-safe profile fields. pin_hash stays on profiles (server-only).';

grant select on public.profiles_public to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Hide pin_hash even if someone queries public.profiles directly
--    Column-level grants: authenticated users may read everything EXCEPT pin_hash.
-- ---------------------------------------------------------------------------
revoke all on public.profiles from authenticated, anon;

grant select (
  id,
  phone,
  last_name,
  first_name,
  middle_name,
  birth_year,
  birth_month,
  barangay,
  municipality,
  registration_completed_at,
  created_at,
  updated_at
) on public.profiles to authenticated;

-- Existing policy "Users can view own profile" still limits rows to auth.uid() = id.

-- ---------------------------------------------------------------------------
-- 4. Failed PIN login tracking (used by verify-login edge function)
--    No RLS policies = clients cannot read or write this table.
-- ---------------------------------------------------------------------------
create table if not exists public.login_attempts (
  phone text primary key,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.login_attempts enable row level security;

comment on table public.login_attempts is
  'Failed PIN attempts per phone. Only edge functions (service role) may access.';
