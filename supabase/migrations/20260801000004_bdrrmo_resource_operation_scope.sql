-- =====================================================================
-- Phase 4: enforce BDRRMO directory and evacuation-center boundaries.
--
-- Client filters make the operational views easier to use, but RLS and
-- triggers remain the authority for barangay scope and allowed mutations.
-- =====================================================================

-- A BDRRMO may read all records in its own barangay, including locally
-- archived entries, plus only active municipality-wide directory entries.
create or replace function public.can_read_resource_in_scope(
  p_barangay_id uuid,
  p_is_active boolean
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_active_profile()
    and (
      not public.is_bdrrmo()
      or p_barangay_id = public.current_app_barangay_id()
      or (p_barangay_id is null and p_is_active)
    );
$$;

revoke all on function public.can_read_resource_in_scope(uuid, boolean)
  from public, anon;
grant execute on function public.can_read_resource_in_scope(uuid, boolean)
  to authenticated, service_role;

drop policy if exists "Hotlines readable by authenticated" on public.hotlines;
create policy "Hotlines readable by authenticated"
  on public.hotlines for select to authenticated
  using (public.can_read_resource_in_scope(barangay_id, is_active));

drop policy if exists "Facilities readable by authenticated" on public.facilities;
create policy "Facilities readable by authenticated"
  on public.facilities for select to authenticated
  using (public.can_read_resource_in_scope(barangay_id, is_active));

-- The seeded national emergency number is municipality-wide. BDRRMO already
-- cannot mutate it through RLS; this guard also blocks creation or mutation of
-- a misleading barangay-scoped national-emergency record.
create or replace function public.guard_bdrrmo_national_hotline_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_bdrrmo() and new.category = 'national_emergency' then
    raise exception 'BDRRMO may not create or modify national emergency hotlines.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bdrrmo_national_hotline_guard on public.hotlines;
create trigger trg_bdrrmo_national_hotline_guard
  before insert or update on public.hotlines
  for each row execute function public.guard_bdrrmo_national_hotline_write();
