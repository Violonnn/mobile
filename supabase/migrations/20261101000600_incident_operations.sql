create function public.record_incident_finding(p_incident_case_id uuid, p_finding text, p_note text,
  p_public_correction text default null)
returns public.incident_cases language plpgsql security definer set search_path = '' as $$
declare incident public.incident_cases; was_public boolean;
  note_text text := public.report_flow_text(p_note, true);
  correction_text text := public.report_flow_text(p_public_correction, false, 280);
begin
  select * into incident from public.incident_cases where id = p_incident_case_id for update;
  if not found then raise exception 'Incident not found' using errcode = 'P0002'; end if;
  perform public.require_incident_lead(incident);
  if incident.state <> 'active' or p_finding is null or p_finding not in ('confirmed', 'not_confirmed')
    or not (incident.verification = 'pending'
      or (incident.lead_office = 'municipal' and incident.municipal_finding is null)) then
    raise exception 'This incident is not awaiting a finding.' using errcode = '22023';
  end if;
  was_public := incident.confirmed_at is not null;
  if p_finding = 'not_confirmed' and was_public then
    correction_text := public.report_flow_text(p_public_correction, true, 280);
  end if;
  if p_finding = 'not_confirmed' and exists (select 1 from public.incident_support_requests
    where incident_case_id = incident.id and status = 'requested') then
    raise exception 'Cancel or return the open coordination request before closing.' using errcode = '22023';
  end if;
  update public.incident_cases set verification = p_finding::public.incident_verification,
    state = case when p_finding = 'not_confirmed' then 'closed' else 'active' end::public.incident_state,
    confirmed_by = case when p_finding = 'confirmed' then coalesce(confirmed_by, auth.uid()) else confirmed_by end,
    confirmed_at = case when p_finding = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
    confirmation_basis = case when p_finding = 'confirmed' then
      case when lead_office = 'municipal' and was_public then 'municipal_review' else 'field_assessment' end::public.incident_confirmation_basis
      else confirmation_basis end,
    municipal_finding = case when lead_office = 'municipal' then p_finding::public.incident_verification else municipal_finding end,
    municipal_finding_by = case when lead_office = 'municipal' then auth.uid() else municipal_finding_by end,
    municipal_finding_at = case when lead_office = 'municipal' then now() else municipal_finding_at end,
    closed_by = case when p_finding = 'not_confirmed' then auth.uid() end,
    closed_at = case when p_finding = 'not_confirmed' then now() end,
    withdrawn_at = case when p_finding = 'confirmed' then null
      when p_finding = 'not_confirmed' and was_public then now() else withdrawn_at end,
    public_correction = case when p_finding = 'not_confirmed' and was_public then correction_text else public_correction end
  where id = incident.id returning * into incident;
  if p_finding = 'not_confirmed' then
    update public.report_media media set public_approved_by = null, public_approved_at = null
    from public.reports report where report.id = media.report_id and report.incident_case_id = incident.id;
  end if;
  perform public.write_incident_event(incident.id,
    case when p_finding = 'not_confirmed' and was_public then 'withdrawn' else 'finding_recorded' end,
    jsonb_build_object('finding', p_finding, 'public_text',
      case when p_finding = 'not_confirmed' then correction_text else 'The incident was confirmed.' end),
    note_text, was_public or p_finding = 'confirmed');
  perform public.sync_incident_reports_compat(incident.id);
  return incident;
end;
$$;

create function public.request_municipal_support(p_incident_case_id uuid, p_kind public.support_request_kind, p_note text)
returns public.incident_support_requests language plpgsql security definer set search_path = '' as $$
declare incident public.incident_cases; result public.incident_support_requests; office_name text;
  note_text text := public.report_flow_text(p_note, p_kind = 'transfer');
begin
  select * into incident from public.incident_cases where id = p_incident_case_id for update;
  if not found then raise exception 'Incident not found' using errcode = 'P0002'; end if;
  perform public.require_incident_lead(incident);
  if not public.is_bdrrmo() or incident.state <> 'active' or p_kind is null
    or (p_kind = 'support' and incident.coordination <> 'local')
    or (p_kind = 'transfer' and incident.coordination not in ('local', 'support_active')) then
    raise exception 'This coordination request is not allowed.' using errcode = '42501';
  end if;
  insert into public.incident_support_requests(incident_case_id, kind, previous_coordination,
    requested_by, requesting_barangay_id, request_note)
  values (incident.id, p_kind, incident.coordination, auth.uid(), incident.lead_barangay_id, note_text)
  returning * into result;
  update public.incident_cases set coordination = case when p_kind = 'support' then 'support_requested'
    else 'transfer_requested' end::public.incident_coordination where id = incident.id;
  if p_kind = 'transfer' then
    perform set_config('disasterlink.report_transition', '1', true);
    update public.reports set escalated_by = auth.uid(), escalated_at = now(), escalated_to = 'mdrrmo'
      where incident_case_id = incident.id;
    perform set_config('disasterlink.report_transition', '', true);
  end if;
  select name into office_name from public.barangays where id = incident.lead_barangay_id;
  perform public.write_incident_event(incident.id, case when p_kind = 'transfer' then 'transfer_requested' else 'support_requested' end,
    jsonb_build_object('request_id', result.id, 'public_text', case when p_kind = 'transfer'
      then 'Forwarded to MDRRMO — Brgy. ' || office_name || ' remains responsible until MDRRMO accepts.' end), note_text);
  perform public.sync_incident_reports_compat(incident.id);
  return result;
