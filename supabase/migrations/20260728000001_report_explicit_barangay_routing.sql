-- Explicit barangay routing for resident reports.
-- Keeps the existing 8-argument create_report_with_media intact for
-- compatibility, and adds a 9-argument overload that accepts p_barangay_id.
-- When p_barangay_id is provided it must exist in public.barangays; when null,
-- the nearest-centroid resolver remains the legacy offline-queue fallback.

create or replace function public.create_report_with_media(
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

  -- Title is optional; description remains required.
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

  -- Explicit resident selection wins; null falls back to nearest centroid.
  if p_barangay_id is not null then
    if not exists (select 1 from public.barangays where id = p_barangay_id) then
      raise exception 'The selected barangay is no longer available. Please refresh and select it again.'
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

revoke all on function public.create_report_with_media(
  uuid, uuid, text, text, double precision, double precision, text, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.create_report_with_media(
  uuid, uuid, text, text, double precision, double precision, text, jsonb, uuid
) to service_role;
