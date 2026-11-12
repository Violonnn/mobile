-- Phase 4: confirmation-time publication, verified photo derivatives, and
-- per-report public media delivery. Private originals remain untouched.

create table public.report_public_photo_derivatives (
  media_id uuid primary key references public.report_media(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  source_storage_path text not null,
  source_object_id uuid not null,
  display_source_path text not null,
  display_source_object_id uuid not null,
  thumbnail_source_path text not null,
  thumbnail_source_object_id uuid not null,
  display_safe_path text not null unique,
  display_safe_object_id uuid not null,
  display_sha256 text not null check (display_sha256 ~ '^[0-9a-f]{64}$'),
  display_size integer not null check (display_size between 1 and 2097152),
  display_width integer not null check (display_width between 1 and 1600),
  display_height integer not null check (display_height between 1 and 1600),
  thumbnail_safe_path text not null unique,
  thumbnail_safe_object_id uuid not null,
  thumbnail_sha256 text not null check (thumbnail_sha256 ~ '^[0-9a-f]{64}$'),
  thumbnail_size integer not null check (thumbnail_size between 1 and 307200),
  thumbnail_width integer not null check (thumbnail_width between 1 and 480),
  thumbnail_height integer not null check (thumbnail_height between 1 and 480),
  processor_version integer not null check (processor_version = 1),
  verified_by uuid not null references public.app_profiles(id),
  verified_at timestamptz not null default now(),
  check (display_width::bigint * display_height::bigint <= 40000000),
  check (thumbnail_width::bigint * thumbnail_height::bigint <= 40000000)
);
alter table public.report_public_photo_derivatives enable row level security;
revoke all on public.report_public_photo_derivatives from public, anon, authenticated;
grant all on public.report_public_photo_derivatives to service_role;

create table public.report_publication_operations (
  operation_id uuid primary key,
  actor_id uuid not null references public.app_profiles(id),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.report_publication_operations enable row level security;
revoke all on public.report_publication_operations from public, anon, authenticated;
grant all on public.report_publication_operations to service_role;

create function public.is_expected_report_media_original_path(
  p_path text, p_reporter_id uuid, p_report_id uuid, p_media_id uuid)
returns boolean language sql immutable security definer set search_path = '' as $$
  select p_path in (
    p_reporter_id::text || '/' || p_report_id::text || '/' || p_media_id::text || '/original.jpg',
    p_reporter_id::text || '/' || p_report_id::text || '/' || p_media_id::text || '/original.jpeg',
    p_reporter_id::text || '/' || p_report_id::text || '/' || p_media_id::text || '/original.png',
    p_reporter_id::text || '/' || p_report_id::text || '/' || p_media_id::text || '/original.webp',
    p_reporter_id::text || '/' || p_report_id::text || '/' || p_media_id::text || '/original.heic',
    p_reporter_id::text || '/' || p_report_id::text || '/' || p_media_id::text || '/original.heif',
    p_reporter_id::text || '/' || p_report_id::text || '/' || p_media_id::text || '.jpg',
    p_reporter_id::text || '/' || p_report_id::text || '/' || p_media_id::text || '.jpeg',
    p_reporter_id::text || '/' || p_report_id::text || '/' || p_media_id::text || '.png',
    p_reporter_id::text || '/' || p_report_id::text || '/' || p_media_id::text || '.webp',
    p_reporter_id::text || '/' || p_report_id::text || '/' || p_media_id::text || '.heic',
    p_reporter_id::text || '/' || p_report_id::text || '/' || p_media_id::text || '.heif'
  );
$$;

create function public.is_verified_public_report_photo(p_report_id uuid, p_media_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.report_public_photo_derivatives proof
    join public.report_media media on media.id = proof.media_id and media.report_id = proof.report_id
    join public.reports report on report.id = proof.report_id
    join storage.objects source_object on source_object.bucket_id = 'report-media'
      and source_object.name = proof.source_storage_path and source_object.id = proof.source_object_id
    join storage.objects display_source on display_source.bucket_id = 'report-media'
      and display_source.name = proof.display_source_path and display_source.id = proof.display_source_object_id
    join storage.objects thumbnail_source on thumbnail_source.bucket_id = 'report-media'
      and thumbnail_source.name = proof.thumbnail_source_path and thumbnail_source.id = proof.thumbnail_source_object_id
    join storage.objects display_safe on display_safe.bucket_id = 'report-media'
      and display_safe.name = proof.display_safe_path and display_safe.id = proof.display_safe_object_id
    join storage.objects thumbnail_safe on thumbnail_safe.bucket_id = 'report-media'
      and thumbnail_safe.name = proof.thumbnail_safe_path and thumbnail_safe.id = proof.thumbnail_safe_object_id
    where proof.report_id = p_report_id and proof.media_id = p_media_id
      and media.type = 'photo'
      and media.storage_path = proof.source_storage_path
      and public.is_expected_report_media_original_path(proof.source_storage_path, report.reporter_id, report.id, media.id)
      and media.display_storage_path = proof.display_source_path
      and media.thumbnail_storage_path = proof.thumbnail_source_path
      and proof.display_source_path = report.reporter_id::text || '/' || report.id::text || '/' || media.id::text || '/display.jpg'
      and proof.thumbnail_source_path = report.reporter_id::text || '/' || report.id::text || '/' || media.id::text || '/thumbnail.jpg'
      and proof.display_safe_path = 'public-safe/' || media.id::text || '/' || proof.display_sha256 || '/display.jpg'
      and proof.thumbnail_safe_path = 'public-safe/' || media.id::text || '/' || proof.thumbnail_sha256 || '/thumbnail.jpg'
      and greatest(proof.display_width, proof.display_height) <= 1600
      and greatest(proof.thumbnail_width, proof.thumbnail_height) <= 480
      and lower(display_safe.metadata->>'mimetype') = 'image/jpeg'
      and lower(thumbnail_safe.metadata->>'mimetype') = 'image/jpeg'
      and (display_safe.metadata->>'size')::bigint = proof.display_size
      and (thumbnail_safe.metadata->>'size')::bigint = proof.thumbnail_size
      and proof.processor_version = 1
  );
$$;

create function public.can_process_public_report_photo(p_report_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare report public.reports; incident public.incident_cases;
begin
  if not public.has_active_profile() or not public.is_officer() then return false; end if;
  select * into report from public.reports where id = p_report_id;
  if not found then return false; end if;
  if report.incident_case_id is not null then
    select * into incident from public.incident_cases where id = report.incident_case_id;
    if found and public.is_incident_lead(incident) then return true; end if;
  end if;
  if report.review_outcome = 'pending' and report.jurisdiction_status = 'in_coverage'
    and report.review_claimed_by = auth.uid() then
    begin
      perform public.require_report_reviewer(report);
      return true;
    exception when insufficient_privilege then
      return false;
    end;
  end if;
  return false;
exception when insufficient_privilege then
  return false;
end;
$$;

create function public.register_public_report_photo_derivatives(
  p_report_id uuid, p_media_id uuid, p_actor_id uuid,
  p_source_storage_path text, p_source_object_id uuid,
  p_display_source_path text, p_display_source_object_id uuid,
  p_thumbnail_source_path text, p_thumbnail_source_object_id uuid,
  p_display_safe_path text, p_display_safe_object_id uuid, p_display_sha256 text,
  p_display_size integer, p_display_width integer, p_display_height integer,
  p_thumbnail_safe_path text, p_thumbnail_safe_object_id uuid, p_thumbnail_sha256 text,
  p_thumbnail_size integer, p_thumbnail_width integer, p_thumbnail_height integer,
  p_processor_version integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare report public.reports; media public.report_media;
  existing public.report_public_photo_derivatives; actor_profile public.app_profiles;
  incident public.incident_cases; incident_case uuid; proof_changed boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Photo derivative registration is restricted to the trusted processor.' using errcode = '42501';
  end if;
  select * into actor_profile from public.app_profiles where id = p_actor_id and role = 'officer' and status = 'active';
  if not found then raise exception 'An active official must process this photo.' using errcode = '42501'; end if;

  -- Lock any existing case before its report and media rows to match incident
  -- mutation ordering and avoid races with findings or publication changes.
  select incident_case_id into incident_case from public.reports where id = p_report_id;
  if not found then raise exception 'Report not found.' using errcode = 'P0002'; end if;
  if incident_case is not null then
    select * into incident from public.incident_cases where id = incident_case for update;
    if not found then raise exception 'Linked incident not found.' using errcode = 'P0002'; end if;
  end if;
  select * into report from public.reports where id = p_report_id for update;
  if not found then raise exception 'Report not found.' using errcode = 'P0002'; end if;
  if report.incident_case_id is distinct from incident_case then
    raise exception 'The report changed while its photo was being processed. Retry.' using errcode = '40001';
  end if;
  select * into media from public.report_media where id = p_media_id and report_id = p_report_id for update;
  if not found or media.type <> 'photo' then raise exception 'Photo is not attached to this report.' using errcode = '22023'; end if;

  -- The edge function verified the JWT first. Reapply that actor context here
  -- and recheck their reviewer claim or incident lead permission after locks.
  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);
  if not public.can_process_public_report_photo(p_report_id) then
    raise exception 'The official no longer has permission to process this photo.' using errcode = '42501';
  end if;

  if p_source_storage_path is distinct from media.storage_path
    or not public.is_expected_report_media_original_path(p_source_storage_path, report.reporter_id, report.id, media.id)
    or p_display_source_path is distinct from media.display_storage_path
    or p_thumbnail_source_path is distinct from media.thumbnail_storage_path
    or p_display_source_path is distinct from report.reporter_id::text || '/' || report.id::text || '/' || media.id::text || '/display.jpg'
    or p_thumbnail_source_path is distinct from report.reporter_id::text || '/' || report.id::text || '/' || media.id::text || '/thumbnail.jpg'
    or p_display_sha256 !~ '^[0-9a-f]{64}$' or p_thumbnail_sha256 !~ '^[0-9a-f]{64}$'
    or p_display_safe_path is distinct from 'public-safe/' || media.id::text || '/' || p_display_sha256 || '/display.jpg'
    or p_thumbnail_safe_path is distinct from 'public-safe/' || media.id::text || '/' || p_thumbnail_sha256 || '/thumbnail.jpg'
    or p_processor_version <> 1
    or p_display_size not between 1 and 2097152 or p_thumbnail_size not between 1 and 307200
    or p_display_width not between 1 and 1600 or p_display_height not between 1 and 1600
    or p_thumbnail_width not between 1 and 480 or p_thumbnail_height not between 1 and 480
    or p_display_width::bigint * p_display_height::bigint > 40000000
    or p_thumbnail_width::bigint * p_thumbnail_height::bigint > 40000000 then
    raise exception 'Photo verification does not match this report attachment.' using errcode = '22023';
  end if;

  if not exists (select 1 from storage.objects where bucket_id = 'report-media'
      and name = p_source_storage_path and id = p_source_object_id)
    or not exists (select 1 from storage.objects where bucket_id = 'report-media'
      and name = p_display_source_path and id = p_display_source_object_id)
    or not exists (select 1 from storage.objects where bucket_id = 'report-media'
      and name = p_thumbnail_source_path and id = p_thumbnail_source_object_id)
    or not exists (select 1 from storage.objects where bucket_id = 'report-media'
      and name = p_display_safe_path and id = p_display_safe_object_id
      and lower(metadata->>'mimetype') = 'image/jpeg' and (metadata->>'size')::bigint = p_display_size)
    or not exists (select 1 from storage.objects where bucket_id = 'report-media'
      and name = p_thumbnail_safe_path and id = p_thumbnail_safe_object_id
      and lower(metadata->>'mimetype') = 'image/jpeg' and (metadata->>'size')::bigint = p_thumbnail_size) then
    raise exception 'Verified photo objects are missing or have changed.' using errcode = '22023';
  end if;

  select * into existing from public.report_public_photo_derivatives
    where media_id = p_media_id for update;
  proof_changed := not found or (
    existing.report_id is distinct from p_report_id
    or existing.source_storage_path is distinct from p_source_storage_path
    or existing.source_object_id is distinct from p_source_object_id
    or existing.display_source_path is distinct from p_display_source_path
    or existing.display_source_object_id is distinct from p_display_source_object_id
    or existing.thumbnail_source_path is distinct from p_thumbnail_source_path
    or existing.thumbnail_source_object_id is distinct from p_thumbnail_source_object_id
    or existing.display_safe_path is distinct from p_display_safe_path
    or existing.display_safe_object_id is distinct from p_display_safe_object_id
    or existing.display_sha256 is distinct from p_display_sha256
    or existing.display_size is distinct from p_display_size
    or existing.display_width is distinct from p_display_width
    or existing.display_height is distinct from p_display_height
    or existing.thumbnail_safe_path is distinct from p_thumbnail_safe_path
    or existing.thumbnail_safe_object_id is distinct from p_thumbnail_safe_object_id
    or existing.thumbnail_sha256 is distinct from p_thumbnail_sha256
    or existing.thumbnail_size is distinct from p_thumbnail_size
    or existing.thumbnail_width is distinct from p_thumbnail_width
    or existing.thumbnail_height is distinct from p_thumbnail_height
    or existing.processor_version is distinct from p_processor_version
  );

  if proof_changed and media.public_approved_at is not null then
    update public.report_media set public_approved_by = null, public_approved_at = null where id = media.id;
    if report.incident_case_id is not null then
      incident_case := report.incident_case_id;
      insert into public.incident_events(incident_case_id, report_id, event_type, actor_id, actor_office,
        actor_barangay_id, details, note)
      values (incident_case, report.id, 'photo_unpublished', p_actor_id,
        case when actor_profile.barangay_id is null then 'municipal' else 'barangay' end::public.incident_lead_office,
        actor_profile.barangay_id, jsonb_build_object('media_id', media.id, 'reason', 'verified_copy_changed'),
        'A verified photo copy changed and requires renewed approval.');
    end if;
  end if;

  insert into public.report_public_photo_derivatives(
    media_id, report_id, source_storage_path, source_object_id,
    display_source_path, display_source_object_id, thumbnail_source_path, thumbnail_source_object_id,
    display_safe_path, display_safe_object_id, display_sha256, display_size, display_width, display_height,
    thumbnail_safe_path, thumbnail_safe_object_id, thumbnail_sha256, thumbnail_size, thumbnail_width, thumbnail_height,
    processor_version, verified_by, verified_at)
  values (media.id, report.id, p_source_storage_path, p_source_object_id,
    p_display_source_path, p_display_source_object_id, p_thumbnail_source_path, p_thumbnail_source_object_id,
    p_display_safe_path, p_display_safe_object_id, p_display_sha256, p_display_size, p_display_width, p_display_height,
    p_thumbnail_safe_path, p_thumbnail_safe_object_id, p_thumbnail_sha256, p_thumbnail_size, p_thumbnail_width, p_thumbnail_height,
    p_processor_version, p_actor_id, now())
  on conflict (media_id) do update set
    report_id = excluded.report_id,
    source_storage_path = excluded.source_storage_path,
    source_object_id = excluded.source_object_id,
    display_source_path = excluded.display_source_path,
    display_source_object_id = excluded.display_source_object_id,
    thumbnail_source_path = excluded.thumbnail_source_path,
    thumbnail_source_object_id = excluded.thumbnail_source_object_id,
    display_safe_path = excluded.display_safe_path,
    display_safe_object_id = excluded.display_safe_object_id,
    display_sha256 = excluded.display_sha256,
    display_size = excluded.display_size,
    display_width = excluded.display_width,
    display_height = excluded.display_height,
    thumbnail_safe_path = excluded.thumbnail_safe_path,
    thumbnail_safe_object_id = excluded.thumbnail_safe_object_id,
    thumbnail_sha256 = excluded.thumbnail_sha256,
    thumbnail_size = excluded.thumbnail_size,
    thumbnail_width = excluded.thumbnail_width,
    thumbnail_height = excluded.thumbnail_height,
    processor_version = excluded.processor_version,
    verified_by = excluded.verified_by,
    verified_at = now();
end;
$$;

revoke all on function public.is_verified_public_report_photo(uuid,uuid),
  public.can_process_public_report_photo(uuid), public.register_public_report_photo_derivatives(
    uuid,uuid,uuid,text,uuid,text,uuid,text,uuid,text,uuid,text,integer,integer,integer,text,uuid,text,integer,integer,integer,integer)
  from public, anon, authenticated;
revoke all on function public.is_verified_public_report_photo(uuid,uuid),
  public.is_expected_report_media_original_path(text,uuid,uuid,uuid) from service_role;
revoke all on function public.is_expected_report_media_original_path(text,uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.can_process_public_report_photo(uuid) to authenticated, service_role;
grant execute on function public.register_public_report_photo_derivatives(
  uuid,uuid,uuid,text,uuid,text,uuid,text,uuid,text,uuid,text,integer,integer,integer,text,uuid,text,integer,integer,integer,integer)
  to service_role;

create or replace function public.can_read_report_media_path(p_storage_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_active_profile() and (
    exists (
    select 1 from public.report_media media
    join public.reports source_report on source_report.id = media.report_id
    where p_storage_path in (media.storage_path, media.display_storage_path, media.thumbnail_storage_path)
      and (public.is_current_user_report_owner(source_report.id)
        or (public.is_official() and not public.is_mayor() and public.can_read_report(source_report)))
    ) or exists (
      select 1 from public.report_public_photo_derivatives proof
      join public.report_media media on media.id = proof.media_id and media.report_id = proof.report_id
      join public.reports source_report on source_report.id = proof.report_id
      left join public.incident_cases incident on incident.id = source_report.incident_case_id
      where p_storage_path in (proof.display_safe_path, proof.thumbnail_safe_path)
        and public.is_verified_public_report_photo(source_report.id, media.id)
        and (public.is_current_user_report_owner(source_report.id)
          or (public.is_official() and not public.is_mayor() and public.can_read_report(source_report))
          or (media.public_approved_at is not null and incident.verification = 'confirmed'
            and incident.withdrawn_at is null and not incident.is_sensitive))
    ));
$$;

create or replace function public.can_delete_report_media_path(p_storage_path text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if p_storage_path like 'public-safe/%' or not public.has_active_profile() then return false; end if;
  if public.is_bdrrmo() then
    return exists (select 1 from public.report_media media join public.reports source_report on source_report.id = media.report_id
      where media.storage_path = p_storage_path and source_report.barangay_id = public.current_app_barangay_id());
  end if;
  return public.is_admin() or public.is_mdrrmo();
end;
$$;

revoke all on function public.can_read_report_media_path(text), public.can_delete_report_media_path(text)
  from public, anon;
grant execute on function public.can_read_report_media_path(text), public.can_delete_report_media_path(text)
  to authenticated, service_role;

drop policy if exists "report-media upload own folder" on storage.objects;
create policy "report-media upload own folder" on storage.objects for insert to authenticated
  with check (public.has_active_profile() and bucket_id = 'report-media'
    and name not like 'public-safe/%' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "report-media update own" on storage.objects;
create policy "report-media update own" on storage.objects for update to authenticated
  using (public.has_active_profile() and bucket_id = 'report-media'
    and name not like 'public-safe/%' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (public.has_active_profile() and bucket_id = 'report-media'
    and name not like 'public-safe/%' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "report-media delete own or official" on storage.objects;
create policy "report-media delete own or official" on storage.objects for delete to authenticated
  using (public.has_active_profile() and bucket_id = 'report-media'
    and name not like 'public-safe/%'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.can_delete_report_media_path(name)));

create or replace function public.set_report_media_public(p_media_id uuid, p_make_public boolean, p_reason text default null)
returns public.report_media language plpgsql security definer set search_path = '' as $$
declare media public.report_media; report public.reports; incident public.incident_cases;
  case_id uuid; report_id uuid;
begin
  select source_report.id, source_report.incident_case_id into report_id, case_id
    from public.report_media item join public.reports source_report on source_report.id = item.report_id
    where item.id = p_media_id;
  if case_id is null then raise exception 'Media must belong to an incident.' using errcode = 'P0002'; end if;
  select * into incident from public.incident_cases where id = case_id for update;
  if not found then raise exception 'Incident not found.' using errcode = 'P0002'; end if;
  select source_report.* into report from public.reports source_report where source_report.id = report_id for update;
  if not found or report.incident_case_id is distinct from case_id then
    raise exception 'Photo attachment changed during publication.' using errcode = '40001';
  end if;
  perform public.require_incident_lead(incident);
  select * into media from public.report_media where id = p_media_id for update;
  if not found or media.report_id is distinct from report_id then
    raise exception 'Photo attachment changed during publication.' using errcode = '40001';
  end if;
  if p_make_public is null or media.type <> 'photo' then
    raise exception 'Only photos can be published.' using errcode = '22023';
  end if;
  if p_make_public and (incident.verification <> 'confirmed' or incident.withdrawn_at is not null
    or incident.is_sensitive or not public.is_verified_public_report_photo(report.id, media.id)) then
    raise exception 'Photo publication requires a confirmed non-sensitive incident and verified safe copies.' using errcode = '22023';
  end if;
  return public.set_report_media_public_unchecked(p_media_id, p_make_public, p_reason);
end;
$$;

revoke all on function public.set_report_media_public(uuid,boolean,text) from public, anon;
grant execute on function public.set_report_media_public(uuid,boolean,text) to authenticated;

create function public.report_public_post_is_current(p_report_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.report_public_posts post
    join public.reports source_report on source_report.id = post.report_id
    join public.incident_cases incident on incident.id = source_report.incident_case_id
    where post.report_id = p_report_id and post.is_published
      and incident.verification = 'confirmed' and incident.withdrawn_at is null and not incident.is_sensitive);
$$;
revoke all on function public.report_public_post_is_current(uuid) from public, anon, authenticated, service_role;

drop function public.get_report_publication_review(uuid);
create function public.get_report_publication_review(p_report_id uuid)
returns table(report_id uuid, incident_case_id uuid, source_title text, source_description text,
  reporter_name text, reporter_avatar_path text,
  source_latitude double precision, source_longitude double precision,
  show_reporter_name boolean, show_reporter_avatar boolean, allow_exact_location boolean,
  is_published boolean, public_title text, public_description text,
  reporter_name_approved boolean, reporter_avatar_approved boolean, exact_location_approved boolean,
  is_sensitive boolean, can_publish boolean, media jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare source_report public.reports; incident public.incident_cases; caller_can_publish boolean := false;
begin
  select * into source_report from public.reports where id = p_report_id;
  if not found then return; end if;
  if source_report.incident_case_id is null then
    if source_report.review_outcome <> 'pending' or source_report.jurisdiction_status <> 'in_coverage'
      or source_report.review_claimed_by is distinct from auth.uid() then return; end if;
    perform public.require_report_reviewer(source_report);
    caller_can_publish := true;
  else
    select * into incident from public.incident_cases where id = source_report.incident_case_id;
    if not found then return; end if;
    perform public.require_incident_lead(incident);
    caller_can_publish := incident.state = 'active' and incident.withdrawn_at is null
      and not incident.is_sensitive and incident.verification in ('pending','confirmed')
      and public.is_incident_lead(incident);
  end if;

  return query select source_report.id, source_report.incident_case_id, source_report.title, source_report.description,
    nullif(concat_ws(' ', profile.first_name, nullif(profile.middle_name, ''), profile.last_name), ''),
    profile.avatar_path,
    extensions.st_y(source_report.location::extensions.geometry),
    extensions.st_x(source_report.location::extensions.geometry),
    coalesce(preference.show_reporter_name, false), coalesce(preference.show_reporter_avatar, false),
    coalesce(preference.allow_exact_location, false), coalesce(post.is_published, false),
    post.public_title, post.public_description, coalesce(post.reporter_name_approved, false),
    coalesce(post.reporter_avatar_approved, false), coalesce(post.exact_location_approved, false),
    coalesce(incident.is_sensitive, false), caller_can_publish,
    coalesce(media_rows.media, '[]'::jsonb)
  from (select 1) singleton
  left join public.app_profiles profile on profile.id = source_report.reporter_id
  left join public.report_publication_preferences preference on preference.report_id = source_report.id
  left join public.report_public_posts post on post.report_id = source_report.id
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'mediaId', media.id, 'type', media.type, 'isPublicApproved', media.public_approved_at is not null,
      'safeCopyVerified', public.is_verified_public_report_photo(source_report.id, media.id),
      'safeDisplayPath', case when public.is_verified_public_report_photo(source_report.id, media.id)
        then proof.display_safe_path end,
      'safeThumbnailPath', case when public.is_verified_public_report_photo(source_report.id, media.id)
        then proof.thumbnail_safe_path end
    ) order by media.position, media.id) as media
    from public.report_media media
    left join public.report_public_photo_derivatives proof on proof.report_id = source_report.id and proof.media_id = media.id
    where media.report_id = source_report.id
  ) media_rows on true;
end;
$$;
revoke all on function public.get_report_publication_review(uuid) from public, anon;
grant execute on function public.get_report_publication_review(uuid) to authenticated;

create function public.review_report_with_publication(
  p_operation_id uuid, p_report_id uuid, p_decision text, p_reason_code text default null,
  p_note text default null, p_link_incident_case_id uuid default null,
  p_public_title text default null, p_public_description text default null,
  p_publish boolean default false, p_approve_reporter_name boolean default false,
  p_approve_reporter_avatar boolean default false, p_approve_exact_location boolean default false,
  p_photo_media_ids uuid[] default '{}'::uuid[], p_publication_acknowledged boolean default false,
  p_mark_incident_sensitive boolean default false, p_sensitivity_reason text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); request_hash text; operation public.report_publication_operations;
  report public.reports; incident public.incident_cases; photo_id uuid; operation_result jsonb;
  sensitivity_reason text;
  publication_status text := 'private'; published boolean := false;
begin
  if actor_id is null or not public.has_active_profile() or not public.is_officer() then
    raise exception 'An active official must review this report.' using errcode = '42501';
  end if;
  if p_operation_id is null or p_report_id is null then
    raise exception 'A durable operation id and report id are required.' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_photo_media_ids), 0) > 0 and not coalesce(p_publish, false) then
    raise exception 'Select report photos only when publishing the screened post.' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_photo_media_ids), 0) <> (
    select count(distinct item)::integer from unnest(coalesce(p_photo_media_ids, '{}'::uuid[])) item
  ) then raise exception 'Duplicate photo selection.' using errcode = '22023'; end if;
  sensitivity_reason := public.report_flow_text(p_sensitivity_reason, coalesce(p_mark_incident_sensitive, false), 280);
  if coalesce(p_mark_incident_sensitive, false) and coalesce(p_publish, false) then
    raise exception 'Sensitive incidents remain private and cannot publish report photos.' using errcode = '22023';
  end if;
  if coalesce(p_publish, false) and not coalesce(p_publication_acknowledged, false) then
    raise exception 'Confirm that the public text and selected photos were screened.' using errcode = '22023';
  end if;

  request_hash := encode(extensions.digest(jsonb_build_object(
    'reportId', p_report_id, 'decision', p_decision, 'reasonCode', p_reason_code, 'note', p_note,
    'linkIncidentCaseId', p_link_incident_case_id, 'publicTitle', p_public_title,
    'publicDescription', p_public_description, 'publish', coalesce(p_publish, false),
    'approveName', coalesce(p_approve_reporter_name, false), 'approveAvatar', coalesce(p_approve_reporter_avatar, false),
    'approveExactLocation', coalesce(p_approve_exact_location, false),
    'publicationAcknowledged', coalesce(p_publication_acknowledged, false),
    'markSensitive', coalesce(p_mark_incident_sensitive, false), 'sensitivityReason', sensitivity_reason,
    'photoMediaIds', to_jsonb(coalesce(p_photo_media_ids, '{}'::uuid[])))::text, 'sha256'), 'hex');
  insert into public.report_publication_operations(operation_id, actor_id, request_hash)
    values (p_operation_id, actor_id, request_hash) on conflict (operation_id) do nothing;
  select * into operation from public.report_publication_operations where operation_id = p_operation_id for update;
  if operation.actor_id is distinct from actor_id or operation.request_hash is distinct from request_hash then
    raise exception 'This operation id is already bound to a different request.' using errcode = '23505';
  end if;
  if operation.result is not null then
    select * into report from public.reports where id = (operation.result->>'reportId')::uuid;
    if not found or not public.can_read_report(report) then
      raise exception 'You no longer have access to this reviewed report.' using errcode = '42501';
    end if;
    operation_result := jsonb_set(operation.result, '{publicAvailable}',
      to_jsonb(public.report_public_post_is_current(report.id)), true);
    operation_result := jsonb_set(operation_result, '{publicationStatus}',
      to_jsonb(case when public.report_public_post_is_current(report.id) then 'published'
        when exists (select 1 from public.incident_cases current_incident
          where current_incident.id = report.incident_case_id and current_incident.is_sensitive)
          then 'sensitive' else 'private' end), true);
    update public.report_publication_operations set result = operation_result where operation_id = p_operation_id;
    return operation_result;
  end if;

  -- For links, lock the target case before the report to match incident write order.
  if p_decision = 'link' then
    select * into incident from public.incident_cases where id = p_link_incident_case_id for update;
    if not found then raise exception 'Incident not found.' using errcode = 'P0002'; end if;
  end if;
  report := public.review_report(p_report_id, p_decision, p_reason_code, p_note, p_link_incident_case_id);
  if report.incident_case_id is not null then
    select * into incident from public.incident_cases where id = report.incident_case_id for update;
    if not found then raise exception 'Incident not found.' using errcode = 'P0002'; end if;
  end if;

  if incident.id is not null and coalesce(p_mark_incident_sensitive, false) then
    perform public.set_incident_sensitive(incident.id, true, sensitivity_reason);
    select * into incident from public.incident_cases where id = incident.id;
    publication_status := 'sensitive';
  elsif coalesce(p_publish, false) then
    if incident.id is null or incident.verification <> 'confirmed' or incident.withdrawn_at is not null then
      publication_status := 'awaiting_confirmation';
    elsif incident.is_sensitive then
      publication_status := 'sensitive';
    elsif not public.is_incident_lead(incident) then
      publication_status := 'awaiting_lead_review';
    else
      perform public.set_report_public_post(report.id, p_public_title, p_public_description, true,
        coalesce(p_approve_reporter_name, false), coalesce(p_approve_reporter_avatar, false),
        coalesce(p_approve_exact_location, false));
      foreach photo_id in array coalesce(p_photo_media_ids, '{}'::uuid[]) loop
        if not exists (select 1 from public.report_media media where media.id = photo_id and media.report_id = report.id) then
          raise exception 'A selected photo is no longer attached to this report.' using errcode = '22023';
        end if;
        perform public.set_report_media_public(photo_id, true, 'Approved with the screened report post.');
      end loop;
      publication_status := 'published';
      published := true;
    end if;
  elsif incident.id is not null and incident.verification = 'confirmed'
    and incident.withdrawn_at is null and not incident.is_sensitive
    and public.is_incident_lead(incident) and p_decision in ('verify','link') then
    raise exception 'Add screened public text or mark the incident sensitive.' using errcode = '22023';
  elsif p_decision = 'link' and not public.is_incident_lead(incident) then
    publication_status := 'awaiting_lead_review';
  end if;

  operation_result := jsonb_build_object('reportId', report.id, 'incidentCaseId', report.incident_case_id,
    'publicAvailable', published, 'publicationStatus', publication_status);
  update public.report_publication_operations set result = operation_result,
    completed_at = now() where operation_id = p_operation_id;
  return operation_result;
end;
$$;

revoke all on function public.review_report_with_publication(uuid,uuid,text,text,text,uuid,text,text,boolean,boolean,boolean,boolean,uuid[],boolean,boolean,text)
  from public, anon;
grant execute on function public.review_report_with_publication(uuid,uuid,text,text,text,uuid,text,text,boolean,boolean,boolean,boolean,uuid[],boolean,boolean,text)
  to authenticated;

create function public.record_incident_finding_with_publication(
  p_operation_id uuid, p_incident_case_id uuid, p_finding text, p_note text,
  p_public_correction text default null, p_report_publications jsonb default '[]'::jsonb,
  p_mark_incident_sensitive boolean default false, p_sensitivity_reason text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); request_hash text; operation public.report_publication_operations;
  incident public.incident_cases; report public.reports; item jsonb; selected_report_id uuid;
  photo_id uuid; photo_text text; photo_ids uuid[]; operation_result jsonb; published_ids uuid[] := '{}'::uuid[];
  publication_status text := 'private'; sensitivity_reason text;
begin
  if actor_id is null or not public.has_active_profile() or not public.is_officer() then
    raise exception 'An active official must record a finding.' using errcode = '42501';
  end if;
  if p_operation_id is null or p_incident_case_id is null
    or p_report_publications is null or jsonb_typeof(p_report_publications) <> 'array' then
    raise exception 'A durable operation id and valid report publication list are required.' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_report_publications) loop
    if jsonb_typeof(item) <> 'object'
      or item - array['reportId','publicTitle','publicDescription','publish','photoMediaIds',
        'approveReporterName','approveReporterAvatar','approveExactLocation','publicationAcknowledged'] <> '{}'::jsonb
      or nullif(item->>'reportId','') is null
      or (item->>'publish') is not null and jsonb_typeof(item->'publish') <> 'boolean'
      or (item->>'approveReporterName') is not null and jsonb_typeof(item->'approveReporterName') <> 'boolean'
      or (item->>'approveReporterAvatar') is not null and jsonb_typeof(item->'approveReporterAvatar') <> 'boolean'
      or (item->>'approveExactLocation') is not null and jsonb_typeof(item->'approveExactLocation') <> 'boolean'
      or coalesce((item->>'publish')::boolean, false)
        and not coalesce((item->>'publicationAcknowledged')::boolean, false)
      or (item->'photoMediaIds' is not null and jsonb_typeof(item->'photoMediaIds') <> 'array')
      or not coalesce((item->>'publish')::boolean, false)
        and jsonb_array_length(coalesce(item->'photoMediaIds', '[]'::jsonb)) > 0 then
      raise exception 'Invalid screened report publication entry.' using errcode = '22023';
    end if;
    for photo_text in select value from jsonb_array_elements_text(coalesce(item->'photoMediaIds', '[]'::jsonb)) loop
      if photo_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        raise exception 'Invalid selected photo id.' using errcode = '22023';
      end if;
    end loop;
  end loop;
  if (select count(*) from jsonb_array_elements(p_report_publications)) <>
    (select count(distinct value->>'reportId') from jsonb_array_elements(p_report_publications)) then
    raise exception 'A report can appear only once in the publication list.' using errcode = '22023';
  end if;
  sensitivity_reason := public.report_flow_text(p_sensitivity_reason,
    coalesce(p_mark_incident_sensitive, false), 280);
  if coalesce(p_mark_incident_sensitive, false) and p_finding <> 'confirmed' then
    raise exception 'Only a confirmed field finding can be marked sensitive.' using errcode = '22023';
  end if;
  if coalesce(p_mark_incident_sensitive, false) and exists (
    select 1 from jsonb_array_elements(p_report_publications) entry
      where coalesce((entry.value->>'publish')::boolean, false)) then
    raise exception 'Sensitive incidents cannot publish report posts or photos.' using errcode = '22023';
  end if;
  request_hash := encode(extensions.digest(jsonb_build_object(
    'incidentCaseId', p_incident_case_id, 'finding', p_finding, 'note', p_note,
    'publicCorrection', p_public_correction, 'reportPublications', p_report_publications,
    'markSensitive', coalesce(p_mark_incident_sensitive, false), 'sensitivityReason', sensitivity_reason)::text, 'sha256'), 'hex');
  insert into public.report_publication_operations(operation_id, actor_id, request_hash)
    values (p_operation_id, actor_id, request_hash) on conflict (operation_id) do nothing;
  select * into operation from public.report_publication_operations where operation_id = p_operation_id for update;
  if operation.actor_id is distinct from actor_id or operation.request_hash is distinct from request_hash then
    raise exception 'This operation id is already bound to a different request.' using errcode = '23505';
  end if;
  if operation.result is not null then
    select * into incident from public.incident_cases
      where id = (operation.result->>'incidentCaseId')::uuid;
    if not found or not public.can_read_incident_case(incident) or not public.is_incident_lead(incident) then
      raise exception 'You no longer have access to this incident finding.' using errcode = '42501';
    end if;
    for selected_report_id in select linked_report.id from public.reports linked_report
      where linked_report.incident_case_id = incident.id
        and public.report_public_post_is_current(linked_report.id) order by linked_report.id loop
      published_ids := array_append(published_ids, selected_report_id);
    end loop;
    operation_result := jsonb_set(operation.result, '{publishedReportIds}', to_jsonb(published_ids), true);
    operation_result := jsonb_set(operation_result, '{publicAvailable}', to_jsonb(cardinality(published_ids) > 0), true);
    operation_result := jsonb_set(operation_result, '{publicationStatus}',
      to_jsonb(case when cardinality(published_ids) > 0 then 'published'
        when incident.is_sensitive then 'sensitive' else 'private' end), true);
    update public.report_publication_operations set result = operation_result where operation_id = p_operation_id;
    return operation_result;
  end if;

  select * into incident from public.incident_cases where id = p_incident_case_id for update;
  if not found then raise exception 'Incident not found.' using errcode = 'P0002'; end if;
  perform public.require_incident_lead(incident);

  -- Prelock any referenced reports in a stable order after the incident lock.
  for selected_report_id in select linked_report.id from public.reports linked_report
    where linked_report.incident_case_id = incident.id order by linked_report.id loop
    select * into report from public.reports where id = selected_report_id for update;
  end loop;
  if exists (select 1 from jsonb_array_elements(p_report_publications) entry
      where not exists (select 1 from public.reports linked_report
        where linked_report.id = (entry.value->>'reportId')::uuid and linked_report.incident_case_id = incident.id)) then
    raise exception 'A screened report is no longer linked to this incident.' using errcode = '22023';
  end if;

  incident := public.record_incident_finding(p_incident_case_id, p_finding, p_note, p_public_correction);
  if coalesce(p_mark_incident_sensitive, false) then
    perform public.set_incident_sensitive(incident.id, true, sensitivity_reason);
    select * into incident from public.incident_cases where id = incident.id;
    publication_status := 'sensitive';
  elsif p_finding = 'confirmed' and incident.verification = 'confirmed'
    and incident.withdrawn_at is null and not incident.is_sensitive then
    if not public.report_public_post_is_current(incident.source_report_id)
      and not exists (select 1 from jsonb_array_elements(p_report_publications) source_entry
        where (source_entry.value->>'reportId')::uuid = incident.source_report_id
          and coalesce((source_entry.value->>'publish')::boolean, false)) then
      raise exception 'Screen a public post for the incident source report as part of this finding.' using errcode = '22023';
    end if;
    for item in select value from jsonb_array_elements(p_report_publications)
      order by (value->>'reportId')::uuid loop
      if coalesce((item->>'publish')::boolean, false) then
        if not exists (select 1 from public.reports source_report
          where source_report.id = (item->>'reportId')::uuid and source_report.incident_case_id = incident.id) then
          raise exception 'A screened report is no longer linked to this incident.' using errcode = '22023';
        end if;
        photo_ids := array(select value::text::uuid from jsonb_array_elements_text(
          coalesce(item->'photoMediaIds', '[]'::jsonb)) value);
        if cardinality(photo_ids) <> (select count(distinct selected_id)::integer from unnest(photo_ids) selected_id) then
          raise exception 'Duplicate photo selection.' using errcode = '22023';
        end if;
        selected_report_id := (item->>'reportId')::uuid;
        perform public.set_report_public_post(selected_report_id, item->>'publicTitle', item->>'publicDescription', true,
          coalesce((item->>'approveReporterName')::boolean, false),
          coalesce((item->>'approveReporterAvatar')::boolean, false),
          coalesce((item->>'approveExactLocation')::boolean, false));
        foreach photo_id in array photo_ids loop
          if not exists (select 1 from public.report_media media where media.id = photo_id and media.report_id = selected_report_id) then
            raise exception 'A selected photo is no longer attached to this report.' using errcode = '22023';
          end if;
          perform public.set_report_media_public(photo_id, true, 'Approved with the screened report post.');
        end loop;
        published_ids := array_append(published_ids, selected_report_id);
      end if;
    end loop;
    select coalesce(array_agg(linked_report.id order by linked_report.id), '{}'::uuid[]) into published_ids
      from public.reports linked_report where linked_report.incident_case_id = incident.id
        and public.report_public_post_is_current(linked_report.id);
    if cardinality(published_ids) > 0 then publication_status := 'published'; end if;
  elsif incident.is_sensitive then
    publication_status := 'sensitive';
  elsif p_finding = 'not_confirmed' then
    publication_status := 'not_confirmed';
  end if;

  operation_result := jsonb_build_object('incidentCaseId', incident.id,
    'publicAvailable', cardinality(published_ids) > 0, 'publicationStatus', publication_status,
    'publishedReportIds', to_jsonb(published_ids));
  update public.report_publication_operations set result = operation_result,
    completed_at = now() where operation_id = p_operation_id;
  return operation_result;
end;
$$;

revoke all on function public.record_incident_finding_with_publication(uuid,uuid,text,text,text,jsonb,boolean,text)
  from public, anon;
grant execute on function public.record_incident_finding_with_publication(uuid,uuid,text,text,text,jsonb,boolean,text)
  to authenticated;

create function public.create_official_report_with_publication(
  p_operation_id uuid, p_reporter_id uuid, p_report_id uuid,
  p_title text, p_description text, p_latitude double precision, p_longitude double precision,
  p_address_text text, p_media jsonb, p_barangay_id uuid, p_incident_type text,
  p_incident_type_other text, p_intake_channel public.report_intake_channel,
  p_public_title text, p_public_description text, p_publish boolean,
  p_publication_acknowledged boolean, p_photo_proofs jsonb default '[]'::jsonb,
  p_mark_incident_sensitive boolean default false, p_sensitivity_reason text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare request_hash text; operation public.report_publication_operations; report_id uuid; report public.reports;
  incident_id uuid; photo_proof jsonb; media_id uuid; photo_ids uuid[] := '{}'::uuid[];
  profile public.app_profiles; operation_result jsonb; publication_status text := 'private';
  sensitivity_reason text; original_subject text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Official intake publication must use the trusted server.' using errcode = '42501';
  end if;
  select * into profile from public.app_profiles where id = p_reporter_id
    and role = 'officer' and status = 'active';
  if not found then raise exception 'An active official is required.' using errcode = '42501'; end if;
  if p_operation_id is null or p_report_id is null or p_reporter_id is null or p_intake_channel is null
    or p_intake_channel not in ('official_field','hotline_call')
    or p_photo_proofs is null or jsonb_typeof(p_photo_proofs) <> 'array' then
    raise exception 'Invalid official intake request.' using errcode = '22023';
  end if;
  if coalesce(p_publish, false) and (p_intake_channel <> 'official_field'
    or not coalesce(p_publication_acknowledged, false)) then
    raise exception 'Only an explicitly screened field observation can be published.' using errcode = '22023';
  end if;
  sensitivity_reason := public.report_flow_text(p_sensitivity_reason,
    p_intake_channel = 'official_field' and coalesce(p_mark_incident_sensitive, false), 280);
  if p_intake_channel = 'hotline_call' and coalesce(p_mark_incident_sensitive, false) then
    raise exception 'Hotline reports remain unconfirmed and private.' using errcode = '22023';
  end if;
  if coalesce(p_mark_incident_sensitive, false) and coalesce(p_publish, false) then
    raise exception 'Sensitive incidents remain private and cannot publish report photos.' using errcode = '22023';
  end if;
  if p_intake_channel = 'official_field' and not coalesce(p_publish, false)
    and not coalesce(p_mark_incident_sensitive, false) then
    raise exception 'Publish the screened field report or mark it sensitive for safety.' using errcode = '22023';
  end if;
  if not coalesce(p_publish, false) and jsonb_array_length(p_photo_proofs) > 0 then
    raise exception 'Process selected photos only when publishing the screened post.' using errcode = '22023';
  end if;

  request_hash := encode(extensions.digest(jsonb_build_object(
    'reporterId', p_reporter_id, 'reportId', p_report_id, 'title', p_title, 'description', p_description,
    'latitude', p_latitude, 'longitude', p_longitude, 'addressText', p_address_text, 'media', p_media,
    'barangayId', p_barangay_id, 'incidentType', p_incident_type, 'incidentTypeOther', p_incident_type_other,
    'intakeChannel', p_intake_channel, 'publicTitle', p_public_title, 'publicDescription', p_public_description,
    'publish', coalesce(p_publish, false), 'publicationAcknowledged', coalesce(p_publication_acknowledged, false),
    'markSensitive', coalesce(p_mark_incident_sensitive, false), 'sensitivityReason', sensitivity_reason,
    'photoProofs', p_photo_proofs)::text, 'sha256'), 'hex');
  insert into public.report_publication_operations(operation_id, actor_id, request_hash)
    values (p_operation_id, p_reporter_id, request_hash) on conflict (operation_id) do nothing;
  select * into operation from public.report_publication_operations where operation_id = p_operation_id for update;
  if operation.actor_id is distinct from p_reporter_id or operation.request_hash is distinct from request_hash then
    raise exception 'This operation id is already bound to a different request.' using errcode = '23505';
  end if;
  original_subject := current_setting('request.jwt.claim.sub', true);
  perform set_config('request.jwt.claim.sub', p_reporter_id::text, true);
  if operation.result is not null then
    select source_report.* into report from public.reports source_report
      where source_report.id = (operation.result->>'reportId')::uuid
        and source_report.reporter_id = p_reporter_id;
    if not found or not public.can_read_report(report) then
      raise exception 'You no longer have access to this official report.' using errcode = '42501';
    end if;
    operation_result := jsonb_set(operation.result, '{publicAvailable}',
      to_jsonb(public.report_public_post_is_current(report.id)), true);
    operation_result := jsonb_set(operation_result, '{publicationStatus}',
      to_jsonb(case when public.report_public_post_is_current(report.id) then 'published'
        when exists(select 1 from public.incident_cases current_incident
          where current_incident.id = report.incident_case_id and current_incident.is_sensitive) then 'sensitive'
        else 'private' end), true);
    update public.report_publication_operations set result = operation_result where operation_id = p_operation_id;
    perform set_config('request.jwt.claim.sub', coalesce(original_subject, ''), true);
    return operation_result;
  end if;

  -- The legacy service-only intake uses a trusted actor id argument. Clearing
  -- auth.uid only during that insert preserves its immutable location guard.
  perform set_config('request.jwt.claim.sub', '', true);
  report_id := public.create_official_report_with_media(p_reporter_id, p_report_id, p_title, p_description,
    p_latitude, p_longitude, p_address_text, p_media, p_barangay_id, p_incident_type,
    p_incident_type_other, p_intake_channel);
  perform set_config('request.jwt.claim.sub', p_reporter_id::text, true);
  select incident_case_id into incident_id from public.reports where id = report_id;

  if coalesce(p_mark_incident_sensitive, false) then
    if incident_id is null then raise exception 'The field report has no incident case.' using errcode = 'P0002'; end if;
    perform public.set_incident_sensitive(incident_id, true, sensitivity_reason);
    publication_status := 'sensitive';
  elsif coalesce(p_publish, false) then
    for photo_proof in select value from jsonb_array_elements(p_photo_proofs) loop
      if jsonb_typeof(photo_proof) <> 'object'
        or photo_proof - array['mediaId','sourceStoragePath','sourceObjectId','displaySourcePath',
          'displaySourceObjectId','thumbnailSourcePath','thumbnailSourceObjectId','displaySafePath',
          'displaySafeObjectId','displaySha256','displaySize','displayWidth','displayHeight',
          'thumbnailSafePath','thumbnailSafeObjectId','thumbnailSha256','thumbnailSize',
          'thumbnailWidth','thumbnailHeight','processorVersion'] <> '{}'::jsonb then
        raise exception 'Invalid verified photo proof.' using errcode = '22023';
      end if;
      media_id := (photo_proof->>'mediaId')::uuid;
      perform public.register_public_report_photo_derivatives(report_id, media_id, p_reporter_id,
        photo_proof->>'sourceStoragePath', (photo_proof->>'sourceObjectId')::uuid,
        photo_proof->>'displaySourcePath', (photo_proof->>'displaySourceObjectId')::uuid,
        photo_proof->>'thumbnailSourcePath', (photo_proof->>'thumbnailSourceObjectId')::uuid,
        photo_proof->>'displaySafePath', (photo_proof->>'displaySafeObjectId')::uuid,
        photo_proof->>'displaySha256', (photo_proof->>'displaySize')::integer,
        (photo_proof->>'displayWidth')::integer, (photo_proof->>'displayHeight')::integer,
        photo_proof->>'thumbnailSafePath', (photo_proof->>'thumbnailSafeObjectId')::uuid,
        photo_proof->>'thumbnailSha256', (photo_proof->>'thumbnailSize')::integer,
        (photo_proof->>'thumbnailWidth')::integer, (photo_proof->>'thumbnailHeight')::integer,
        (photo_proof->>'processorVersion')::integer);
      photo_ids := array_append(photo_ids, media_id);
    end loop;
    if cardinality(photo_ids) <> (select count(distinct item)::integer from unnest(photo_ids) item) then
      raise exception 'Duplicate photo proof.' using errcode = '22023';
    end if;
    perform public.set_report_public_post(report_id, p_public_title, p_public_description, true, false, false, false);
    foreach media_id in array photo_ids loop
      perform public.set_report_media_public(media_id, true, 'Approved with the screened official field post.');
    end loop;
    publication_status := 'published';
  end if;

  operation_result := jsonb_build_object('reportId', report_id, 'incidentCaseId', incident_id,
    'publicAvailable', coalesce(p_publish, false), 'publicationStatus', publication_status);
  update public.report_publication_operations set result = operation_result,
    completed_at = now() where operation_id = p_operation_id;
  perform set_config('request.jwt.claim.sub', coalesce(original_subject, ''), true);
  return operation_result;
end;
$$;

revoke all on function public.create_official_report_with_publication(uuid,uuid,uuid,text,text,double precision,double precision,
  text,jsonb,uuid,text,text,public.report_intake_channel,text,text,boolean,boolean,jsonb,boolean,text) from public, anon, authenticated;
grant execute on function public.create_official_report_with_publication(uuid,uuid,uuid,text,text,double precision,double precision,
  text,jsonb,uuid,text,text,public.report_intake_channel,text,text,boolean,boolean,jsonb,boolean,text) to service_role;

-- Public feeds expose only the registered metadata-safe copies. Keep each
-- display and thumbnail in the same aggregate row before building the arrays.
create or replace function public.public_incident_record(p_incident_case_id uuid)
returns table (incident_case_id uuid, incident_type text, public_type_label text, barangay_name text,
  public_location_mode text, approx_latitude double precision, approx_longitude double precision,
  exact_latitude double precision, exact_longitude double precision, safety_location_reason text,
  public_status text, confirmed_at timestamptz, last_public_update_at timestamptz,
  latest_public_update text, public_summary text, public_correction text, linked_report_count integer,
  public_photo_display_paths text[], public_photo_thumbnail_paths text[], public_title text,
  public_caption text, public_landmark text, support_count integer, comment_count integer, has_supported boolean)
language sql stable security definer set search_path = '' as $$
  select incident.id, incident.incident_type,
    coalesce(incident.public_type_label, case incident.incident_type when 'other' then 'Other incident'
      when 'fire' then 'Fire' when 'flood' then 'Flood' when 'road_crash' then 'Road crash'
      when 'medical' then 'Medical emergency' else 'Incident' end),
    coalesce(barangay.name, 'Municipality'),
    case when incident.is_sensitive then 'barangay_only' else incident.public_location_mode end,
    case when not incident.is_sensitive and incident.public_location_mode = 'approximate_area'
      then round(extensions.st_y(incident.location::extensions.geometry)::numeric, 2)::double precision end,
    case when not incident.is_sensitive and incident.public_location_mode = 'approximate_area'
      then round(extensions.st_x(incident.location::extensions.geometry)::numeric, 2)::double precision end,
    case when not incident.is_sensitive and incident.public_location_mode = 'exact_for_safety'
      then extensions.st_y(incident.location::extensions.geometry) end,
    case when not incident.is_sensitive and incident.public_location_mode = 'exact_for_safety'
      then extensions.st_x(incident.location::extensions.geometry) end,
    case when not incident.is_sensitive and incident.public_location_mode = 'exact_for_safety'
      then incident.public_location_reason end,
    case when incident.withdrawn_at is not null then 'withdrawn' when incident.state = 'resolved' then 'resolved'
      when public.incident_has_current_response(incident.id) then 'response_ongoing' else 'confirmed' end,
    incident.confirmed_at, latest.occurred_at, latest.public_text, incident.public_summary,
    incident.public_correction,
    (select count(*)::integer from public.reports linked_report where linked_report.incident_case_id = incident.id),
    coalesce(photos.displays, array[]::text[]), coalesce(photos.thumbnails, array[]::text[]),
    case when incident.withdrawn_at is null and not incident.is_sensitive then incident.public_title end,
    case when incident.withdrawn_at is null and not incident.is_sensitive then incident.public_caption end,
    case when incident.withdrawn_at is null and not incident.is_sensitive
      and incident.public_location_mode <> 'barangay_only' then incident.public_landmark end,
    (select count(*)::integer from public.incident_upvotes vote where vote.incident_case_id = incident.id),
    (select count(*)::integer from public.incident_comments comment
      where comment.incident_case_id = incident.id and not comment.is_hidden),
    exists (select 1 from public.incident_upvotes vote
      where vote.incident_case_id = incident.id and vote.user_id = auth.uid())
  from public.incident_cases incident
  left join public.barangays barangay on barangay.id = incident.barangay_id
  left join lateral (select event.occurred_at,
    coalesce(event.details->>'public_text', event.details->>'text') as public_text
    from public.incident_events event where event.incident_case_id = incident.id and event.is_public
      and event.event_type in ('progress_update','resolved','summary_added','withdrawn')
    order by event.occurred_at desc, event.id desc limit 1) latest on true
  left join lateral (
    select array_agg(proof.display_safe_path order by media.id) as displays,
      array_agg(proof.thumbnail_safe_path order by media.id) as thumbnails
    from public.report_media media
    join public.reports linked_report on linked_report.id = media.report_id
    join public.report_public_photo_derivatives proof on proof.report_id = linked_report.id and proof.media_id = media.id
    where linked_report.incident_case_id = incident.id and media.type = 'photo'
      and media.public_approved_at is not null and not incident.is_sensitive
      and incident.withdrawn_at is null and incident.verification = 'confirmed'
      and public.is_verified_public_report_photo(linked_report.id, media.id)
  ) photos on true
  where incident.id = p_incident_case_id and public.has_active_profile()
    and ((incident.verification = 'confirmed' and incident.withdrawn_at is null)
      or (incident.withdrawn_at is not null and not incident.is_sensitive));
$$;

drop function public.list_public_community_posts(uuid,integer,integer);
drop function public.get_public_report(uuid);
drop function public.list_public_reports(uuid,integer,integer);
drop function public.public_report_record(uuid);

create function public.public_report_record(p_report_id uuid)
returns table(report_id uuid, incident_case_id uuid, public_title text, public_description text,
  incident_type text, public_type_label text, barangay_name text, public_location_mode text,
  approx_latitude double precision, approx_longitude double precision,
  exact_latitude double precision, exact_longitude double precision,
  reporter_name text, reporter_avatar_path text, created_at timestamptz,
  public_status text, confirmed_at timestamptz, latest_public_update_at timestamptz,
  latest_public_update text, public_summary text, public_correction text,
  public_photo_display_paths text[], public_photo_thumbnail_paths text[],
  support_count integer, comment_count integer, has_supported boolean)
language sql stable security definer set search_path = '' as $$
  select source_report.id, incident.id, post.public_title, post.public_description,
    source_report.incident_type,
    coalesce(incident.public_type_label, case source_report.incident_type when 'other' then 'Other incident'
      when 'fire' then 'Fire' when 'flood' then 'Flood' when 'road_crash' then 'Road crash'
      when 'medical' then 'Medical emergency' else 'Incident' end),
    coalesce(barangay.name, 'Municipality'),
    case when preference.allow_exact_location and post.exact_location_approved
      and incident.public_location_mode <> 'barangay_only' then 'exact_shared'
      when incident.public_location_mode in ('approximate_area','exact_for_safety') then 'approximate_area'
      else 'barangay_only' end,
    case when not (preference.allow_exact_location and post.exact_location_approved)
      and incident.public_location_mode in ('approximate_area','exact_for_safety')
      then round(extensions.st_y(source_report.location::extensions.geometry)::numeric, 2)::double precision end,
    case when not (preference.allow_exact_location and post.exact_location_approved)
      and incident.public_location_mode in ('approximate_area','exact_for_safety')
      then round(extensions.st_x(source_report.location::extensions.geometry)::numeric, 2)::double precision end,
    case when preference.allow_exact_location and post.exact_location_approved
      and incident.public_location_mode <> 'barangay_only'
      then extensions.st_y(source_report.location::extensions.geometry) end,
    case when preference.allow_exact_location and post.exact_location_approved
      and incident.public_location_mode <> 'barangay_only'
      then extensions.st_x(source_report.location::extensions.geometry) end,
    case when preference.show_reporter_name and post.reporter_name_approved then nullif(concat_ws(' ', profile.first_name,
      nullif(profile.middle_name, ''), profile.last_name), '') end,
    case when preference.show_reporter_avatar and post.reporter_avatar_approved then profile.avatar_path end,
    source_report.created_at,
    case when incident.state = 'resolved' then 'resolved'
      when public.incident_has_current_response(incident.id) then 'response_ongoing' else 'confirmed' end,
    incident.confirmed_at, latest.occurred_at, latest.public_text, incident.public_summary, incident.public_correction,
    coalesce(photos.displays, array[]::text[]), coalesce(photos.thumbnails, array[]::text[]),
    (select count(*)::integer from public.incident_upvotes vote where vote.incident_case_id = incident.id),
    (select count(*)::integer from public.incident_comments comment
      where comment.incident_case_id = incident.id and not comment.is_hidden),
    exists(select 1 from public.incident_upvotes vote
      where vote.incident_case_id = incident.id and vote.user_id = auth.uid())
  from public.reports source_report
  join public.report_public_posts post on post.report_id = source_report.id and post.is_published
  join public.report_publication_preferences preference on preference.report_id = source_report.id
  join public.incident_cases incident on incident.id = source_report.incident_case_id
  left join public.barangays barangay on barangay.id = source_report.barangay_id
  left join public.app_profiles profile on profile.id = source_report.reporter_id
  left join lateral (select event.occurred_at,
    coalesce(event.details->>'public_text', event.details->>'text') as public_text
    from public.incident_events event where event.incident_case_id = incident.id and event.is_public
      and event.event_type in ('progress_update','resolved','summary_added')
    order by event.occurred_at desc, event.id desc limit 1) latest on true
  left join lateral (
    select array_agg(proof.display_safe_path order by media.position, media.id) as displays,
      array_agg(proof.thumbnail_safe_path order by media.position, media.id) as thumbnails
    from public.report_media media
    join public.report_public_photo_derivatives proof on proof.report_id = source_report.id and proof.media_id = media.id
    where media.report_id = source_report.id and media.type = 'photo' and media.public_approved_at is not null
      and public.is_verified_public_report_photo(source_report.id, media.id)
  ) photos on true
  where source_report.id = p_report_id and public.has_active_profile()
    and incident.verification = 'confirmed' and incident.withdrawn_at is null and not incident.is_sensitive;
$$;

create function public.list_public_reports(p_barangay_id uuid default null,
  p_limit integer default 50, p_offset integer default 0)
returns table(report_id uuid, incident_case_id uuid, public_title text, public_description text,
  incident_type text, public_type_label text, barangay_name text, public_location_mode text,
  approx_latitude double precision, approx_longitude double precision,
  exact_latitude double precision, exact_longitude double precision,
  reporter_name text, reporter_avatar_path text, created_at timestamptz,
  public_status text, confirmed_at timestamptz, latest_public_update_at timestamptz,
  latest_public_update text, public_summary text, public_correction text,
  public_photo_display_paths text[], public_photo_thumbnail_paths text[],
  support_count integer, comment_count integer, has_supported boolean)
language sql stable security definer set search_path = '' as $$
  select record.* from public.reports source_report
  cross join lateral public.public_report_record(source_report.id) record
  where p_barangay_id is null or source_report.barangay_id = p_barangay_id
  order by coalesce(record.latest_public_update_at, record.confirmed_at, record.created_at) desc, record.report_id
  limit greatest(1, least(coalesce(p_limit,50),100)) offset greatest(0,coalesce(p_offset,0));
$$;

create function public.get_public_report(p_report_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('report', to_jsonb(record), 'updates', coalesce((
    select jsonb_agg(jsonb_build_object('occurred_at', event.occurred_at, 'entry_type', event.event_type,
      'public_text', coalesce(event.details->>'public_text', event.details->>'text')) order by event.occurred_at, event.id)
    from public.incident_events event where event.incident_case_id = record.incident_case_id and event.is_public
      and event.event_type in ('progress_update','resolved','summary_added')
  ), '[]'::jsonb)) from public.public_report_record(p_report_id) record;
$$;

create function public.list_public_community_posts(p_barangay_id uuid default null,
  p_limit integer default 50, p_offset integer default 0)
returns table(post_kind text, report_id uuid, incident_case_id uuid, post_data jsonb)
language sql stable security definer set search_path = '' as $$
  with visible_posts as (
    select 'report'::text as post_kind, record.report_id, record.incident_case_id, to_jsonb(record) as post_data,
      coalesce(record.latest_public_update_at, record.confirmed_at, record.created_at) as sort_at
    from public.reports source_report
    cross join lateral public.public_report_record(source_report.id) record
    where p_barangay_id is null or source_report.barangay_id = p_barangay_id
    union all
    select 'incident'::text, null::uuid, record.incident_case_id, to_jsonb(record),
      coalesce(record.last_public_update_at, record.confirmed_at, incident.created_at)
    from public.incident_cases incident
    cross join lateral public.public_incident_record(incident.id) record
    where (p_barangay_id is null or incident.barangay_id = p_barangay_id)
      and (incident.withdrawn_at is null or incident.withdrawn_at >= now() - interval '7 days')
      and not exists (select 1 from public.reports linked_report
        join public.report_public_posts post on post.report_id = linked_report.id and post.is_published
        where linked_report.incident_case_id = incident.id and incident.verification = 'confirmed'
          and incident.withdrawn_at is null and not incident.is_sensitive)
  )
  select visible_posts.post_kind, visible_posts.report_id, visible_posts.incident_case_id, visible_posts.post_data
  from visible_posts order by visible_posts.sort_at desc, visible_posts.incident_case_id,
    visible_posts.report_id nulls last
  limit greatest(1, least(coalesce(p_limit, 50), 100)) offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.public_report_record(uuid) from public, anon, authenticated;
revoke all on function public.list_public_reports(uuid,integer,integer), public.get_public_report(uuid),
  public.list_public_community_posts(uuid,integer,integer), public.public_incident_record(uuid)
  from public, anon;
grant execute on function public.list_public_reports(uuid,integer,integer), public.get_public_report(uuid),
  public.list_public_community_posts(uuid,integer,integer), public.list_public_incidents(uuid,integer,integer),
  public.get_public_incident(uuid) to authenticated;
