-- Keep the workflow RPC contract and existing queues intact while adding the
-- server-filtered municipal active-response lane.
create or replace function public.list_official_workflow_report_ids(p_queue text, p_limit integer default 20, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_officer() then raise exception 'Operational officer access is required.' using errcode = '42501'; end if;
  if p_queue is null or p_queue not in ('all', 'needs_review', 'under_review', 'mine', 'being_assessed',
    'awaiting_mdrrmo', 'jurisdiction_check', 'incoming_requests', 'municipal_active', 'legacy_escalations',
    'municipal_review', 'municipal_lead', 'mayor_requests') then
    raise exception 'Choose a valid workflow queue.' using errcode = '22023';
  end if;
  with matching as materialized (
    select report.id, report.status, report.created_at from public.reports report
    left join public.incident_cases incident on incident.id = report.incident_case_id
    where public.can_read_report(report) and case p_queue
      when 'all' then true
      when 'needs_review' then report.review_outcome = 'pending' and report.jurisdiction_status = 'in_coverage' and report.review_claimed_by is null
      when 'under_review' then report.review_outcome = 'pending' and report.review_claimed_by is not null
      when 'mine' then report.review_outcome = 'pending' and report.review_claimed_by = auth.uid()
      when 'being_assessed' then incident.state = 'active' and incident.verification = 'pending'
      when 'awaiting_mdrrmo' then incident.state = 'active' and incident.lead_office = 'barangay' and incident.coordination in ('support_requested', 'transfer_requested')
      when 'jurisdiction_check' then public.is_mdrrmo() and report.jurisdiction_status = 'needs_check' and report.review_outcome = 'pending'
      when 'incoming_requests' then public.is_mdrrmo() and incident.state = 'active' and exists (
        select 1 from public.incident_support_requests request where request.incident_case_id = incident.id and request.status = 'requested')
      when 'municipal_active' then public.is_mdrrmo() and incident.state = 'active'
        and (incident.lead_office = 'municipal' or incident.coordination = 'support_active')
      when 'legacy_escalations' then public.is_mdrrmo() and exists (
        select 1 from public.incident_support_requests request where request.incident_case_id = incident.id and request.status = 'requested' and request.is_legacy)
      when 'municipal_review' then public.is_mdrrmo() and incident.state = 'active' and incident.lead_office = 'municipal' and incident.municipal_finding is null
      when 'municipal_lead' then public.is_mdrrmo() and incident.state = 'active' and incident.lead_office = 'municipal'
      when 'mayor_requests' then exists (select 1 from public.incident_update_requests request
        where request.status in ('open', 'acknowledged') and (request.report_id = report.id or request.incident_case_id = incident.id)
        and ((request.responsible_office = 'municipal' and public.is_mdrrmo())
          or (request.responsible_office = 'barangay' and request.responsible_barangay_id = public.current_app_barangay_id())))
      else false end
  ), page as (
    select id from matching order by created_at desc, id
    limit greatest(1, least(coalesce(p_limit, 20), 50)) offset greatest(0, coalesce(p_offset, 0))
  )
  select jsonb_build_object('ids', coalesce((select jsonb_agg(id) from page), '[]'::jsonb),
    'counts', jsonb_build_object('total', count(*), 'unverified', count(*) filter (where status = 'unverified'),
      'verified', count(*) filter (where status = 'verified'), 'escalated', count(*) filter (where status = 'escalated'),
      'resolved', count(*) filter (where status = 'resolved'), 'closed', count(*) filter (where status = 'closed')))
  into result from matching;
  return result;
end;
$$;
revoke all on function public.list_official_workflow_report_ids(text, integer, integer) from public, anon;
grant execute on function public.list_official_workflow_report_ids(text, integer, integer) to authenticated;
