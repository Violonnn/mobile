-- Phase 3: retain barangay visibility while the lead office controls mutations.
create or replace function public.can_read_report(p_report public.reports)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_active_profile() then return false; end if;
  if public.is_bdrrmo() then
    return p_report.barangay_id = public.current_app_barangay_id()
      or exists (select 1 from public.incident_cases incident where incident.id = p_report.incident_case_id
        and (public.is_incident_lead(incident) or public.is_incident_supporter(incident)));
  end if;
  if public.is_official() then return true; end if;
  -- Resident/public cutover remains Phase 4. Preserve Phase 0's existing rule.
  return p_report.reporter_id = auth.uid() or p_report.status <> 'unverified';
end;
$$;

create or replace function public.guard_bdrrmo_handed_off_report_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor_text text := nullif(current_setting('disasterlink.location_actor', true), '');
  actor_barangay uuid;
begin
  if actor_text is null or old.incident_case_id is null then return new; end if;
  select barangay_id into actor_barangay from public.app_profiles
    where id = actor_text::uuid and role = 'officer' and status = 'active';
  if actor_barangay is not null and exists (select 1 from public.incident_cases incident
    where incident.id = old.incident_case_id and incident.lead_office = 'municipal') then
    raise exception 'Only the lead office can change incident content or location after an accepted transfer.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Append only: existing clients depend on the original projection column order.
create or replace view public.reports_map with (security_invoker = true) as
select r.id, r.title, r.description, r.status, r.barangay_id, r.created_at, r.reporter_id,
  r.address_text, r.upvote_count, r.comment_count, ap.first_name as reporter_first_name,
  ap.last_name as reporter_last_name, ap.middle_name as reporter_middle_name,
  extensions.st_y(r.location::extensions.geometry) as latitude,
  extensions.st_x(r.location::extensions.geometry) as longitude,
  r.incident_type, r.incident_type_other, ap.avatar_path as reporter_avatar_path,
  r.incident_case_id, r.review_outcome, r.review_reason_code, r.review_claimed_by,
  r.review_claimed_at, r.jurisdiction_status, r.intake_channel
from public.reports r join public.app_profiles_public ap on ap.id = r.reporter_id;

-- Server-side filtering precedes pagination. Return aggregate counts separately
-- so rare queues remain reachable even when newer unrelated reports fill a page.
create function public.list_official_workflow_report_ids(p_queue text, p_limit integer default 20, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_officer() then raise exception 'Operational officer access is required.' using errcode = '42501'; end if;
  if p_queue is null or p_queue not in ('all', 'needs_review', 'under_review', 'mine', 'being_assessed',
    'awaiting_mdrrmo', 'jurisdiction_check', 'incoming_requests', 'legacy_escalations',
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

-- A service-only intake overload stores uncertainty in the same transaction as
-- the report and media. There is no interval where a reviewer can claim it first.
create function public.create_report_with_media(
  p_reporter_id uuid, p_report_id uuid, p_title text, p_description text,
  p_latitude double precision, p_longitude double precision, p_address_text text, p_media jsonb,
  p_barangay_id uuid, p_incident_type text, p_incident_type_other text,
  p_device_latitude double precision, p_device_longitude double precision,
  p_gps_accuracy_meters double precision, p_jurisdiction_status public.report_jurisdiction_status
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare report_id uuid;
begin
  if p_jurisdiction_status is null or p_jurisdiction_status not in ('in_coverage', 'needs_check') then
    raise exception 'Invalid intake jurisdiction.' using errcode = '22023';
  end if;
  report_id := public.create_report_with_media(p_reporter_id, p_report_id, p_title, p_description,
    p_latitude, p_longitude, p_address_text, p_media, p_barangay_id, p_incident_type, p_incident_type_other,
    p_device_latitude, p_device_longitude, p_gps_accuracy_meters);
  perform set_config('disasterlink.report_transition', '1', true);
  update public.reports set jurisdiction_status = p_jurisdiction_status where id = report_id;
  perform set_config('disasterlink.report_transition', '', true);
  return report_id;
end;
$$;
revoke all on function public.create_report_with_media(uuid, uuid, text, text, double precision,
  double precision, text, jsonb, uuid, text, text, double precision, double precision, double precision,
  public.report_jurisdiction_status) from public, anon, authenticated;
grant execute on function public.create_report_with_media(uuid, uuid, text, text, double precision,
  double precision, text, jsonb, uuid, text, text, double precision, double precision, double precision,
  public.report_jurisdiction_status) to service_role;

create function public.get_report_intake_routing(p_latitude double precision, p_longitude double precision, p_barangay_id uuid default null)
returns table(nearest_barangay_id uuid, nearest_distance_meters double precision, selected_distance_meters double precision)
language sql stable security definer set search_path = '' as $$
  with point as (select extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography as location)
  select nearest.id, extensions.st_distance(nearest.centroid, point.location),
    (select extensions.st_distance(selected.centroid, point.location) from public.barangays selected where selected.id = p_barangay_id)
  from point left join lateral (select barangay.id, barangay.centroid from public.barangays barangay
    where barangay.centroid is not null order by extensions.st_distance(barangay.centroid, point.location) limit 1) nearest on true;
$$;
revoke all on function public.get_report_intake_routing(double precision, double precision, uuid) from public, anon, authenticated;
grant execute on function public.get_report_intake_routing(double precision, double precision, uuid) to service_role;
