create function public.request_mayor_update(p_report_id uuid default null,
  p_incident_case_id uuid default null, p_note text default null)
returns public.incident_update_requests language plpgsql security definer set search_path = '' as $$
declare report public.reports; incident public.incident_cases; result public.incident_update_requests;
  office public.incident_lead_office; target_barangay uuid; note_text text := public.report_flow_text(p_note);
begin
  if not public.is_mayor() then raise exception 'Only the Mayor can request an update.' using errcode = '42501'; end if;
  if num_nonnulls(p_report_id, p_incident_case_id) <> 1 then
    raise exception 'Specify exactly one update target.' using errcode = '22023';
  end if;
  if p_report_id is not null then
    select * into report from public.reports where id = p_report_id for update;
    if not found then raise exception 'Report not found' using errcode = 'P0002'; end if;
    if report.incident_case_id is not null or report.review_outcome <> 'pending' then
      raise exception 'Select the incident for an already reviewed report.' using errcode = '22023';
    end if;
    office := case when report.jurisdiction_status = 'needs_check' or report.barangay_id is null
      or not public.barangay_has_active_bdrrmo(report.barangay_id) then 'municipal' else 'barangay' end;
    target_barangay := case when office = 'barangay' then report.barangay_id end;
  else
    select * into incident from public.incident_cases where id = p_incident_case_id for update;
    if not found then raise exception 'Incident not found' using errcode = 'P0002'; end if;
    office := incident.lead_office; target_barangay := incident.lead_barangay_id;
  end if;
  insert into public.incident_update_requests(report_id, incident_case_id, responsible_office,
    responsible_barangay_id, requested_by, request_note)
  values (p_report_id, p_incident_case_id, office, target_barangay, auth.uid(), note_text) returning * into result;
  return result;
end;
$$;

create function public.require_update_responsible_office(p_request public.incident_update_requests)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((p_request.responsible_office = 'municipal' and public.is_mdrrmo())
    or (p_request.responsible_office = 'barangay' and public.is_bdrrmo()
      and p_request.responsible_barangay_id = public.current_app_barangay_id()), false) then
    raise exception 'Only the responsible office can answer this request.' using errcode = '42501';
  end if;
end;
$$;

create function public.acknowledge_update_request(p_request_id uuid)
returns public.incident_update_requests language plpgsql security definer set search_path = '' as $$
declare request public.incident_update_requests;
begin
  select * into request from public.incident_update_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  perform public.require_update_responsible_office(request);
  if request.status <> 'open' then raise exception 'Only an open request can be acknowledged.' using errcode = '22023'; end if;
  update public.incident_update_requests set status = 'acknowledged', acknowledged_by = auth.uid(), acknowledged_at = now()
    where id = request.id returning * into request;
  return request;
end;
$$;

create function public.answer_update_request(p_request_id uuid, p_answer_text text, p_progress_event_id uuid default null)
returns public.incident_update_requests language plpgsql security definer set search_path = '' as $$
declare request public.incident_update_requests; answer text := public.report_flow_text(p_answer_text, true);
begin
  select * into request from public.incident_update_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  perform public.require_update_responsible_office(request);
  if request.status not in ('open', 'acknowledged') then
    raise exception 'Only an open or acknowledged request can be answered.' using errcode = '22023';
  end if;
  if p_progress_event_id is not null and not exists (select 1 from public.incident_events event
    where event.id = p_progress_event_id and event.incident_case_id = request.incident_case_id
      and event.event_type = 'progress_update' and event.is_public) then
    raise exception 'Progress event must be a public update on this incident.' using errcode = '22023';
  end if;
  update public.incident_update_requests set status = 'answered', answered_by = auth.uid(), answered_at = now(),
    answer_text = answer, answer_event_id = p_progress_event_id where id = request.id returning * into request;
  return request;
end;
$$;

create function public.cancel_update_request(p_request_id uuid)
returns public.incident_update_requests language plpgsql security definer set search_path = '' as $$
declare request public.incident_update_requests;
begin
  if not public.is_mayor() then raise exception 'Only the Mayor can cancel an update request.' using errcode = '42501'; end if;
  select * into request from public.incident_update_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if request.status not in ('open', 'acknowledged') then
    raise exception 'Only an open request can be cancelled.' using errcode = '22023';
  end if;
  update public.incident_update_requests set status = 'cancelled' where id = request.id returning * into request;
  return request;
