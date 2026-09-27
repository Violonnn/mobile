-- A BDRRMO handoff is final: escalated reports leave every BDRRMO read path.
-- Residents retain access to their own reports, while MDRRMO/Mayor behavior is unchanged.

create or replace function public.can_read_report(p_report public.reports)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_active_profile() then
    return false;
  end if;

  if public.is_bdrrmo() then
    return p_report.barangay_id is not distinct from public.current_app_barangay_id()
      and p_report.status <> 'escalated';
  end if;

  return true;
end;
$$;

create or replace function public.can_read_report_id(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_active_profile()
    and exists (
      select 1
      from public.reports report
      where report.id = p_report_id
        and (
          not public.is_bdrrmo()
          or (
            report.barangay_id is not distinct from public.current_app_barangay_id()
            and report.status <> 'escalated'
          )
        )
    );
$$;

revoke all on function public.can_read_report(public.reports) from public, anon;
revoke all on function public.can_read_report_id(uuid) from public, anon;
grant execute on function public.can_read_report(public.reports)
  to authenticated, service_role;
grant execute on function public.can_read_report_id(uuid)
  to authenticated, service_role;

-- Comment moderation must follow the same parent-report visibility rule.
create or replace function public.can_moderate_report_comment(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_active_profile()
    and public.can_read_report_id(p_report_id)
    and (
      public.is_admin()
      or public.is_mdrrmo()
      or public.is_bdrrmo()
    );
$$;

revoke all on function public.can_moderate_report_comment(uuid) from public, anon;
grant execute on function public.can_moderate_report_comment(uuid)
  to authenticated, service_role;

-- The trusted verification RPC must not disclose the immutable resident GPS
-- coordinate after a BDRRMO has handed the report to MDRRMO.
create or replace function public.get_report_location_verification(p_report_id uuid)
returns table (
  device_latitude double precision,
  device_longitude double precision,
  gps_accuracy_meters double precision,
  location_adjustment_meters double precision
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_admin()
    or public.is_mayor()
    or public.is_mdrrmo()
    or public.is_bdrrmo()
  ) then
    raise exception 'Official access required.' using errcode = '42501';
  end if;

  if not public.can_read_report_id(p_report_id) then
    return;
  end if;

  return query
  select
    extensions.st_y(report.device_location::extensions.geometry),
    extensions.st_x(report.device_location::extensions.geometry),
    report.gps_accuracy_meters::double precision,
    report.location_adjustment_meters::double precision
  from public.reports report
  where report.id = p_report_id;
end;
$$;

revoke all on function public.get_report_location_verification(uuid)
  from public, anon;
grant execute on function public.get_report_location_verification(uuid)
  to authenticated, service_role;

-- Trusted content/location RPCs identify their actor through this transaction-
-- local setting. Block every such BDRRMO mutation after the handoff completes.
create or replace function public.guard_bdrrmo_handed_off_report_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_text text := nullif(
    current_setting('disasterlink.location_actor', true),
    ''
  );
  v_actor_barangay uuid;
begin
  if v_actor_text is null or old.status <> 'escalated' then
    return new;
  end if;

  select profile.barangay_id
    into v_actor_barangay
  from public.app_profiles profile
  where profile.id = v_actor_text::uuid
    and profile.role = 'officer'
    and profile.status = 'active';

  if v_actor_barangay is not null then
    raise exception 'This report has already been handed off to MDRRMO.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reports_guard_bdrrmo_handoff_mutation
  on public.reports;
create trigger trg_reports_guard_bdrrmo_handoff_mutation
  before update on public.reports
  for each row execute function public.guard_bdrrmo_handed_off_report_mutation();
