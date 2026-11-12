-- Keep official scope unchanged; residents see their own pending submissions.
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

  if public.is_official() then
    return true;
  end if;

  return p_report.reporter_id = auth.uid() or p_report.status <> 'unverified';
end;
$$;

-- Related-table policies must use the id helper because clients cannot select
-- the full report composite (it includes the protected device GPS column).
create or replace function public.can_read_report_id(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reports report
    where report.id = p_report_id
      and public.can_read_report(report)
  );
$$;

revoke all on function public.can_read_report(public.reports) from public, anon;
revoke all on function public.can_read_report_id(uuid) from public, anon;
grant execute on function public.can_read_report(public.reports)
  to authenticated, service_role;
grant execute on function public.can_read_report_id(uuid)
  to authenticated, service_role;
