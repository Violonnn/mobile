-- A category and municipality identify a responding service; a particular
-- office, team, or unit name is optional. Keep existing named payloads unchanged
-- so submissions first recorded under the previous validator remain retryable.
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
      if not (service_details ? 'municipality') then
        raise exception 'Each grouped service requires a municipality.' using errcode = '22023';
      end if;
      if service_entry ? 'note' and jsonb_typeof(service_entry->'note') not in ('string', 'null') then
        raise exception 'Service notes must be text.' using errcode = '22023';
      end if;
      service_note := public.report_flow_text(service_entry->>'note');
      if service_note ~ '[+]?[0-9][0-9 ()-]{6,}[0-9]' then
        raise exception 'Do not include phone numbers in service notes.' using errcode = '22023';
      end if;
      -- Named fields avoid collisions from punctuation or swapped team/town names.
      -- Other services retain their own names even when no particular unit is named.
      service_identity := jsonb_build_object('service', service_details->>'service',
        'service_name', lower(coalesce(service_details->>'service_name', '')),
        'municipality', lower(service_details->>'municipality'),
        'service_other', case when service_details->>'service' = 'other' then
          lower(btrim(regexp_replace(service_details->>'service_other', '[[:space:]]+', ' ', 'g')))
          else '' end);
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
        '[[:space:]]+', ' ', 'g')), field_name = 'municipality', 120);
      -- An empty optional name has the same identity as an omitted name.
      if field_name = 'service_name' and field_text is null then continue; end if;
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
  if normalized ? 'service_name' and not (normalized ? 'municipality') then
    raise exception 'A named service unit requires a municipality.' using errcode = '22023';
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

revoke all on function public.validate_response_event(text, jsonb) from public, anon, authenticated;
