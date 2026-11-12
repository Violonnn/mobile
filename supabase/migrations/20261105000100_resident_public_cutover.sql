-- Phase 4: source reports stay private; public information has a separate,
-- deliberately limited projection. No client gets raw incident rows through it.
create or replace function public.can_read_report(p_report public.reports)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_active_profile() then return false; end if;
  if public.is_bdrrmo() then
    return coalesce(p_report.barangay_id = public.current_app_barangay_id()
      or exists (select 1 from public.incident_cases incident where incident.id = p_report.incident_case_id
        and (public.is_incident_lead(incident) or public.is_incident_supporter(incident))), false);
  end if;
  if public.is_mdrrmo() then return true; end if;
  if public.is_admin() then return true; end if;
  -- The Mayor uses dedicated oversight projections, never source reports.
  return not public.is_mayor() and p_report.reporter_id = auth.uid();
end;
$$;

create or replace function public.can_read_report_id(p_report_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports report where report.id = p_report_id
    and public.can_read_report(report));
$$;

-- Preserve existing aggregate charts without restoring access to source rows.
create function public.report_totals_snapshot()
returns table (barangay_id uuid,barangay_name text,status public.report_status,report_count bigint)
language sql stable security definer set search_path = '' as $$
  select report.barangay_id,coalesce(nullif(btrim(barangay.name),''),'Unassigned'),report.status,count(*)
  from public.reports report left join public.barangays barangay on barangay.id = report.barangay_id
  where public.is_mayor() or public.is_mdrrmo()
    or (public.is_bdrrmo() and report.barangay_id = public.current_app_barangay_id())
  group by report.barangay_id,barangay.name,report.status;
$$;
create or replace view public.report_totals_by_barangay with (security_invoker = true) as
  select * from public.report_totals_snapshot();
alter function public.mayor_report_activity(text,uuid) security definer;
revoke all on function public.report_totals_snapshot() from public,anon;
grant execute on function public.report_totals_snapshot() to authenticated;

create function public.incident_has_current_response(p_incident_case_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.incident_events event
    join public.incident_cases incident on incident.id = event.incident_case_id
    where incident.id = p_incident_case_id
      and event.event_type in ('dispatch_confirmed','responders_on_site','assistance_given','work_done')
      and event.occurred_at >= coalesce((select max(period.occurred_at) from public.incident_events period
        where period.incident_case_id = incident.id and (period.event_type = 'reopened'
          or (incident.lead_office = 'municipal' and period.event_type = 'transfer_accepted'))), '-infinity'));
$$;

create function public.public_incident_record(p_incident_case_id uuid)
returns table (incident_case_id uuid, incident_type text, public_type_label text, barangay_name text,
  public_location_mode text, approx_latitude double precision, approx_longitude double precision,
  exact_latitude double precision, exact_longitude double precision, safety_location_reason text,
  public_status text, confirmed_at timestamptz, last_public_update_at timestamptz,
  latest_public_update text, public_summary text, public_correction text, linked_report_count integer,
  public_photo_display_paths text[], public_photo_thumbnail_paths text[])
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
    (select count(*)::integer from public.reports report where report.incident_case_id = incident.id),
    coalesce(photos.displays, array[]::text[]), coalesce(photos.thumbnails, array[]::text[])
  from public.incident_cases incident
  left join public.barangays barangay on barangay.id = incident.barangay_id
  left join lateral (select event.occurred_at,
    coalesce(event.details->>'public_text', event.details->>'text') as public_text
    from public.incident_events event where event.incident_case_id = incident.id and event.is_public
      and event.event_type in ('progress_update','resolved','summary_added','withdrawn')
    order by event.occurred_at desc, event.id desc limit 1) latest on true
  left join lateral (select array_agg(media.display_storage_path order by media.id) as displays,
    array_agg(media.thumbnail_storage_path order by media.id) as thumbnails
    from public.report_media media join public.reports report on report.id = media.report_id
    where report.incident_case_id = incident.id and media.type = 'photo' and media.public_approved_at is not null
      and media.display_storage_path is not null and media.thumbnail_storage_path is not null
      and media.display_storage_path <> media.storage_path and media.thumbnail_storage_path <> media.storage_path
      and not incident.is_sensitive and incident.withdrawn_at is null and incident.verification = 'confirmed') photos on true
  where incident.id = p_incident_case_id and public.has_active_profile()
    and ((incident.verification = 'confirmed' and incident.withdrawn_at is null)
      or (incident.withdrawn_at is not null and not incident.is_sensitive));
