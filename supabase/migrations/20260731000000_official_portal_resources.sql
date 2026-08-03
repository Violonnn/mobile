-- =====================================================================
-- Official portal resources + scoped moderation + official-report RPCs.
--
-- Extends hotlines/facilities with verification metadata, tightens write
-- RLS so Mayor cannot edit directory records, scopes comment moderation,
-- blocks direct client inserts of official reports (Edge Functions only),
-- and publishes resource/announcement tables to Realtime.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. Enum: national_emergency hotline category (e.g. 911)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'hotline_category'
      and e.enumlabel = 'national_emergency'
  ) then
    alter type public.hotline_category add value 'national_emergency';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. hotlines: active flag, verification stamps, optional facility link
-- ---------------------------------------------------------------------------
alter table public.hotlines
  add column if not exists is_active boolean not null default true,
  add column if not exists last_verified_at timestamptz,
  add column if not exists last_verified_by uuid references public.app_profiles (id),
  add column if not exists facility_id uuid references public.facilities (id);

create index if not exists idx_hotlines_active
  on public.hotlines (is_active)
  where is_active = true;

create index if not exists idx_hotlines_facility
  on public.hotlines (facility_id)
  where facility_id is not null;

-- ---------------------------------------------------------------------------
-- 3. facilities: active flag + verification stamps
-- ---------------------------------------------------------------------------
alter table public.facilities
  add column if not exists is_active boolean not null default true,
  add column if not exists last_verified_at timestamptz,
  add column if not exists last_verified_by uuid references public.app_profiles (id);

create index if not exists idx_facilities_active
  on public.facilities (is_active)
  where is_active = true;

-- Map-friendly lat/lng projection (mirrors reports_map pattern).
create or replace view public.facilities_map
with (security_invoker = true) as
select
  f.id,
  f.name,
  f.type,
  f.address,
  f.contact,
  f.barangay_id,
  f.is_active,
  f.last_verified_at,
  f.last_verified_by,
  f.created_by,
  f.created_at,
  f.updated_at,
  extensions.st_y(f.location::extensions.geometry) as latitude,
  extensions.st_x(f.location::extensions.geometry) as longitude
from public.facilities f;

comment on view public.facilities_map is
  'Facilities with latitude/longitude for map layers via PostgREST.';

grant select on public.facilities_map to authenticated;

create or replace view public.evacuation_centers_map
with (security_invoker = true) as
select
  e.id,
  e.name,
  e.capacity,
  e.status,
  e.is_priority,
  e.barangay_id,
  e.managed_by,
  e.last_updated_by,
  e.last_updated_at,
  e.created_at,
  e.updated_at,
  extensions.st_y(e.location::extensions.geometry) as latitude,
  extensions.st_x(e.location::extensions.geometry) as longitude
from public.evacuation_centers e;

comment on view public.evacuation_centers_map is
  'Evacuation centers with latitude/longitude for map layers via PostgREST.';

grant select on public.evacuation_centers_map to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Stamp creator/verifier; block audit spoofing and ownership changes
-- ---------------------------------------------------------------------------
create or replace function public.guard_hotline_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    -- First insert counts as the initial verification by the authoring officer.
    new.last_verified_by := auth.uid();
    new.last_verified_at := coalesce(new.last_verified_at, now());
    return new;
  end if;

  -- Ownership / identity columns are immutable after create.
  if new.created_by is distinct from old.created_by then
    raise exception 'Hotline created_by cannot be changed.'
      using errcode = '42501';
  end if;

  -- Always stamp the verifier from the session; never trust client values.
  if new.is_active is distinct from old.is_active
     or new.name is distinct from old.name
     or new.number is distinct from old.number
     or new.category is distinct from old.category
     or new.barangay_id is distinct from old.barangay_id
     or new.facility_id is distinct from old.facility_id
     or new.last_verified_at is distinct from old.last_verified_at
     or new.last_verified_by is distinct from old.last_verified_by then
    new.last_verified_by := auth.uid();
    new.last_verified_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_hotline_write_guard on public.hotlines;
