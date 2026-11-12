-- Keep trusted edit attribution scoped to the edit, including legacy overloads.
-- A later workflow RPC in the same transaction must not inherit a previous actor.
create or replace function public.guard_bdrrmo_handed_off_report_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor_id uuid; actor_barangay uuid;
begin
  if old.incident_case_id is null then return new; end if;
  if row(new.title, new.description, new.location, new.address_text, new.barangay_id,
    new.incident_type, new.incident_type_other) is not distinct from
    row(old.title, old.description, old.location, old.address_text, old.barangay_id,
      old.incident_type, old.incident_type_other) then return new; end if;
  -- Authenticated clients cannot impersonate another actor through a custom GUC.
  actor_id := case when current_setting('role', true) in ('authenticated', 'anon') then auth.uid()
    else nullif(current_setting('disasterlink.location_actor', true), '')::uuid end;
  if actor_id is null then return new; end if;
  select barangay_id into actor_barangay from public.app_profiles
    where id = actor_id and role = 'officer' and status = 'active';
  if actor_barangay is not null and exists (select 1 from public.incident_cases incident
    where incident.id = old.incident_case_id and incident.lead_office = 'municipal') then
    raise exception 'Only the lead office can change incident content or location after an accepted transfer.' using errcode = '42501';
  end if;
  return new;
end;
$$;

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

  perform set_config('disasterlink.location_actor', p_actor_id::text, true);

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

  perform set_config('disasterlink.location_actor', '', true);
  return p_report_id;
end;
$$;

create or replace function public.update_official_report_fields(
  p_actor_id uuid,
  p_report_id uuid,
  p_title text,
  p_description text,
  p_latitude double precision,
  p_longitude double precision,
  p_address_text text,
  p_barangay_id uuid,
  p_incident_type text,
  p_incident_type_other text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report_id uuid;
begin
  if p_incident_type is not null
     and p_incident_type not in ('fire', 'flood', 'road_crash', 'medical', 'other') then
    raise exception 'Select a valid incident type.' using errcode = '22023';
  end if;
  if p_incident_type = 'other'
     and nullif(trim(coalesce(p_incident_type_other, '')), '') is null then
    raise exception 'Specify the incident type.' using errcode = '22023';
  end if;

  perform set_config('disasterlink.location_actor', p_actor_id::text, true);
  v_report_id := public.update_official_report_fields(
    p_actor_id,
    p_report_id,
    p_title,
    p_description,
    p_latitude,
    p_longitude,
    p_address_text,
    p_barangay_id
  );

  perform set_config('disasterlink.location_actor', p_actor_id::text, true);
  if p_incident_type is not null then
    update public.reports
       set incident_type = p_incident_type,
           incident_type_other = case
             when p_incident_type = 'other'
               then nullif(trim(coalesce(p_incident_type_other, '')), '')
             else null
           end
     where id = v_report_id;
  end if;

  perform set_config('disasterlink.location_actor', '', true);
  return v_report_id;
end;
$$;

create or replace function public.correct_report_incident_location(
  p_actor_id uuid,
  p_report_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_address_text text,
  p_barangay_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_status public.account_status;
  v_actor_barangay uuid;
  v_report_barangay uuid;
  v_next_barangay uuid;
begin
  select role, status, barangay_id
    into v_role, v_status, v_actor_barangay
  from public.app_profiles
  where id = p_actor_id;

  if v_role is null
     or v_role is distinct from 'officer'
     or v_status is distinct from 'active' then
    raise exception 'Only active response officers can correct incident locations.'
      using errcode = '42501';
  end if;

  select barangay_id into v_report_barangay
  from public.reports where id = p_report_id;
  if not found then
    raise exception 'Report not found.' using errcode = 'P0002';
  end if;

  if v_actor_barangay is not null and v_report_barangay is distinct from v_actor_barangay then
    raise exception 'BDRRMO can only correct reports in their assigned barangay.'
      using errcode = '42501';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Valid incident coordinates are required.' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_note, ''))) > 500 then
    raise exception 'Correction note must be 500 characters or fewer.'
      using errcode = '22023';
  end if;

  if v_actor_barangay is not null then
    v_next_barangay := v_actor_barangay;
  elsif p_barangay_id is not null then
    if not exists (select 1 from public.barangays where id = p_barangay_id) then
      raise exception 'The selected barangay is no longer available.'
        using errcode = '22023';
    end if;
    v_next_barangay := p_barangay_id;
  else
    v_next_barangay := public.resolve_barangay_id(p_latitude, p_longitude);
  end if;

  perform set_config('disasterlink.location_actor', p_actor_id::text, true);
  perform set_config(
    'disasterlink.location_correction_note',
    trim(coalesce(p_note, '')),
    true
  );

  update public.reports
     set location = extensions.st_setsrid(
           extensions.st_makepoint(p_longitude, p_latitude),
           4326
         )::extensions.geography,
         address_text = nullif(trim(coalesce(p_address_text, '')), ''),
         barangay_id = v_next_barangay
   where id = p_report_id;

  perform set_config('disasterlink.location_actor', '', true);
  perform set_config('disasterlink.location_correction_note', '', true);
  return p_report_id;
end;
$$;
