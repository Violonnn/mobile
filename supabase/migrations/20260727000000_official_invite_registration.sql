-- =====================================================================
-- Official invite registration (email-bound, pending row, OTP complete).
--
-- - invites.invited_email binds each invite to one government email.
-- - reserved_at / reserved_by claim an invite at Auth signup time.
-- - pending_official_registrations holds name/contact until email OTP
--   confirmation finishes; clients cannot read or write it.
-- - Auth signup trigger validates the opaque token hash + email match.
-- - complete_official_registration() finishes the account after confirm.
-- - check_active_official_access() gates Sign in / success panel.
-- - claim_official_email_otp_send() enforces 60s / 3-per-hour resend limits.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. Invite columns: invited email + reservation
-- ---------------------------------------------------------------------------
alter table public.invites
  add column if not exists invited_email text,
  add column if not exists reserved_at timestamptz,
  add column if not exists reserved_by uuid references auth.users (id);

-- Normalize and require email on every row going forward.
update public.invites
   set invited_email = lower(trim(invited_email))
 where invited_email is not null
   and invited_email <> lower(trim(invited_email));

-- Legacy open invites without an email cannot be safely claimed — revoke them.
update public.invites
   set revoked_at = coalesce(revoked_at, now())
 where invited_email is null
   and used_at is null
   and revoked_at is null;

-- Used / already-revoked legacy rows still need a non-null placeholder.
update public.invites
   set invited_email = 'legacy-unbound@invalid.local'
 where invited_email is null;

alter table public.invites
  alter column invited_email set not null;

alter table public.invites
  drop constraint if exists invites_invited_email_normalized;
alter table public.invites
  add constraint invites_invited_email_normalized
  check (invited_email = lower(trim(invited_email)) and length(invited_email) > 3);

create index if not exists idx_invites_reserved_by
  on public.invites (reserved_by)
  where reserved_at is not null and used_at is null;

