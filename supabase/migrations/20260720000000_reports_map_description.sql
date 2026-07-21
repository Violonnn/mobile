-- Expose report description on the map projection for marker detail sheets.
-- DROP is required: PostgreSQL cannot insert a column mid-list via CREATE OR REPLACE VIEW.

drop view if exists public.reports_map;

create view public.reports_map
with (security_invoker = true)
as
select
  r.id,
  r.title,
  r.description,
  r.status,
  r.barangay_id,
  r.created_at,
  extensions.st_y(r.location::extensions.geometry) as latitude,
  extensions.st_x(r.location::extensions.geometry) as longitude
from public.reports r;

comment on view public.reports_map is
  'Report pins for the resident map: id, title, description, status, lat/lng.';

grant select on public.reports_map to authenticated;
grant select on public.reports_map to service_role;
