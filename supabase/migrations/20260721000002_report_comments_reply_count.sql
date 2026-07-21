-- Add a reply count to each comment projection row so collapsed threads can
-- show "Show N replies" without downloading reply bodies or issuing one count
-- query per parent comment. The existing parent_comment_id index keeps this
-- correlated count inexpensive for the small page of visible parents.

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
  ap.middle_name as author_middle_name,
  (
    select count(*)::integer
    from public.comments reply
    where reply.parent_comment_id = c.id
      and reply.is_hidden = false
  ) as reply_count
from public.comments c
join public.app_profiles_public ap on ap.id = c.user_id;

comment on view public.report_comments is
  'Report comment threads with author name and visible direct-reply count.';

grant select on public.report_comments to authenticated;
grant select on public.report_comments to service_role;
