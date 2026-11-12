create function public.validate_response_event(p_event_type text, p_details jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare normalized jsonb := '{}'; field_name text; required_fields text[] := '{}'; field_text text;
begin
  if p_details is null or jsonb_typeof(p_details) <> 'object' then
    raise exception 'Event details must be an object.' using errcode = '22023';
  end if;
  if p_event_type is null or p_event_type not in ('reporter_call', 'hotline_contacted', 'assistance_requested',
    'dispatch_confirmed', 'responders_on_site', 'assistance_given', 'work_done', 'external_info', 'internal_note', 'progress_update') then
    raise exception 'Invalid response event type.' using errcode = '22023';
  end if;
  required_fields := case p_event_type
    when 'reporter_call' then array['outcome'] when 'hotline_contacted' then array['service', 'outcome']
    when 'assistance_requested' then array['service', 'requested']
    when 'dispatch_confirmed' then array['service', 'confirmed_by', 'method']
    when 'responders_on_site' then array['service'] when 'assistance_given' then array['action']
    when 'work_done' then array['action'] when 'external_info' then array['source']
    when 'internal_note' then array['text'] when 'progress_update' then array['text'] end;
  -- Copy an explicit vocabulary, never arbitrary JSON (especially contact numbers).
  for field_name in select jsonb_object_keys(p_details) loop
    if not (field_name = any(required_fields) or field_name in ('service_other', 'reference')) then
      raise exception 'Unexpected event detail: %', field_name using errcode = '22023';
    end if;
    if jsonb_typeof(p_details->field_name) <> 'string' then
      raise exception 'Event detail values must be text.' using errcode = '22023';
    end if;
    field_text := public.report_flow_text(p_details->>field_name, true,
      case when field_name = 'confirmed_by' then 80 when p_event_type = 'progress_update' then 280 else 500 end);
    -- Phone numbers have no place in event details; use the audited contact RPC.
    if field_text ~ '[+]?[0-9][0-9 ()-]{6,}[0-9]' then
      raise exception 'Do not include phone numbers in event details.' using errcode = '22023';
    end if;
    normalized := normalized || jsonb_build_object(field_name, field_text);
  end loop;
  foreach field_name in array required_fields loop
    if not normalized ? field_name then raise exception 'Missing event detail: %', field_name using errcode = '22023'; end if;
  end loop;
  if normalized ? 'service' and normalized->>'service' not in ('bfp', 'pnp', 'rhu_ambulance', 'mdrrmo_rescue', 'bdrrmo_team', 'other') then
    raise exception 'Select a valid service.' using errcode = '22023';
  end if;
  if normalized->>'service' = 'other' and not normalized ? 'service_other' then
    raise exception 'Name the other service.' using errcode = '22023';
  end if;
  if p_event_type in ('reporter_call', 'hotline_contacted') and (
    normalized->>'outcome' not in ('reached', 'no_answer', 'call_failed', 'not_recorded')
    or (p_event_type = 'hotline_contacted' and normalized->>'outcome' = 'not_recorded')) then
    raise exception 'Select a valid call outcome.' using errcode = '22023';
  end if;
  if p_event_type = 'dispatch_confirmed' and normalized->>'method' not in ('callback', 'radio', 'in_person', 'written_message') then
    raise exception 'Select a valid dispatch confirmation method.' using errcode = '22023';
  end if;
  return normalized;
end;
$$;

create function public.log_incident_event(p_incident_case_id uuid, p_event_type text, p_details jsonb,
  p_note text, p_is_public boolean default false, p_occurred_at timestamptz default null)
returns public.incident_events language plpgsql security definer set search_path = '' as $$
declare incident public.incident_cases; result public.incident_events;
  normalized jsonb := public.validate_response_event(p_event_type, p_details);
  note_text text := public.report_flow_text(p_note); event_time timestamptz := coalesce(p_occurred_at, clock_timestamp());
begin
  if note_text ~ '[+]?[0-9][0-9 ()-]{6,}[0-9]' then
    raise exception 'Do not include phone numbers in response notes.' using errcode = '22023';
  end if;
  select * into incident from public.incident_cases where id = p_incident_case_id for update;
  if not found then raise exception 'Incident not found' using errcode = 'P0002'; end if;
  if not coalesce(public.is_incident_lead(incident) or public.is_incident_supporter(incident), false) then
    raise exception 'Only the lead or supporting office can log events.' using errcode = '42501';
  end if;
  if incident.state <> 'active' then raise exception 'Only active incidents accept response events.' using errcode = '22023'; end if;
  if p_is_public is null or (p_is_public and (not public.is_incident_lead(incident) or p_event_type <> 'progress_update'))
    or (p_event_type = 'progress_update' and not p_is_public) then
    raise exception 'Only the lead office can post a public progress update.' using errcode = '42501';
  end if;
  if event_time < incident.created_at or event_time > clock_timestamp() then
    raise exception 'Event time must be between incident creation and now.' using errcode = '22023';
  end if;
  if p_is_public and exists (select 1 from public.incident_events where incident_case_id = incident.id
    and event_type = 'progress_update' and is_public and created_at > clock_timestamp() - interval '10 minutes') then
    raise exception 'Wait ten minutes between public progress updates.' using errcode = '22023';
  end if;
  insert into public.incident_events(incident_case_id, event_type, actor_id, actor_office, actor_barangay_id,
    details, note, is_public, occurred_at)
  values (incident.id, p_event_type, auth.uid(), (select office from public.current_official_office()),
    public.current_app_barangay_id(), normalized, note_text, p_is_public, event_time) returning * into result;
  return result;
end;
$$;

create function public.log_report_contact(p_report_id uuid, p_event_type text, p_details jsonb, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare report public.reports; normalized jsonb := public.validate_response_event(p_event_type, p_details);
  note_text text := public.report_flow_text(p_note);
begin
  if p_event_type not in ('reporter_call', 'hotline_contacted', 'assistance_requested', 'dispatch_confirmed', 'external_info') then
    raise exception 'Invalid pre-incident contact type.' using errcode = '22023';
  end if;
  -- Read first, then acquire the normal case-before-report lock order if linked.
  select * into report from public.reports where id = p_report_id;
  if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
  if report.incident_case_id is not null then
    perform public.log_incident_event(report.incident_case_id, p_event_type, normalized, note_text);
    return;
  end if;
  select * into report from public.reports where id = p_report_id for update;
  if report.incident_case_id is not null then
    perform public.log_incident_event(report.incident_case_id, p_event_type, normalized, note_text);
    return;
  end if;
  perform public.require_report_reviewer(report);
  if report.review_outcome <> 'pending' or report.jurisdiction_status <> 'in_coverage' then
    raise exception 'Contact logging requires an in-coverage pending report.' using errcode = '22023';
  end if;
  if note_text ~ '[+]?[0-9][0-9 ()-]{6,}[0-9]' then
    raise exception 'Do not include phone numbers in contact notes.' using errcode = '22023';
  end if;
  perform public.write_report_flow_history(report.id, 'contact_logged',
    jsonb_build_object('event_type', p_event_type, 'details', normalized), note_text);
end;
$$;

create or replace function public.can_request_reporter_contact(p_report public.reports)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_officer() and (
    (p_report.incident_case_id is null and p_report.jurisdiction_status = 'in_coverage'
      and p_report.review_outcome = 'pending' and (
        (public.is_bdrrmo() and p_report.barangay_id = public.current_app_barangay_id())
        or (public.is_mdrrmo() and not public.barangay_has_active_bdrrmo(p_report.barangay_id))))
    or exists (select 1 from public.incident_cases incident where incident.id = p_report.incident_case_id
      and (public.is_incident_lead(incident) or public.is_incident_supporter(incident))));
$$;

revoke all on function public.validate_response_event(text, jsonb) from public, anon, authenticated;
revoke all on function public.log_report_contact(uuid, text, jsonb, text),
  public.log_incident_event(uuid, text, jsonb, text, boolean, timestamptz) from public, anon;
grant execute on function public.log_report_contact(uuid, text, jsonb, text),
  public.log_incident_event(uuid, text, jsonb, text, boolean, timestamptz) to authenticated;
