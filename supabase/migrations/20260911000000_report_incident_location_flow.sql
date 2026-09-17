-- Incident classification and verifiable two-coordinate report locations.
-- `location` remains the response location shown on maps. `device_location`
-- is immutable verification metadata and is exposed to officials only by RPC.

alter table public.reports
  add column if not exists incident_type text,
  add column if not exists incident_type_other text,
  add column if not exists device_location extensions.geography(Point, 4326),
  add column if not exists gps_accuracy_meters numeric(8, 2),
  add column if not exists location_adjustment_meters numeric(8, 2);

alter table public.reports
  drop constraint if exists reports_incident_type_check,
  add constraint reports_incident_type_check check (
    incident_type is null
    or incident_type in ('fire', 'flood', 'road_crash', 'medical', 'other')
  ),
  drop constraint if exists reports_incident_type_other_check,
  add constraint reports_incident_type_other_check check (
    case
      when incident_type = 'other' then
        nullif(trim(incident_type_other), '') is not null
        and length(trim(incident_type_other)) <= 80
      else incident_type_other is null
    end
  ),
  drop constraint if exists reports_gps_accuracy_check,
  add constraint reports_gps_accuracy_check check (
    gps_accuracy_meters is null
    or (gps_accuracy_meters >= 0 and gps_accuracy_meters <= 10000)
  ),
  drop constraint if exists reports_location_adjustment_check,
  add constraint reports_location_adjustment_check check (
    location_adjustment_meters is null
    or (location_adjustment_meters >= 0 and location_adjustment_meters <= 300.5)
  );

comment on column public.reports.location is
  'Primary incident coordinate used for dispatch and maps.';
comment on column public.reports.device_location is
  'Original immutable device GPS coordinate captured when a resident started the report.';
comment on column public.reports.gps_accuracy_meters is
  'Horizontal accuracy reported by the device for device_location.';
comment on column public.reports.location_adjustment_meters is
  'Distance from immutable device_location to the submitted incident location.';

-- Add classification to the client-safe map/feed projection. Legacy rows keep
-- null incident values and are labelled safely by the application.
create or replace view public.reports_map
with (security_invoker = true)
as
select
  r.id,
  r.title,
  r.description,
  r.status,
  r.barangay_id,
  r.created_at,
  r.reporter_id,
  r.address_text,
  r.upvote_count,
  r.comment_count,
  ap.first_name as reporter_first_name,
  ap.last_name as reporter_last_name,
  ap.middle_name as reporter_middle_name,
  extensions.st_y(r.location::extensions.geometry) as latitude,
  extensions.st_x(r.location::extensions.geometry) as longitude,
  r.incident_type,
  r.incident_type_other
from public.reports r
join public.app_profiles_public ap on ap.id = r.reporter_id;

comment on view public.reports_map is
  'Client-safe report pins with primary incident location, public identity, classification, and engagement totals.';

grant select on public.reports_map to authenticated;
grant select on public.reports_map to service_role;

-- Keep verification metadata out of ordinary authenticated table reads. The
-- scoped RPC below is the only client path to the original device coordinate.
revoke select on public.reports from authenticated;
grant select (
  id,
  reporter_id,
  title,
  description,
  incident_type,
  incident_type_other,
  status,
  location,
  address_text,
  barangay_id,
  verified_by,
  verified_at,
  reverified_by,
  reverified_at,
  escalated_by,
  escalated_at,
  escalated_to,
  resolved_by,
  resolved_at,
  upvote_count,
  comment_count,
  created_at,
  updated_at
) on public.reports to authenticated;

