begin;

-- Authorize the caller before looking up a media id so this RPC cannot be used
-- as a media-existence oracle by residents or the Mayor account.
create or replace function public.set_report_media_public(
  p_media_id uuid,
  p_make_public boolean,
  p_reason text default null
)
returns public.report_media
language plpgsql
security definer
set search_path = ''
as $$
declare
  media public.report_media;
  source_report public.reports;
  incident public.incident_cases;
  case_id uuid;
  report_id uuid;
begin
  if not public.has_active_profile() or not public.is_officer() then
    raise exception 'An active official must review report photos.' using errcode = '42501';
  end if;

  select report_row.id, report_row.incident_case_id
    into report_id, case_id
    from public.report_media media_row
    join public.reports report_row on report_row.id = media_row.report_id
    where media_row.id = p_media_id;
  if case_id is null then
    raise exception 'Media must belong to an incident.' using errcode = 'P0002';
  end if;

  -- Keep case locks ahead of report and media locks to match publication flows.
  select * into incident from public.incident_cases where id = case_id for update;
  if not found then raise exception 'Incident not found.' using errcode = 'P0002'; end if;
  select report_row.* into source_report from public.reports report_row
    where report_row.id = report_id for update;
  if not found or source_report.incident_case_id is distinct from case_id then
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
  if p_make_public and (
    incident.verification <> 'confirmed'
    or incident.withdrawn_at is not null
    or incident.is_sensitive
    or not public.is_verified_public_report_photo(source_report.id, media.id)
  ) then
    raise exception 'Photo publication requires a confirmed non-sensitive incident and verified safe copies.' using errcode = '22023';
  end if;

  return public.set_report_media_public_unchecked(p_media_id, p_make_public, p_reason);
end;
$$;

-- Public-safe copies are immutable. Keep existing private-evidence delete
-- permissions for authorized admins, MDRRMO, and the scoped BDRRMO.
create or replace function public.can_delete_report_media_path(p_storage_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_storage_path like 'public-safe/%' or not public.has_active_profile() then
    return false;
  end if;
  if public.is_bdrrmo() then
    return exists (
      select 1
      from public.report_media media
      join public.reports source_report on source_report.id = media.report_id
      where media.storage_path = p_storage_path
        and source_report.barangay_id = public.current_app_barangay_id()
    );
  end if;
  return public.is_admin() or public.is_mdrrmo();
end;
$$;

revoke all on function public.set_report_media_public(uuid, boolean, text) from public, anon;
grant execute on function public.set_report_media_public(uuid, boolean, text) to authenticated;
revoke all on function public.can_delete_report_media_path(text) from public, anon;
grant execute on function public.can_delete_report_media_path(text) to authenticated, service_role;

commit;
