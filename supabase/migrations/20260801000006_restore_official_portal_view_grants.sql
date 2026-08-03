-- Restore the least-privilege grants required by security-invoker views.
-- RLS policies continue to enforce active accounts and barangay scope.

grant select (
  id,
  role,
  first_name,
  last_name,
  middle_name,
  barangay_id,
  status,
  email_verified_at,
  created_at,
  updated_at
) on public.app_profiles to authenticated;

grant select on public.app_profiles_public to authenticated;
grant select on public.reports to authenticated;
grant select on public.reports_map to authenticated;
grant select on public.evacuation_centers to authenticated;
grant select on public.evacuation_centers_map to authenticated;
