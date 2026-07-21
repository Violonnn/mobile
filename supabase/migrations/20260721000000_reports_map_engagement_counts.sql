-- Expose the denormalized engagement counters on the resident map projection so
-- the feed and map detail sheet can show upvote/comment totals without joining
-- the engagement tables. Counters stay trigger-maintained on public.reports.

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
  r.reporter_id,
  r.address_text,
  r.upvote_count,
  r.comment_count,
  ap.first_name as reporter_first_name,
  ap.last_name as reporter_last_name,
  ap.middle_name as reporter_middle_name,
  extensions.st_y(r.location::extensions.geometry) as latitude,
  extensions.st_x(r.location::extensions.geometry) as longitude
from public.reports r
join public.app_profiles_public ap on ap.id = r.reporter_id;

comment on view public.reports_map is
  'Report pins for the resident map: details, reporter name, location label, lat/lng, engagement counts.';

grant select on public.reports_map to authenticated;
grant select on public.reports_map to service_role;
