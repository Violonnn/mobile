-- =====================================================================
-- Admin & invite hardening.
--
-- - am_i_admin(): parameterless active-admin check for portal routing.
-- - Invite create / list / revoke / validate are SECURITY DEFINER RPCs.
-- - Authenticated clients lose direct insert/update on invites; token_hash
--   is never returned to the client.
-- - Admin / resident invites are rejected. Only mayor, MDRRMO (officer,
--   no barangay), and BDRRMO (officer + barangay) may be invited.
-- - redeem_invite() is left intact for a future registration form.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. am_i_admin() — active admin only; callable by authenticated users.
-- ---------------------------------------------------------------------------
create or replace function public.am_i_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.app_profiles
     where id = auth.uid()
       and role = 'admin'
       and status = 'active'
  );
$$;

revoke execute on function public.am_i_admin() from public, anon;
grant execute on function public.am_i_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Remove direct authenticated write access to invites.
--    Listing / creation / revocation go through the RPCs below.
-- ---------------------------------------------------------------------------
drop policy if exists "Managers can create invites" on public.invites;
drop policy if exists "Managers can revoke invites" on public.invites;

-- Keep a narrow select for managers so tooling still works; RPCs are the
-- supported client path and never expose token_hash.
drop policy if exists "Invites visible to creators and managers" on public.invites;
create policy "Invites visible to creators and managers"
  on public.invites
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_admin()
    or public.is_mayor()
  );

revoke insert, update, delete on public.invites from authenticated;
grant select on public.invites to authenticated;
grant select, insert, update, delete on public.invites to service_role;

-- ---------------------------------------------------------------------------
-- 3. create_official_invite()
--    Generates an opaque random token, stores only sha256(hex), returns the
--    raw token exactly once. Seven-day expiry (table default).
-- ---------------------------------------------------------------------------
create or replace function public.create_official_invite(
  p_role public.app_role,
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
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if not public.am_i_admin() then
    raise exception 'Only an active administrator can create invites.'
      using errcode = '42501';
  end if;

  -- Inviteable roles only: mayor, MDRRMO, BDRRMO. Never admin/resident.
  if p_role = 'mayor' then
    if p_barangay_id is not null then
      raise exception 'Mayor invites cannot include a barangay.'
        using errcode = '22023';
    end if;
  elsif p_role = 'officer' then
    -- MDRRMO: barangay null. BDRRMO: barangay required and must exist.
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

  -- 32 cryptographically random bytes → 64 hex chars. Opaque; no role encoded.
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.invites (token_hash, role, barangay_id, created_by)
  values (v_hash, p_role, p_barangay_id, auth.uid());

  return v_token;
end;
$$;

revoke execute on function
  public.create_official_invite(public.app_role, uuid) from public, anon;
grant execute on function
  public.create_official_invite(public.app_role, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. list_official_invites()
--    Active = unused, unrevoked, unexpired. Used = redeemed. Omits expired
--    and revoked. Never returns token_hash.
-- ---------------------------------------------------------------------------
create or replace function public.list_official_invites()
returns table (
  id uuid,
  list_group text,
  role public.app_role,
  barangay_id uuid,
  barangay_name text,
  created_at timestamptz,
  expires_at timestamptz,
  used_at timestamptz
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
    i.created_at,
    i.expires_at,
    i.used_at
  from public.invites i
  left join public.barangays b on b.id = i.barangay_id
  where i.revoked_at is null
    and (
      -- Active open invites
      (i.used_at is null and i.expires_at > now())
      -- Or already redeemed (Used list)
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
-- 5. revoke_official_invite()
--    Revokes only active, unused, unexpired invites.
-- ---------------------------------------------------------------------------
create or replace function public.revoke_official_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  if not public.am_i_admin() then
    raise exception 'Only an active administrator can revoke invites.'
      using errcode = '42501';
  end if;

  select * into v_invite
    from public.invites
   where id = p_invite_id
   for update;

  if not found then
    raise exception 'Invite not found.' using errcode = '22023';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'This invite is already revoked.' using errcode = '22023';
  end if;

  if v_invite.used_at is not null then
    raise exception 'Used invites cannot be revoked.' using errcode = '22023';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'Expired invites cannot be revoked.' using errcode = '22023';
  end if;

  update public.invites
     set revoked_at = now()
   where id = p_invite_id;
end;
$$;

revoke execute on function public.revoke_official_invite(uuid) from public, anon;
grant execute on function public.revoke_official_invite(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. validate_invite_token()
--    Anonymous-safe lookup. Returns role/barangay scope for a valid open
--    invite only. Does not consume the token or create an account.
--    Invalid/expired/used/revoked all return zero rows (generic client message).
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
    and i.expires_at > now()
  limit 1;
end;
$$;

-- Callable before sign-in (deep link / invite screen).
revoke execute on function public.validate_invite_token(text) from public;
grant execute on function public.validate_invite_token(text)
  to anon, authenticated, service_role;
