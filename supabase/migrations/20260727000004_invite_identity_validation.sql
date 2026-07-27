-- =====================================================================
-- Prevent invalid official invites before registration.
--
-- create_official_invite becomes the authoritative admin identity check:
-- normalize email/phone, lock, reject conflicts with field-level errors,
-- and return either a one-time token or structured availability errors.
--
-- Phone uniqueness remains official-only (residents may share a number).
-- Auth emails without a valid official profile require manual review —
-- no automatic delete, reset, or role conversion.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. Service-role helper: does this email already exist in Auth?
-- ---------------------------------------------------------------------------
create or replace function public.auth_email_exists(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  v_email := lower(trim(coalesce(p_email, '')));
  if v_email = '' or position('@' in v_email) = 0 then
    return false;
  end if;

  return exists (
    select 1
      from auth.users u
     where lower(trim(coalesce(u.email, ''))) = v_email
  );
end;
$$;

revoke all on function public.auth_email_exists(text) from public;
revoke all on function public.auth_email_exists(text) from anon, authenticated;
grant execute on function public.auth_email_exists(text) to service_role;

comment on function public.auth_email_exists(text) is
  'Service-role only. True when auth.users already has this email.';

-- ---------------------------------------------------------------------------
-- 2. Shared identity conflict probe (service_role + used inside create RPC)
-- ---------------------------------------------------------------------------
create or replace function public.check_official_invite_identities(
  p_email text,
  p_phone text,
  p_exclude_invite_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_phone text;
  v_email_in_auth boolean := false;
  v_email_has_active_official boolean := false;
  v_email_active_invite boolean := false;
  v_phone_active_invite boolean := false;
  v_phone_active_official boolean := false;
  v_auth_user_id uuid;
begin
  v_email := lower(trim(coalesce(p_email, '')));
  v_phone := public.normalize_ph_mobile(p_phone);

  if v_email <> '' and position('@' in v_email) > 0 then
    select u.id
      into v_auth_user_id
      from auth.users u
     where lower(trim(coalesce(u.email, ''))) = v_email
     limit 1;

    v_email_in_auth := v_auth_user_id is not null;

    if v_auth_user_id is not null then
      v_email_has_active_official := exists (
        select 1
          from public.app_profiles p
         where p.id = v_auth_user_id
           and p.role in ('mayor', 'officer')
           and p.status = 'active'
      );
    end if;

    -- Also treat an active official row with this contact email as taken.
    if not v_email_has_active_official then
      v_email_has_active_official := exists (
        select 1
          from public.app_profiles p
         where lower(trim(coalesce(p.email, ''))) = v_email
           and p.role in ('mayor', 'officer')
           and p.status = 'active'
      );
    end if;

    v_email_active_invite := exists (
      select 1
        from public.invites i
       where i.invited_email = v_email
         and i.revoked_at is null
         and i.used_at is null
         and i.expires_at > now()
         and (p_exclude_invite_id is null or i.id <> p_exclude_invite_id)
    );
  end if;

  if v_phone is not null then
    v_phone_active_invite := exists (
      select 1
        from public.invites i
       where i.invited_phone = v_phone
         and i.revoked_at is null
         and i.used_at is null
         and i.expires_at > now()
         and (p_exclude_invite_id is null or i.id <> p_exclude_invite_id)
    );

    -- Residents may reuse the same phone; only mayor/officer are blocked.
    v_phone_active_official := exists (
      select 1
        from public.app_profiles p
       where public.normalize_ph_mobile(p.phone_number) = v_phone
         and p.role in ('mayor', 'officer')
         and p.status = 'active'
    );
  end if;

  return jsonb_build_object(
    'email_in_auth', v_email_in_auth,
    'email_has_active_official', v_email_has_active_official,
    'email_active_invite', v_email_active_invite,
    'phone_active_invite', v_phone_active_invite,
    'phone_active_official', v_phone_active_official,
    -- Auth row exists but there is no valid active official profile.
    'requires_manual_review',
      (v_email_in_auth and not v_email_has_active_official)
  );
end;
$$;

revoke all on function
  public.check_official_invite_identities(text, text, uuid) from public;
revoke all on function
  public.check_official_invite_identities(text, text, uuid)
  from anon, authenticated;
grant execute on function
  public.check_official_invite_identities(text, text, uuid)
  to service_role;

comment on function public.check_official_invite_identities(text, text, uuid) is
  'Service-role identity probe for official invites. Never expose results to invite recipients.';

-- ---------------------------------------------------------------------------
-- 3. create_official_invite() — structured admin result + xact locks
-- ---------------------------------------------------------------------------
drop function if exists public.create_official_invite(public.app_role, text, text, uuid);

create or replace function public.create_official_invite(
  p_role public.app_role,
  p_invited_email text,
  p_invited_phone text,
  p_barangay_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_hash text;
  v_email text;
  v_phone text;
  v_conflicts jsonb;
  v_email_error text := null;
  v_phone_error text := null;
  v_requires_manual_review boolean := false;
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

  -- Serialize competing create requests for the same email or phone.
  -- Lock order is fixed (email then phone) to avoid deadlocks.
  perform pg_advisory_xact_lock(hashtextextended('invite_email:' || v_email, 0));
  perform pg_advisory_xact_lock(hashtextextended('invite_phone:' || v_phone, 0));

  v_conflicts := public.check_official_invite_identities(v_email, v_phone, null);

  if coalesce((v_conflicts->>'email_in_auth')::boolean, false) then
    if coalesce((v_conflicts->>'email_has_active_official')::boolean, false) then
      v_email_error :=
        'This email is already used by an active official account.';
    else
      -- Orphan / abandoned Auth user — admin must resolve manually.
      v_email_error :=
        'This email already exists in Authentication and requires manual review before a new invite can be issued.';
      v_requires_manual_review := true;
    end if;
  elsif coalesce((v_conflicts->>'email_active_invite')::boolean, false) then
    v_email_error := 'An active invite already uses this email.';
  end if;

  if coalesce((v_conflicts->>'phone_active_invite')::boolean, false) then
    v_phone_error := 'An active invite already uses this phone number.';
  elsif coalesce((v_conflicts->>'phone_active_official')::boolean, false) then
    v_phone_error :=
      'This phone number is already used by an active official account.';
  end if;

  if v_email_error is not null or v_phone_error is not null then
    return jsonb_build_object(
      'ok', false,
      'token', null,
      'email_error', v_email_error,
      'phone_error', v_phone_error,
      'requires_manual_review', v_requires_manual_review
    );
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.invites (
    token_hash, role, barangay_id, created_by, invited_email, invited_phone
  )
  values (v_hash, p_role, p_barangay_id, auth.uid(), v_email, v_phone);

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'email_error', null,
    'phone_error', null,
    'requires_manual_review', false
  );
end;
$$;

revoke execute on function
  public.create_official_invite(public.app_role, text, text, uuid) from public, anon;
grant execute on function
  public.create_official_invite(public.app_role, text, text, uuid)
  to authenticated, service_role;

comment on function public.create_official_invite(public.app_role, text, text, uuid) is
  'Admin-only. Returns {ok,token} or field-level email/phone availability errors.';