create trigger trg_hotline_write_guard
  before insert or update on public.hotlines
  for each row execute function public.guard_hotline_write();

create or replace function public.guard_facility_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.last_verified_by := auth.uid();
    new.last_verified_at := coalesce(new.last_verified_at, now());
    return new;
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'Facility created_by cannot be changed.'
      using errcode = '42501';
  end if;

  if new.is_active is distinct from old.is_active
     or new.name is distinct from old.name
     or new.type is distinct from old.type
     or new.location is distinct from old.location
     or new.address is distinct from old.address
     or new.contact is distinct from old.contact
     or new.barangay_id is distinct from old.barangay_id
     or new.last_verified_at is distinct from old.last_verified_at
     or new.last_verified_by is distinct from old.last_verified_by then
    new.last_verified_by := auth.uid();
    new.last_verified_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_facility_write_guard on public.facilities;
create trigger trg_facility_write_guard
  before insert or update on public.facilities
  for each row execute function public.guard_facility_write();

-- ---------------------------------------------------------------------------
-- 5. Hotline / facility RLS: exclude Mayor; BDRRMO own barangay only
-- ---------------------------------------------------------------------------
drop policy if exists "Officials write hotlines" on public.hotlines;
create policy "Officers write hotlines"
  on public.hotlines
  for all
  to authenticated
  using (
    public.is_admin()
    or public.is_mdrrmo()
    or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
  )
  with check (
    public.is_admin()
    or public.is_mdrrmo()
    or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
  );

drop policy if exists "Officials write facilities" on public.facilities;
create policy "Officers write facilities"
  on public.facilities
  for all
  to authenticated
  using (
    public.is_admin()
    or public.is_mdrrmo()
    or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
  )
  with check (
    public.is_admin()
    or public.is_mdrrmo()
    or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
  );

-- Evacuation-center ownership stays as defined in 20250617000300:
-- MDRRMO/admin create/delete; Mayor is_priority only; BDRRMO status in barangay.

-- ---------------------------------------------------------------------------
-- 6. Scoped comment moderation (BDRRMO barangay / MDRRMO+admin muni; Mayor RO)
-- ---------------------------------------------------------------------------
create or replace function public.can_moderate_report_comment(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_admin()
    or public.is_mdrrmo()
    or (
      public.is_bdrrmo()
      and exists (
        select 1
        from public.reports r
        where r.id = p_report_id
          and r.barangay_id = public.current_app_barangay_id()
      )
    );
$$;

revoke all on function public.can_moderate_report_comment(uuid) from public, anon;
grant execute on function public.can_moderate_report_comment(uuid) to authenticated;

-- Authors may still edit their own body; officials only flip moderation fields.
create or replace function public.guard_comment_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Author editing own comment body (not moderation).
  if new.user_id = auth.uid()
     and new.is_hidden is not distinct from old.is_hidden
     and new.hidden_by is not distinct from old.hidden_by
     and new.hidden_at is not distinct from old.hidden_at then
    return new;
  end if;

  -- Moderation path: only scoped officers; stamp hidden_by/at.
  if not public.can_moderate_report_comment(old.report_id) then
    raise exception 'Not permitted to moderate this comment.'
      using errcode = '42501';
  end if;

  -- Moderators may only change hide fields — never body or ownership.
  if new.body is distinct from old.body
     or new.user_id is distinct from old.user_id
     or new.report_id is distinct from old.report_id
     or new.parent_comment_id is distinct from old.parent_comment_id then
    raise exception 'Moderators may only change comment visibility.'
      using errcode = '42501';
  end if;

  if new.is_hidden is distinct from old.is_hidden then
    if new.is_hidden then
      new.hidden_by := auth.uid();
      new.hidden_at := now();
    else
      new.hidden_by := null;
      new.hidden_at := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_comment_moderation_guard on public.comments;
create trigger trg_comment_moderation_guard
  before update on public.comments
  for each row execute function public.guard_comment_moderation();

drop policy if exists "Authors edit or officials moderate comments" on public.comments;
create policy "Authors edit or officers moderate comments"
  on public.comments
  for update
  to authenticated
  using (
    user_id = auth.uid()
    or public.can_moderate_report_comment(report_id)
  )
  with check (
    user_id = auth.uid()
    or public.can_moderate_report_comment(report_id)
  );

-- ---------------------------------------------------------------------------
-- 7. Restrict direct client report inserts to residents only.
--    Official field reports go through create-official-report Edge Function.
-- ---------------------------------------------------------------------------
drop policy if exists "Users create own reports" on public.reports;
create policy "Residents create own reports"
  on public.reports
  for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and public.current_app_role() = 'resident'
  );

