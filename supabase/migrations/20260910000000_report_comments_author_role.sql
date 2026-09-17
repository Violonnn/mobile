-- Expose the comment author's public role so resident map previews can place
-- official responses before general discussion. The base comments table keeps
-- its existing RLS; this client-safe view remains security-invoker.

create or replace view public.report_comments
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
  ) as reply_count,
  ap.role as author_role
from public.comments c
join public.app_profiles_public ap on ap.id = c.user_id;

comment on view public.report_comments is
  'Report comment threads with public author identity, role, and visible direct-reply count.';

grant select on public.report_comments to authenticated;
grant select on public.report_comments to service_role;
