-- Keep both legacy service-only overloads. The new overload reuses their
-- established media and scope validation in the same database transaction.
alter function public.create_official_report_with_media(uuid, uuid, text, text,
  double precision, double precision, text, jsonb, uuid, text, text)
  rename to create_official_report_classified_with_media;
revoke all on function public.create_official_report_classified_with_media(uuid, uuid, text, text,
  double precision, double precision, text, jsonb, uuid, text, text) from public, anon, authenticated, service_role;

create function public.create_official_report_with_media(
  p_reporter_id uuid, p_report_id uuid, p_title text, p_description text,
  p_latitude double precision, p_longitude double precision, p_address_text text,
  p_media jsonb, p_barangay_id uuid, p_incident_type text, p_incident_type_other text,
  p_intake_channel public.report_intake_channel default 'official_field'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare report_id uuid;
begin
  if p_intake_channel is null or p_intake_channel not in ('official_field', 'hotline_call') then
    raise exception 'Official intake must be an observation or a recorded hotline account.' using errcode = '22023';
  end if;
  perform set_config('disasterlink.official_intake_channel', p_intake_channel::text, true);
  report_id := public.create_official_report_classified_with_media(p_reporter_id, p_report_id, p_title, p_description,
    p_latitude, p_longitude, p_address_text, p_media, p_barangay_id, p_incident_type, p_incident_type_other);
  perform set_config('disasterlink.official_intake_channel', '', true);
  return report_id;
end;
$$;

-- Apply the trusted intake channel before the existing normalization trigger.
create function public.apply_official_intake_channel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('disasterlink.official_intake_channel', true) in ('official_field', 'hotline_call') then
    new.intake_channel := current_setting('disasterlink.official_intake_channel', true)::public.report_intake_channel;
  end if;
  return new;
end;
$$;
create trigger trg_reports_intake_channel before insert on public.reports
  for each row execute function public.apply_official_intake_channel();

create function public.create_official_observation_case()
returns trigger language plpgsql security definer set search_path = '' as $$
declare incident_id uuid; officer_barangay uuid;
begin
  if new.intake_channel <> 'official_field' then return new; end if;
  select barangay_id into officer_barangay from public.app_profiles where id = new.reporter_id;
  insert into public.incident_cases(source_report_id, barangay_id, incident_type, incident_type_other,
    location, address_text, verification, lead_office, lead_barangay_id, coordination,
    confirmed_by, confirmed_at, confirmation_basis, municipal_finding, municipal_finding_by,
    municipal_finding_at, created_by)
  values (new.id, new.barangay_id, new.incident_type, new.incident_type_other, new.location, new.address_text,
    'confirmed', case when officer_barangay is null then 'municipal' else 'barangay' end::public.incident_lead_office,
    officer_barangay, case when officer_barangay is null then 'municipal_lead' else 'local' end::public.incident_coordination,
    new.reporter_id, new.verified_at, 'official_observation',
    case when officer_barangay is null then 'confirmed' end::public.incident_verification,
    case when officer_barangay is null then new.reporter_id end,
    case when officer_barangay is null then new.verified_at end, new.reporter_id)
  returning id into incident_id;
  perform set_config('disasterlink.report_transition', '1', true);
  update public.reports set incident_case_id = incident_id where id = new.id;
  perform set_config('disasterlink.report_transition', '', true);
  insert into public.incident_events(incident_case_id, report_id, event_type, actor_id, actor_office, actor_barangay_id, details)
  values (incident_id, new.id, 'incident_created', new.reporter_id,
    case when officer_barangay is null then 'municipal' else 'barangay' end::public.incident_lead_office,
    officer_barangay, jsonb_build_object('basis', 'official_observation'));
  return new;
end;
$$;
create trigger trg_reports_official_case after insert on public.reports
  for each row execute function public.create_official_observation_case();

-- Old edit/location RPCs still operate on reports during this phase. Keep their
-- source case's operational metadata aligned without changing review or ownership.
create function public.sync_source_incident_metadata()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if row(new.incident_type, new.incident_type_other, new.location, new.address_text)
    is distinct from row(old.incident_type, old.incident_type_other, old.location, old.address_text) then
    update public.incident_cases set incident_type = new.incident_type, incident_type_other = new.incident_type_other,
      location = new.location, address_text = new.address_text where source_report_id = new.id;
  end if;
  return new;
end;
$$;
create trigger trg_reports_source_incident_metadata after update on public.reports
  for each row execute function public.sync_source_incident_metadata();

revoke all on function public.create_official_report_with_media(uuid, uuid, text, text,
  double precision, double precision, text, jsonb, uuid, text, text, public.report_intake_channel)
  from public, anon, authenticated;
grant execute on function public.create_official_report_with_media(uuid, uuid, text, text,
  double precision, double precision, text, jsonb, uuid, text, text, public.report_intake_channel) to service_role;
revoke all on function public.apply_official_intake_channel(), public.create_official_observation_case(),
  public.sync_source_incident_metadata() from public, anon, authenticated;
