-- Announcement likes + comments (mirrors report engagement).
-- Counters are trigger-maintained on public.announcements.

alter table public.announcements
  add column if not exists upvote_count integer not null default 0,
  add column if not exists comment_count integer not null default 0;

-- Postgres expands a.* at view-create time, so recreate after adding columns.
create or replace view public.announcements_ranked
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

-- ---------------------------------------------------------------------------
-- 1. announcement_upvotes (one per user per announcement)
-- ---------------------------------------------------------------------------
create table if not exists public.announcement_upvotes (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.app_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists idx_announcement_upvotes_user
  on public.announcement_upvotes (user_id);

create or replace function public.bump_announcement_upvote_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.announcements
       set upvote_count = upvote_count + 1
     where id = new.announcement_id;
  elsif tg_op = 'DELETE' then
    update public.announcements
       set upvote_count = greatest(upvote_count - 1, 0)
     where id = old.announcement_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_announcement_upvotes_count on public.announcement_upvotes;
create trigger trg_announcement_upvotes_count
  after insert or delete on public.announcement_upvotes
  for each row execute function public.bump_announcement_upvote_count();

-- ---------------------------------------------------------------------------
-- 2. announcement_comments (threaded + soft-hide moderation)
-- ---------------------------------------------------------------------------
create table if not exists public.announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.app_profiles (id),
  body text not null,
  parent_comment_id uuid references public.announcement_comments (id) on delete cascade,
  is_hidden boolean not null default false,
  hidden_by uuid references public.app_profiles (id),
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_announcement_comments_announcement
  on public.announcement_comments (announcement_id, created_at);
create index if not exists idx_announcement_comments_parent
  on public.announcement_comments (parent_comment_id);

drop trigger if exists announcement_comments_updated_at on public.announcement_comments;
create trigger announcement_comments_updated_at
  before update on public.announcement_comments
  for each row execute function public.set_updated_at();

create or replace function public.bump_announcement_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.announcements
       set comment_count = comment_count + 1
     where id = new.announcement_id;
  elsif tg_op = 'DELETE' then
    update public.announcements
       set comment_count = greatest(comment_count - 1, 0)
     where id = old.announcement_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_announcement_comments_count on public.announcement_comments;
create trigger trg_announcement_comments_count
  after insert or delete on public.announcement_comments
  for each row execute function public.bump_announcement_comment_count();

-- ---------------------------------------------------------------------------
-- 3. Client-safe comment projection (author names + reply counts)
-- ---------------------------------------------------------------------------
create or replace view public.announcement_comments_view
with (security_invoker = true)
as
select
  c.id,
  c.announcement_id,
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
    from public.announcement_comments reply
    where reply.parent_comment_id = c.id
      and reply.is_hidden = false
  ) as reply_count
from public.announcement_comments c
join public.app_profiles_public ap on ap.id = c.user_id;

comment on view public.announcement_comments_view is
  'Announcement comment threads with author name and visible direct-reply count.';

grant select on public.announcement_comments_view to authenticated;
grant select on public.announcement_comments_view to service_role;

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.announcement_upvotes enable row level security;
alter table public.announcement_comments enable row level security;

drop policy if exists "Announcement upvotes readable by authenticated" on public.announcement_upvotes;
create policy "Announcement upvotes readable by authenticated"
  on public.announcement_upvotes for select to authenticated using (true);

drop policy if exists "Users manage own announcement upvote" on public.announcement_upvotes;
create policy "Users manage own announcement upvote"
  on public.announcement_upvotes
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Visible comments for everyone; officials may also review hidden ones.
drop policy if exists "Announcement comments readable by authenticated" on public.announcement_comments;
create policy "Announcement comments readable by authenticated"
  on public.announcement_comments
  for select
  to authenticated
  using (not is_hidden or public.is_official());

drop policy if exists "Users create own announcement comments" on public.announcement_comments;
create policy "Users create own announcement comments"
  on public.announcement_comments
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Authors edit or officials moderate announcement comments" on public.announcement_comments;
create policy "Authors edit or officials moderate announcement comments"
  on public.announcement_comments
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_official())
  with check (user_id = auth.uid() or public.is_official());

grant select, insert, delete on public.announcement_upvotes to authenticated;
grant select, insert, update on public.announcement_comments to authenticated;
grant select, insert, update, delete on public.announcement_upvotes to service_role;
grant select, insert, update, delete on public.announcement_comments to service_role;

-- Realtime for live comment threads on opened announcement details.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'announcement_comments'
  ) then
    alter publication supabase_realtime add table public.announcement_comments;
  end if;
end;
$$;
