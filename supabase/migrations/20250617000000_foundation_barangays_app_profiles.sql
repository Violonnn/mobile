-- =====================================================================
-- DisasterLink foundation: barangays lookup + shared role-bearing
-- app_profiles identity, RLS helper functions, and the resident bridge
-- from the existing phone/PIN `profiles` table.
--
-- WHY a separate app_profiles table:
--   The existing `profiles` table (20250613000000) stays as resident-only
--   PRIVATE registration detail (pin_hash, birth data, phone). Officials
--   register via email + password and cannot fit its NOT NULL resident
--   columns. app_profiles is the single role-bearing identity every
--   authenticated user has, and the only source RLS reads for role/scope.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
--    PostGIS -> geography columns for map + "near you" queries.
--    pgcrypto -> digest() for hashing invite tokens (migration 2).
--    Installed in the dedicated `extensions` schema (Supabase convention).
-- ---------------------------------------------------------------------------
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Generic updated_at trigger (search_path pinned per Security Advisor).
--    Reused by every new table that carries an updated_at column.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
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
-- 2. Enums shared across the schema.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('resident', 'officer', 'mayor', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum ('active', 'suspended');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Barangays lookup (19 barangays of Minglanilla, Cebu).
--    centroid is nullable: a real reference point can be added later and
--    is used as the nearest-centroid fallback for report barangay routing.
--    No GIST index here on purpose -- a static 19-row table gains nothing.
-- ---------------------------------------------------------------------------
create table if not exists public.barangays (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  municipality text not null default 'Minglanilla',
  centroid extensions.geography(Point, 4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Canonical names mirror the registration dropdown
-- (mobile/components/register/DetailsStep.tsx). Keep the two in sync.
insert into public.barangays (name)
values
  ('Cadulawan'), ('Calajo-an'), ('Camp 7'), ('Camp 8'), ('Cuanos'),
  ('Guindaruhan'), ('Linao-Lipata'), ('Manduang'), ('Pakigne'),
  ('Poblacion Ward I'), ('Poblacion Ward II'), ('Poblacion Ward III'),
  ('Poblacion Ward IV'), ('Tubod'), ('Tulay'), ('Tunghaan'),
  ('Tungkil'), ('Tungkop'), ('Vito')
on conflict (name) do nothing;

alter table public.barangays enable row level security;

-- Everyone signed in may read the lookup (needed for map + dropdowns).
drop policy if exists "Barangays readable by authenticated" on public.barangays;
create policy "Barangays readable by authenticated"
  on public.barangays
  for select
  to authenticated
  using (true);

-- Writes are rare/static -> service_role only (no authenticated write policy).
grant select on public.barangays to authenticated;
grant select, insert, update, delete on public.barangays to service_role;

-- ---------------------------------------------------------------------------
-- 4. Shared identity: app_profiles (one row per auth user, all roles).
--    email / phone_number are official contact PII and are NEVER exposed
--    to the authenticated role (column-level grants below hide them).
-- ---------------------------------------------------------------------------
create table if not exists public.app_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'resident',
  first_name text not null,
  last_name text not null,
  middle_name text,
  email text,
  phone_number text,
  barangay_id uuid references public.barangays (id),
  status public.account_status not null default 'active',
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- BDRRMO = officer with a barangay; MDRRMO = officer with none.
  -- mayor/admin are always municipality-wide (no barangay scope).
  constraint app_profiles_barangay_scope check (
    role = 'officer' or role = 'resident' or barangay_id is null
  )
);

create index if not exists idx_app_profiles_role on public.app_profiles (role);
create index if not exists idx_app_profiles_barangay on public.app_profiles (barangay_id);

drop trigger if exists app_profiles_updated_at on public.app_profiles;
create trigger app_profiles_updated_at
  before update on public.app_profiles
  for each row execute function public.set_updated_at();

alter table public.app_profiles enable row level security;

-- Row visibility: any signed-in user may read identity rows so the feed can
-- attribute reports/comments and show who verified a report. Column grants
-- (below) ensure email/phone are never returned to the authenticated role.
drop policy if exists "App profiles readable by authenticated" on public.app_profiles;
create policy "App profiles readable by authenticated"
  on public.app_profiles
  for select
  to authenticated
  using (true);

-- All writes go through server contexts (invite redemption RPC / resident
-- sync trigger / service_role). No authenticated INSERT/UPDATE/DELETE policy.

-- Hide email/phone from clients even on a direct select of app_profiles.
revoke all on public.app_profiles from authenticated, anon;
grant select (
  id, role, first_name, last_name, middle_name,
  barangay_id, status, email_verified_at, created_at, updated_at
) on public.app_profiles to authenticated;
grant select, insert, update, delete on public.app_profiles to service_role;

-- Client-safe projection (no email/phone). Mirrors profiles_public.
create or replace view public.app_profiles_public
with (security_invoker = true) as
select
  id, role, first_name, last_name, middle_name,
  barangay_id, status, created_at, updated_at
from public.app_profiles;

comment on view public.app_profiles_public is
  'Client-safe identity fields for attribution. email/phone stay server-only.';

grant select on public.app_profiles_public to authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS helper functions.
--    STABLE  -> Postgres evaluates once per statement, not once per row.
--    SECURITY DEFINER -> reads app_profiles WITHOUT triggering app_profiles
--                        RLS, which is what avoids recursive policy lookups.
--    search_path = '' -> Advisor-clean; all names fully qualified.
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role from public.app_profiles where id = auth.uid()),
    'resident'::public.app_role
  );
