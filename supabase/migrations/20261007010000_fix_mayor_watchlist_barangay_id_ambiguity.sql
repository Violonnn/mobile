-- Repair the Watchlist RPC after its initial deployment. PL/pgSQL exposes
-- RETURNS TABLE fields as variables, so every CTE field must be qualified.

create or replace function public.list_mayor_watchlist()
returns table (
  item_key text,
  id uuid,
  title text,
  status public.report_status,
  barangay_id uuid,
  barangay_name text,
  address_text text,
  created_at timestamptz,
  escalated_at timestamptz,
  latest_status_activity_at timestamptz,
  active_backlog bigint,
  item_count bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_mayor() then
    raise exception 'Mayor watchlist is unavailable for this account.'
      using errcode = '42501';
  end if;

  return query
  with active_reports as (
    select
      report.id,
      report.title,
      report.status,
      report.barangay_id,
      coalesce(nullif(trim(barangay.name), ''), 'Unassigned') as barangay_name,
      report.address_text,
      report.created_at,
      report.escalated_at,
      extensions.st_y(report.location::extensions.geometry) as latitude,
      extensions.st_x(report.location::extensions.geometry) as longitude,
      activity.latest_status_update_at
    from public.reports report
    left join public.barangays barangay on barangay.id = report.barangay_id
    left join public.report_feed_activity activity on activity.report_id = report.id
    where report.status in ('unverified', 'verified', 'escalated')
  ),
  missing_context as (
    select
      report.*,
      count(*) over() as item_count,
      row_number() over (order by report.created_at asc, report.id asc) as item_rank
    from active_reports report
    where report.barangay_id is null
       or nullif(trim(report.address_text), '') is null
       or report.latitude is null
       or report.longitude is null
  ),
  inactive_status as (
    select
      report.*,
      count(*) over() as item_count,
      row_number() over (
        order by coalesce(report.latest_status_update_at, report.created_at) asc, report.id asc
      ) as item_rank
    from active_reports report
    where coalesce(report.latest_status_update_at, report.created_at) <= now() - interval '24 hours'
  ),
  active_backlogs as (
    select
      report.barangay_id,
      report.barangay_name,
      count(*)::bigint as active_backlog,
      row_number() over (order by count(*) desc, report.barangay_name asc) as item_rank
    from active_reports report
    where report.barangay_id is not null
    group by report.barangay_id, report.barangay_name
  )
  (
  select
    'longest_waiting_bdrrmo'::text,
    active_reports.id,
    active_reports.title,
    active_reports.status,
    active_reports.barangay_id,
    active_reports.barangay_name,
    active_reports.address_text,
    active_reports.created_at,
    active_reports.escalated_at,
    active_reports.latest_status_update_at,
    null::bigint,
    null::bigint
  from active_reports
  where active_reports.status = 'unverified'
  order by active_reports.created_at asc, active_reports.id asc
  limit 1
  )

  union all

  (
  select
    'longest_waiting_mdrrmo'::text,
    active_reports.id,
    active_reports.title,
    active_reports.status,
    active_reports.barangay_id,
    active_reports.barangay_name,
    active_reports.address_text,
    active_reports.created_at,
    active_reports.escalated_at,
    active_reports.latest_status_update_at,
    null::bigint,
    null::bigint
  from active_reports
  where active_reports.status = 'escalated'
  order by coalesce(active_reports.escalated_at, active_reports.created_at) asc, active_reports.id asc
  limit 1
  )

  union all

  select
    'largest_active_backlog'::text,
    null::uuid,
    null::text,
    null::public.report_status,
    active_backlogs.barangay_id,
    active_backlogs.barangay_name,
    null::text,
    null::timestamptz,
    null::timestamptz,
    null::timestamptz,
    active_backlogs.active_backlog,
    null::bigint
  from active_backlogs
  where active_backlogs.item_rank = 1

  union all

  select
    'missing_context'::text,
    missing_context.id,
    missing_context.title,
    missing_context.status,
    missing_context.barangay_id,
    missing_context.barangay_name,
    missing_context.address_text,
    missing_context.created_at,
    missing_context.escalated_at,
    missing_context.latest_status_update_at,
    null::bigint,
    missing_context.item_count
  from missing_context
  where missing_context.item_rank <= 5

  union all

  select
    'inactive_status'::text,
    inactive_status.id,
    inactive_status.title,
    inactive_status.status,
    inactive_status.barangay_id,
    inactive_status.barangay_name,
    inactive_status.address_text,
    inactive_status.created_at,
    inactive_status.escalated_at,
    inactive_status.latest_status_update_at,
    null::bigint,
    inactive_status.item_count
  from inactive_status
  where inactive_status.item_rank <= 5;
end;
$$;
