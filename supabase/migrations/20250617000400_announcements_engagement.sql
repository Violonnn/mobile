-- =====================================================================
-- Announcements + feed engagement (upvotes, comments, flags).
--
-- Pin ordering (mayor -> MDRRMO -> BDRRMO, then recency) is QUERY-TIME on
-- the author's role, not a stored rank column: precedence is business logic,
-- not mutable announcement data. A convenience view encodes the order.
--
-- Engagement counters on reports (upvote_count / comment_count) are
-- TRIGGER-MAINTAINED: correct by construction, no drift, negligible write
-- cost at this scale. No periodic recompute.
--
-- Announcements are soft-managed (no hard delete path exposed) for the same
-- Realtime-DELETE reason noted on reports.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'announcement_scope') then
    create type public.announcement_scope as enum ('barangay', 'municipal');
  end if;
  if not exists (select 1 from pg_type where typname = 'flaggable_type') then
    create type public.flaggable_type as enum ('report', 'comment');
  end if;
  if not exists (select 1 from pg_type where typname = 'flag_reason') then
    create type public.flag_reason as enum
      ('misinformation', 'spam', 'inappropriate');
  end if;
  if not exists (select 1 from pg_type where typname = 'flag_status') then
    create type public.flag_status as enum ('pending', 'reviewed', 'dismissed');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. announcements
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.app_profiles (id),
  scope public.announcement_scope not null,
  barangay_id uuid references public.barangays (id),
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_scope_barangay check (
    (scope = 'barangay' and barangay_id is not null)
    or (scope = 'municipal' and barangay_id is null)
  )
);

create index if not exists idx_announcements_created
  on public.announcements (created_at desc);
create index if not exists idx_announcements_barangay_created
  on public.announcements (barangay_id, created_at desc);

drop trigger if exists announcements_updated_at on public.announcements;
create trigger announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- Query-time pin ordering encoded once for reuse (home screen + feed).
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
-- 3. report_upvotes (one per user per report)
-- ---------------------------------------------------------------------------
create table if not exists public.report_upvotes (
  report_id uuid not null references public.reports (id) on delete cascade,
  user_id uuid not null references public.app_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

create index if not exists idx_report_upvotes_user on public.report_upvotes (user_id);

-- ---------------------------------------------------------------------------
-- 4. comments (threaded via parent_comment_id; moderated via is_hidden)
-- ---------------------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  user_id uuid not null references public.app_profiles (id),
  body text not null,
  parent_comment_id uuid references public.comments (id) on delete cascade,
  is_hidden boolean not null default false,
  hidden_by uuid references public.app_profiles (id),
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_comments_report on public.comments (report_id, created_at);
create index if not exists idx_comments_parent on public.comments (parent_comment_id);

drop trigger if exists comments_updated_at on public.comments;
create trigger comments_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. flags (polymorphic over reports + comments)
--    flaggable_type + flaggable_id chosen over two nullable FKs so one table
--    and one set of moderation policies cover both. Trade-off: no DB-level
--    FK to the target (enforced by the create-flag path instead).
-- ---------------------------------------------------------------------------
create table if not exists public.flags (
  id uuid primary key default gen_random_uuid(),
  flaggable_type public.flaggable_type not null,
  flaggable_id uuid not null,
  flagged_by uuid not null references public.app_profiles (id),
  reason public.flag_reason not null,
  status public.flag_status not null default 'pending',
  reviewed_by uuid references public.app_profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint flags_one_per_user unique (flaggable_type, flaggable_id, flagged_by)
);

create index if not exists idx_flags_target
  on public.flags (flaggable_type, flaggable_id);
create index if not exists idx_flags_status on public.flags (status);

-- ---------------------------------------------------------------------------
-- 6. Trigger-maintained counters on reports.
-- ---------------------------------------------------------------------------
create or replace function public.bump_report_upvote_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.reports
       set upvote_count = upvote_count + 1
     where id = new.report_id;
  elsif tg_op = 'DELETE' then
    update public.reports
       set upvote_count = greatest(upvote_count - 1, 0)
     where id = old.report_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_report_upvotes_count on public.report_upvotes;
create trigger trg_report_upvotes_count
  after insert or delete on public.report_upvotes
  for each row execute function public.bump_report_upvote_count();

create or replace function public.bump_report_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.reports
       set comment_count = comment_count + 1
     where id = new.report_id;
  elsif tg_op = 'DELETE' then
    update public.reports
       set comment_count = greatest(comment_count - 1, 0)
     where id = old.report_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_report_comments_count on public.comments;
create trigger trg_report_comments_count
  after insert or delete on public.comments
  for each row execute function public.bump_report_comment_count();

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------
alter table public.announcements enable row level security;
alter table public.report_upvotes enable row level security;
alter table public.comments enable row level security;
alter table public.flags enable row level security;

-- announcements: readable by all signed-in users.
drop policy if exists "Announcements readable by authenticated" on public.announcements;
create policy "Announcements readable by authenticated"
  on public.announcements for select to authenticated using (true);

-- Authoring: municipal scope by municipality-wide managers; barangay scope
-- by the BDRRMO of that barangay. Mayor may author municipal announcements.
drop policy if exists "Officials author announcements" on public.announcements;
create policy "Officials author announcements"
  on public.announcements
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and (
      (scope = 'municipal' and public.can_manage_municipality())
      or (scope = 'barangay' and public.is_bdrrmo()
          and barangay_id = public.current_app_barangay_id())
    )
  );

