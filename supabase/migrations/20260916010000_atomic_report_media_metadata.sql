-- Store verified report-media derivatives in the same transaction as the
-- report. Realtime consumers must never observe a committed report before its
-- feed thumbnail/display metadata is available.

-- Repair recent rows created during the old two-step write. Only record a
-- derived path when that object is already present in the private bucket.
update public.report_media as media
set thumbnail_storage_path = regexp_replace(
  media.storage_path,
  '/original[.][^/]+$',
  '/thumbnail.jpg'
)
where media.thumbnail_storage_path is null
  and media.storage_path ~ '/original[.][^/]+$'
  and exists (
    select 1
    from storage.objects as object
    where object.bucket_id = 'report-media'
      and object.name = regexp_replace(
        media.storage_path,
        '/original[.][^/]+$',
        '/thumbnail.jpg'
      )
  );

update public.report_media as media
set display_storage_path = regexp_replace(
  media.storage_path,
  '/original[.][^/]+$',
  '/display.jpg'
)
where media.type = 'photo'
  and media.display_storage_path is null
  and media.storage_path ~ '/original[.][^/]+$'
  and exists (
    select 1
    from storage.objects as object
    where object.bucket_id = 'report-media'
      and object.name = regexp_replace(
        media.storage_path,
        '/original[.][^/]+$',
        '/display.jpg'
      )
  );

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
  v_thumbnail_path text;
  v_display_path text;
  v_duration numeric;
  v_file_size_bytes bigint;
  v_width integer;
  v_height integer;
  v_position smallint := 0;
begin
  if p_reporter_id is null then
    raise exception 'Reporter is required.' using errcode = '22023';
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
    v_thumbnail_path := nullif(trim(coalesce(v_item->>'thumbnailStoragePath', '')), '');
    v_display_path := nullif(trim(coalesce(v_item->>'displayStoragePath', '')), '');
    v_duration := nullif(v_item->>'durationSeconds', '')::numeric;
    v_file_size_bytes := nullif(v_item->>'fileSizeBytes', '')::bigint;
    v_width := nullif(v_item->>'width', '')::integer;
    v_height := nullif(v_item->>'height', '')::integer;

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
      thumbnail_storage_path,
      display_storage_path,
      file_size_bytes,
      width,
      height,
      position
    ) values (
      v_media_id,
      v_report_id,
      v_type::public.media_type,
      v_path,
      case when v_type = 'video' then v_duration else null end,
      v_thumbnail_path,
      case when v_type = 'photo' then v_display_path else null end,
      v_file_size_bytes,
      v_width,
      v_height,
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
  v_thumbnail_path text;
  v_display_path text;
  v_duration numeric;
  v_file_size_bytes bigint;
  v_width integer;
  v_height integer;
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

  if p_media is null or jsonb_typeof(p_media) <> 'array' then
    raise exception 'Media must be a JSON array.' using errcode = '22023';
  end if;

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
    v_thumbnail_path := nullif(trim(coalesce(v_item->>'thumbnailStoragePath', '')), '');
    v_display_path := nullif(trim(coalesce(v_item->>'displayStoragePath', '')), '');
    v_duration := nullif(v_item->>'durationSeconds', '')::numeric;
    v_file_size_bytes := nullif(v_item->>'fileSizeBytes', '')::bigint;
    v_width := nullif(v_item->>'width', '')::integer;
    v_height := nullif(v_item->>'height', '')::integer;

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
      thumbnail_storage_path,
      display_storage_path,
      file_size_bytes,
      width,
      height,
      position
    ) values (
      v_media_id,
      v_report_id,
      v_type::public.media_type,
      v_path,
      case when v_type = 'video' then v_duration else null end,
      v_thumbnail_path,
      case when v_type = 'photo' then v_display_path else null end,
      v_file_size_bytes,
      v_width,
      v_height,
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