end;
$$;

create function public.cancel_support_request(p_request_id uuid, p_note text default null)
returns public.incident_support_requests language plpgsql security definer set search_path = '' as $$
declare incident public.incident_cases; request public.incident_support_requests;
  note_text text := public.report_flow_text(p_note);
begin
  select * into request from public.incident_support_requests where id = p_request_id;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  select * into incident from public.incident_cases where id = request.incident_case_id for update;
  perform public.require_incident_lead(incident);
  select * into request from public.incident_support_requests where id = p_request_id for update;
  if not public.is_bdrrmo() or request.status <> 'requested' or incident.state <> 'active' then
    raise exception 'Only the requesting lead barangay can cancel an open request.' using errcode = '42501';
  end if;
  update public.incident_support_requests set status = 'cancelled', responded_by = auth.uid(),
    responded_at = now(), response_note = note_text where id = request.id returning * into request;
  update public.incident_cases set coordination = request.previous_coordination where id = incident.id;
  perform public.write_incident_event(incident.id, 'request_cancelled', jsonb_build_object('request_id', request.id), note_text);
  perform public.sync_incident_reports_compat(incident.id);
  return request;
end;
$$;

create function public.respond_support_request(p_request_id uuid, p_decision text, p_note text default null)
returns public.incident_support_requests language plpgsql security definer set search_path = '' as $$
declare incident public.incident_cases; request public.incident_support_requests; office_name text;
  note_text text := public.report_flow_text(p_note, p_decision = 'return');
begin
  if not public.is_mdrrmo() then raise exception 'Only MDRRMO can respond to requests.' using errcode = '42501'; end if;
  select * into request from public.incident_support_requests where id = p_request_id;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  select * into incident from public.incident_cases where id = request.incident_case_id for update;
  select * into request from public.incident_support_requests where id = p_request_id for update;
  if request.status <> 'requested' or incident.state <> 'active' or p_decision is null
    or p_decision not in ('accept', 'return') then
    raise exception 'An open request and valid response are required.' using errcode = '22023';
  end if;
  update public.incident_support_requests set status = case when p_decision = 'accept' then 'accepted'
    else 'returned' end::public.support_request_status, responded_by = auth.uid(), responded_at = now(), response_note = note_text
    where id = request.id returning * into request;
  update public.incident_cases set coordination = case when p_decision = 'return' then request.previous_coordination
      when request.kind = 'transfer' then 'municipal_lead' else 'support_active' end::public.incident_coordination,
    lead_office = case when p_decision = 'accept' and request.kind = 'transfer' then 'municipal' else lead_office end::public.incident_lead_office,
    lead_barangay_id = case when p_decision = 'accept' and request.kind = 'transfer' then null else lead_barangay_id end
    where id = incident.id;
  select name into office_name from public.barangays where id = request.requesting_barangay_id;
  perform public.write_incident_event(incident.id, case when p_decision = 'return' then 'request_returned'
    when request.kind = 'transfer' then 'transfer_accepted' else 'support_accepted' end,
    jsonb_build_object('request_id', request.id, 'public_text', case when p_decision = 'return'
      then 'Brgy. ' || office_name || ' remains responsible.' when request.kind = 'transfer'
      then 'MDRRMO is now the responsible office.' end), note_text);
  perform public.sync_incident_reports_compat(incident.id);
  return request;
end;
$$;

-- Both resolution entrypoints share the same lead/state/open-request checks.
create function public.finish_incident_resolution(p_case_id uuid, p_note text, p_summary text, p_legacy boolean)
returns public.incident_cases language plpgsql security definer set search_path = '' as $$
declare incident public.incident_cases;
  note_text text := public.report_flow_text(p_note, not p_legacy);
  summary_text text := public.report_flow_text(p_summary, not p_legacy, 280);
