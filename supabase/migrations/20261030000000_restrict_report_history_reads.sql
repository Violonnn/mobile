-- Internal notes and location-correction detail are for scoped officials only.
drop policy if exists "Report history readable by authenticated"
  on public.report_status_history;
create policy "Report history readable by scoped officials"
  on public.report_status_history for select to authenticated
  using (public.is_official() and public.can_read_report_id(report_id));

-- Intentionally owner-rights: residents need ordering timestamps after history
-- RLS hides the underlying notes. The explicit scope check replaces report RLS;
-- only the report id and the existing three timestamps may be projected here.
create or replace view public.report_feed_activity
with (security_invoker = false, security_barrier = true)
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
from public.reports report
where public.can_read_report_id(report.id);

comment on view public.report_feed_activity is
  'Intentional owner-rights timestamp projection: explicit can_read_report_id scope; no history notes, detail, or comment bodies. Security Advisor definer-view warning is expected.';

revoke all on public.report_feed_activity from public, anon;
grant select on public.report_feed_activity to authenticated, service_role;
