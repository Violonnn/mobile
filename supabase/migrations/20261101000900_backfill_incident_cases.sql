-- Retained as an internal, idempotent routine so reconciliation can be tested
-- with representative legacy rows. It never invents a transfer acceptance.
create function public.backfill_incident_cases()
returns void language plpgsql security definer set search_path = '' as $$
declare report public.reports; incident public.incident_cases; reporter public.app_profiles;
  municipal boolean; previous_suppression text := current_setting('disasterlink.suppress_flow_notifications', true);
begin
  perform set_config('disasterlink.suppress_flow_notifications', '1', true);
  for report in select * from public.reports where incident_case_id is null
    and status in ('verified', 'escalated', 'resolved') order by id for update loop
    select * into reporter from public.app_profiles where id = report.reporter_id;
    -- Authorship alone does not record a handoff or a municipal finding.
    -- Routed legacy cases stay barangay-led unless municipal handling is recorded.
    municipal := report.reverified_at is not null or (report.status = 'resolved' and report.escalated_at is not null)
      or report.barangay_id is null;
    if report.status = 'escalated' and report.reverified_at is null and report.barangay_id is null then
      raise exception 'Legacy escalation % needs a receiving barangay before migration.', report.id using errcode = '23514';
    end if;
    insert into public.incident_cases(source_report_id, barangay_id, incident_type, incident_type_other,
      location, address_text, verification, state, lead_office, lead_barangay_id, coordination,
      confirmed_by, confirmed_at, confirmation_basis, municipal_finding, municipal_finding_by,
      municipal_finding_at, resolved_by, resolved_at, legacy_resolution, public_summary, created_by, created_at)
    values (report.id, report.barangay_id, report.incident_type, report.incident_type_other,
      report.location, report.address_text, 'confirmed',
      case when report.status = 'resolved' then 'resolved' else 'active' end::public.incident_state,
      case when municipal then 'municipal' else 'barangay' end::public.incident_lead_office,
      case when not municipal then report.barangay_id end,
      case when municipal then 'municipal_lead' when report.status = 'escalated' then 'transfer_requested'
        else 'local' end::public.incident_coordination,
      report.verified_by, coalesce(report.verified_at, report.created_at), 'legacy',
      case when report.reverified_at is not null then 'confirmed' end::public.incident_verification,
      report.reverified_by, report.reverified_at, report.resolved_by,
      case when report.status = 'resolved' then coalesce(report.resolved_at, report.updated_at) end,
      report.status = 'resolved', null, report.reporter_id, report.created_at)
    returning * into incident;
    perform set_config('disasterlink.report_transition', '1', true);
    update public.reports set incident_case_id = incident.id, review_outcome = 'verified',
      reviewed_by = report.verified_by, reviewed_at = coalesce(report.verified_at, report.created_at),
      intake_channel = case when reporter.role in ('officer', 'mayor', 'admin') then 'official_field' else 'resident_app' end::public.report_intake_channel
      where id = report.id;
    perform set_config('disasterlink.report_transition', '', true);
    if report.status = 'escalated' and report.reverified_at is null then
      insert into public.incident_support_requests(incident_case_id, kind, previous_coordination, requested_by,
        requesting_barangay_id, is_legacy, legacy_label, created_at)
      values (incident.id, 'transfer', 'local', report.escalated_by, report.barangay_id, true,
        'Legacy escalation — MDRRMO acceptance not recorded', coalesce(report.escalated_at, report.updated_at));
    end if;
    insert into public.incident_events(incident_case_id, report_id, event_type, actor_id, actor_office,
      actor_barangay_id, details, occurred_at)
    values (incident.id, report.id, case when report.reverified_at is not null then 'legacy_handoff' else 'incident_created' end,
      coalesce(report.reverified_by, report.verified_by),
      case when municipal then 'municipal' else 'barangay' end::public.incident_lead_office,
      case when not municipal then report.barangay_id end,
      jsonb_build_object('legacy', true, 'legacy_label', case
        when report.reverified_at is not null then 'Legacy handoff — MDRRMO re-verified this case; a separate transfer acceptance was not recorded.'
        when report.status = 'escalated' then 'Legacy escalation — MDRRMO acceptance not recorded'
        when report.status = 'resolved' then 'Resolved — outcome summary not recorded'
        when reporter.role in ('officer', 'mayor', 'admin') then 'Logged by an official under the previous process'
        else 'Verified under the previous process' end), coalesce(report.reverified_at, report.verified_at, report.created_at));
    perform public.sync_report_compat_status(report.id);
  end loop;
  perform set_config('disasterlink.suppress_flow_notifications', coalesce(previous_suppression, ''), true);
end;
$$;
revoke all on function public.backfill_incident_cases() from public, anon, authenticated, service_role;

select public.backfill_incident_cases();

-- Deployment reconciliation: counts must match, and this list is the MDRRMO queue.
select report.status, count(*) as legacy_compatibility_count,
  count(incident.id) as incident_count
from public.reports report left join public.incident_cases incident on incident.id = report.incident_case_id
group by report.status order by report.status;
select request.id, request.incident_case_id, request.requesting_barangay_id, request.legacy_label
from public.incident_support_requests request where request.is_legacy and request.status = 'requested';
