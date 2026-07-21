-- =====================================================================
-- Create-report helpers + map-friendly report projection.
--
-- - resolve_barangay_id: nearest barangay centroid for GPS routing
-- - create_report_with_media: single-transaction insert (report + media)
--   so deferred resident media rules evaluate at COMMIT correctly
-- - reports_map: lat/lng columns for Leaflet markers via PostgREST
-- - Seed approximate centroids for Minglanilla barangays (dev/demo)
-- - report_create_attempts: sliding-window rate limit for create-report
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. Approximate centroids (WGS84). Good enough for nearest-barangay routing
--    in demos; replace with surveyed points for production.
-- ---------------------------------------------------------------------------
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.7967, 10.2447), 4326)::extensions.geography where name = 'Poblacion Ward I';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.7985, 10.2460), 4326)::extensions.geography where name = 'Poblacion Ward II';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.7950, 10.2430), 4326)::extensions.geography where name = 'Poblacion Ward III';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.8000, 10.2420), 4326)::extensions.geography where name = 'Poblacion Ward IV';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.7800, 10.2550), 4326)::extensions.geography where name = 'Cadulawan';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.8100, 10.2600), 4326)::extensions.geography where name = 'Calajo-an';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.7700, 10.2300), 4326)::extensions.geography where name = 'Camp 7';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.7650, 10.2200), 4326)::extensions.geography where name = 'Camp 8';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.8200, 10.2500), 4326)::extensions.geography where name = 'Cuanos';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.8300, 10.2400), 4326)::extensions.geography where name = 'Guindaruhan';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.7850, 10.2350), 4326)::extensions.geography where name = 'Linao-Lipata';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.8050, 10.2300), 4326)::extensions.geography where name = 'Manduang';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.8150, 10.2450), 4326)::extensions.geography where name = 'Pakigne';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.7900, 10.2600), 4326)::extensions.geography where name = 'Tubod';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.7750, 10.2450), 4326)::extensions.geography where name = 'Tulay';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.8000, 10.2550), 4326)::extensions.geography where name = 'Tunghaan';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.8250, 10.2350), 4326)::extensions.geography where name = 'Tungkil';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.8350, 10.2550), 4326)::extensions.geography where name = 'Tungkop';
update public.barangays set centroid = extensions.st_setsrid(extensions.st_makepoint(123.7600, 10.2500), 4326)::extensions.geography where name = 'Vito';

-- ---------------------------------------------------------------------------
-- 2. Nearest-centroid barangay resolver
-- ---------------------------------------------------------------------------
create or replace function public.resolve_barangay_id(
  p_latitude double precision,
  p_longitude double precision
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id
  from public.barangays b
  where b.centroid is not null
  order by extensions.st_distance(
    b.centroid,
    extensions.st_setsrid(
      extensions.st_makepoint(p_longitude, p_latitude),
      4326
    )::extensions.geography
  )
  limit 1;
$$;

revoke all on function public.resolve_barangay_id(double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.resolve_barangay_id(double precision, double precision)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3. Single-transaction report + media create (service_role / Edge Function)
-- ---------------------------------------------------------------------------
create or replace function public.create_report_with_media(
  p_reporter_id uuid,
  p_report_id uuid,
  p_title text,
  p_description text,
  p_latitude double precision,
  p_longitude double precision,
  p_address_text text,
  p_media jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report_id uuid;
  v_barangay_id uuid;
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

  if nullif(trim(p_title), '') is null then
    raise exception 'Title is required.' using errcode = '22023';
  end if;

  if nullif(trim(p_description), '') is null then
    raise exception 'Description is required.' using errcode = '22023';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Valid latitude and longitude are required.' using errcode = '22023';
  end if;

  if p_media is null or jsonb_typeof(p_media) <> 'array' or jsonb_array_length(p_media) < 1 then
    raise exception 'At least one media item is required.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.app_profiles where id = p_reporter_id) then
    raise exception 'Reporter profile not found.' using errcode = 'P0002';
  end if;

  v_barangay_id := public.resolve_barangay_id(p_latitude, p_longitude);
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
    trim(p_title),
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

revoke all on function public.create_report_with_media(
  uuid, uuid, text, text, double precision, double precision, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_report_with_media(
  uuid, uuid, text, text, double precision, double precision, text, jsonb
) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Map projection (authenticated read)
-- ---------------------------------------------------------------------------
create or replace view public.reports_map
with (security_invoker = true)
as
select
  r.id,
  r.title,
  r.status,
  r.barangay_id,
  r.created_at,
  extensions.st_y(r.location::extensions.geometry) as latitude,
  extensions.st_x(r.location::extensions.geometry) as longitude
from public.reports r;

comment on view public.reports_map is
  'Report pins for the resident map: id, title, status, lat/lng.';

grant select on public.reports_map to authenticated;
grant select on public.reports_map to service_role;

-- ---------------------------------------------------------------------------
-- 5. Create-report rate-limit table (Edge Function / service_role only)
-- ---------------------------------------------------------------------------
create table if not exists public.report_create_attempts (
  reporter_id uuid primary key references public.app_profiles (id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.report_create_attempts enable row level security;
-- No authenticated policies — service_role only.

grant select, insert, update, delete on public.report_create_attempts to service_role;
