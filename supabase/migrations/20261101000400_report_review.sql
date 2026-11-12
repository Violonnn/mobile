create function public.claim_report_review(p_report_id uuid, p_take_over boolean default false)
returns public.reports language plpgsql security definer set search_path = '' as $$
declare report public.reports; previous_claimant uuid;
begin
  select * into report from public.reports where id = p_report_id for update;
  if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
  perform public.require_report_reviewer(report);
  if report.review_outcome <> 'pending' or report.jurisdiction_status <> 'in_coverage' then
    raise exception 'Only an in-coverage pending report can be claimed.' using errcode = '22023';
  end if;
  if report.review_claimed_by = auth.uid() then return report; end if;
  previous_claimant := report.review_claimed_by;
  if previous_claimant is not null then
    if not coalesce(p_take_over, false) or not exists (
      select 1 from public.app_profiles claimant where claimant.id = previous_claimant
        and claimant.role = 'officer'
        and claimant.barangay_id is not distinct from public.current_app_barangay_id()
    ) then
      raise exception 'Taking over requires another reviewer in the same office.' using errcode = '42501';
    end if;
  end if;
  perform set_config('disasterlink.report_transition', '1', true);
  update public.reports set review_claimed_by = auth.uid(), review_claimed_at = case
    when current_setting('disasterlink.legacy_client', true) = '1' then now() else clock_timestamp() end
    where id = p_report_id returning * into report;
  perform set_config('disasterlink.report_transition', '', true);
  perform public.write_report_flow_history(p_report_id,
    case when previous_claimant is null then 'review_claimed' else 'review_taken_over' end,
    jsonb_build_object('previous_claimant', previous_claimant, 'claimant', auth.uid()));
  return report;
end;
$$;

create function public.release_report_review(p_report_id uuid, p_note text default null)
returns public.reports language plpgsql security definer set search_path = '' as $$
declare report public.reports; note_text text := public.report_flow_text(p_note);
begin
  select * into report from public.reports where id = p_report_id for update;
  if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
  perform public.require_report_reviewer(report);
  if report.review_outcome <> 'pending' or report.review_claimed_by is distinct from auth.uid() then
    raise exception 'Only the current claimant can release a pending review.' using errcode = '42501';
  end if;
  perform set_config('disasterlink.report_transition', '1', true);
  update public.reports set review_claimed_by = null, review_claimed_at = null
    where id = p_report_id returning * into report;
  perform set_config('disasterlink.report_transition', '', true);
  perform public.write_report_flow_history(p_report_id, 'review_released', '{}', note_text);
  return report;
end;
$$;

create function public.review_report(p_report_id uuid, p_decision text, p_reason_code text default null,
  p_note text default null, p_link_incident_case_id uuid default null)
returns public.reports language plpgsql security definer set search_path = '' as $$
declare report public.reports; incident public.incident_cases; outcome public.report_review_outcome;
  note_text text := public.report_flow_text(p_note); reason_text text := public.report_flow_text(p_reason_code, false, 80);
