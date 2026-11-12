-- A grouped submission is one activity, with each service retaining its own
-- identity, event details, and optional note. Legacy single-service JSON remains valid.
create or replace function public.validate_response_event(p_event_type text, p_details jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  normalized jsonb := '{}';
  field_name text;
  required_fields text[] := '{}';
  field_text text;
  service_entry jsonb;
  service_details jsonb;
  service_note text;
  normalized_services jsonb := '[]';
  service_identity jsonb;
  seen_identities jsonb := '[]';
  submission_id uuid;
begin
  if p_details is null or jsonb_typeof(p_details) <> 'object' then
    raise exception 'Event details must be an object.' using errcode = '22023';
  end if;
  if p_event_type is null or p_event_type not in ('reporter_call', 'hotline_contacted', 'assistance_requested',
    'dispatch_confirmed', 'responders_on_site', 'assistance_given', 'work_done', 'external_info', 'internal_note', 'progress_update') then
    raise exception 'Invalid response event type.' using errcode = '22023';
  end if;

  if p_details ? 'services' or p_details ? 'submission_id' then
    if p_event_type not in ('hotline_contacted', 'assistance_requested', 'dispatch_confirmed', 'responders_on_site') then
      raise exception 'This activity type cannot contain grouped services.' using errcode = '22023';
    end if;
    for field_name in select jsonb_object_keys(p_details) loop
      if field_name not in ('submission_id', 'services') then
        raise exception 'Unexpected grouped event detail: %', field_name using errcode = '22023';
      end if;
    end loop;
    if not (p_details ? 'submission_id') or jsonb_typeof(p_details->'submission_id') <> 'string'
      or (p_details->>'submission_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'A grouped activity requires a UUID submission ID.' using errcode = '22023';
    end if;
    submission_id := (p_details->>'submission_id')::uuid;
    if not (p_details ? 'services') or jsonb_typeof(p_details->'services') <> 'array' then
      raise exception 'Grouped services must be an array.' using errcode = '22023';
    end if;
    if jsonb_array_length(p_details->'services') not between 1 and 20 then
      raise exception 'Select between one and twenty services.' using errcode = '22023';
    end if;
    for service_entry in select value from jsonb_array_elements(p_details->'services') loop
      if jsonb_typeof(service_entry) <> 'object' then
        raise exception 'Each grouped service must be an object.' using errcode = '22023';
      end if;
      for field_name in select jsonb_object_keys(service_entry) loop
        if field_name not in ('details', 'note') then
          raise exception 'Unexpected grouped service field: %', field_name using errcode = '22023';
        end if;
      end loop;
      if not (service_entry ? 'details') or jsonb_typeof(service_entry->'details') <> 'object' then
        raise exception 'Each grouped service requires event details.' using errcode = '22023';
      end if;
      -- Nested groups are forbidden; each entry uses the existing single-event validator.
      if service_entry->'details' ? 'services' or service_entry->'details' ? 'submission_id' then
        raise exception 'Grouped services cannot contain another group.' using errcode = '22023';
      end if;
      service_details := public.validate_response_event(p_event_type, service_entry->'details');
      if not (service_details ? 'service_name' and service_details ? 'municipality') then
        raise exception 'Each grouped service requires a team or office name and municipality.' using errcode = '22023';
      end if;
      if service_entry ? 'note' and jsonb_typeof(service_entry->'note') not in ('string', 'null') then
        raise exception 'Service notes must be text.' using errcode = '22023';
      end if;
      service_note := public.report_flow_text(service_entry->>'note');
      if service_note ~ '[+]?[0-9][0-9 ()-]{6,}[0-9]' then
        raise exception 'Do not include phone numbers in service notes.' using errcode = '22023';
      end if;
      -- Named fields avoid collisions from punctuation or swapped team/town names.
      service_identity := jsonb_build_object('service', service_details->>'service',
        'service_name', lower(service_details->>'service_name'),
        'municipality', lower(service_details->>'municipality'));
      if seen_identities @> jsonb_build_array(service_identity) then
        raise exception 'The same service team and municipality cannot be selected twice.' using errcode = '22023';
      end if;
      seen_identities := seen_identities || jsonb_build_array(service_identity);
      normalized_services := normalized_services || jsonb_build_array(
        jsonb_build_object('details', service_details, 'note', service_note));
    end loop;
    return jsonb_build_object('submission_id', submission_id::text, 'services', normalized_services);
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
    if not (field_name = any(required_fields) or field_name in ('service_other', 'reference')
      or ('service' = any(required_fields) and field_name in ('service_name', 'municipality'))) then
      raise exception 'Unexpected event detail: %', field_name using errcode = '22023';
    end if;
    if jsonb_typeof(p_details->field_name) <> 'string' then
      raise exception 'Event detail values must be text.' using errcode = '22023';
    end if;
    if field_name in ('service_name', 'municipality') then
      -- Identity matching ignores extra spaces, tabs, and line breaks.
      field_text := public.report_flow_text(btrim(regexp_replace(p_details->>field_name,
        '[[:space:]]+', ' ', 'g')), true, 120);
    else
      field_text := public.report_flow_text(p_details->>field_name, true,
        case when field_name = 'confirmed_by' then 80 when p_event_type = 'progress_update' then 280 else 500 end);
    end if;
    if field_text ~ '[+]?[0-9][0-9 ()-]{6,}[0-9]' then
      raise exception 'Do not include phone numbers in event details.' using errcode = '22023';
    end if;
    normalized := normalized || jsonb_build_object(field_name, field_text);
  end loop;
  foreach field_name in array required_fields loop
    if not normalized ? field_name then raise exception 'Missing event detail: %', field_name using errcode = '22023'; end if;
  end loop;
  if (normalized ? 'service_name') <> (normalized ? 'municipality') then
    raise exception 'Service name and municipality must be provided together.' using errcode = '22023';
  end if;
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

-- These also protect grouped contacts copied into an incident during review.
create unique index incident_events_grouped_submission
  on public.incident_events(incident_case_id, actor_id, (details->>'submission_id'))
  where details ? 'submission_id';
create unique index report_contacts_grouped_submission
  on public.report_status_history(report_id, changed_by, (detail->'details'->>'submission_id'))
  where event_type = 'contact_logged' and detail->'details' ? 'submission_id';

create or replace function public.log_incident_event(p_incident_case_id uuid, p_event_type text, p_details jsonb,
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
  if p_is_public is null or (p_is_public and (not public.is_incident_lead(incident) or p_event_type <> 'progress_update'))
    or (p_event_type = 'progress_update' and not p_is_public) then
    raise exception 'Only the lead office can post a public progress update.' using errcode = '42501';
  end if;
  -- Authorize first; a retry may return its existing activity after resolution.
  -- The target row lock serializes competing submissions with the same ID.
  if normalized ? 'submission_id' then
    select * into result from public.incident_events where incident_case_id = incident.id
      and actor_id = auth.uid() and details->>'submission_id' = normalized->>'submission_id';
    if found then
      if result.event_type is distinct from p_event_type or result.details is distinct from normalized
        or result.note is distinct from note_text or result.is_public is distinct from p_is_public
        or (p_occurred_at is not null and result.occurred_at is distinct from p_occurred_at) then
        raise exception 'This submission ID was already used for a different activity.' using errcode = '22023';
      end if;
      return result;
    end if;
  end if;
  if incident.state <> 'active' then raise exception 'Only active incidents accept response events.' using errcode = '22023'; end if;
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

create or replace function public.log_report_contact(p_report_id uuid, p_event_type text, p_details jsonb, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare report public.reports; existing_contact public.report_status_history;
  normalized jsonb := public.validate_response_event(p_event_type, p_details);
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
  if note_text ~ '[+]?[0-9][0-9 ()-]{6,}[0-9]' then
    raise exception 'Do not include phone numbers in contact notes.' using errcode = '22023';
  end if;
  if normalized ? 'submission_id' then
    select * into existing_contact from public.report_status_history where report_id = report.id
      and changed_by = auth.uid() and event_type = 'contact_logged'
      and detail->'details'->>'submission_id' = normalized->>'submission_id';
    if found then
      if existing_contact.detail->>'event_type' is distinct from p_event_type
        or existing_contact.detail->'details' is distinct from normalized or existing_contact.note is distinct from note_text then
        raise exception 'This submission ID was already used for a different activity.' using errcode = '22023';
      end if;
      return;
    end if;
  end if;
  if report.review_outcome <> 'pending' or report.jurisdiction_status <> 'in_coverage' then
    raise exception 'Contact logging requires an in-coverage pending report.' using errcode = '22023';
  end if;
  perform public.write_report_flow_history(report.id, 'contact_logged',
    jsonb_build_object('event_type', p_event_type, 'details', normalized), note_text);
end;
$$;

revoke all on function public.validate_response_event(text, jsonb) from public, anon, authenticated;
revoke all on function public.log_report_contact(uuid, text, jsonb, text),
  public.log_incident_event(uuid, text, jsonb, text, boolean, timestamptz) from public, anon;
grant execute on function public.log_report_contact(uuid, text, jsonb, text),
  public.log_incident_event(uuid, text, jsonb, text, boolean, timestamptz) to authenticated;