drop policy if exists "Authors and managers update announcements" on public.announcements;
create policy "Authors and managers update announcements"
  on public.announcements
  for update
  to authenticated
  using (
    author_id = auth.uid()
    or public.can_manage_municipality()
    or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
  )
  with check (
    author_id = auth.uid()
    or public.can_manage_municipality()
    or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
  );

-- report_upvotes: readable by all; each user manages only their own vote.
drop policy if exists "Upvotes readable by authenticated" on public.report_upvotes;
create policy "Upvotes readable by authenticated"
  on public.report_upvotes for select to authenticated using (true);

drop policy if exists "Users manage own upvote" on public.report_upvotes;
create policy "Users manage own upvote"
  on public.report_upvotes
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- comments: everyone reads; author creates own; author edits own body;
-- officials moderate (is_hidden) within scope.
drop policy if exists "Comments readable by authenticated" on public.comments;
create policy "Comments readable by authenticated"
  on public.comments for select to authenticated using (true);

drop policy if exists "Users create own comments" on public.comments;
create policy "Users create own comments"
  on public.comments
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Authors edit or officials moderate comments" on public.comments;
create policy "Authors edit or officials moderate comments"
  on public.comments
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_official())
  with check (user_id = auth.uid() or public.is_official());

-- flags: a user sees their own flags; officials see all (moderation queue).
drop policy if exists "Flags visible to reporter and officials" on public.flags;
create policy "Flags visible to reporter and officials"
  on public.flags
  for select
  to authenticated
  using (flagged_by = auth.uid() or public.is_official());

drop policy if exists "Users create own flags" on public.flags;
create policy "Users create own flags"
  on public.flags
  for insert
  to authenticated
  with check (flagged_by = auth.uid());

drop policy if exists "Officials review flags" on public.flags;
create policy "Officials review flags"
  on public.flags
  for update
  to authenticated
  using (public.is_official())
  with check (public.is_official());

grant select, insert, update on public.announcements to authenticated;
grant select, insert, delete on public.report_upvotes to authenticated;
grant select, insert, update on public.comments to authenticated;
grant select, insert, update on public.flags to authenticated;

grant select, insert, update, delete on public.announcements to service_role;
grant select, insert, update, delete on public.report_upvotes to service_role;
grant select, insert, update, delete on public.comments to service_role;
grant select, insert, update, delete on public.flags to service_role;