end;
$$;

-- Move tracked requests with responsibility, including a pending report becoming
-- an incident. Locking the target in the request RPC serializes both paths.
create function public.reroute_open_update_requests()
returns trigger language plpgsql security definer set search_path = '' as $$
declare office public.incident_lead_office; target_barangay uuid; target_case uuid; moved_id uuid;
begin
  if tg_table_name = 'reports' then
    target_case := new.incident_case_id;
    if target_case is not null then
      select lead_office, lead_barangay_id into office, target_barangay from public.incident_cases where id = target_case;
    else
      office := case when new.jurisdiction_status <> 'in_coverage' or new.barangay_id is null
        or not public.barangay_has_active_bdrrmo(new.barangay_id) then 'municipal' else 'barangay' end;
      target_barangay := case when office = 'barangay' then new.barangay_id end;
    end if;
    -- If the destination already has a tracked request, retain the report request
    -- as a cancelled audit row rather than manufacturing a second open request.
    if target_case is not null and exists (select 1 from public.incident_update_requests
      where incident_case_id = target_case and status in ('open', 'acknowledged')) then
      update public.incident_update_requests set status = 'cancelled'
        where report_id = new.id and status in ('open', 'acknowledged');
      return new;
    end if;
    for moved_id in update public.incident_update_requests set responsible_office = office,
      responsible_barangay_id = target_barangay, report_id = case when target_case is null then report_id end,
      incident_case_id = target_case where report_id = new.id and status in ('open', 'acknowledged')
      and (responsible_office is distinct from office or responsible_barangay_id is distinct from target_barangay
        or target_case is not null) returning id loop
      perform public.write_report_flow_history(new.id, 'update_request_rerouted', jsonb_build_object('request_id', moved_id));
    end loop;
  else
    for moved_id in update public.incident_update_requests set responsible_office = new.lead_office,
      responsible_barangay_id = new.lead_barangay_id where incident_case_id = new.id
      and status in ('open', 'acknowledged') and (responsible_office is distinct from new.lead_office
        or responsible_barangay_id is distinct from new.lead_barangay_id) returning id loop
      perform public.write_incident_event(new.id, 'update_request_rerouted', jsonb_build_object('request_id', moved_id));
    end loop;
  end if;
  return new;
end;
$$;
create trigger incident_update_request_routing after update of lead_office, lead_barangay_id on public.incident_cases
  for each row execute function public.reroute_open_update_requests();
create trigger report_update_request_routing after update of barangay_id, jurisdiction_status, incident_case_id on public.reports
  for each row execute function public.reroute_open_update_requests();

create function public.set_report_media_public(p_media_id uuid, p_make_public boolean, p_reason text default null)
returns public.report_media language plpgsql security definer set search_path = '' as $$
declare media public.report_media; incident public.incident_cases; case_id uuid;
  reason_text text := public.report_flow_text(p_reason);
begin
  select report.incident_case_id into case_id from public.report_media item
    join public.reports report on report.id = item.report_id where item.id = p_media_id;
  select * into incident from public.incident_cases where id = case_id for update;
  if not found then raise exception 'Media must belong to an incident.' using errcode = 'P0002'; end if;
  perform public.require_incident_lead(incident);
  select * into media from public.report_media where id = p_media_id for update;
  if p_make_public is null or media.type <> 'photo' then
    raise exception 'Only photos can be published.' using errcode = '22023';
  end if;
  if p_make_public and (incident.verification <> 'confirmed' or incident.withdrawn_at is not null
    or incident.is_sensitive or media.display_storage_path is null or media.thumbnail_storage_path is null
    or media.display_storage_path = media.storage_path or media.thumbnail_storage_path = media.storage_path
    or not exists (select 1 from storage.objects where bucket_id = 'report-media' and name = media.display_storage_path)
    or not exists (select 1 from storage.objects where bucket_id = 'report-media' and name = media.thumbnail_storage_path)) then
    raise exception 'Publication requires a confirmed non-sensitive incident and processed photo derivatives.' using errcode = '22023';
  end if;
  if (media.public_approved_at is not null) = p_make_public then return media; end if;
  update public.report_media set public_approved_by = case when p_make_public then auth.uid() end,
    public_approved_at = case when p_make_public then now() end where id = media.id returning * into media;
  perform public.write_incident_event(incident.id, case when p_make_public then 'photo_published' else 'photo_unpublished' end,
    jsonb_build_object('media_id', media.id), reason_text);
  return media;