$$;

create function public.list_public_incidents(p_barangay_id uuid default null,
  p_limit integer default 50, p_offset integer default 0)
returns table (incident_case_id uuid, incident_type text, public_type_label text, barangay_name text,
  public_location_mode text, approx_latitude double precision, approx_longitude double precision,
  exact_latitude double precision, exact_longitude double precision, safety_location_reason text,
  public_status text, confirmed_at timestamptz, last_public_update_at timestamptz,
  latest_public_update text, public_summary text, public_correction text, linked_report_count integer,
  public_photo_display_paths text[], public_photo_thumbnail_paths text[])
language sql stable security definer set search_path = '' as $$
  select record.* from public.incident_cases incident
  cross join lateral public.public_incident_record(incident.id) record
  where (p_barangay_id is null or incident.barangay_id = p_barangay_id)
    and (incident.withdrawn_at is null or incident.withdrawn_at >= now() - interval '7 days')
  order by coalesce(record.last_public_update_at, record.confirmed_at, incident.created_at) desc, incident.id
  limit greatest(1, least(coalesce(p_limit, 50), 100)) offset greatest(0, coalesce(p_offset, 0));
$$;

create function public.get_public_incident(p_incident_case_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('incident', to_jsonb(record), 'updates', coalesce((
    select jsonb_agg(jsonb_build_object('occurred_at', event.occurred_at, 'entry_type', event.event_type,
      'public_text', coalesce(event.details->>'public_text', event.details->>'text')) order by event.occurred_at, event.id)
    from public.incident_events event where event.incident_case_id = record.incident_case_id and event.is_public
      and event.event_type in ('progress_update','resolved','summary_added','withdrawn')
  ), '[]'::jsonb)) from public.public_incident_record(p_incident_case_id) record;
$$;

create or replace function public.can_read_report_media_path(p_storage_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_active_profile() and exists (
    select 1 from public.report_media media join public.reports report on report.id = media.report_id
    left join public.incident_cases incident on incident.id = report.incident_case_id
    where (media.storage_path = p_storage_path or media.display_storage_path = p_storage_path
      or media.thumbnail_storage_path = p_storage_path) and (
      public.is_current_user_report_owner(media.report_id)
      or (public.is_official() and not public.is_mayor() and public.can_read_report(report))
      or (media.type = 'photo' and media.public_approved_at is not null
        and incident.verification = 'confirmed' and incident.withdrawn_at is null and not incident.is_sensitive
        and p_storage_path <> media.storage_path
        and p_storage_path in (media.display_storage_path, media.thumbnail_storage_path))));
$$;

create function public.can_read_incident_discussion(p_incident_case_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_active_profile() and exists (select 1 from public.incident_cases incident
    where incident.id = p_incident_case_id and ((incident.verification = 'confirmed' and incident.withdrawn_at is null)
      or public.can_read_incident_case(incident)));
$$;
drop policy incident_comments_public_read on public.incident_comments;
drop policy incident_comments_public_insert on public.incident_comments;
create policy incident_comments_public_read on public.incident_comments for select to authenticated
  using (public.can_read_incident_discussion(incident_case_id) and not is_hidden);
create policy incident_comments_public_insert on public.incident_comments for insert to authenticated
  with check (public.can_read_incident_discussion(incident_case_id) and user_id = auth.uid()
    and not is_hidden and hidden_by is null and hidden_at is null);

-- Free-text legacy comments have no screening record. Nothing is automatically
-- copied: a scoped reviewer must explicitly approve an eligible body for copying.
alter table public.incident_comments add column legacy_comment_id uuid unique references public.comments(id);
revoke select on public.incident_comments from authenticated;
grant select(id,incident_case_id,user_id,body,parent_comment_id,is_hidden,created_at,updated_at)
  on public.incident_comments to authenticated;
create function public.publish_legacy_incident_comment(p_comment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare source public.comments; incident public.incident_cases;
begin
  select * into source from public.comments where id = p_comment_id;
  select incident_row.* into incident from public.incident_cases incident_row
    join public.reports report on report.incident_case_id = incident_row.id where report.id = source.report_id for update of incident_row;
  if incident.id is null or source.is_hidden or source.parent_comment_id is not null then
    raise exception 'Select a visible top-level comment on a confirmed incident.' using errcode = '22023';
  end if;
  perform public.require_incident_lead(incident);
  if incident.verification <> 'confirmed' or incident.withdrawn_at is not null then
    raise exception 'Incident must be public and confirmed.' using errcode = '22023';
  end if;
  insert into public.incident_comments(incident_case_id,user_id,body,created_at,legacy_comment_id)
    values(incident.id,source.user_id,source.body,source.created_at,source.id) on conflict(legacy_comment_id) do nothing;
end;
$$;

create function public.list_legacy_incident_comments(p_incident_case_id uuid,p_limit integer default 20,p_offset integer default 0)
returns table(id uuid,body text,created_at timestamptz,already_public boolean)
language plpgsql stable security definer set search_path = '' as $$
declare incident public.incident_cases;
begin
  select * into incident from public.incident_cases where incident_cases.id=p_incident_case_id;
  perform public.require_incident_lead(incident);
  return query select comment.id,comment.body,comment.created_at,
    exists(select 1 from public.incident_comments copied where copied.legacy_comment_id=comment.id)
  from public.comments comment join public.reports report on report.id=comment.report_id
  where report.incident_case_id=incident.id and not comment.is_hidden and comment.parent_comment_id is null
  order by comment.created_at,comment.id limit greatest(1,least(coalesce(p_limit,20),50)) offset greatest(0,coalesce(p_offset,0));
end;
$$;

-- Keep existing resident support on the incident rather than on private sources.
create table public.incident_upvotes (
  incident_case_id uuid not null references public.incident_cases(id) on delete cascade,
  user_id uuid not null references public.app_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(incident_case_id,user_id)
);
alter table public.incident_upvotes enable row level security;
revoke all on public.incident_upvotes from public,anon,authenticated;
grant select on public.incident_upvotes to authenticated;
grant all on public.incident_upvotes to service_role;
create policy incident_upvotes_own_read on public.incident_upvotes for select to authenticated
  using(user_id=auth.uid() and public.can_read_incident_discussion(incident_case_id));

-- Merge existing support across linked submissions without double counting a
-- resident who supported several reports about the same confirmed incident.
insert into public.incident_upvotes(incident_case_id,user_id,created_at)
select incident.id,vote.user_id,min(vote.created_at)
from public.report_upvotes vote join public.reports report on report.id=vote.report_id
join public.incident_cases incident on incident.id=report.incident_case_id
where incident.verification='confirmed' and incident.withdrawn_at is null
group by incident.id,vote.user_id on conflict(incident_case_id,user_id) do nothing;

create function public.get_incident_engagement(p_incident_case_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_read_incident_discussion(p_incident_case_id) then
    raise exception 'Incident discussion is unavailable.' using errcode='42501';
  end if;
  return jsonb_build_object('upvote_count',(select count(*) from public.incident_upvotes where incident_case_id=p_incident_case_id),
    'comment_count',(select count(*) from public.incident_comments where incident_case_id=p_incident_case_id and not is_hidden),
    'has_upvoted',exists(select 1 from public.incident_upvotes where incident_case_id=p_incident_case_id and user_id=auth.uid()));
end;
$$;
create function public.toggle_incident_upvote(p_incident_case_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare incident public.incident_cases;
begin
  select * into incident from public.incident_cases where id=p_incident_case_id for update;
  if not found or not public.has_active_profile() or incident.verification<>'confirmed' or incident.withdrawn_at is not null then
    raise exception 'Only public confirmed incidents accept support.' using errcode='42501';
  end if;
  delete from public.incident_upvotes where incident_case_id=incident.id and user_id=auth.uid();
  if not found then insert into public.incident_upvotes(incident_case_id,user_id) values(incident.id,auth.uid()); end if;
  return public.get_incident_engagement(incident.id);
end;
$$;
revoke all on function public.get_incident_engagement(uuid),public.toggle_incident_upvote(uuid) from public,anon;
grant execute on function public.get_incident_engagement(uuid),public.toggle_incident_upvote(uuid) to authenticated;

create view public.incident_comment_details with (security_invoker = true) as
select comment.id, comment.incident_case_id as report_id, comment.user_id, comment.body,
  comment.parent_comment_id, comment.is_hidden, comment.created_at,
  (select count(*)::integer from public.incident_comments reply where reply.parent_comment_id = comment.id
    and not reply.is_hidden) as reply_count,
  author.first_name as author_first_name, author.last_name as author_last_name,
  author.middle_name as author_middle_name, author.avatar_path as author_avatar_path, author.role as author_role
from public.incident_comments comment join public.app_profiles_public author on author.id = comment.user_id;
grant select on public.incident_comment_details to authenticated;

-- Metadata stripping is not established by MIME/size validation or exif:false
-- on the picker. Until byte-level server verification exists, approval is closed.
alter function public.set_report_media_public(uuid,boolean,text) rename to set_report_media_public_unchecked;
revoke all on function public.set_report_media_public_unchecked(uuid,boolean,text) from public, anon, authenticated;
create function public.set_report_media_public(p_media_id uuid,p_make_public boolean,p_reason text default null)
returns public.report_media language plpgsql security definer set search_path = '' as $$
declare incident public.incident_cases;
begin
  if not public.is_officer() then raise exception 'Operational officer access is required.' using errcode = '42501'; end if;
  select incident_row.* into incident from public.incident_cases incident_row
    join public.reports report on report.incident_case_id = incident_row.id
    join public.report_media media on media.report_id = report.id where media.id = p_media_id;
  if incident.id is null then raise exception 'Media must belong to an incident.' using errcode = 'P0002'; end if;
  perform public.require_incident_lead(incident);
  if p_make_public then
    raise exception 'Photo publication is unavailable until location metadata removal is verified.' using errcode = '22023';
  end if;
  return public.set_report_media_public_unchecked(p_media_id,p_make_public,p_reason);
end;
$$;
-- Prior approvals were never a proof of stripped metadata. Revoke before cutover.
update public.report_media set public_approved_by = null, public_approved_at = null where public_approved_at is not null;

create function public.list_resident_report_states(p_report_ids uuid[])
returns table (report_id uuid, incident_case_id uuid, lifecycle_facts jsonb, review_reason_code text,
  public_summary text, public_correction text)
language sql stable security definer set search_path = '' as $$
  select report.id, report.incident_case_id, jsonb_build_object(
    'status',report.status,'reviewOutcome',report.review_outcome,'reviewClaimedAt',report.review_claimed_at,
    'reviewClaimedByName',null,'jurisdictionStatus',report.jurisdiction_status,
    'incidentVerification',incident.verification,'incidentState',incident.state,'coordination',incident.coordination,
    'leadOffice',incident.lead_office,'municipalFinding',incident.municipal_finding,
    'hasQualifyingResponseAction',coalesce(public.incident_has_current_response(incident.id),false),
    'legacyResolution',coalesce(incident.legacy_resolution,false),'withdrawn',incident.withdrawn_at is not null,
    'legacyEscalation',exists(select 1 from public.incident_support_requests request
      where request.incident_case_id = incident.id and request.is_legacy and request.status = 'requested'),
    'legacyHandoff',exists(select 1 from public.incident_events event
      where event.incident_case_id = incident.id and event.event_type = 'legacy_handoff')),
    report.review_reason_code,incident.public_summary,incident.public_correction
  from public.reports report left join public.incident_cases incident on incident.id = report.incident_case_id
  where report.id = any(p_report_ids[1:200]) and report.reporter_id = auth.uid() and public.has_active_profile();
$$;

-- Store office responsibility alongside new audit events. The projection below
-- reads only approved fields, never arbitrary notes/details or contact outcomes.
alter table public.report_status_history add column resident_responsible_office_label text;
alter table public.incident_events add column resident_responsible_office_label text;
create function public.snapshot_report_responsibility()
returns trigger language plpgsql security definer set search_path = '' as $$
declare report public.reports; label text;
begin
  select * into report from public.reports where id = new.report_id;
  select case when report.jurisdiction_status = 'needs_check' or report.barangay_id is null
    or not public.barangay_has_active_bdrrmo(report.barangay_id) then 'MDRRMO'
    else 'Brgy. ' || barangay.name || ' BDRRMO' end into label
    from (select 1) singleton left join public.barangays barangay on barangay.id = report.barangay_id;
  new.resident_responsible_office_label := label;
  return new;
end;
$$;
create trigger report_responsibility_snapshot before insert on public.report_status_history
  for each row execute function public.snapshot_report_responsibility();
create function public.snapshot_incident_responsibility()
returns trigger language plpgsql security definer set search_path = '' as $$
declare label text;
begin
  select case when incident.lead_office = 'municipal' then 'MDRRMO'
    else 'Brgy. ' || coalesce(barangay.name,'assigned barangay') || ' BDRRMO' end into label
  from public.incident_cases incident left join public.barangays barangay on barangay.id = incident.lead_barangay_id
  where incident.id = new.incident_case_id;
  new.resident_responsible_office_label := label;
  return new;
end;
$$;
create trigger incident_responsibility_snapshot before insert on public.incident_events
  for each row execute function public.snapshot_incident_responsibility();

-- Additional resident notices contain only fixed public copy. Operational event
-- notes, dispatch confirmation identities, and contact details stay private.
create function public.create_phase4_resident_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare report public.reports; recipient record; title_text text; body_text text;
begin
  if tg_table_name='report_status_history' then
    if new.event_type<>'review_decided' or new.detail->>'outcome'<>'needs_assessment' then return new; end if;
    select * into report from public.reports where id=new.report_id;
    perform public.notify_report_flow_recipient(report.reporter_id,new.changed_by,'report_progress',
      'Incident being assessed','The responsible office requested field assessment. This does not yet confirm the incident.',
      'report',report.id,'assessment-event:' || new.id || ':' || report.reporter_id);
    return new;
  end if;
  if new.event_type not in ('dispatch_confirmed','responders_on_site','assistance_given','work_done')
    or not exists(select 1 from public.incident_cases incident where incident.id=new.incident_case_id
      and incident.verification='confirmed' and incident.withdrawn_at is null) then return new; end if;
  title_text:='Response action recorded';
  body_text:='A qualifying response action has been recorded. Open your report for the current status and responsible office.';
  for recipient in select distinct on(reporter_id) reporter_id,id from public.reports
    where incident_case_id=new.incident_case_id order by reporter_id,created_at,id loop
    perform public.notify_report_flow_recipient(recipient.reporter_id,new.actor_id,'report_progress',title_text,body_text,
      'report',recipient.id,'response-event:' || new.id || ':' || recipient.reporter_id);
  end loop;
  return new;
end;
$$;
create trigger resident_assessment_notification after insert on public.report_status_history
  for each row execute function public.create_phase4_resident_notification();
create trigger resident_response_notification after insert on public.incident_events
  for each row execute function public.create_phase4_resident_notification();

create function public.list_resident_report_timeline(p_report_id uuid)
returns table (occurred_at timestamptz,entry_type text,public_text text,responsible_office_label text)
language plpgsql stable security definer set search_path = '' as $$
declare report public.reports; initial_office text;
begin
  select * into report from public.reports where id = p_report_id and reporter_id = auth.uid() and public.has_active_profile();
  if not found then raise exception 'Report not found.' using errcode = '42501'; end if;
  select 'Brgy. ' || name || ' BDRRMO' into initial_office from public.barangays where id = report.barangay_id;
  return query
  with entries as (
    select report.created_at as at_time,'received'::text as kind,'Received by DisasterLink.'::text as message,
      coalesce((select history.resident_responsible_office_label from public.report_status_history history
        where history.report_id = report.id order by history.created_at,history.id limit 1),
        'Original office not recorded') as office
    union all
    select history.created_at,history.event_type,
      case history.event_type when 'review_claimed' then 'The responsible office started reviewing your report.'
        when 'review_taken_over' then 'Review was taken over within the same office.'
        when 'review_reopened' then 'Your report was reopened for review.'
        when 'routing_changed' then history.detail->>'public_text'
        when 'jurisdiction_checked' then history.detail->>'public_text'
        when 'review_decided' then case history.detail->>'outcome'
          when 'verified' then 'Incident confirmed.' when 'linked' then 'Your report was linked to an incident.'
          when 'needs_assessment' then 'The incident is being assessed on site.'
          when 'could_not_confirm' then 'The incident could not be confirmed. Send a new report if conditions change.'
          when 'rejected' then 'Review completed. See the report outcome for the reason.' end end,
      coalesce(history.resident_responsible_office_label,'Office at this time not recorded')
    from public.report_status_history history where history.report_id = report.id
      and history.event_type in ('review_claimed','review_taken_over','review_reopened','routing_changed','jurisdiction_checked','review_decided')
    union all
    select event.occurred_at,event.event_type,
      case event.event_type when 'incident_created' then case when event.details->>'decision' = 'needs_assessment'
        then 'The incident is being assessed on site.' else 'Incident recorded.' end
        when 'finding_recorded' then case when event.details->>'finding' = 'confirmed' then 'Incident confirmed.' else 'Incident not confirmed.' end
        when 'transfer_requested' then coalesce(event.details->>'public_text','Forwarded to MDRRMO. The barangay remains responsible until acceptance.')
        when 'transfer_accepted' then 'MDRRMO is now the responsible office.'
        when 'request_returned' then 'The request was returned. The barangay remains responsible.'
        when 'support_requested' then 'MDRRMO support requested. The barangay remains responsible.'
        when 'support_accepted' then 'MDRRMO support accepted. The barangay remains responsible.'
        when 'request_cancelled' then 'The coordination request was cancelled.'
        when 'reopened' then 'Incident reopened for further response.'
        when 'progress_update' then event.details->>'text'
        when 'resolved' then coalesce(event.details->>'public_text','Resolved. Outcome summary not yet posted.')
        when 'summary_added' then event.details->>'public_text'
        when 'withdrawn' then event.details->>'public_text' end,
      coalesce(event.resident_responsible_office_label,
        case when event.event_type = 'transfer_accepted' then 'MDRRMO' else 'Office at this time not recorded' end)
    from public.incident_events event where event.incident_case_id = report.incident_case_id
      and event.occurred_at >= report.created_at
      and event.event_type in ('incident_created','finding_recorded','transfer_requested','transfer_accepted',
        'request_returned','support_requested','support_accepted','request_cancelled','reopened','resolved','withdrawn','summary_added','progress_update')
  ) select entries.at_time,entries.kind,entries.message,entries.office from entries
    where entries.message is not null order by entries.at_time,entries.kind;
end;
$$;

revoke all on function public.incident_has_current_response(uuid),public.public_incident_record(uuid),
  public.snapshot_report_responsibility(),public.snapshot_incident_responsibility(),public.create_phase4_resident_notification() from public,anon,authenticated;
revoke all on function public.list_public_incidents(uuid,integer,integer),public.get_public_incident(uuid),
  public.can_read_incident_discussion(uuid),public.list_resident_report_states(uuid[]),public.list_resident_report_timeline(uuid),
  public.set_report_media_public(uuid,boolean,text),public.publish_legacy_incident_comment(uuid),public.list_legacy_incident_comments(uuid,integer,integer) from public,anon;
grant execute on function public.list_public_incidents(uuid,integer,integer),public.get_public_incident(uuid),
  public.can_read_incident_discussion(uuid),public.list_resident_report_states(uuid[]),public.list_resident_report_timeline(uuid),
  public.set_report_media_public(uuid,boolean,text),public.publish_legacy_incident_comment(uuid),public.list_legacy_incident_comments(uuid,integer,integer) to authenticated;
