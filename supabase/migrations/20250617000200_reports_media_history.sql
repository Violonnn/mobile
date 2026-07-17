-- =====================================================================
-- Reports, report media, and status history.
--
-- Lifecycle: unverified -> verified -> (escalated) -> resolved.
-- Resident reports start 'unverified'. Official reports auto-verify to
-- 'verified' with verified_by = self.
--
-- reports.barangay_id is the barangay the report is ABOUT (resolved from
-- the report's GPS location by the create-report edge function), NOT the
-- reporter's home barangay -- that is what routes it to the right BDRRMO.
--
-- Media minimums for RESIDENT reports (1-3 photos, >=1 video, combined
-- video <= 30s) are enforced with DEFERRABLE INITIALLY DEFERRED constraint
-- triggers so the whole report+media insert is judged at COMMIT, not on the
-- first row.
--
-- Reports are NEVER hard-deleted (status transitions only). This keeps the
-- Supabase Realtime DELETE exception (delete events bypass RLS) irrelevant.
-- Revisit before adding any hard-delete path.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum
      ('unverified', 'verified', 'escalated', 'resolved');
  end if;
  if not exists (select 1 from pg_type where typname = 'media_type') then
    create type public.media_type as enum ('photo', 'video');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. reports
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.app_profiles (id),
  title text not null,
  description text not null,
  status public.report_status not null default 'unverified',
  location extensions.geography(Point, 4326) not null,
  address_text text,
  barangay_id uuid references public.barangays (id),
  verified_by uuid references public.app_profiles (id),
  verified_at timestamptz,
  escalated_by uuid references public.app_profiles (id),
  escalated_at timestamptz,
  escalated_to text,
  resolved_by uuid references public.app_profiles (id),
  resolved_at timestamptz,
  -- Denormalized engagement counters (trigger-maintained in migration 5).
  upvote_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Spatial index for map render + "near you".
create index if not exists idx_reports_location
  on public.reports using gist (location);

-- Highest-impact non-spatial indexes: every officer dashboard load filters
-- reports by barangay (under RLS) and orders by recency.
create index if not exists idx_reports_barangay_created
  on public.reports (barangay_id, created_at desc);
create index if not exists idx_reports_barangay_status_created
  on public.reports (barangay_id, status, created_at desc);
-- Municipality-wide feeds (MDRRMO / mayor / resident home).
create index if not exists idx_reports_created
  on public.reports (created_at desc);
create index if not exists idx_reports_reporter
  on public.reports (reporter_id);

drop trigger if exists reports_updated_at on public.reports;
create trigger reports_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. report_media
--    Own table (not array columns) so per-item type/duration/position and
--    the count/duration limits are actually enforceable.
-- ---------------------------------------------------------------------------
create table if not exists public.report_media (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  type public.media_type not null,
  storage_path text not null,
  duration_seconds numeric(6, 2),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  -- A video row must carry a positive duration; photos must not.
  constraint report_media_duration_by_type check (
    (type = 'video' and duration_seconds is not null and duration_seconds > 0)
    or (type = 'photo' and duration_seconds is null)
  ),
  constraint report_media_position_unique unique (report_id, position)
);

create index if not exists idx_report_media_report on public.report_media (report_id);

-- ---------------------------------------------------------------------------
-- 4. report_status_history
--    Reconstructs the full timeline for the PDF export (migration 7):
--    status transitions AND audited barangay corrections.
-- ---------------------------------------------------------------------------
create table if not exists public.report_status_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  event_type text not null default 'status_change',
  from_status public.report_status,
  to_status public.report_status,
  changed_by uuid references public.app_profiles (id),
  note text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_report_history_report
  on public.report_status_history (report_id, created_at);

-- ---------------------------------------------------------------------------
-- 5. Media rule enforcement (resident reports only).
--    Shared checker + two deferred constraint triggers so the rule holds
--    whether media rows or the report row land last in the transaction.
-- ---------------------------------------------------------------------------
create or replace function public.check_report_media(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_photos int;
  v_videos int;
  v_duration numeric;
begin
  -- Report may have been removed within the same tx (cascade) -> nothing to check.
  select ap.role into v_role
    from public.reports r
    join public.app_profiles ap on ap.id = r.reporter_id
   where r.id = p_report_id;

  if v_role is null then
    return;
  end if;

  -- Only resident-submitted reports carry the media minimums.
  if v_role <> 'resident' then
    return;
  end if;

  select
    count(*) filter (where type = 'photo'),
    count(*) filter (where type = 'video'),
    coalesce(sum(duration_seconds) filter (where type = 'video'), 0)
  into v_photos, v_videos, v_duration
  from public.report_media
  where report_id = p_report_id;

  if v_photos < 1 or v_photos > 3 then
    raise exception 'Resident reports require 1 to 3 photos (got %).', v_photos
      using errcode = '23514';
  end if;
  if v_videos < 1 then
    raise exception 'Resident reports require at least 1 video.'
      using errcode = '23514';
  end if;
  if v_duration > 30 then
    raise exception 'Combined video duration must not exceed 30 seconds (got %s).', v_duration
      using errcode = '23514';
  end if;
end;
$$;

-- Trigger wrapper fired from report_media changes.
create or replace function public.trg_check_media_from_media()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_report_media(coalesce(new.report_id, old.report_id));
  return null;
end;
$$;

-- Trigger wrapper fired from the report row itself (covers "no media at all").
create or replace function public.trg_check_media_from_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_report_media(new.id);
  return null;
end;
$$;

drop trigger if exists trg_report_media_rules on public.report_media;
create constraint trigger trg_report_media_rules
  after insert or update or delete on public.report_media
  deferrable initially deferred
  for each row execute function public.trg_check_media_from_media();

drop trigger if exists trg_reports_require_media on public.reports;
create constraint trigger trg_reports_require_media
  after insert on public.reports
  deferrable initially deferred
  for each row execute function public.trg_check_media_from_report();

-- ---------------------------------------------------------------------------
-- 6. Status normalization + timeline logging.
-- ---------------------------------------------------------------------------
-- Force status by reporter role at insert time (residents cannot self-verify).
create or replace function public.normalize_report_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
begin
  select role into v_role from public.app_profiles where id = new.reporter_id;

  if v_role in ('officer', 'mayor', 'admin') then
    new.status := 'verified';
    new.verified_by := new.reporter_id;
    new.verified_at := now();
  else
    new.status := 'unverified';
    new.verified_by := null;
    new.verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reports_normalize on public.reports;
create trigger trg_reports_normalize
  before insert on public.reports
  for each row execute function public.normalize_report_on_insert();

-- Append status + barangay-correction events for the export timeline.
create or replace function public.log_report_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.report_status_history
      (report_id, event_type, from_status, to_status, changed_by)
    values
      (new.id, 'status_change', null, new.status, new.reporter_id);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.report_status_history
      (report_id, event_type, from_status, to_status, changed_by)
    values
      (new.id, 'status_change', old.status, new.status, auth.uid());
  end if;

  if new.barangay_id is distinct from old.barangay_id then
    insert into public.report_status_history
      (report_id, event_type, changed_by, detail)
    values
      (new.id, 'barangay_change', auth.uid(),
       jsonb_build_object('from', old.barangay_id, 'to', new.barangay_id));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reports_log_insert on public.reports;
create trigger trg_reports_log_insert
  after insert on public.reports
  for each row execute function public.log_report_changes();

drop trigger if exists trg_reports_log_update on public.reports;
create trigger trg_reports_log_update
  after update on public.reports
  for each row execute function public.log_report_changes();

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------
alter table public.reports enable row level security;
alter table public.report_media enable row level security;
alter table public.report_status_history enable row level security;

-- reports: any signed-in user may read (social feed + map).
drop policy if exists "Reports readable by authenticated" on public.reports;
create policy "Reports readable by authenticated"
  on public.reports
  for select
  to authenticated
  using (true);

-- Insert only as yourself. normalize trigger fixes status by role.
drop policy if exists "Users create own reports" on public.reports;
create policy "Users create own reports"
  on public.reports
  for insert
  to authenticated
  with check (reporter_id = auth.uid());

-- Updates: reporter (own row), municipality-wide managers, or the BDRRMO
-- whose barangay the report is about.
drop policy if exists "Reporters and scoped officials update reports" on public.reports;
create policy "Reporters and scoped officials update reports"
  on public.reports
  for update
  to authenticated
  using (
    reporter_id = auth.uid()
    or public.can_manage_municipality()
    or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
  )
  with check (
    reporter_id = auth.uid()
    or public.can_manage_municipality()
    or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
  );

-- No DELETE policy on purpose -> hard deletes are blocked (see header note).

-- report_media: readable by authenticated (shown in feed); writable by the
-- owning reporter (create/replace during submission).
drop policy if exists "Report media readable by authenticated" on public.report_media;
create policy "Report media readable by authenticated"
  on public.report_media
  for select
  to authenticated
  using (true);

drop policy if exists "Reporters manage own report media" on public.report_media;
create policy "Reporters manage own report media"
  on public.report_media
  for all
  to authenticated
  using (
    exists (
      select 1 from public.reports r
      where r.id = report_media.report_id
        and r.reporter_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.reports r
      where r.id = report_media.report_id
        and r.reporter_id = auth.uid()
    )
  );

-- history: readable by authenticated; written only by triggers/service_role.
drop policy if exists "Report history readable by authenticated" on public.report_status_history;
create policy "Report history readable by authenticated"
  on public.report_status_history
  for select
  to authenticated
  using (true);

grant select, insert, update on public.reports to authenticated;
grant select, insert, update, delete on public.report_media to authenticated;
grant select on public.report_status_history to authenticated;

grant select, insert, update, delete on public.reports to service_role;
grant select, insert, update, delete on public.report_media to service_role;
grant select, insert, update, delete on public.report_status_history to service_role;

-- ---------------------------------------------------------------------------
-- 8. Realtime: officers/residents see new reports the moment they land.
--    Clients MUST subscribe with a scoped filter (BDRRMO: own barangay_id)
--    so they are not flooded with municipality-wide changes.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table public.reports;
  end if;
end;
$$;