begin
  -- All incident mutations lock the case before its linked reports. A pending
  -- review has no case yet, so this report lock also serializes duplicate reviews.
  select * into report from public.reports where id = p_report_id for update;
  if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
  perform public.require_report_reviewer(report);
  if report.review_outcome <> 'pending' or report.jurisdiction_status <> 'in_coverage'
    or report.review_claimed_by is distinct from auth.uid() then
    raise exception 'An in-coverage pending report requires your own review claim.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('verify', 'link', 'needs_assessment', 'could_not_confirm', 'reject') then
    raise exception 'Invalid review decision.' using errcode = '22023';
  end if;
  if p_decision <> 'link' and p_link_incident_case_id is not null then
    raise exception 'Only a link decision can specify an existing incident.' using errcode = '22023';
  end if;
  if p_decision = 'reject' and (reason_text is null or reason_text not in (
    'test_or_spam', 'not_an_emergency_incident', 'outside_approved_type', 'abusive_content',
    'insufficient_location', 'other')) then
    raise exception 'Select a valid rejection reason.' using errcode = '22023';
  end if;
  if p_decision = 'could_not_confirm' or (p_decision = 'reject' and reason_text = 'other')
    or (p_decision = 'verify' and report.intake_channel = 'hotline_call') then
    note_text := public.report_flow_text(p_note, true);
  end if;
  outcome := case p_decision when 'verify' then 'verified' when 'link' then 'linked'
    when 'reject' then 'rejected' else p_decision end::public.report_review_outcome;
  if p_decision = 'link' then
    select * into incident from public.incident_cases where id = p_link_incident_case_id for update;
    if not found or not coalesce(public.can_read_incident_case(incident), false) or incident.state <> 'active'
      or incident.verification = 'not_confirmed' then
      raise exception 'An active incident within your scope is required.' using errcode = '42501';
    end if;
  elsif p_decision in ('verify', 'needs_assessment') then
    insert into public.incident_cases(source_report_id, barangay_id, incident_type, incident_type_other,
      location, address_text, verification, lead_office, lead_barangay_id, coordination,
      confirmed_by, confirmed_at, confirmation_basis, created_by)
    values (report.id, report.barangay_id, report.incident_type, report.incident_type_other, report.location,
      report.address_text, case when p_decision = 'verify' then 'confirmed' else 'pending' end::public.incident_verification,
      case when public.is_mdrrmo() then 'municipal' else 'barangay' end::public.incident_lead_office,
      case when public.is_bdrrmo() then report.barangay_id else null end,
      case when public.is_mdrrmo() then 'municipal_lead' else 'local' end::public.incident_coordination,
      case when p_decision = 'verify' then auth.uid() end,
      case when p_decision = 'verify' then now() end,
      case when p_decision = 'verify' then 'remote_evidence' end::public.incident_confirmation_basis, auth.uid())
    returning * into incident;
    -- A municipal intake has no transfer awaiting a separate municipal finding.
    if public.is_mdrrmo() and p_decision = 'verify' then
      update public.incident_cases set municipal_finding = 'confirmed', municipal_finding_by = auth.uid(),
        municipal_finding_at = now() where id = incident.id returning * into incident;
    end if;
    perform public.write_incident_event(incident.id, 'incident_created', jsonb_build_object('decision', p_decision), note_text);
  end if;
  perform set_config('disasterlink.report_transition', '1', true);
  update public.reports set review_outcome = outcome, review_reason_code = reason_text,
    reviewed_by = auth.uid(), reviewed_at = now(), incident_case_id = incident.id
    where id = report.id;
  perform set_config('disasterlink.report_transition', '', true);
  if incident.id is not null then
    insert into public.incident_events(incident_case_id, report_id, event_type, actor_id, actor_office,
      actor_barangay_id, details, note, occurred_at)
    select incident.id, report.id, history.detail->>'event_type', history.changed_by,
      case when profile.barangay_id is null then 'municipal' else 'barangay' end::public.incident_lead_office,
      profile.barangay_id, history.detail->'details', history.note, history.created_at
    from public.report_status_history history left join public.app_profiles profile on profile.id = history.changed_by
    where history.report_id = report.id and history.event_type = 'contact_logged';
    if p_decision = 'link' then
      perform public.write_incident_event(incident.id, 'report_linked', jsonb_build_object('report_id', report.id));
    end if;
  end if;
  perform public.write_report_flow_history(report.id, 'review_decided', jsonb_build_object('outcome', outcome), note_text);
  perform public.sync_report_compat_status(report.id);
  select * into report from public.reports where id = p_report_id;
  return report;
end;
$$;

create function public.reopen_report_review(p_report_id uuid, p_reason text)
returns public.reports language plpgsql security definer set search_path = '' as $$
declare report public.reports; reason_text text := public.report_flow_text(p_reason, true);
begin
  select * into report from public.reports where id = p_report_id for update;
  if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
  perform public.require_report_reviewer(report);
  if report.review_outcome not in ('could_not_confirm', 'rejected') or report.incident_case_id is not null then
    raise exception 'Only a rejected or unconfirmed review can be reopened.' using errcode = '22023';
  end if;
  perform set_config('disasterlink.report_transition', '1', true);
  update public.reports set review_outcome = 'pending', review_reason_code = null, reviewed_by = null,
    reviewed_at = null, review_claimed_by = null, review_claimed_at = null where id = report.id;
  perform set_config('disasterlink.report_transition', '', true);
  perform public.write_report_flow_history(report.id, 'review_reopened', '{}', reason_text);
  perform public.sync_report_compat_status(report.id);
  select * into report from public.reports where id = p_report_id;
  return report;
end;
$$;

create function public.reroute_report_barangay(p_report_id uuid, p_target_barangay_id uuid, p_reason text)
returns public.reports language plpgsql security definer set search_path = '' as $$
declare report public.reports; barangay_name text; reason_text text := public.report_flow_text(p_reason, true);
begin
  select * into report from public.reports where id = p_report_id for update;
  if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
  if not coalesce(public.is_mdrrmo() or (public.is_bdrrmo() and report.barangay_id = public.current_app_barangay_id()), false) then
    raise exception 'Not authorized to reroute this report.' using errcode = '42501';
  end if;
  if report.review_outcome <> 'pending' or report.jurisdiction_status <> 'in_coverage' then
    raise exception 'Only an in-coverage pending report can be rerouted.' using errcode = '22023';
  end if;
  select name into barangay_name from public.barangays where id = p_target_barangay_id;
  if not found or p_target_barangay_id = report.barangay_id then
    raise exception 'Select a different valid barangay.' using errcode = '22023';
  end if;
  perform set_config('disasterlink.report_transition', '1', true);
  update public.reports set barangay_id = p_target_barangay_id, review_claimed_by = null, review_claimed_at = null
    where id = report.id returning * into report;
  perform set_config('disasterlink.report_transition', '', true);
  perform public.write_report_flow_history(report.id, 'routing_changed', jsonb_build_object(
    'barangay_id', p_target_barangay_id, 'public_text', 'Moved to Brgy. ' || barangay_name
      || ' BDRRMO because the incident location is in Brgy. ' || barangay_name || '.'), reason_text);
  return report;
