-- Comment threads for a single report.
--
-- 1. report_comments: a client-safe projection that joins comment rows to the
--    author's public identity (name only). Residents read this view; the raw
--    comments table stays the write target so RLS + counter triggers apply.
-- 2. Realtime: add public.comments to the supabase_realtime publication so an
--    open comments sheet can subscribe to a single report's thread. The client
--    filters by report_id and refetches; no report/feed list subscribes here.

drop view if exists public.report_comments;

create view public.report_comments
with (security_invoker = true)
as
select
  c.id,
  c.report_id,
  c.user_id,
  c.body,
  c.parent_comment_id,
  c.is_hidden,
  c.created_at,
  c.updated_at,
  ap.first_name as author_first_name,
  ap.last_name as author_last_name,
  ap.middle_name as author_middle_name
from public.comments c
join public.app_profiles_public ap on ap.id = c.user_id;

comment on view public.report_comments is
  'Report comment threads with author name for the resident comments sheet.';

grant select on public.report_comments to authenticated;
grant select on public.report_comments to service_role;

-- Realtime: only add comments to the publication (reports is already added).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
end;
$$;
