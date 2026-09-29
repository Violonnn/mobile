-- Residents can opt in to the Community feed's all-barangay official updates.
-- BDRRMO accounts remain limited to their assigned barangay because they use
-- announcements as part of their operational workload.
create or replace function public.can_read_announcement(
  p_announcement public.announcements
)
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

  -- Official announcements are public community information for residents.
  -- The resident feed still defaults to local updates and only shows this
  -- wider audience after the resident chooses the all-barangay view.
  if public.current_app_role() = 'resident' then
    return true;
  end if;

  if p_announcement.scope = 'municipal' then
    return true;
  end if;

  if public.is_admin() or public.is_mayor() or public.is_mdrrmo() then
    return true;
  end if;

  return p_announcement.barangay_id is not distinct from public.current_app_barangay_id();
end;
$$;

grant execute on function public.can_read_announcement(public.announcements)
  to authenticated, service_role;
