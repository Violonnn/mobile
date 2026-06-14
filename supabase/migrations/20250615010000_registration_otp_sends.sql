-- Registration OTP send tracking (server-side anti-abuse).
-- WHY: Client cooldown/session counters can be bypassed by reinstalling the app.
--      Edge functions (service role) are the only writers.

create table if not exists public.registration_otp_sends (
  phone text primary key,
  send_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  last_sent_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.registration_otp_sends enable row level security;

comment on table public.registration_otp_sends is
  'OTP send counters per phone for registration. Service role only.';
