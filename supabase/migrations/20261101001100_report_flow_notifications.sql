create function public.active_official_ids_for_office(p_office public.incident_lead_office, p_barangay_id uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.app_profiles where role = 'officer' and status = 'active'
    and ((p_office = 'municipal' and barangay_id is null)
      or (p_office = 'barangay' and barangay_id = p_barangay_id));
$$;

create function public.notify_report_flow_recipient(p_recipient uuid, p_actor uuid, p_type public.notification_type,
  p_title text, p_body text, p_entity_type text, p_entity_id uuid, p_dedupe_key text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications(user_id, actor_id, type, title, body, related_entity_type,
    related_entity_id, sent_via, dedupe_key)
  select p_recipient, p_actor, p_type, p_title, p_body, p_entity_type, p_entity_id, 'none', p_dedupe_key
  where coalesce(current_setting('disasterlink.suppress_flow_notifications', true), '') <> '1'
    and exists (select 1 from public.app_profiles where id = p_recipient and status = 'active')
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
$$;

-- Workflow notifications use the immutable audit-event id. Timestamp/counter
-- updates and compatibility synchronization cannot produce duplicate alerts.
create function public.create_report_flow_history_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
declare report public.reports; notice_type public.notification_type; notice_title text; notice_body text;
begin
  if coalesce(current_setting('disasterlink.suppress_flow_notifications', true), '') = '1' then return new; end if;
  select * into report from public.reports where id = new.report_id;
  case new.event_type
    when 'review_claimed' then
      notice_type := 'report_review_started'; notice_title := 'Report under review';
      notice_body := 'The responsible office has started reviewing your report.';
    when 'routing_changed' then
      notice_type := 'report_rerouted'; notice_title := 'Responsible office updated'; notice_body := new.detail->>'public_text';
    when 'jurisdiction_checked' then
      notice_type := case when new.detail->>'decision' = 'outside_coverage' then 'report_outside_coverage'
        else 'report_rerouted' end; notice_title := 'Coverage check completed'; notice_body := new.detail->>'public_text';
    when 'review_decided' then
      case new.detail->>'outcome'
        when 'verified' then notice_type := 'report_verified'; notice_title := 'Report confirmed';
        when 'linked' then notice_type := 'report_linked'; notice_title := 'Report linked to an incident';
        when 'could_not_confirm' then notice_type := 'report_not_confirmed'; notice_title := 'Report could not be confirmed';
        when 'rejected' then notice_type := 'report_rejected'; notice_title := 'Report review completed';
        else return new;
      end case;
      notice_body := notice_title || '. Open your report for its current outcome.';
    else return new;
  end case;
  perform public.notify_report_flow_recipient(report.reporter_id, new.changed_by, notice_type,
    notice_title, notice_body, 'report', report.id, 'report-flow:' || new.id || ':' || report.reporter_id);
  return new;
end;
$$;
create trigger report_flow_history_notifications after insert on public.report_status_history
  for each row execute function public.create_report_flow_history_notifications();

create or replace function public.create_report_activity_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid := coalesce(nullif(current_setting('disasterlink.location_actor', true), '')::uuid, auth.uid());
begin
  if actor is null or actor = new.reporter_id
    or coalesce(current_setting('disasterlink.suppress_flow_notifications', true), '') = '1' then return new; end if;
  -- Routing gets a precise history-based notice. Ordinary content/location edits
  -- keep the existing activity notification used by old apps.
  if row(new.title, new.description, new.incident_type, new.incident_type_other, new.location, new.address_text)
    is distinct from row(old.title, old.description, old.incident_type, old.incident_type_other, old.location, old.address_text) then
    perform public.notify_report_flow_recipient(new.reporter_id, actor, 'report_updated', 'Report details updated',
      'An official updated your report.', 'report', new.id, 'report-edit:' || new.id || ':' || clock_timestamp());
  end if;
  return new;
end;
$$;

create function public.create_incident_event_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
declare incident public.incident_cases; notice_type public.notification_type; notice_title text; recipient uuid;
  linked_report record; notice_body text;
begin
  if coalesce(current_setting('disasterlink.suppress_flow_notifications', true), '') = '1' then return new; end if;
  select * into incident from public.incident_cases where id = new.incident_case_id;
  case new.event_type
    when 'transfer_requested' then notice_type := 'report_forwarded'; notice_title := 'Forwarded to MDRRMO';
    when 'transfer_accepted' then notice_type := 'report_transfer_accepted'; notice_title := 'MDRRMO accepted responsibility';
    when 'request_returned' then notice_type := 'report_rerouted'; notice_title := 'The barangay remains responsible';
    when 'withdrawn' then notice_type := 'report_withdrawn'; notice_title := 'Incident confirmation corrected';
    when 'progress_update' then notice_type := 'report_progress'; notice_title := 'Incident progress update';
    when 'resolved' then notice_type := 'report_resolved'; notice_title := 'Incident resolved';
    when 'summary_added' then notice_type := 'report_progress'; notice_title := 'Outcome summary posted';
    when 'finding_recorded' then
      notice_type := case when new.details->>'finding' = 'confirmed' then 'report_verified' else 'report_not_confirmed' end;
      notice_title := case when new.details->>'finding' = 'confirmed' then 'Incident confirmed' else 'Incident could not be confirmed' end;
    else notice_type := null;
  end case;
  if notice_type is not null then
    notice_body := coalesce(new.details->>'public_text',
      case when new.event_type = 'progress_update' then new.details->>'text' end, notice_title || '.');
    -- One alert per reporter, even if that person submitted multiple linked reports.
    for linked_report in select distinct on (reporter_id) reporter_id, id from public.reports
      where incident_case_id = incident.id order by reporter_id, created_at, id loop
      perform public.notify_report_flow_recipient(linked_report.reporter_id, new.actor_id, notice_type,
        notice_title, notice_body, 'report', linked_report.id, 'incident-event:' || new.id || ':' || linked_report.reporter_id);
    end loop;
  end if;
  if new.event_type in ('support_requested', 'transfer_requested') then
    for recipient in select public.active_official_ids_for_office('municipal', null) loop
      perform public.notify_report_flow_recipient(recipient, new.actor_id, 'incident_support_requested',
        'Municipal coordination requested', 'A barangay has requested municipal coordination.',
        'report', incident.source_report_id, 'incident-event:' || new.id || ':' || recipient);
    end loop;
  elsif new.event_type in ('support_accepted', 'transfer_accepted', 'request_returned') then
    for recipient in select public.active_official_ids_for_office('barangay', incident.barangay_id) loop
      perform public.notify_report_flow_recipient(recipient, new.actor_id, 'incident_support_responded',
        'MDRRMO responded', 'MDRRMO has responded to the coordination request.',
        'report', incident.source_report_id, 'incident-event:' || new.id || ':' || recipient);
    end loop;
  end if;
  return new;
end;
$$;
create trigger incident_event_notifications after insert on public.incident_events
  for each row execute function public.create_incident_event_notifications();

create function public.create_update_request_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient uuid; entity_id uuid;
begin
  entity_id := coalesce(new.report_id, (select source_report_id from public.incident_cases where id = new.incident_case_id));
  if tg_op = 'INSERT' then
    for recipient in select public.active_official_ids_for_office(new.responsible_office, new.responsible_barangay_id) loop
      perform public.notify_report_flow_recipient(recipient, new.requested_by, 'mayor_update_requested',
        'Mayor requested an update', 'Your office has a tracked update request from the Mayor.',
        'report', entity_id, 'mayor-request:' || new.id || ':open:' || recipient);
    end loop;
  elsif new.status is distinct from old.status and new.status in ('acknowledged', 'answered') then
    perform public.notify_report_flow_recipient(new.requested_by, coalesce(new.answered_by, new.acknowledged_by),
      'mayor_update_answered', case when new.status = 'answered' then 'Update request answered' else 'Update request acknowledged' end,
      'The responsible office has ' || new.status::text || ' your update request.', 'report', entity_id,
      'mayor-request:' || new.id || ':' || new.status || ':' || new.requested_by);
  end if;
  return new;
end;
$$;
create trigger update_request_notifications after insert or update on public.incident_update_requests
  for each row execute function public.create_update_request_notifications();

revoke all on function public.active_official_ids_for_office(public.incident_lead_office, uuid),
  public.notify_report_flow_recipient(uuid, uuid, public.notification_type, text, text, text, uuid, text),
  public.create_report_flow_history_notifications(), public.create_report_activity_notification(),
  public.create_incident_event_notifications(), public.create_update_request_notifications()
  from public, anon, authenticated;
