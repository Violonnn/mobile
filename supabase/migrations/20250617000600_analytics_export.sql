-- =====================================================================
-- Analytics + PDF export support.
--
-- Scope: mayor / MDRRMO / admin see municipality-wide; BDRRMO is limited to
-- their own barangay. NOTE: the reports feed is intentionally readable by all
-- (social feed), so RLS alone does NOT scope analytics -- the view filters by
-- role/barangay explicitly. Residents get no rows (no analytics access).
--
-- Dashboard performance: a plain security_invoker view is enough at this
-- scale. A MATERIALIZED view is deliberately NOT created now -- it would
-- bypass RLS and need scheduled refresh + its own scoping. Revisit only if
-- report volume makes the live aggregate slow (template left in comments).
--
-- Export timeout: interactive queries are capped at 5s (authenticated role,
-- migration 1). PDF export can legitimately scan history + media. The export
-- Edge Function must raise the timeout on its DB session BEFORE calling
-- export_report(), as a SEPARATE statement, e.g. over a direct pg connection:
--
--     await sql`set statement_timeout = '60s'`;   -- own statement
--     await sql`select public.export_report(${reportId})`;
--
-- A `SET LOCAL` inside the function body would NOT help: statement_timeout is
-- armed at statement start, so changing it mid-call cannot extend the in-flight
-- export_report() call. export_report() itself re-checks caller scope (it is
-- SECURITY DEFINER and bypasses RLS) so relaxing the ceiling never widens access.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. Dashboard aggregate (resolved/unresolved by barangay + day).
--    Scope is applied explicitly here (the reports feed RLS is open to all).
-- ---------------------------------------------------------------------------
create or replace view public.report_stats_by_barangay
with (security_invoker = true) as
select
  r.barangay_id,
  r.status,
  date_trunc('day', r.created_at) as day,
  count(*) as report_count
from public.reports r
where public.can_manage_municipality()
   or (public.is_bdrrmo() and r.barangay_id = public.current_app_barangay_id())
group by r.barangay_id, r.status, date_trunc('day', r.created_at);

comment on view public.report_stats_by_barangay is
  'Live report counts by barangay/status/day. Municipality-wide roles see all; BDRRMO only their barangay; residents none.';

grant select on public.report_stats_by_barangay to authenticated;

-- Optional future optimization (only if the live view gets slow):
--   create materialized view public.report_stats_mv as
--     select barangay_id, status, date_trunc('day', created_at) as day,
--            count(*) as report_count
--     from public.reports group by 1,2,3;
--   -- refresh on a schedule (pg_cron / edge cron); note MV bypasses RLS, so
--   -- expose it only through a scope-checking view or RPC.

-- ---------------------------------------------------------------------------
-- 2. export_report(): everything the PDF needs, in one scoped call.
--    Returns report details + GPS + address, media (storage paths for signed
--    URLs), verification attribution, and the full status/barangay timeline.
--    SECURITY DEFINER (bypasses RLS) so it MUST re-check the caller's scope.
-- ---------------------------------------------------------------------------
create or replace function public.export_report(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
  v_result jsonb;
begin
  -- NOTE: the calling Edge Function raises statement_timeout on its session
  -- before invoking this (see header) -- a change here could not re-arm the
  -- in-flight call, so it is intentionally not attempted in the body.

  select * into v_report from public.reports where id = p_report_id;
  if not found then
    raise exception 'Report not found.' using errcode = 'no_data_found';
  end if;

  -- Authorization: municipality-wide roles see any report; a BDRRMO only
  -- reports in their own barangay. Residents cannot export.
  if not (
    public.can_manage_municipality()
    or (public.is_bdrrmo()
        and v_report.barangay_id = public.current_app_barangay_id())
  ) then
    raise exception 'Not permitted to export this report.'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'report', to_jsonb(v_report)
      || jsonb_build_object(
           'longitude', extensions.st_x(v_report.location::extensions.geometry),
           'latitude',  extensions.st_y(v_report.location::extensions.geometry)
         ),
    'reporter', (
      select to_jsonb(ap) - 'email' - 'phone_number'
      from public.app_profiles ap where ap.id = v_report.reporter_id
    ),
    'verified_by', (
      select to_jsonb(ap) - 'email' - 'phone_number'
      from public.app_profiles ap where ap.id = v_report.verified_by
    ),
    'media', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.position)
      from public.report_media m where m.report_id = p_report_id
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.created_at)
      from public.report_status_history h where h.report_id = p_report_id
    ), '[]'::jsonb),
    'official_comments', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at)
      from public.comments c
      join public.app_profiles ap on ap.id = c.user_id
      where c.report_id = p_report_id
        and ap.role in ('officer', 'mayor', 'admin')
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.export_report(uuid) from public, anon;
grant execute on function public.export_report(uuid) to authenticated, service_role;
