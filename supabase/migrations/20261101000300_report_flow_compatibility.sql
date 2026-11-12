-- Shared validation and audit writers are internal, never exposed as RPCs.
create function public.report_flow_text(p_text text, p_required boolean default false, p_max integer default 500)
returns text language plpgsql security definer set search_path = '' as $$
declare normalized text := nullif(btrim(p_text), '');
begin
  if (p_required and normalized is null) or length(normalized) > p_max then
    raise exception 'Text is required when specified and must be % characters or fewer.', p_max using errcode = '22023';
  end if;
  return normalized;
end;
$$;

create function public.require_report_reviewer(p_report public.reports)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((public.is_bdrrmo() and p_report.barangay_id = public.current_app_barangay_id())
    or (public.is_mdrrmo() and not public.barangay_has_active_bdrrmo(p_report.barangay_id)), false) then
    raise exception 'Not authorized to review this report.' using errcode = '42501';
  end if;
end;
$$;

create function public.require_incident_lead(p_case public.incident_cases)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.is_incident_lead(p_case), false) then
    raise exception 'Only the lead office can perform this action.' using errcode = '42501';
  end if;
end;
$$;

create function public.write_report_flow_history(p_report_id uuid, p_event_type text,
  p_detail jsonb default '{}', p_note text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.report_status_history(report_id, event_type, changed_by, detail, note)
  values (p_report_id, p_event_type, auth.uid(), p_detail || jsonb_build_object(
    'via_legacy_client', coalesce(current_setting('disasterlink.legacy_client', true), '') = '1'), p_note);
$$;

create function public.write_incident_event(p_case_id uuid, p_event_type text,
  p_details jsonb default '{}', p_note text default null, p_public boolean default false)
returns public.incident_events language plpgsql security definer set search_path = '' as $$
declare result public.incident_events;
begin
  insert into public.incident_events(incident_case_id, event_type, actor_id, actor_office,
    actor_barangay_id, details, note, is_public)
  values (p_case_id, p_event_type, auth.uid(),
    (select office from public.current_official_office()), public.current_app_barangay_id(),
    p_details, p_note, p_public) returning * into result;
  return result;
end;
$$;

create function public.sync_report_compat_status(p_report_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare report public.reports; incident public.incident_cases; compat public.report_status;
begin
  select * into report from public.reports where id = p_report_id for update;
  if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
  select * into incident from public.incident_cases where id = report.incident_case_id;
  compat := case
    when report.review_outcome in ('could_not_confirm', 'rejected', 'outside_coverage')
      or report.jurisdiction_status = 'outside_coverage' or incident.state = 'closed' then 'closed'
    when incident.state = 'resolved' then 'resolved'
    when incident.coordination = 'transfer_requested'
      or (incident.coordination = 'municipal_lead' and incident.municipal_finding is null) then 'escalated'
    when incident.verification = 'confirmed' then 'verified'
    else 'unverified' end;
  perform set_config('disasterlink.report_transition', '1', true);
  update public.reports set status = compat,
    verified_by = coalesce(incident.confirmed_by, reports.verified_by),
    verified_at = coalesce(incident.confirmed_at, reports.verified_at),
    reverified_by = case when incident.municipal_finding = 'confirmed' then incident.municipal_finding_by else reports.reverified_by end,
    reverified_at = case when incident.municipal_finding = 'confirmed' then incident.municipal_finding_at else reports.reverified_at end,
    resolved_by = incident.resolved_by, resolved_at = incident.resolved_at
  where id = p_report_id;
  perform set_config('disasterlink.report_transition', '', true);
end;
$$;

create function public.sync_incident_reports_compat(p_incident_case_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare linked_id uuid;
begin
  for linked_id in select id from public.reports where incident_case_id = p_incident_case_id order by id loop
    perform public.sync_report_compat_status(linked_id);
  end loop;
end;
$$;

-- Invoker rights are intentional: a caller-set GUC alone cannot bypass this guard.
create or replace function public.guard_report_status_columns()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon')
    and current_setting('disasterlink.report_transition', true) = '1' then return new; end if;
  if row(new.status, new.verified_by, new.verified_at, new.reverified_by, new.reverified_at,
    new.escalated_by, new.escalated_at, new.escalated_to, new.resolved_by, new.resolved_at,
    new.incident_case_id, new.review_outcome, new.review_reason_code, new.reviewed_by, new.reviewed_at,
    new.review_claimed_by, new.review_claimed_at, new.jurisdiction_status, new.intake_channel)
    is distinct from row(old.status, old.verified_by, old.verified_at, old.reverified_by, old.reverified_at,
    old.escalated_by, old.escalated_at, old.escalated_to, old.resolved_by, old.resolved_at,
    old.incident_case_id, old.review_outcome, old.review_reason_code, old.reviewed_by, old.reviewed_at,
    old.review_claimed_by, old.review_claimed_at, old.jurisdiction_status, old.intake_channel) then
    raise exception 'Report lifecycle changes must use the authorized workflow functions.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.normalize_report_on_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare reporter public.app_profiles;
begin
  select * into reporter from public.app_profiles where id = new.reporter_id;
  new.incident_case_id := null;
  new.review_claimed_by := null; new.review_claimed_at := null;
  new.review_reason_code := null; new.reviewed_by := null; new.reviewed_at := null;
  new.reverified_by := null; new.reverified_at := null;
  new.escalated_by := null; new.escalated_at := null; new.escalated_to := null;
  new.resolved_by := null; new.resolved_at := null;
  -- Only trusted intake may set needs_check; a resident cannot self-confirm jurisdiction.
  if current_setting('role', true) = 'authenticated' then new.jurisdiction_status := 'in_coverage'; end if;
  if reporter.role = 'officer' and reporter.status = 'active' then
    if new.intake_channel <> 'hotline_call' then new.intake_channel := 'official_field'; end if;
  else
    new.intake_channel := 'resident_app';
  end if;
  if new.intake_channel = 'official_field' then
    new.status := 'verified'; new.review_outcome := 'verified';
    new.verified_by := new.reporter_id; new.verified_at := now();
    new.reviewed_by := new.reporter_id; new.reviewed_at := now();
  else
    new.status := 'unverified'; new.review_outcome := 'pending';
    new.verified_by := null; new.verified_at := null;
  end if;
  return new;
end;
$$;

create function public.incident_case_touch()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := clock_timestamp(); new.version := old.version + 1;
  return new;
end;
$$;
create trigger incident_case_touch before update on public.incident_cases
  for each row execute function public.incident_case_touch();

revoke all on function public.report_flow_text(text, boolean, integer), public.require_report_reviewer(public.reports),
  public.require_incident_lead(public.incident_cases), public.write_report_flow_history(uuid, text, jsonb, text),
  public.write_incident_event(uuid, text, jsonb, text, boolean), public.sync_report_compat_status(uuid),
  public.sync_incident_reports_compat(uuid), public.incident_case_touch(), public.normalize_report_on_insert()
  from public, anon, authenticated;
