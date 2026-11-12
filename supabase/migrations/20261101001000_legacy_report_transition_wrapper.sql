create or replace function public.transition_report_status(p_report_id uuid,
  p_target_status public.report_status, p_note text default null)
returns public.reports language plpgsql security definer set search_path = '' as $$
declare report public.reports; incident public.incident_cases; request_id uuid;
  note_text text := public.report_flow_text(p_note);
begin
  if public.is_mayor() then
    raise exception 'Mayor accounts cannot change report status' using errcode = '42501';
  end if;
  if not public.is_officer() then raise exception 'Not authorized for this report' using errcode = '42501'; end if;
  select * into report from public.reports where id = p_report_id;
  if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
  -- Case-first ordering matches the incident RPCs and avoids stale decisions.
  if report.incident_case_id is not null then
    select * into incident from public.incident_cases where id = report.incident_case_id for update;
  end if;
  select * into report from public.reports where id = p_report_id for update;
  if public.is_bdrrmo() and report.barangay_id is distinct from public.current_app_barangay_id() then
    raise exception 'Not authorized for this report' using errcode = '42501';
  end if;
  if public.is_bdrrmo() and p_target_status = 'escalated' and report.reverified_at is not null then
    raise exception 'A reverified report cannot be escalated again.' using errcode = '42501';
  end if;
  perform set_config('disasterlink.legacy_client', '1', true);
  if public.is_bdrrmo() and report.status = 'unverified' and p_target_status = 'verified'
    and report.review_outcome = 'pending' then
    -- Do not silently take another officer's claim for an old client.
    perform public.claim_report_review(report.id);
    perform public.review_report(report.id, 'verify', null, note_text);
  elsif public.is_bdrrmo() and report.status = 'verified' and p_target_status = 'escalated'
    and report.escalated_at is null then
    perform public.request_municipal_support(report.incident_case_id, 'transfer',
      coalesce(note_text, 'Transfer requested through the previous app workflow.'));
  elsif public.is_bdrrmo() and report.status = 'verified' and p_target_status = 'resolved'
    and report.escalated_at is null then
    perform public.resolve_incident_legacy(report.incident_case_id, note_text);
  elsif public.is_mdrrmo() and report.status = 'escalated' and p_target_status = 'verified' then
    select id into request_id from public.incident_support_requests
      where incident_case_id = report.incident_case_id and kind = 'transfer' and status = 'requested';
    if request_id is not null then perform public.respond_support_request(request_id, 'accept', note_text); end if;
    perform public.record_incident_finding(report.incident_case_id, 'confirmed',
      coalesce(note_text, 'Finding recorded through the previous app workflow.'));
  elsif public.is_mdrrmo() and report.status = 'verified' and p_target_status = 'resolved'
    and report.escalated_at is not null and report.reverified_at is not null then
    perform public.resolve_incident_legacy(report.incident_case_id, note_text);
  else
    raise exception 'This status transition is not allowed' using errcode = '42501';
  end if;
  perform set_config('disasterlink.legacy_client', '', true);
  select * into report from public.reports where id = p_report_id;
  return report;
end;
$$;
revoke all on function public.transition_report_status(uuid, public.report_status, text) from public, anon;
grant execute on function public.transition_report_status(uuid, public.report_status, text) to authenticated, service_role;