-- New resident RPC overload. The older overloads remain for queue compatibility,
-- while every new app submission uses this backend-validated two-point path.
create or replace function public.create_report_with_media(
  p_reporter_id uuid,
  p_report_id uuid,
  p_title text,
  p_description text,
  p_latitude double precision,
  p_longitude double precision,
  p_address_text text,
  p_media jsonb,
  p_barangay_id uuid,
  p_incident_type text,
  p_incident_type_other text,
  p_device_latitude double precision,
  p_device_longitude double precision,
  p_gps_accuracy_meters double precision
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report_id uuid;
  v_device_location extensions.geography(Point, 4326);
  v_incident_location extensions.geography(Point, 4326);
  v_adjustment_meters double precision;
  v_allowed_meters double precision;
begin
  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Valid incident coordinates are required.'
      using errcode = '22023';
  end if;

  if p_device_latitude is null or p_device_longitude is null
     or p_device_latitude < -90 or p_device_latitude > 90
     or p_device_longitude < -180 or p_device_longitude > 180 then
    raise exception 'Valid verified device coordinates are required.'
      using errcode = '22023';
  end if;

  if p_gps_accuracy_meters is not null
     and (p_gps_accuracy_meters < 0 or p_gps_accuracy_meters > 10000) then
    raise exception 'GPS accuracy must be between 0 and 10000 meters.'
      using errcode = '22023';
  end if;

  if p_incident_type is not null
     and p_incident_type not in ('fire', 'flood', 'road_crash', 'medical', 'other') then
    raise exception 'Select a valid incident type.' using errcode = '22023';
  end if;

  if p_incident_type = 'other'
     and nullif(trim(coalesce(p_incident_type_other, '')), '') is null then
    raise exception 'Specify the incident type.' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_incident_type_other, ''))) > 80 then
    raise exception 'Incident type is too long.' using errcode = '22023';
  end if;

  v_device_location := extensions.st_setsrid(
    extensions.st_makepoint(p_device_longitude, p_device_latitude),
    4326
  )::extensions.geography;
  v_incident_location := extensions.st_setsrid(
    extensions.st_makepoint(p_longitude, p_latitude),
    4326
  )::extensions.geography;
  v_adjustment_meters := extensions.st_distance(
    v_device_location,
    v_incident_location
  );

  -- A normal fix gets 150 m. Reported inaccuracy can widen this, capped at 300 m.
  v_allowed_meters := least(
    300.0,
    greatest(150.0, coalesce(p_gps_accuracy_meters, 150.0))
  );

  if v_adjustment_meters > v_allowed_meters then
    raise exception 'Incident pin must stay within % meters of the verified device location.',
      round(v_allowed_meters)
      using errcode = '22023';
  end if;

  v_report_id := public.create_report_with_media(
    p_reporter_id,
    p_report_id,
    p_title,
    p_description,
    p_latitude,
    p_longitude,
    p_address_text,
    p_media,
    p_barangay_id
  );

  update public.reports
     set incident_type = p_incident_type,
         incident_type_other = case
           when p_incident_type = 'other'
             then nullif(trim(coalesce(p_incident_type_other, '')), '')
           else null
         end,
         device_location = v_device_location,
         gps_accuracy_meters = p_gps_accuracy_meters,
         location_adjustment_meters = round(v_adjustment_meters::numeric, 2)
   where id = v_report_id;

  return v_report_id;
end;
$$;

revoke all on function public.create_report_with_media(
  uuid, uuid, text, text, double precision, double precision, text, jsonb,
  uuid, text, text, double precision, double precision, double precision
) from public, anon, authenticated;
grant execute on function public.create_report_with_media(
  uuid, uuid, text, text, double precision, double precision, text, jsonb,
  uuid, text, text, double precision, double precision, double precision
) to service_role;