end;
$$;

-- Existing reporter media write policies must not permit approval forgery.
create function public.guard_report_media_publication()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.public_approved_by is not null or new.public_approved_at is not null then
        raise exception 'Photo approval requires the lead office.' using errcode = '42501';
      end if;
    elsif row(new.public_approved_by, new.public_approved_at) is distinct from row(old.public_approved_by, old.public_approved_at)
      or (old.public_approved_at is not null and row(new.storage_path, new.display_storage_path,
        new.thumbnail_storage_path, new.report_id, new.type) is distinct from row(old.storage_path,
        old.display_storage_path, old.thumbnail_storage_path, old.report_id, old.type)) then
      raise exception 'Approved photo fields require the lead office.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger report_media_publication_guard before insert or update on public.report_media
  for each row execute function public.guard_report_media_publication();

create function public.set_incident_public_location(p_incident_case_id uuid, p_mode text, p_reason text default null)
returns public.incident_cases language plpgsql security definer set search_path = '' as $$
declare incident public.incident_cases; reason_text text := public.report_flow_text(p_reason, p_mode = 'exact_for_safety');
begin
  select * into incident from public.incident_cases where id = p_incident_case_id for update;
  if not found then raise exception 'Incident not found' using errcode = 'P0002'; end if;
  perform public.require_incident_lead(incident);
  if p_mode is null or p_mode not in ('barangay_only', 'approximate_area', 'exact_for_safety')
    or (incident.is_sensitive and p_mode <> 'barangay_only') then
    raise exception 'Invalid public location mode for this incident.' using errcode = '22023';
  end if;
  update public.incident_cases set public_location_mode = p_mode, public_location_reason = reason_text
    where id = incident.id returning * into incident;
  perform public.write_incident_event(incident.id, 'public_location_changed', jsonb_build_object('mode', p_mode), reason_text);
  return incident;
end;
$$;

create function public.set_incident_sensitive(p_incident_case_id uuid, p_is_sensitive boolean, p_reason text)
returns public.incident_cases language plpgsql security definer set search_path = '' as $$
declare incident public.incident_cases; reason_text text := public.report_flow_text(p_reason, true);
begin
  select * into incident from public.incident_cases where id = p_incident_case_id for update;
  if not found then raise exception 'Incident not found' using errcode = 'P0002'; end if;
  perform public.require_incident_lead(incident);
  if p_is_sensitive is null then raise exception 'Specify sensitivity.' using errcode = '22023'; end if;
  update public.incident_cases set is_sensitive = p_is_sensitive,
    public_location_mode = case when p_is_sensitive then 'barangay_only' else public_location_mode end,
    public_location_reason = case when p_is_sensitive then null else public_location_reason end
    where id = incident.id returning * into incident;
  if p_is_sensitive then
    update public.report_media media set public_approved_by = null, public_approved_at = null
    from public.reports report where report.id = media.report_id and report.incident_case_id = incident.id;
  end if;
  perform public.write_incident_event(incident.id, 'sensitivity_changed', jsonb_build_object('sensitive', p_is_sensitive), reason_text);
  return incident;
end;
$$;

revoke all on function public.require_update_responsible_office(public.incident_update_requests),
  public.reroute_open_update_requests(), public.guard_report_media_publication() from public, anon, authenticated;
revoke all on function public.request_mayor_update(uuid, uuid, text), public.acknowledge_update_request(uuid),
  public.answer_update_request(uuid, text, uuid), public.cancel_update_request(uuid),
  public.set_report_media_public(uuid, boolean, text), public.set_incident_public_location(uuid, text, text),
  public.set_incident_sensitive(uuid, boolean, text) from public, anon;
grant execute on function public.request_mayor_update(uuid, uuid, text), public.acknowledge_update_request(uuid),
  public.answer_update_request(uuid, text, uuid), public.cancel_update_request(uuid),
  public.set_report_media_public(uuid, boolean, text), public.set_incident_public_location(uuid, text, text),
  public.set_incident_sensitive(uuid, boolean, text) to authenticated;
