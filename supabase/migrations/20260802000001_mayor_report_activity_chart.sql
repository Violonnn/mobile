-- Mayor report-activity chart data. This must remain separate from the
-- already-deployed awareness migration so it is applied to existing projects.
create or replace function public.mayor_report_activity(
  p_range text default 'today',
  p_barangay_id uuid default null
)
returns table (
  bucket timestamptz,
  status public.report_status,
  report_count bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_local_day date := (now() at time zone 'Asia/Manila')::date;
  v_start timestamptz;
  v_end timestamptz;
  v_step interval;
begin
  if not public.is_mayor() then
    raise exception 'Mayor report activity is unavailable for this account.'
      using errcode = '42501';
  end if;

  if p_range = 'today' then
    v_start := v_local_day::timestamp at time zone 'Asia/Manila';
    v_end := v_start + interval '1 day';
    v_step := interval '1 hour';
  elsif p_range = '3d' then
    v_start := (v_local_day - 2)::timestamp at time zone 'Asia/Manila';
    v_end := (v_local_day + 1)::timestamp at time zone 'Asia/Manila';
    v_step := interval '1 day';
  elsif p_range = '7d' then
    v_start := (
      v_local_day - (extract(isodow from v_local_day)::integer - 1)
    )::timestamp at time zone 'Asia/Manila';
    v_end := v_start + interval '7 days';
    v_step := interval '1 day';
  else
    raise exception 'Unsupported report activity range.' using errcode = '22023';
  end if;

  return query
  with buckets as (
    select generate_series(v_start, v_end - v_step, v_step) as bucket
  ), statuses as (
    select unnest(enum_range(null::public.report_status)) as status
  )
  select
    buckets.bucket,
    statuses.status,
    count(report.id)::bigint as report_count
  from buckets
  cross join statuses
  left join public.reports report
    on report.created_at >= buckets.bucket
   and report.created_at < buckets.bucket + v_step
   and report.status = statuses.status
   and (p_barangay_id is null or report.barangay_id = p_barangay_id)
  group by buckets.bucket, statuses.status
  order by buckets.bucket, statuses.status;
end;
$$;

revoke all on function public.mayor_report_activity(text, uuid) from public, anon;
grant execute on function public.mayor_report_activity(text, uuid) to authenticated;
