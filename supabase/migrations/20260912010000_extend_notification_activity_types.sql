-- Extend the durable inbox for report activity. Each ALTER TYPE lives in its
-- own migration so the new values are committed before trigger functions use
-- them in the following migration.

alter type public.notification_type add value if not exists 'report_resolved';
alter type public.notification_type add value if not exists 'report_updated';
alter type public.notification_type add value if not exists 'report_commented';
alter type public.notification_type add value if not exists 'report_upvoted';

alter table public.notifications
  add column if not exists actor_id uuid
    references public.app_profiles (id) on delete set null,
  add column if not exists dedupe_key text;

create unique index if not exists idx_notifications_dedupe_key
  on public.notifications (dedupe_key)
  where dedupe_key is not null;

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

