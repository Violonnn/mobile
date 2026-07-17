-- =====================================================================
-- Map data: hotlines, facilities, evacuation centers.
--
-- Ownership for evacuation centers:
--   MDRRMO / admin  -> create, manage, delete (full control)
--   BDRRMO          -> update STATUS of centers in their own barangay
--   mayor           -> flag is_priority
-- Column-scope for BDRRMO/mayor is enforced by an update-guard trigger,
-- since RLS alone cannot restrict WHICH columns change.
--
-- No barangay/date B-tree indexes here: these tables are small and mostly
-- static. Add them only if EXPLAIN later says otherwise. GIST stays for the
-- spatial predicates that map render + "near you" actually use.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'facility_type') then
    create type public.facility_type as enum
      ('rhu', 'hospital', 'fire_station', 'police_station',
       'barangay_hall', 'municipal_hall', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'hotline_category') then
    create type public.hotline_category as enum
      ('police', 'fire', 'medical', 'rescue', 'lgu', 'utility', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'evacuation_status') then
    create type public.evacuation_status as enum
      ('open', 'full', 'closed_temporarily');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. hotlines (no location column -- number directory; barangay optional)
-- ---------------------------------------------------------------------------
create table if not exists public.hotlines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  number text not null,
  category public.hotline_category not null default 'other',
  barangay_id uuid references public.barangays (id),  -- null = municipality-wide
  created_by uuid references public.app_profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hotlines_barangay on public.hotlines (barangay_id);

drop trigger if exists hotlines_updated_at on public.hotlines;
create trigger hotlines_updated_at
  before update on public.hotlines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. facilities
-- ---------------------------------------------------------------------------
create table if not exists public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.facility_type not null,
  location extensions.geography(Point, 4326) not null,
  address text,
  contact text,
  barangay_id uuid references public.barangays (id),
  created_by uuid references public.app_profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_facilities_location
  on public.facilities using gist (location);

drop trigger if exists facilities_updated_at on public.facilities;
create trigger facilities_updated_at
  before update on public.facilities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. evacuation_centers
-- ---------------------------------------------------------------------------
create table if not exists public.evacuation_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location extensions.geography(Point, 4326) not null,
  capacity integer,
  status public.evacuation_status not null default 'closed_temporarily',
  is_priority boolean not null default false,
  barangay_id uuid references public.barangays (id),
  managed_by uuid references public.app_profiles (id),
  last_updated_by uuid references public.app_profiles (id),
  last_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_evacuation_centers_location
  on public.evacuation_centers using gist (location);

drop trigger if exists evacuation_centers_updated_at on public.evacuation_centers;
create trigger evacuation_centers_updated_at
  before update on public.evacuation_centers
  for each row execute function public.set_updated_at();

-- Stamp who/when on every update, and enforce per-role column scope.
create or replace function public.guard_evacuation_center_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.last_updated_by := auth.uid();
  new.last_updated_at := now();

  -- Full control belongs to MDRRMO (center managers) and admin -- NOT mayor.
  if public.is_admin() or public.is_mdrrmo() then
    return new;
  end if;

  -- Mayor may only toggle is_priority.
  if public.is_mayor() then
    if new.name is distinct from old.name
       or new.location is distinct from old.location
       or new.capacity is distinct from old.capacity
       or new.status is distinct from old.status
       or new.barangay_id is distinct from old.barangay_id
       or new.managed_by is distinct from old.managed_by then
      raise exception 'Mayor may only change is_priority on evacuation centers.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- BDRRMO may only change status, and only for their own barangay.
  if public.is_bdrrmo() then
    if old.barangay_id is distinct from public.current_app_barangay_id() then
      raise exception 'BDRRMO may only update centers in their own barangay.'
        using errcode = '42501';
    end if;
    if new.name is distinct from old.name
       or new.location is distinct from old.location
       or new.capacity is distinct from old.capacity
       or new.is_priority is distinct from old.is_priority
       or new.barangay_id is distinct from old.barangay_id
       or new.managed_by is distinct from old.managed_by then
      raise exception 'BDRRMO may only change status on evacuation centers.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'Not permitted to update evacuation centers.'
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_evacuation_center_guard on public.evacuation_centers;
create trigger trg_evacuation_center_guard
  before update on public.evacuation_centers
  for each row execute function public.guard_evacuation_center_update();

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
alter table public.hotlines enable row level security;
alter table public.facilities enable row level security;
alter table public.evacuation_centers enable row level security;

-- All three are readable by any signed-in user (they are map layers).
drop policy if exists "Hotlines readable by authenticated" on public.hotlines;
create policy "Hotlines readable by authenticated"
  on public.hotlines for select to authenticated using (true);

drop policy if exists "Facilities readable by authenticated" on public.facilities;
create policy "Facilities readable by authenticated"
  on public.facilities for select to authenticated using (true);

drop policy if exists "Evac centers readable by authenticated" on public.evacuation_centers;
create policy "Evac centers readable by authenticated"
  on public.evacuation_centers for select to authenticated using (true);

-- hotlines / facilities writes: municipality-wide managers anywhere; BDRRMO
-- within their own barangay.
drop policy if exists "Officials write hotlines" on public.hotlines;
create policy "Officials write hotlines"
  on public.hotlines
  for all
  to authenticated
  using (
    public.can_manage_municipality()
    or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
  )
  with check (
    public.can_manage_municipality()
    or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
  );

drop policy if exists "Officials write facilities" on public.facilities;
create policy "Officials write facilities"
  on public.facilities
  for all
  to authenticated
  using (
    public.can_manage_municipality()
    or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
  )
  with check (
    public.can_manage_municipality()
    or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
  );

-- evacuation_centers: MDRRMO/admin create + delete; mayor (priority) and
-- BDRRMO (status, own barangay) update only. Column scope is enforced by the
-- guard trigger above; these policies are the row-level gate.
drop policy if exists "Managers create evac centers" on public.evacuation_centers;
create policy "Managers create evac centers"
  on public.evacuation_centers
  for insert
  to authenticated
  with check (public.is_admin() or public.is_mdrrmo());

drop policy if exists "Managers delete evac centers" on public.evacuation_centers;
create policy "Managers delete evac centers"
  on public.evacuation_centers
  for delete
  to authenticated
  using (public.is_admin() or public.is_mdrrmo());

drop policy if exists "Scoped officials update evac centers" on public.evacuation_centers;
create policy "Scoped officials update evac centers"
  on public.evacuation_centers
  for update
  to authenticated
  using (
    public.is_admin()
    or public.is_mdrrmo()
    or public.is_mayor()
    or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
  )
  with check (
    public.is_admin()
    or public.is_mdrrmo()
    or public.is_mayor()
    or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
  );

grant select, insert, update, delete on public.hotlines to authenticated;
grant select, insert, update, delete on public.facilities to authenticated;
grant select, insert, update, delete on public.evacuation_centers to authenticated;

grant select, insert, update, delete on public.hotlines to service_role;
grant select, insert, update, delete on public.facilities to service_role;
grant select, insert, update, delete on public.evacuation_centers to service_role;