begin
  select * into incident from public.incident_cases where id = p_case_id for update;
  if not found then raise exception 'Incident not found' using errcode = 'P0002'; end if;
  perform public.require_incident_lead(incident);
  if incident.state <> 'active' or incident.verification <> 'confirmed'
    or (incident.lead_office = 'municipal' and incident.municipal_finding is distinct from 'confirmed')
    or exists (select 1 from public.incident_support_requests where incident_case_id = incident.id and status = 'requested') then
    raise exception 'Resolution requires a confirmed active incident and no open coordination request.' using errcode = '22023';
  end if;
  update public.incident_cases set state = 'resolved', resolved_by = auth.uid(), resolved_at = now(),
    public_summary = case when p_legacy then null else summary_text end, legacy_resolution = p_legacy
    where id = incident.id returning * into incident;
  perform public.write_incident_event(incident.id, 'resolved',
    jsonb_build_object('legacy_resolution', p_legacy, 'public_text', incident.public_summary), note_text, true);
  perform public.sync_incident_reports_compat(incident.id);
  return incident;
end;
$$;

create function public.resolve_incident(p_incident_case_id uuid, p_outcome_note text, p_public_summary text)
returns public.incident_cases language sql security definer set search_path = '' as $$
  select public.finish_incident_resolution(p_incident_case_id, p_outcome_note, p_public_summary, false);
$$;
create function public.resolve_incident_legacy(p_incident_case_id uuid, p_note text)
returns public.incident_cases language sql security definer set search_path = '' as $$
  select public.finish_incident_resolution(p_incident_case_id, p_note, null, true);
$$;

create function public.add_public_summary(p_incident_case_id uuid, p_public_summary text)
returns public.incident_cases language plpgsql security definer set search_path = '' as $$
declare incident public.incident_cases; summary_text text := public.report_flow_text(p_public_summary, true, 280);
begin
  select * into incident from public.incident_cases where id = p_incident_case_id for update;
  if not found then raise exception 'Incident not found' using errcode = 'P0002'; end if;
  perform public.require_incident_lead(incident);
  if incident.state <> 'resolved' or not incident.legacy_resolution or incident.public_summary is not null then
    raise exception 'Only a legacy resolution with a missing summary can receive one.' using errcode = '22023';
  end if;
  update public.incident_cases set public_summary = summary_text, legacy_resolution = false
    where id = incident.id returning * into incident;
  perform public.write_incident_event(incident.id, 'summary_added', jsonb_build_object('public_text', summary_text), null, true);
  return incident;
end;
$$;

create function public.reopen_incident(p_incident_case_id uuid, p_reason text)
returns public.incident_cases language plpgsql security definer set search_path = '' as $$
declare incident public.incident_cases; reason_text text := public.report_flow_text(p_reason, true);
begin
  select * into incident from public.incident_cases where id = p_incident_case_id for update;
  if not found then raise exception 'Incident not found' using errcode = 'P0002'; end if;
  perform public.require_incident_lead(incident);
  if incident.state not in ('resolved', 'closed') then
    raise exception 'Only a resolved or closed incident can be reopened.' using errcode = '22023';
  end if;
  update public.incident_cases set state = 'active',
    verification = case when state = 'closed' then 'pending' else verification end::public.incident_verification,
    municipal_finding = case when state = 'closed' then null else municipal_finding end,
    municipal_finding_by = case when state = 'closed' then null else municipal_finding_by end,
    municipal_finding_at = case when state = 'closed' then null else municipal_finding_at end,
    resolved_by = null, resolved_at = null, closed_by = null, closed_at = null,
    public_summary = null, legacy_resolution = false where id = incident.id returning * into incident;
  -- Keep any correction notice until a new finding confirms the reopened case.
  perform public.write_incident_event(incident.id, 'reopened', '{}', reason_text);
  perform public.sync_incident_reports_compat(incident.id);
  return incident;
end;
$$;

revoke all on function public.finish_incident_resolution(uuid, text, text, boolean),
  public.resolve_incident_legacy(uuid, text) from public, anon, authenticated;
revoke all on function public.record_incident_finding(uuid, text, text, text),
  public.request_municipal_support(uuid, public.support_request_kind, text), public.cancel_support_request(uuid, text),
  public.respond_support_request(uuid, text, text), public.resolve_incident(uuid, text, text),
  public.add_public_summary(uuid, text), public.reopen_incident(uuid, text) from public, anon;
grant execute on function public.record_incident_finding(uuid, text, text, text),
  public.request_municipal_support(uuid, public.support_request_kind, text), public.cancel_support_request(uuid, text),
  public.respond_support_request(uuid, text, text), public.resolve_incident(uuid, text, text),
  public.add_public_summary(uuid, text), public.reopen_incident(uuid, text) to authenticated;
