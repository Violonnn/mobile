-- =====================================================================
-- Mayor situational-awareness data.
--
-- This is deliberately additive: report workflow state and report history
-- remain untouched. Analytics counts describe submitted reports, not incidents.
-- =====================================================================

-- Compact all-time aggregate used by the Mayor dashboard. Although reports are
-- readable in the resident feed, this explicit role predicate prevents the
-- analytics view from becoming an aggregate-disclosure path for residents.
create or replace view public.report_totals_by_barangay
with (security_invoker = true) as
select
  report.barangay_id,
  coalesce(nullif(trim(barangay.name), ''), 'Unassigned') as barangay_name,
  report.status,
  count(*)::bigint as report_count
from public.reports report
left join public.barangays barangay on barangay.id = report.barangay_id
where public.is_mayor()
   or public.is_mdrrmo()
   or (
     public.is_bdrrmo()
     and report.barangay_id = public.current_app_barangay_id()
   )
group by report.barangay_id, barangay.name, report.status;

comment on view public.report_totals_by_barangay is
  'All-time submitted-report totals by barangay and current workflow status. Active Mayor/MDRRMO see municipality-wide data; active BDRRMO sees only its assigned barangay.';

grant select on public.report_totals_by_barangay to authenticated;

-- Mayor-only drill-down. Inputs are SQL function parameters rather than
-- client-composed PostgREST filters, which keeps search input out of query
-- syntax. The ordinary SECURITY INVOKER setting means reports_map RLS still
-- applies after the active-Mayor guard succeeds.
create or replace function public.list_mayor_situations(
  p_barangay_id uuid default null,
  p_status public.report_status default null,
  p_search text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  description text,
  status public.report_status,
  barangay_id uuid,
  barangay_name text,
  address_text text,
  created_at timestamptz,
  reporter_name text,
  total_count bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_search text := left(trim(coalesce(p_search, '')), 200);
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_mayor() then
    raise exception 'Mayor situational awareness is unavailable for this account.'
      using errcode = '42501';
  end if;

  return query
  with matching_reports as (
    select
      report.id,
      report.title,
      report.description,
      report.status,
      report.barangay_id,
      coalesce(nullif(trim(barangay.name), ''), 'Unassigned') as barangay_name,
      report.address_text,
      report.created_at,
      coalesce(
        nullif(
          trim(concat_ws(
            ' ',
            nullif(trim(report.reporter_first_name), ''),
            nullif(trim(report.reporter_last_name), '')
          )),
          ''
        ),
        'Resident'
      ) as reporter_name
    from public.reports_map report
    left join public.barangays barangay on barangay.id = report.barangay_id
    where (p_barangay_id is null or report.barangay_id = p_barangay_id)
      and (p_status is null or report.status = p_status)
      and (
        v_search = ''
        or strpos(lower(report.title), lower(v_search)) > 0
        or strpos(lower(report.description), lower(v_search)) > 0
        or strpos(lower(coalesce(report.address_text, '')), lower(v_search)) > 0
        or strpos(
          lower(concat_ws(
            ' ',
            coalesce(report.reporter_first_name, ''),
            coalesce(report.reporter_last_name, ''),
            coalesce(report.reporter_middle_name, '')
          )),
          lower(v_search)
        ) > 0
      )
  )
  select
    matching_reports.id,
    matching_reports.title,
    matching_reports.description,
    matching_reports.status,
    matching_reports.barangay_id,
    matching_reports.barangay_name,
    matching_reports.address_text,
    matching_reports.created_at,
    matching_reports.reporter_name,
    count(*) over() as total_count
  from matching_reports
  order by matching_reports.created_at desc, matching_reports.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.list_mayor_situations(
  uuid, public.report_status, text, integer, integer
) from public, anon;
grant execute on function public.list_mayor_situations(
  uuid, public.report_status, text, integer, integer
) to authenticated;