-- ---------------------------------------------------------------------------
-- 2. Private pending registrations (no direct client access)
-- ---------------------------------------------------------------------------
create table if not exists public.pending_official_registrations (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  invite_id uuid not null unique references public.invites (id),
  first_name text not null,
  last_name text not null,
  middle_name text,
  phone_number text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pending_official_regs_invite
  on public.pending_official_registrations (invite_id);

alter table public.pending_official_registrations enable row level security;

-- No authenticated/anon policies: only SECURITY DEFINER RPCs / service_role.
revoke all on public.pending_official_registrations from public, anon, authenticated;
grant select, insert, update, delete on public.pending_official_registrations
  to service_role;

comment on table public.pending_official_registrations is
  'Private official signup staging. Clients never read/write this table directly.';

-- ---------------------------------------------------------------------------
-- 3. Email OTP send counters (server-side anti-abuse)
-- ---------------------------------------------------------------------------
create table if not exists public.official_email_otp_sends (
  email text primary key,
  send_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  last_sent_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.official_email_otp_sends enable row level security;

revoke all on public.official_email_otp_sends from public, anon, authenticated;
grant select, insert, update, delete on public.official_email_otp_sends
  to service_role;

comment on table public.official_email_otp_sends is
  'Official email confirmation send counters. Written only via claim RPC.';

-- ---------------------------------------------------------------------------
-- 4. claim_official_email_otp_send()
--    60-second cooldown, max 3 sends per rolling hour. Generic errors.
-- ---------------------------------------------------------------------------
create or replace function public.claim_official_email_otp_send(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_row public.official_email_otp_sends%rowtype;
  v_now timestamptz := now();
  v_cooldown_seconds integer := 60;
  v_max_sends integer := 3;
  v_window interval := interval '1 hour';
  v_wait integer;
begin
  v_email := lower(trim(coalesce(p_email, '')));
  if v_email = '' or position('@' in v_email) = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'Unable to send verification code. Please try again.'
    );
  end if;

  select * into v_row
    from public.official_email_otp_sends
   where email = v_email
   for update;

  if not found then
    insert into public.official_email_otp_sends (email, send_count, window_started_at, last_sent_at)
    values (v_email, 1, v_now, v_now);
    return jsonb_build_object(
      'ok', true,
      'send_count', 1,
      'max_sends', v_max_sends,
      'cooldown_seconds', v_cooldown_seconds
    );
  end if;

  -- Reset the hour window when it has elapsed.
  if v_row.window_started_at <= v_now - v_window then
    update public.official_email_otp_sends
       set send_count = 1,
           window_started_at = v_now,
           last_sent_at = v_now,
           updated_at = v_now
     where email = v_email;
    return jsonb_build_object(
      'ok', true,
      'send_count', 1,
      'max_sends', v_max_sends,
      'cooldown_seconds', v_cooldown_seconds
    );
  end if;

  if v_row.send_count >= v_max_sends then
    return jsonb_build_object(
      'ok', false,
      'error', 'Unable to send verification code. Please try again later.',
      'limit_reached', true,
      'send_count', v_row.send_count,
      'max_sends', v_max_sends
    );
  end if;

  if v_row.last_sent_at is not null
     and v_row.last_sent_at > v_now - make_interval(secs => v_cooldown_seconds)
  then
    v_wait := ceil(
      extract(
        epoch from (v_row.last_sent_at + make_interval(secs => v_cooldown_seconds) - v_now)
      )
    )::integer;
    return jsonb_build_object(
      'ok', false,
      'error', 'Unable to send verification code. Please try again.',
      'cooldown_seconds', greatest(v_wait, 1),
      'send_count', v_row.send_count,
      'max_sends', v_max_sends
    );
  end if;

  update public.official_email_otp_sends
     set send_count = v_row.send_count + 1,
         last_sent_at = v_now,
         updated_at = v_now
   where email = v_email;

  return jsonb_build_object(
    'ok', true,
    'send_count', v_row.send_count + 1,
    'max_sends', v_max_sends,
    'cooldown_seconds', v_cooldown_seconds
  );
end;
$$;

revoke execute on function public.claim_official_email_otp_send(text) from public;
grant execute on function public.claim_official_email_otp_send(text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. create_official_invite() — require invited government email
-- ---------------------------------------------------------------------------
drop function if exists public.create_official_invite(public.app_role, uuid);

create or replace function public.create_official_invite(
  p_role public.app_role,
  p_invited_email text,
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

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.invites (
    token_hash, role, barangay_id, created_by, invited_email
  )
  values (v_hash, p_role, p_barangay_id, auth.uid(), v_email);

  return v_token;
end;
$$;

revoke execute on function
  public.create_official_invite(public.app_role, text, uuid) from public, anon;
grant execute on function
  public.create_official_invite(public.app_role, text, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. list_official_invites() — include invited_email
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
-- 7. validate_invite_token() — reject reserved invites too
-- ---------------------------------------------------------------------------
create or replace function public.validate_invite_token(p_token text)
returns table (
  role public.app_role,
  barangay_id uuid,
  barangay_name text
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
    b.name as barangay_name
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
-- 8. Auth signup trigger — reserve invite + stage pending registration
--    AFTER INSERT so auth.users(id) exists before FK writes to pending /
--    invites.reserved_by. Raising here still rolls back the Auth insert.
-- ---------------------------------------------------------------------------
create or replace function public.handle_official_invite_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb;
  v_token text;
  v_hash text;
  v_invite public.invites%rowtype;
  v_first text;
  v_last text;
  v_middle text;
  v_phone text;
  v_email text;
  v_cleaned_meta jsonb;
begin
  v_meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  -- Resident / non-invite signups are untouched.
  if coalesce(v_meta->>'official_invite', '') <> '1' then
    return new;
  end if;

  v_token := trim(coalesce(v_meta->>'official_invite_token', ''));
  if v_token = '' then
    raise exception 'Registration could not be completed.' using errcode = '22023';
  end if;

  v_email := lower(trim(coalesce(new.email, '')));
  if v_email = '' then
    raise exception 'Registration could not be completed.' using errcode = '22023';
  end if;

  v_first := trim(coalesce(v_meta->>'first_name', ''));
  v_last := trim(coalesce(v_meta->>'last_name', ''));
  v_middle := nullif(trim(coalesce(v_meta->>'middle_name', '')), '');
  v_phone := nullif(trim(coalesce(v_meta->>'phone_number', '')), '');

  if v_first = '' or v_last = '' then
    raise exception 'Registration could not be completed.' using errcode = '22023';
  end if;

  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  select * into v_invite
    from public.invites
   where token_hash = v_hash
   for update;

  if not found
     or v_invite.revoked_at is not null
     or v_invite.used_at is not null
     or v_invite.reserved_at is not null
     or v_invite.expires_at <= now()
     or v_invite.invited_email is distinct from v_email
  then
    raise exception 'Registration could not be completed.' using errcode = '22023';
  end if;

  insert into public.pending_official_registrations (
    auth_user_id, invite_id, first_name, last_name, middle_name, phone_number
  )
  values (
    new.id, v_invite.id, v_first, v_last, v_middle, v_phone
  );

  update public.invites
     set reserved_at = now(),
         reserved_by = new.id
   where id = v_invite.id;

  -- Strip invite token and registration PII from Auth metadata after copy.
  v_cleaned_meta := v_meta
    - 'official_invite'
    - 'official_invite_token'
    - 'first_name'
    - 'last_name'
    - 'middle_name'
    - 'phone_number';

  update auth.users
     set raw_user_meta_data = v_cleaned_meta
   where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_official_invite on auth.users;
create trigger on_auth_user_created_official_invite
  after insert on auth.users
  for each row
  execute function public.handle_official_invite_signup();

-- ---------------------------------------------------------------------------
-- 9. complete_official_registration() — parameterless post-OTP finalize
-- ---------------------------------------------------------------------------
create or replace function public.complete_official_registration()
returns table (
  role public.app_role,
  barangay_id uuid,
  barangay_name text,
  email text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
  v_pending public.pending_official_registrations%rowtype;
  v_invite public.invites%rowtype;
  v_profile public.app_profiles%rowtype;
  v_barangay_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  select * into v_user from auth.users where id = auth.uid();
  if not found or v_user.email_confirmed_at is null then
    raise exception 'Confirm your email before continuing.' using errcode = '42501';
  end if;

  -- Already an active official? Return locked scope (idempotent success).
  select * into v_profile
    from public.app_profiles
   where id = auth.uid();

  if found
     and v_profile.status = 'active'
     and v_profile.role in ('mayor', 'officer')
  then
    -- Clean up any stale pending row from a prior interrupted attempt.
    delete from public.pending_official_registrations
     where auth_user_id = auth.uid();

    select b.name into v_barangay_name
      from public.barangays b
     where b.id = v_profile.barangay_id;

    role := v_profile.role;
    barangay_id := v_profile.barangay_id;
    barangay_name := v_barangay_name;
    email := lower(trim(coalesce(v_user.email, v_profile.email, '')));
    return next;
    return;
  end if;

  select * into v_pending
    from public.pending_official_registrations
   where auth_user_id = auth.uid()
   for update;

  if not found then
    raise exception 'Registration could not be completed.' using errcode = '22023';
  end if;

  select * into v_invite
    from public.invites
   where id = v_pending.invite_id
   for update;

  if not found
     or v_invite.revoked_at is not null
     or v_invite.used_at is not null
     or v_invite.expires_at <= now()
     or v_invite.invited_email is distinct from lower(trim(coalesce(v_user.email, '')))
     or v_invite.reserved_by is distinct from auth.uid()
  then
    raise exception 'Registration could not be completed.' using errcode = '22023';
  end if;

  insert into public.app_profiles (
    id, role, first_name, last_name, middle_name,
    email, phone_number, barangay_id, status, email_verified_at
  )
  values (
    auth.uid(),
    v_invite.role,
    v_pending.first_name,
    v_pending.last_name,
    v_pending.middle_name,
    lower(trim(v_user.email)),
    v_pending.phone_number,
    v_invite.barangay_id,
    'active',
    v_user.email_confirmed_at
  )
  on conflict (id) do update
    set role              = excluded.role,
        first_name        = excluded.first_name,
        last_name         = excluded.last_name,
        middle_name       = excluded.middle_name,
        email             = excluded.email,
        phone_number      = excluded.phone_number,
        barangay_id       = excluded.barangay_id,
        status            = 'active',
        email_verified_at = excluded.email_verified_at,
        updated_at        = now()
  returning * into v_profile;

  update public.invites
     set used_at = now(),
         used_by = auth.uid(),
         reserved_at = null,
         reserved_by = null
   where id = v_invite.id;

  delete from public.pending_official_registrations
   where id = v_pending.id;

  select b.name into v_barangay_name
    from public.barangays b
   where b.id = v_profile.barangay_id;

  role := v_profile.role;
  barangay_id := v_profile.barangay_id;
  barangay_name := v_barangay_name;
  email := lower(trim(coalesce(v_user.email, '')));
  return next;
end;
$$;

revoke execute on function public.complete_official_registration() from public, anon;
grant execute on function public.complete_official_registration()
  to authenticated, service_role;

-- Clients must not call the old token-bearing redeem path anymore.
revoke execute on function
  public.redeem_invite(text, text, text, text, text) from authenticated, anon, public;
grant execute on function
  public.redeem_invite(text, text, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 10. check_active_official_access() — Sign in / success panel gate
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

  -- Incomplete official signup still pending — not active yet.
  if exists (
    select 1
      from public.pending_official_registrations p
     where p.auth_user_id = auth.uid()
  ) then
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

  -- Mayor / MDRRMO / BDRRMO only (not admin, not resident).
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
