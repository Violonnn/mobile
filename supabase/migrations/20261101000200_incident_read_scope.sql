create function public.current_official_office()
returns table (office public.incident_lead_office, barangay_id uuid)
language sql stable security definer set search_path = '' as $$
  select case when profile.barangay_id is null then 'municipal' else 'barangay' end::public.incident_lead_office,
    profile.barangay_id
  from public.app_profiles profile
  where profile.id = auth.uid() and profile.role = 'officer' and profile.status = 'active';
$$;

create function public.barangay_has_active_bdrrmo(p_barangay_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_profiles where role = 'officer'
    and status = 'active' and barangay_id = p_barangay_id);
$$;

create function public.is_incident_lead(p_case public.incident_cases)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_officer() and (
    (p_case.lead_office = 'municipal' and public.is_mdrrmo())
    or (p_case.lead_office = 'barangay' and public.is_bdrrmo()
      and p_case.lead_barangay_id = public.current_app_barangay_id()));
$$;

create function public.is_incident_supporter(p_case public.incident_cases)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_officer() and (
    (public.is_bdrrmo() and p_case.lead_office = 'municipal'
      and p_case.barangay_id = public.current_app_barangay_id())
    or (public.is_mdrrmo() and p_case.lead_office = 'barangay' and p_case.coordination = 'support_active'));
$$;

create function public.can_read_incident_case(p_case public.incident_cases)
returns boolean language sql stable security definer set search_path = '' as $$
  -- Mayor summaries use a dedicated projection in Phase 5, never this raw row.
  select coalesce(public.is_mdrrmo() or (public.is_bdrrmo() and (
    p_case.barangay_id = public.current_app_barangay_id()
    or p_case.lead_barangay_id = public.current_app_barangay_id())), false);
$$;

create function public.can_read_public_incident(p_incident_case_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_active_profile() and exists (
    select 1 from public.incident_cases incident where incident.id = p_incident_case_id
      and ((incident.verification = 'confirmed' and incident.withdrawn_at is null)
        or (incident.withdrawn_at is not null and not incident.is_sensitive)));
$$;

create policy incident_cases_official_read on public.incident_cases for select to authenticated
  using (public.can_read_incident_case(incident_cases));
create policy incident_support_official_read on public.incident_support_requests for select to authenticated
  using (exists (select 1 from public.incident_cases incident where incident.id = incident_case_id
    and public.can_read_incident_case(incident)));
create policy incident_events_official_read on public.incident_events for select to authenticated
  using (exists (select 1 from public.incident_cases incident where incident.id = incident_case_id
    and public.can_read_incident_case(incident)));
create policy incident_update_request_read on public.incident_update_requests for select to authenticated
  using (public.is_mayor() or (public.is_officer() and (
    (responsible_office = 'municipal' and public.is_mdrrmo())
    or (responsible_office = 'barangay' and responsible_barangay_id = public.current_app_barangay_id()))));
create policy incident_comments_public_read on public.incident_comments for select to authenticated
  using (public.can_read_public_incident(incident_case_id) and (not is_hidden or user_id = auth.uid()));
create policy incident_comments_public_insert on public.incident_comments for insert to authenticated
  with check (public.can_read_public_incident(incident_case_id) and user_id = auth.uid()
    and not is_hidden and hidden_by is null and hidden_at is null);
grant insert (incident_case_id, user_id, body, parent_comment_id) on public.incident_comments to authenticated;

create function public.validate_incident_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.body := btrim(new.body);
  if new.parent_comment_id is not null and not exists (
    select 1 from public.incident_comments parent where parent.id = new.parent_comment_id
      and parent.incident_case_id = new.incident_case_id and not parent.is_hidden
  ) then
    raise exception 'Parent comment must be visible and belong to the same incident.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger incident_comment_validate before insert on public.incident_comments
  for each row execute function public.validate_incident_comment();

revoke all on function public.current_official_office(), public.barangay_has_active_bdrrmo(uuid),
  public.is_incident_lead(public.incident_cases), public.is_incident_supporter(public.incident_cases),
  public.can_read_incident_case(public.incident_cases), public.can_read_public_incident(uuid)
  from public, anon;
grant execute on function public.current_official_office(), public.barangay_has_active_bdrrmo(uuid),
  public.is_incident_lead(public.incident_cases), public.is_incident_supporter(public.incident_cases),
  public.can_read_incident_case(public.incident_cases), public.can_read_public_incident(uuid)
  to authenticated, service_role;
revoke all on function public.validate_incident_comment() from public, anon, authenticated;
