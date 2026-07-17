-- =====================================================================
-- Notifications: push tokens, in-app notifications, and a fan-out outbox.
--
-- Fan-out is DB-trigger -> outbox -> Edge Function / Database Webhook, NOT
-- client-triggered. Report/announcement writes enqueue a durable outbox row
-- and return immediately; a worker delivers pushes and writes per-user
-- notifications rows. This keeps critical alerts reliable and auditable and
-- never blocks the originating write on push delivery.
--
-- Expo push note: since Expo SDK 53 (this app is on SDK 54), Expo Go on
-- ANDROID cannot receive remote push -- only local notifications work there.
-- Android remote push must be tested with a development build; iOS Expo Go
-- is still fine. push_tokens therefore records `platform` so the worker can
-- skip / special-case devices, and clients should still register local
-- notifications regardless of push availability.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'device_platform') then
    create type public.device_platform as enum ('ios', 'android');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum
      ('report_verified', 'report_escalated', 'new_announcement',
       'nearby_report', 'evacuation_update');
  end if;
  if not exists (select 1 from pg_type where typname = 'outbox_status') then
    create type public.outbox_status as enum
      ('pending', 'processing', 'sent', 'failed');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. push_tokens (multiple devices per user; unique per token for rotation)
-- ---------------------------------------------------------------------------
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_profiles (id) on delete cascade,
  expo_push_token text not null unique,
  platform public.device_platform not null,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_push_tokens_user on public.push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- 3. notifications (per-user, in-app inbox; also mirrors what was pushed)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  related_entity_type text,
  related_entity_id uuid,
  is_read boolean not null default false,
  sent_via text,  -- 'push' | 'local' | 'none'
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, is_read, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. notification_outbox (durable queue consumed by the worker)
-- ---------------------------------------------------------------------------
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  payload jsonb not null,
  status public.outbox_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  process_after timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_outbox_pending
  on public.notification_outbox (status, process_after);

-- ---------------------------------------------------------------------------
-- 5. Fan-out enqueue triggers.
-- ---------------------------------------------------------------------------
-- Report status changes -> verified / escalated events.
create or replace function public.enqueue_report_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'verified' then
      insert into public.notification_outbox (event_type, payload)
      values ('report_verified', jsonb_build_object(
        'report_id', new.id, 'reporter_id', new.reporter_id,
        'barangay_id', new.barangay_id));
    elsif new.status = 'escalated' then
      insert into public.notification_outbox (event_type, payload)
      values ('report_escalated', jsonb_build_object(
        'report_id', new.id, 'reporter_id', new.reporter_id,
        'barangay_id', new.barangay_id));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reports_enqueue_notif on public.reports;
create trigger trg_reports_enqueue_notif
  after update on public.reports
  for each row execute function public.enqueue_report_notifications();

-- New announcement -> new_announcement event (worker resolves recipients
-- from scope/barangay).
create or replace function public.enqueue_announcement_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_outbox (event_type, payload)
  values ('new_announcement', jsonb_build_object(
    'announcement_id', new.id, 'scope', new.scope,
    'barangay_id', new.barangay_id));
  return new;
end;
$$;

drop trigger if exists trg_announcements_enqueue_notif on public.announcements;
create trigger trg_announcements_enqueue_notif
  after insert on public.announcements
  for each row execute function public.enqueue_announcement_notifications();

-- Evacuation center status change -> evacuation_update event.
create or replace function public.enqueue_evacuation_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.notification_outbox (event_type, payload)
    values ('evacuation_update', jsonb_build_object(
      'evacuation_center_id', new.id, 'status', new.status,
      'barangay_id', new.barangay_id));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_evacuation_enqueue_notif on public.evacuation_centers;
create trigger trg_evacuation_enqueue_notif
  after update on public.evacuation_centers
  for each row execute function public.enqueue_evacuation_notifications();

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
alter table public.push_tokens enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_outbox enable row level security;

-- push_tokens: a user fully manages only their own device tokens.
drop policy if exists "Users manage own push tokens" on public.push_tokens;
create policy "Users manage own push tokens"
  on public.push_tokens
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- notifications: a user reads and marks-read only their own; inserts come
-- from the worker (service_role).
drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications"
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- notification_outbox: NO authenticated policies -> service_role/worker only
-- (same pattern as login_attempts / registration_otp_sends).

grant select, insert, update, delete on public.push_tokens to authenticated;
grant select, update on public.notifications to authenticated;

grant select, insert, update, delete on public.push_tokens to service_role;
grant select, insert, update, delete on public.notifications to service_role;
grant select, insert, update, delete on public.notification_outbox to service_role;
