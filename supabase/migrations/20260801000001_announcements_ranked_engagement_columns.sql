-- Ensure engagement counters exist and are exposed by announcements_ranked.
-- Postgres expands a.* when the view is created, so the view must be recreated
-- after upvote_count / comment_count are added to public.announcements.

alter table public.announcements
  add column if not exists upvote_count integer not null default 0,
  add column if not exists comment_count integer not null default 0;

-- CREATE OR REPLACE cannot insert columns before an existing view column.
-- Rebuild the projection so author_rank remains the final column after a.*.
drop view if exists public.announcements_ranked;

create view public.announcements_ranked
with (security_invoker = true) as
select
  a.*,
  case ap.role
    when 'mayor'  then 1
    when 'officer' then
      case when ap.barangay_id is null then 2  -- MDRRMO
           else 3                               -- BDRRMO
      end
    else 4
  end as author_rank
from public.announcements a
join public.app_profiles ap on ap.id = a.author_id;

comment on view public.announcements_ranked is
  'Announcements with author_rank for pin ordering: ORDER BY is_pinned desc, author_rank asc, created_at desc.';

grant select on public.announcements_ranked to authenticated;