$$;

create or replace function public.current_app_barangay_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select barangay_id from public.app_profiles where id = auth.uid();
$$;

-- Thin, readable role predicates built on the two definer helpers above.
create or replace function public.is_admin()
returns boolean language sql stable set search_path = '' as $$
  select public.current_app_role() = 'admin';
$$;

create or replace function public.is_mayor()
returns boolean language sql stable set search_path = '' as $$
  select public.current_app_role() = 'mayor';
$$;

create or replace function public.is_officer()
returns boolean language sql stable set search_path = '' as $$
  select public.current_app_role() = 'officer';
$$;

-- MDRRMO = municipality-wide officer (no barangay).
create or replace function public.is_mdrrmo()
returns boolean language sql stable set search_path = '' as $$
  select public.current_app_role() = 'officer'
     and public.current_app_barangay_id() is null;
$$;

-- BDRRMO = barangay-scoped officer.
create or replace function public.is_bdrrmo()
returns boolean language sql stable set search_path = '' as $$
  select public.current_app_role() = 'officer'
     and public.current_app_barangay_id() is not null;
$$;

-- Anyone with municipality-wide authority: mayor, admin, or MDRRMO.
create or replace function public.can_manage_municipality()
returns boolean language sql stable set search_path = '' as $$
  select public.current_app_role() in ('mayor', 'admin')
      or public.is_mdrrmo();
$$;

-- Any official (non-resident).
create or replace function public.is_official()
returns boolean language sql stable set search_path = '' as $$
  select public.current_app_role() in ('officer', 'mayor', 'admin');
$$;

-- Only signed-in users evaluate these under RLS.
revoke execute on function
  public.current_app_role(),
  public.current_app_barangay_id(),
  public.is_admin(),
  public.is_mayor(),
  public.is_officer(),
  public.is_mdrrmo(),
  public.is_bdrrmo(),
  public.can_manage_municipality(),
  public.is_official()
from public, anon;

grant execute on function
  public.current_app_role(),
  public.current_app_barangay_id(),
  public.is_admin(),
  public.is_mayor(),
  public.is_officer(),
  public.is_mdrrmo(),
  public.is_bdrrmo(),
  public.can_manage_municipality(),
  public.is_official()
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Bridge the existing resident `profiles` into the new model.
--    (a) add barangay_id FK + backfill from the free-text barangay,
--    (b) keep it in sync on future writes,
--    (c) create/refresh a matching resident app_profiles row so resident
--        reporters satisfy the reports.reporter_id FK and carry a role.
--
--    IMPORTANT (pre-apply audit): confirm every distinct profiles.barangay
--    value exact-matches a public.barangays.name row BEFORE running this in
--    a shared/prod DB, or those residents backfill to a NULL barangay_id
--    and silently drop out of their BDRRMO's queue. Run:
--        select barangay, count(*) from public.profiles group by barangay;
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists barangay_id uuid references public.barangays (id);

create index if not exists idx_profiles_barangay_id on public.profiles (barangay_id);

update public.profiles p
   set barangay_id = b.id
  from public.barangays b
 where b.name = p.barangay
   and p.barangay_id is null;

-- Keep profiles.barangay_id resolved from the text value on any write.
create or replace function public.set_profile_barangay_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select id into new.barangay_id
    from public.barangays
   where name = new.barangay;
  return new;
end;
$$;

drop trigger if exists trg_profiles_set_barangay on public.profiles;
create trigger trg_profiles_set_barangay
  before insert or update of barangay on public.profiles
  for each row execute function public.set_profile_barangay_id();

-- Mirror resident registration into app_profiles (role = resident).
-- Runs in the service_role context of complete-registration, so the
-- existing edge function keeps working untouched.
create or replace function public.sync_resident_app_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_profiles (
    id, role, first_name, last_name, middle_name, barangay_id, status
  )
  values (
    new.id, 'resident', new.first_name, new.last_name,
    nullif(new.middle_name, ''), new.barangay_id, 'active'
  )
  on conflict (id) do update
    set first_name  = excluded.first_name,
        last_name   = excluded.last_name,
        middle_name = excluded.middle_name,
        barangay_id = excluded.barangay_id,
        updated_at  = now()
  -- Never downgrade an account that was later promoted to an official.
  where app_profiles.role = 'resident';
  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_app_profile on public.profiles;
create trigger trg_profiles_sync_app_profile
  after insert or update on public.profiles
  for each row execute function public.sync_resident_app_profile();

-- One-time backfill for residents who registered before this migration.
insert into public.app_profiles (
  id, role, first_name, last_name, middle_name, barangay_id, status
)
select
  p.id, 'resident', p.first_name, p.last_name,
  nullif(p.middle_name, ''), p.barangay_id, 'active'
from public.profiles p
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 7. Interactive query ceiling. Cheap insurance against runaway queries.
--    Analytics/PDF export must NOT rely on this: it runs through a scoped
--    RPC that raises the timeout transaction-locally (migration 7).
-- ---------------------------------------------------------------------------
alter role authenticated set statement_timeout = '5s';