-- New official-create overload reuses the established role/scope/media checks.
create or replace function public.create_official_report_with_media(
  p_reporter_id uuid,
  p_report_id uuid,
  p_title text,
  p_description text,
  p_latitude double precision,
  p_longitude double precision,
  p_address_text text,
  p_media jsonb,
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

  v_report_id := public.create_official_report_with_media(
    p_reporter_id,
    p_report_id,
    p_title,
    p_description,
    p_latitude,
    p_longitude,
    p_address_text,
    p_media,
    p_barangay_id
  );

  update public.reports
     set incident_type = p_incident_type,
         incident_type_other = case
           when p_incident_type = 'other'
             then nullif(trim(coalesce(p_incident_type_other, '')), '')
           else null
         end,
         device_location = location,
         location_adjustment_meters = 0
   where id = v_report_id;

  return v_report_id;
end;
$$;

revoke all on function public.create_official_report_with_media(
  uuid, uuid, text, text, double precision, double precision, text, jsonb,
  uuid, text, text
) from public, anon, authenticated;
grant execute on function public.create_official_report_with_media(
  uuid, uuid, text, text, double precision, double precision, text, jsonb,
  uuid, text, text
) to service_role;

-- Official-author edit overload preserves legacy classifications when the
-- caller omits the new fields and records the actor for location audit events.
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

  return v_report_id;
end;
$$;

revoke all on function public.update_official_report_fields(
  uuid, uuid, text, text, double precision, double precision, text, uuid,
  text, text
) from public, anon, authenticated;
grant execute on function public.update_official_report_fields(
  uuid, uuid, text, text, double precision, double precision, text, uuid,
  text, text
) to service_role;

-- Protect the original GPS data and submitted incident coordinate from direct
-- resident updates. Trusted official RPCs run without the resident auth id.
create or replace function public.guard_resident_report_locations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() = old.reporter_id and (
    new.location is distinct from old.location
    or new.device_location is distinct from old.device_location
    or new.gps_accuracy_meters is distinct from old.gps_accuracy_meters
    or new.location_adjustment_meters is distinct from old.location_adjustment_meters
  ) then
    raise exception 'Submitted report locations cannot be changed by residents.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reports_guard_resident_locations on public.reports;
create trigger trg_reports_guard_resident_locations
  before update on public.reports
  for each row execute function public.guard_resident_report_locations();

-- Add location and classification changes to the existing status/barangay log.
create or replace function public.log_report_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text;
  v_actor uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.report_status_history
      (report_id, event_type, from_status, to_status, changed_by)
    values
      (new.id, 'status_change', null, new.status, new.reporter_id);
    return new;
  end if;

  v_actor := coalesce(
    nullif(current_setting('disasterlink.location_actor', true), '')::uuid,
    auth.uid()
  );

  if new.status is distinct from old.status then
    v_note := nullif(trim(current_setting('disasterlink.transition_note', true)), '');
    insert into public.report_status_history
      (report_id, event_type, from_status, to_status, changed_by, note)
    values
      (new.id, 'status_change', old.status, new.status, auth.uid(), v_note);
  end if;

  if new.barangay_id is distinct from old.barangay_id then
    insert into public.report_status_history
      (report_id, event_type, changed_by, detail)
    values
      (new.id, 'barangay_change', v_actor,
       jsonb_build_object('from', old.barangay_id, 'to', new.barangay_id));
  end if;

  if new.location is distinct from old.location then
    v_note := nullif(
      trim(current_setting('disasterlink.location_correction_note', true)),
      ''
    );
    insert into public.report_status_history
      (report_id, event_type, changed_by, note, detail)
    values
      (
        new.id,
        'location_change',
        v_actor,
        v_note,
        jsonb_build_object(
          'from_latitude', extensions.st_y(old.location::extensions.geometry),
          'from_longitude', extensions.st_x(old.location::extensions.geometry),
          'to_latitude', extensions.st_y(new.location::extensions.geometry),
          'to_longitude', extensions.st_x(new.location::extensions.geometry)
        )
      );
  end if;

  if new.incident_type is distinct from old.incident_type
     or new.incident_type_other is distinct from old.incident_type_other then
    insert into public.report_status_history
      (report_id, event_type, changed_by, detail)
    values
      (
        new.id,
        'incident_type_change',
        v_actor,
        jsonb_build_object(
          'from_type', old.incident_type,
          'from_other', old.incident_type_other,
          'to_type', new.incident_type,
          'to_other', new.incident_type_other
        )
      );
  end if;

  return new;
end;
$$;

-- Authorized BDRRMO/MDRRMO officers can correct the primary response point.
-- The original device coordinate is never overwritten and the trigger records
-- the before/after points, actor, and optional correction note.
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

  return p_report_id;
end;
$$;

revoke all on function public.correct_report_incident_location(
  uuid, uuid, double precision, double precision, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.correct_report_incident_location(
  uuid, uuid, double precision, double precision, text, uuid, text
) to service_role;

-- Officials receive original-GPS verification through a scoped function rather
-- than the public map view. Legacy reports return null verification fields.
create or replace function public.get_report_location_verification(p_report_id uuid)
returns table (
  device_latitude double precision,
  device_longitude double precision,
  gps_accuracy_meters double precision,
  location_adjustment_meters double precision
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_status public.account_status;
  v_actor_barangay uuid;
  v_report_barangay uuid;
begin
  select role, status, barangay_id
    into v_role, v_status, v_actor_barangay
  from public.app_profiles
  where id = auth.uid();

  if v_role is null
     or v_status is distinct from 'active'
     or v_role not in ('officer', 'mayor', 'admin') then
    raise exception 'Official access required.' using errcode = '42501';
  end if;

  select barangay_id into v_report_barangay
  from public.reports where id = p_report_id;
  if not found then
    return;
  end if;

  if v_role = 'officer'
     and v_actor_barangay is not null
     and v_report_barangay is distinct from v_actor_barangay then
    raise exception 'Report is outside your assigned barangay.' using errcode = '42501';
  end if;

  return query
  select
    extensions.st_y(report.device_location::extensions.geometry),
    extensions.st_x(report.device_location::extensions.geometry),
    report.gps_accuracy_meters::double precision,
    report.location_adjustment_meters::double precision
  from public.reports report
  where report.id = p_report_id;
end;
$$;

revoke all on function public.get_report_location_verification(uuid)
  from public, anon;
grant execute on function public.get_report_location_verification(uuid)
  to authenticated, service_role;
