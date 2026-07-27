-- =====================================================================
-- Official registration: switch from email OTP to SMS OTP (iProgSMS).
--
-- - invites.invited_phone binds each invite to one supported PH mobile.
-- - official_sms_challenges stores hashed OTP + verification state.
-- - official_sms_otp_sends enforces 60s / 3-per-hour send limits.
-- - Retires email-OTP runtime: signup trigger, pending rows, email
--   OTP claim/counters, and complete_official_registration RPC.
-- - Auth user creation moves to a trusted Edge Function (service role).
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. Normalize PH mobiles to E.164 (+639XXXXXXXXX) for comparisons/storage
-- ---------------------------------------------------------------------------
create or replace function public.normalize_ph_mobile(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');

  if v_digits ~ '^639\d{9}$' then
    return '+' || v_digits;
  end if;

  if v_digits ~ '^09\d{9}$' then
    return '+63' || substring(v_digits from 2);
  end if;

  if v_digits ~ '^9\d{9}$' then
    return '+63' || v_digits;
  end if;

  return null;
end;
$$;

revoke all on function public.normalize_ph_mobile(text) from public;
grant execute on function public.normalize_ph_mobile(text)
  to anon, authenticated, service_role;

-- Globe/TM + DITO prefixes only (IPROG shared sender constraint).
create or replace function public.is_supported_iprog_carrier(p_phone text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_e164 text;
  v_prefix integer;
begin
  v_e164 := public.normalize_ph_mobile(p_phone);
  if v_e164 is null or v_e164 !~ '^\+639\d{9}$' then
    return false;
  end if;

  v_prefix := substring(v_e164 from 4 for 3)::integer;

  return v_prefix in (
    -- Globe / TM
    817, 904, 905, 906, 915, 916, 917, 926, 927, 935, 936, 937,
    945, 954, 955, 956, 965, 966, 967, 975, 976, 977, 978, 979,
    995, 997,
    -- DITO
    895, 896, 897, 898, 991, 992, 993, 994
  );
end;
$$;

revoke all on function public.is_supported_iprog_carrier(text) from public;
grant execute on function public.is_supported_iprog_carrier(text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. invites.invited_phone (required going forward)
-- ---------------------------------------------------------------------------
alter table public.invites
  add column if not exists invited_phone text;

-- Legacy open invites without a phone cannot be safely claimed — revoke them.
update public.invites
   set revoked_at = coalesce(revoked_at, now())
 where invited_phone is null
   and used_at is null
   and revoked_at is null;

-- Used / already-revoked legacy rows need a non-null placeholder.
update public.invites
   set invited_phone = '+639000000000'
 where invited_phone is null;

alter table public.invites
  alter column invited_phone set not null;

alter table public.invites
  drop constraint if exists invites_invited_phone_e164;
alter table public.invites
  add constraint invites_invited_phone_e164
  check (invited_phone ~ '^\+639\d{9}$');

create index if not exists idx_invites_invited_phone_active
  on public.invites (invited_phone)
  where revoked_at is null and used_at is null;

-- ---------------------------------------------------------------------------
-- 3. app_profiles.phone_verified_at (SMS is the verified factor)
-- ---------------------------------------------------------------------------
alter table public.app_profiles
  add column if not exists phone_verified_at timestamptz;

-- Keep column grants in sync: clients still cannot see email/phone.
revoke all on public.app_profiles from authenticated, anon;
grant select (
  id, role, first_name, last_name, middle_name,
  barangay_id, status, email_verified_at, phone_verified_at,
  created_at, updated_at
) on public.app_profiles to authenticated;
grant select, insert, update, delete on public.app_profiles to service_role;

-- ---------------------------------------------------------------------------
-- 4. Private SMS challenge storage (hashed OTP only)
-- ---------------------------------------------------------------------------
create table if not exists public.official_sms_challenges (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.invites (id) on delete cascade,
  phone text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  verified_at timestamptz,
  failed_attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint official_sms_challenges_phone_e164
    check (phone ~ '^\+639\d{9}$'),
  constraint official_sms_challenges_failed_nonneg
    check (failed_attempts >= 0)
);

create index if not exists idx_official_sms_challenges_invite
  on public.official_sms_challenges (invite_id, created_at desc);

create index if not exists idx_official_sms_challenges_active
  on public.official_sms_challenges (invite_id, phone)
  where verified_at is null;

drop trigger if exists official_sms_challenges_updated_at
  on public.official_sms_challenges;
create trigger official_sms_challenges_updated_at
  before update on public.official_sms_challenges
  for each row execute function public.set_updated_at();

alter table public.official_sms_challenges enable row level security;

revoke all on public.official_sms_challenges from public, anon, authenticated;
grant select, insert, update, delete on public.official_sms_challenges
  to service_role;

comment on table public.official_sms_challenges is
  'Private official invite SMS OTP challenges. Clients never read/write directly.';

-- ---------------------------------------------------------------------------
-- 5. SMS send counters (60s cooldown, 3 sends / hour per invite)
-- ---------------------------------------------------------------------------
create table if not exists public.official_sms_otp_sends (
  invite_id uuid primary key references public.invites (id) on delete cascade,
  send_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  last_sent_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.official_sms_otp_sends enable row level security;

revoke all on public.official_sms_otp_sends from public, anon, authenticated;
grant select, insert, update, delete on public.official_sms_otp_sends
  to service_role;

comment on table public.official_sms_otp_sends is
  'Official invite SMS send counters. Written only by Edge Functions.';

-- ---------------------------------------------------------------------------
-- 6. create_official_invite() — require email + supported phone
-- ---------------------------------------------------------------------------
drop function if exists public.create_official_invite(public.app_role, text, uuid);

create or replace function public.create_official_invite(
  p_role public.app_role,
  p_invited_email text,
  p_invited_phone text,
  p_barangay_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_hash text;
  v_email text;
  v_phone text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if not public.am_i_admin() then
    raise exception 'Only an active administrator can create invites.'
      using errcode = '42501';
  end if;

  v_email := lower(trim(coalesce(p_invited_email, '')));
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid government email is required for every invite.'
      using errcode = '22023';
  end if;

  v_phone := public.normalize_ph_mobile(p_invited_phone);
  if v_phone is null then
    raise exception 'Enter a valid Philippine mobile number.'
      using errcode = '22023';
  end if;

  if not public.is_supported_iprog_carrier(v_phone) then
    raise exception 'Not supported yet. Try Globe, TM, or DITO'
      using errcode = '22023';
  end if;

  if p_role = 'mayor' then
    if p_barangay_id is not null then
      raise exception 'Mayor invites cannot include a barangay.'
        using errcode = '22023';
    end if;
  elsif p_role = 'officer' then
    if p_barangay_id is not null
       and not exists (
         select 1 from public.barangays where id = p_barangay_id
       )
    then
      raise exception 'Unknown barangay.' using errcode = '22023';
    end if;
  else
    raise exception 'This role cannot be invited.' using errcode = '22023';
  end if;

  -- Phone uniqueness among active official invites (generic message).
  if exists (
    select 1
      from public.invites i
     where i.invited_phone = v_phone
       and i.revoked_at is null
       and i.used_at is null
       and i.expires_at > now()
  ) then
    raise exception 'Could not create invite. Check the email and phone, then try again.'
      using errcode = '23505';
  end if;

  -- Phone uniqueness among active official accounts (residents may reuse).
  if exists (
    select 1
      from public.app_profiles p
     where public.normalize_ph_mobile(p.phone_number) = v_phone
       and p.role in ('mayor', 'officer')
       and p.status = 'active'
  ) then
    raise exception 'Could not create invite. Check the email and phone, then try again.'
      using errcode = '23505';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.invites (
    token_hash, role, barangay_id, created_by, invited_email, invited_phone
  )
  values (v_hash, p_role, p_barangay_id, auth.uid(), v_email, v_phone);

  return v_token;
end;
$$;

revoke execute on function
  public.create_official_invite(public.app_role, text, text, uuid) from public, anon;
grant execute on function
  public.create_official_invite(public.app_role, text, text, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. list_official_invites() — include invited_phone
-- ---------------------------------------------------------------------------
drop function if exists public.list_official_invites();

create or replace function public.list_official_invites()
returns table (
  id uuid,
  list_group text,
  role public.app_role,
  barangay_id uuid,
  barangay_name text,
  invited_email text,
  invited_phone text,
  created_at timestamptz,
  expires_at timestamptz,
  used_at timestamptz,
  reserved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if not public.am_i_admin() then
    raise exception 'Only an active administrator can list invites.'
      using errcode = '42501';
  end if;

  return query
  select
    i.id,
    case
      when i.used_at is not null then 'used'
      else 'active'
    end as list_group,
    i.role,
    i.barangay_id,
    b.name as barangay_name,
    i.invited_email,
    i.invited_phone,
    i.created_at,
    i.expires_at,
    i.used_at,
    i.reserved_at
  from public.invites i
  left join public.barangays b on b.id = i.barangay_id
  where i.revoked_at is null
    and (
      (i.used_at is null and i.expires_at > now())
      or i.used_at is not null
    )
  order by
    case when i.used_at is null then 0 else 1 end,
    coalesce(i.used_at, i.created_at) desc;
end;
$$;

revoke execute on function public.list_official_invites() from public, anon;
grant execute on function public.list_official_invites()
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. validate_invite_token() — return bound email + phone (no reservation gate
--    for SMS path; reserved_at only blocks leftover email-OTP attempts)
-- ---------------------------------------------------------------------------
drop function if exists public.validate_invite_token(text);

create function public.validate_invite_token(p_token text)
returns table (
  role public.app_role,
  barangay_id uuid,
  barangay_name text,
  invited_email text,
  invited_phone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return;
  end if;

  v_hash := encode(extensions.digest(trim(p_token), 'sha256'), 'hex');

  return query
  select
    i.role,
    i.barangay_id,
    b.name as barangay_name,
    i.invited_email,
    i.invited_phone
  from public.invites i
  left join public.barangays b on b.id = i.barangay_id
  where i.token_hash = v_hash
    and i.revoked_at is null
    and i.used_at is null
    and i.reserved_at is null
    and i.expires_at > now()
  limit 1;
end;
$$;

revoke execute on function public.validate_invite_token(text) from public;
grant execute on function public.validate_invite_token(text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. check_active_official_access() — drop pending-email dependency
-- ---------------------------------------------------------------------------
create or replace function public.check_active_official_access()
returns table (
  role public.app_role,
  barangay_id uuid,
  barangay_name text,
  email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
  v_profile public.app_profiles%rowtype;
  v_barangay_name text;
begin
  if auth.uid() is null then
    return;
  end if;

  select * into v_user from auth.users where id = auth.uid();
  if not found or v_user.email_confirmed_at is null then
    return;
  end if;

  select * into v_profile
    from public.app_profiles
   where id = auth.uid();

  if not found then
    return;
  end if;

  if v_profile.status is distinct from 'active' then
    return;
  end if;

  if v_profile.role not in ('mayor', 'officer') then
    return;
  end if;

  select b.name into v_barangay_name
    from public.barangays b
   where b.id = v_profile.barangay_id;

  role := v_profile.role;
  barangay_id := v_profile.barangay_id;
  barangay_name := v_barangay_name;
  email := lower(trim(coalesce(v_user.email, v_profile.email, '')));
  return next;
end;
$$;

revoke execute on function public.check_active_official_access() from public, anon;
grant execute on function public.check_active_official_access()
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10. Retire email-OTP runtime path (forward-only; history preserved)
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created_official_invite on auth.users;
drop function if exists public.handle_official_invite_signup();

drop function if exists public.complete_official_registration();
drop function if exists public.claim_official_email_otp_send(text);

-- Clear any in-flight email-OTP reservations before dropping staging tables.
update public.invites
   set reserved_at = null,
       reserved_by = null,
       revoked_at = coalesce(revoked_at, now())
 where reserved_at is not null
   and used_at is null
   and revoked_at is null;

drop table if exists public.pending_official_registrations;
drop table if exists public.official_email_otp_sends;
