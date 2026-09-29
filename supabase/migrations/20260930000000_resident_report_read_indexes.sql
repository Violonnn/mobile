-- Keep resident map and feed reads efficient as report activity grows.
-- These indexes support the exact filter/order shapes used by reports_map and
-- the per-report detail/activity queries without changing RLS or client access.

create index if not exists idx_reports_created_id
  on public.reports (created_at desc, id);

create index if not exists idx_reports_barangay_created_id
  on public.reports (barangay_id, created_at desc, id);

create index if not exists idx_report_status_history_activity
  on public.report_status_history (report_id, event_type, created_at desc);

create index if not exists idx_comments_report_visible_created
  on public.comments (report_id, is_hidden, created_at desc);

-- This security-invoker projection returns one bounded activity row per report.
-- It replaces client-side scans through every status-history and comment row
-- when the community feed is ordered by latest official activity.
create or replace view public.report_feed_activity
with (security_invoker = true)
as
select
  report.id as report_id,
  (
    select max(history.created_at)
    from public.report_status_history history
    where history.report_id = report.id
      and history.event_type = 'status_change'
  ) as latest_status_activity_at,
  (
    select max(history.created_at)
    from public.report_status_history history
    where history.report_id = report.id
      and history.event_type = 'status_change'
      and history.from_status is not null
  ) as latest_status_update_at,
  (
    select max(report_comment.created_at)
    from public.comments report_comment
    join public.app_profiles_public author on author.id = report_comment.user_id
    where report_comment.report_id = report.id
      and report_comment.is_hidden = false
      and author.role in ('officer', 'mayor')
  ) as latest_official_comment_at
from public.reports report;

grant select on public.report_feed_activity to authenticated, service_role;