-- ---------------------------------------------------------------------------
-- 8. Official report RPCs (service_role / Edge Functions only)
-- ---------------------------------------------------------------------------
create or replace function public.create_official_report_with_media(
  p_reporter_id uuid,
  p_report_id uuid,
  p_title text,
  p_description text,
  p_latitude double precision,
  p_longitude double precision,
  p_address_text text,
  p_media jsonb,
  p_barangay_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report_id uuid;
  v_barangay_id uuid;
  v_role public.app_role;
  v_status public.account_status;
  v_officer_barangay uuid;
  v_item jsonb;
  v_media_id uuid;
  v_type text;
  v_path text;
  v_duration numeric;
  v_position smallint := 0;
begin
  if p_reporter_id is null then
    raise exception 'Reporter is required.' using errcode = '22023';
  end if;

  select role, status, barangay_id
    into v_role, v_status, v_officer_barangay
  from public.app_profiles
  where id = p_reporter_id;

  if v_role is null then
    raise exception 'Reporter profile not found.' using errcode = 'P0002';
  end if;

  -- Active officers only — Mayor and residents cannot use this path.
  if v_role <> 'officer' or v_status <> 'active' then
    raise exception 'Only active officers can log official incidents.'
      using errcode = '42501';
  end if;

  if nullif(trim(p_description), '') is null then
    raise exception 'Description is required.' using errcode = '22023';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Valid latitude and longitude are required.' using errcode = '22023';
  end if;

  -- Media is optional for officials; empty array is allowed.
  if p_media is null or jsonb_typeof(p_media) <> 'array' then
    raise exception 'Media must be a JSON array.' using errcode = '22023';
  end if;

  -- BDRRMO must stay inside their barangay; MDRRMO may pass any valid id.
  if v_officer_barangay is not null then
    if p_barangay_id is not null and p_barangay_id is distinct from v_officer_barangay then
      raise exception 'BDRRMO may only log incidents in their own barangay.'
        using errcode = '42501';
    end if;
    v_barangay_id := v_officer_barangay;
  elsif p_barangay_id is not null then
    if not exists (select 1 from public.barangays where id = p_barangay_id) then
      raise exception 'The selected barangay is no longer available.'
        using errcode = '22023';
    end if;
    v_barangay_id := p_barangay_id;
  else
    v_barangay_id := public.resolve_barangay_id(p_latitude, p_longitude);
  end if;

  v_report_id := coalesce(p_report_id, gen_random_uuid());

  insert into public.reports (
    id,
    reporter_id,
    title,
    description,
    location,
    address_text,
    barangay_id
  ) values (
    v_report_id,
    p_reporter_id,
    trim(coalesce(p_title, '')),
    trim(p_description),
    extensions.st_setsrid(
      extensions.st_makepoint(p_longitude, p_latitude),
      4326
    )::extensions.geography,
    nullif(trim(coalesce(p_address_text, '')), ''),
    v_barangay_id
  );

  for v_item in select * from jsonb_array_elements(p_media)
  loop
    v_media_id := (v_item->>'id')::uuid;
    v_type := v_item->>'type';
    v_path := trim(v_item->>'storagePath');
    v_duration := nullif(v_item->>'durationSeconds', '')::numeric;

    if v_media_id is null or v_path is null or v_path = '' then
      raise exception 'Each media item needs id and storagePath.' using errcode = '22023';
    end if;

    if v_type not in ('photo', 'video') then
      raise exception 'Invalid media type: %', v_type using errcode = '22023';
    end if;

    insert into public.report_media (
      id,
      report_id,
      type,
      storage_path,
      duration_seconds,
      position
    ) values (
      v_media_id,
      v_report_id,
      v_type::public.media_type,
      v_path,
      case when v_type = 'video' then v_duration else null end,
      v_position
    );

    v_position := v_position + 1;
  end loop;

  return v_report_id;
end;
$$;

revoke all on function public.create_official_report_with_media(
  uuid, uuid, text, text, double precision, double precision, text, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.create_official_report_with_media(
  uuid, uuid, text, text, double precision, double precision, text, jsonb, uuid
) to service_role;

create or replace function public.update_official_report_fields(
  p_actor_id uuid,
  p_report_id uuid,
  p_title text,
  p_description text,
  p_latitude double precision,
  p_longitude double precision,
  p_address_text text,
  p_barangay_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_status public.account_status;
  v_officer_barangay uuid;
  v_reporter_id uuid;
  v_barangay_id uuid;
begin
  if p_actor_id is null or p_report_id is null then
    raise exception 'Actor and report id are required.' using errcode = '22023';
  end if;

  select role, status, barangay_id
    into v_role, v_status, v_officer_barangay
  from public.app_profiles
  where id = p_actor_id;

  if v_role is null or v_role <> 'officer' or v_status <> 'active' then
    raise exception 'Only active officers can edit official incidents.'
      using errcode = '42501';
  end if;

  select reporter_id, barangay_id
    into v_reporter_id, v_barangay_id
  from public.reports
  where id = p_report_id;

  if v_reporter_id is null then
    raise exception 'Report not found.' using errcode = 'P0002';
  end if;

  if v_reporter_id is distinct from p_actor_id then
    raise exception 'Only the authoring official may edit this incident.'
      using errcode = '42501';
  end if;

  if nullif(trim(p_description), '') is null then
    raise exception 'Description is required.' using errcode = '22023';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Valid latitude and longitude are required.' using errcode = '22023';
  end if;

  if v_officer_barangay is not null then
    if p_barangay_id is not null and p_barangay_id is distinct from v_officer_barangay then
      raise exception 'BDRRMO may only keep incidents in their own barangay.'
        using errcode = '42501';
    end if;
    v_barangay_id := v_officer_barangay;
  elsif p_barangay_id is not null then
    if not exists (select 1 from public.barangays where id = p_barangay_id) then
      raise exception 'The selected barangay is no longer available.'
        using errcode = '22023';
    end if;
    v_barangay_id := p_barangay_id;
  end if;

  -- Content-only update; status/audit columns stay untouched (guard trigger).
  update public.reports
     set title = trim(coalesce(p_title, '')),
         description = trim(p_description),
         location = extensions.st_setsrid(
           extensions.st_makepoint(p_longitude, p_latitude),
           4326
         )::extensions.geography,
         address_text = nullif(trim(coalesce(p_address_text, '')), ''),
         barangay_id = v_barangay_id
   where id = p_report_id;

  return p_report_id;
end;
$$;

revoke all on function public.update_official_report_fields(
  uuid, uuid, text, text, double precision, double precision, text, uuid
) from public, anon, authenticated;
grant execute on function public.update_official_report_fields(
  uuid, uuid, text, text, double precision, double precision, text, uuid
) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Realtime: resource + announcement tables for live official/resident UIs
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'hotlines'
  ) then
    alter publication supabase_realtime add table public.hotlines;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'facilities'
  ) then
    alter publication supabase_realtime add table public.facilities;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'evacuation_centers'
  ) then
    alter publication supabase_realtime add table public.evacuation_centers;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'announcements'
  ) then
    alter publication supabase_realtime add table public.announcements;
  end if;
end;
$$;

-- National 911 seed lives in 20260731000001 so the new enum value is
-- visible after this migration commits (Postgres ADD VALUE rule).