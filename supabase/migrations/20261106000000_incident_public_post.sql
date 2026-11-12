-- Phase 4 resident UI: a screened public post for confirmed incidents.
-- The app prefills these fields from the resident's report, but nothing is
-- copied automatically. Only the lead office can publish or clear them.
alter table public.incident_cases
  add column public_title text check (length(btrim(public_title)) between 1 and 80),
  add column public_caption text check (length(btrim(public_caption)) between 1 and 500),
  add column public_landmark text check (length(btrim(public_landmark)) between 1 and 120),
  add constraint incident_public_post_pair check ((public_title is null) = (public_caption is null));

alter table public.incident_events drop constraint incident_events_event_type_check;
alter table public.incident_events add constraint incident_events_event_type_check check (event_type in (
  'reporter_call', 'hotline_contacted', 'assistance_requested', 'dispatch_confirmed',
  'responders_on_site', 'assistance_given', 'work_done', 'external_info', 'internal_note',
  'progress_update', 'incident_created', 'report_linked', 'finding_recorded', 'support_requested',
  'transfer_requested', 'support_accepted', 'transfer_accepted', 'request_returned',
  'request_cancelled', 'resolved', 'summary_added', 'reopened', 'withdrawn', 'legacy_handoff',
  'photo_published', 'photo_unpublished', 'public_location_changed', 'sensitivity_changed',
  'update_request_rerouted', 'public_post_changed'));

create function public.set_incident_public_post(p_incident_case_id uuid, p_title text,
  p_caption text, p_landmark text default null)
returns public.incident_cases language plpgsql security definer set search_path = '' as $$
declare incident public.incident_cases;
  title_text text := public.report_flow_text(p_title, false, 80);
  caption_text text := public.report_flow_text(p_caption, false, 500);
  landmark_text text := public.report_flow_text(p_landmark, false, 120);
begin
  select * into incident from public.incident_cases where id = p_incident_case_id for update;
  if not found then raise exception 'Incident not found' using errcode = 'P0002'; end if;
  perform public.require_incident_lead(incident);
  if (title_text is null) <> (caption_text is null) then
    raise exception 'Add both a public title and caption, or clear both.' using errcode = '22023';
  end if;
  if title_text is null and landmark_text is not null then
    raise exception 'A landmark needs a public title and caption.' using errcode = '22023';
  end if;
  -- Clearing is always allowed; publishing needs a current public incident.
  if title_text is not null and (incident.verification <> 'confirmed' or incident.withdrawn_at is not null) then
    raise exception 'Only a confirmed public incident can have a public post.' using errcode = '22023';
  end if;
  update public.incident_cases set public_title = title_text, public_caption = caption_text,
    public_landmark = landmark_text where id = incident.id returning * into incident;
  perform public.write_incident_event(incident.id, 'public_post_changed',
    jsonb_build_object('published', title_text is not null, 'has_landmark', landmark_text is not null));
  return incident;
end;
$$;

-- The record gains the screened post and engagement counts. A landmark is
-- withheld whenever the public location is barangay-only or the case is sensitive,
-- and withdrawn incidents show their correction instead of the original post.
drop function public.list_public_incidents(uuid, integer, integer);
drop function public.get_public_incident(uuid);
drop function public.public_incident_record(uuid);

create function public.public_incident_record(p_incident_case_id uuid)
returns table (incident_case_id uuid, incident_type text, public_type_label text, barangay_name text,
  public_location_mode text, approx_latitude double precision, approx_longitude double precision,
  exact_latitude double precision, exact_longitude double precision, safety_location_reason text,
  public_status text, confirmed_at timestamptz, last_public_update_at timestamptz,
  latest_public_update text, public_summary text, public_correction text, linked_report_count integer,
  public_photo_display_paths text[], public_photo_thumbnail_paths text[],
  public_title text, public_caption text, public_landmark text,
  support_count integer, comment_count integer, has_supported boolean)
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
  public_photo_display_paths text[], public_photo_thumbnail_paths text[],
  public_title text, public_caption text, public_landmark text,
  support_count integer, comment_count integer, has_supported boolean)
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

revoke all on function public.public_incident_record(uuid) from public, anon, authenticated;
revoke all on function public.list_public_incidents(uuid, integer, integer), public.get_public_incident(uuid),
  public.set_incident_public_post(uuid, text, text, text) from public, anon;
grant execute on function public.list_public_incidents(uuid, integer, integer), public.get_public_incident(uuid),
  public.set_incident_public_post(uuid, text, text, text) to authenticated;