end;
$$;

create function public.resolve_report_jurisdiction(p_report_id uuid, p_decision text,
  p_barangay_id uuid default null, p_note text default null)
returns public.reports language plpgsql security definer set search_path = '' as $$
declare report public.reports; note_text text := public.report_flow_text(p_note);
begin
  if not public.is_mdrrmo() then raise exception 'Only MDRRMO can check jurisdiction.' using errcode = '42501'; end if;
  select * into report from public.reports where id = p_report_id for update;
  if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
  if report.jurisdiction_status <> 'needs_check' or report.review_outcome <> 'pending'
    or p_decision is null or p_decision not in ('in_coverage', 'outside_coverage') then
    raise exception 'A pending jurisdiction check and valid decision are required.' using errcode = '22023';
  end if;
  if p_decision = 'in_coverage' and not exists (
    select 1 from public.barangays where id = coalesce(p_barangay_id, report.barangay_id)) then
    raise exception 'Select a valid receiving barangay.' using errcode = '22023';
  end if;
  perform set_config('disasterlink.report_transition', '1', true);
  update public.reports set jurisdiction_status = p_decision::public.report_jurisdiction_status,
    review_outcome = case when p_decision = 'outside_coverage' then 'outside_coverage' else 'pending' end::public.report_review_outcome,
    barangay_id = case when p_decision = 'in_coverage' then coalesce(p_barangay_id, barangay_id) else barangay_id end,
    review_claimed_by = null, review_claimed_at = null where id = p_report_id returning * into report;
  perform set_config('disasterlink.report_transition', '', true);
  perform public.write_report_flow_history(report.id, 'jurisdiction_checked', jsonb_build_object(
    'decision', p_decision, 'barangay_id', report.barangay_id, 'public_text',
    case when p_decision = 'in_coverage' then 'MDRRMO confirmed coverage and routed the report to Brgy. '
      || (select name from public.barangays where id = report.barangay_id) || ' BDRRMO.'
      else 'MDRRMO confirmed that the location is outside coverage.' end), note_text);
  perform public.sync_report_compat_status(report.id);
  select * into report from public.reports where id = p_report_id;
  return report;
end;
$$;

create function public.list_incident_link_candidates(p_report_id uuid, p_radius_meters integer default 500,
  p_window_hours integer default 24)
returns table (incident_case_id uuid, source_report_id uuid, incident_type text,
  verification public.incident_verification, coordination public.incident_coordination,
  distance_meters double precision, linked_report_count integer, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare report public.reports;
begin
  select * into report from public.reports where id = p_report_id;
  if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
  perform public.require_report_reviewer(report);
  return query select incident.id, incident.source_report_id, incident.incident_type, incident.verification,
    incident.coordination, extensions.st_distance(incident.location, report.location),
    (select count(*)::integer from public.reports linked where linked.incident_case_id = incident.id), incident.created_at
  from public.incident_cases incident where public.can_read_incident_case(incident)
    and incident.state = 'active' and incident.verification <> 'not_confirmed'
    and incident.created_at >= now() - make_interval(hours => greatest(1, least(coalesce(p_window_hours, 24), 168)))
    and extensions.st_dwithin(incident.location, report.location, greatest(50, least(coalesce(p_radius_meters, 500), 5000)))
  order by extensions.st_distance(incident.location, report.location), incident.id limit 50;
end;
$$;

create function public.count_nearby_pending_reports(p_report_id uuid, p_radius_meters integer default 500,
  p_window_hours integer default 6)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare report public.reports; total integer;
begin
  select * into report from public.reports where id = p_report_id;
  if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
  perform public.require_report_reviewer(report);
  select count(*)::integer into total from public.reports nearby where nearby.id <> report.id
    and nearby.review_outcome = 'pending' and public.can_read_report(nearby)
    and nearby.created_at >= now() - make_interval(hours => greatest(1, least(coalesce(p_window_hours, 6), 168)))
    and extensions.st_dwithin(nearby.location, report.location, greatest(50, least(coalesce(p_radius_meters, 500), 5000)));
  return total;
end;
$$;

revoke all on function public.claim_report_review(uuid, boolean), public.release_report_review(uuid, text),
  public.review_report(uuid, text, text, text, uuid), public.reopen_report_review(uuid, text),
  public.reroute_report_barangay(uuid, uuid, text), public.resolve_report_jurisdiction(uuid, text, uuid, text),
  public.list_incident_link_candidates(uuid, integer, integer), public.count_nearby_pending_reports(uuid, integer, integer)
  from public, anon;
grant execute on function public.claim_report_review(uuid, boolean), public.release_report_review(uuid, text),
  public.review_report(uuid, text, text, text, uuid), public.reopen_report_review(uuid, text),
  public.reroute_report_barangay(uuid, uuid, text), public.resolve_report_jurisdiction(uuid, text, uuid, text),
  public.list_incident_link_candidates(uuid, integer, integer), public.count_nearby_pending_reports(uuid, integer, integer)
  to authenticated;
