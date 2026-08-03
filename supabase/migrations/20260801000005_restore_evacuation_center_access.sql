-- Restore authenticated access required by the security-invoker map view.
-- RLS below still restricts BDRRMO accounts to their assigned barangay.

alter table public.evacuation_centers enable row level security;

grant select, update on public.evacuation_centers to authenticated;
grant select on public.evacuation_centers_map to authenticated;

drop policy if exists "Evac centers readable by authenticated"
  on public.evacuation_centers;

create policy "Evac centers readable by authenticated"
  on public.evacuation_centers
  for select
  to authenticated
  using (public.can_read_evacuation_center(barangay_id));
