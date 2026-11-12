-- Phase 3 introduces closed reviews. Changing a hidden pending report to closed
-- must not accidentally publish its description, identity, or incident pin.
-- The full limited-public-incident cutover remains Phase 4.
create or replace function public.can_read_report(p_report public.reports)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_active_profile() then return false; end if;
  if public.is_bdrrmo() then
    return coalesce(p_report.barangay_id = public.current_app_barangay_id()
      or exists (select 1 from public.incident_cases incident where incident.id = p_report.incident_case_id
        and (public.is_incident_lead(incident) or public.is_incident_supporter(incident))), false);
  end if;
  if public.is_official() then return true; end if;
  return p_report.reporter_id = auth.uid() or p_report.status in ('verified', 'escalated', 'resolved');
end;
$$;
