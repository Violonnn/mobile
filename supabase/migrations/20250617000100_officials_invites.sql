-- =====================================================================
-- Officials & invites.
--
-- Invite tokens are OPAQUE lookup keys: only a sha256 hash is stored, and
-- the role / barangay_id are read from the invites ROW server-side -- never
-- parsed or trusted from the token string.
--
-- Single-use is enforced APPLICATION-LAYER, transactionally, inside
-- redeem_invite(): the invite is validated and marked used in the SAME
-- transaction that creates the app_profiles row, so a token becomes
-- unusable the instant an account is created from it and a mid-flow failure
-- rolls back cleanly (no half-created official).
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. invites
-- ---------------------------------------------------------------------------
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  -- sha256(raw token) as hex. The raw token is delivered out-of-band and is
  -- never stored. Unique so a hash maps to at most one invite.
  token_hash text not null unique,
  role public.app_role not null,
  barangay_id uuid references public.barangays (id),
  created_by uuid references public.app_profiles (id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  used_by uuid references public.app_profiles (id),
  revoked_at timestamptz,
  -- Derived flag kept in sync automatically so callers can filter cheaply.
  is_revoked boolean generated always as (revoked_at is not null) stored,
  created_at timestamptz not null default now(),
  -- Residents never use invites.
  constraint invites_role_not_resident check (role <> 'resident'),
  -- Only barangay-scoped officers (BDRRMO) carry a barangay on the invite.
  constraint invites_barangay_scope check (
    role = 'officer' or barangay_id is null
  )
);

create index if not exists idx_invites_created_by on public.invites (created_by);
create index if not exists idx_invites_open
  on public.invites (expires_at)
  where used_at is null and revoked_at is null;

alter table public.invites enable row level security;

-- Creators see their own invites; mayor/admin see all (for management UIs).
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

-- Admin may invite anyone; a mayor may invite officers only.
drop policy if exists "Managers can create invites" on public.invites;
create policy "Managers can create invites"
  on public.invites
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.is_admin()
      or (public.is_mayor() and role = 'officer')
    )
  );

-- Revoke = update revoked_at. Creator or admin only.
drop policy if exists "Managers can revoke invites" on public.invites;
create policy "Managers can revoke invites"
  on public.invites
  for update
  to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

grant select, insert, update on public.invites to authenticated;
grant select, insert, update, delete on public.invites to service_role;

-- ---------------------------------------------------------------------------
-- 2. redeem_invite(): transactional, single-use acceptance.
--    Called by a freshly email-confirmed official (auth.uid() set).
--    SECURITY DEFINER so it can consume the invite and write app_profiles,
--    but it re-derives role/barangay from the ROW and locks it FOR UPDATE
--    to prevent a concurrent double-redeem.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_invite(
  p_token text,
  p_first_name text,
  p_last_name text,
  p_middle_name text default null,
  p_phone_number text default null
)
returns public.app_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_invite public.invites%rowtype;
  v_user auth.users%rowtype;
  v_profile public.app_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '28000';
  end if;

  -- Officials are gated on email confirmation before they can redeem.
  select * into v_user from auth.users where id = auth.uid();
  if v_user.email_confirmed_at is null then
    raise exception 'Confirm your email before redeeming an invite.'
      using errcode = '42501';
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  -- Lock the invite row so two concurrent redemptions cannot both succeed.
  select * into v_invite
    from public.invites
   where token_hash = v_hash
   for update;

  if not found then
    raise exception 'Invalid invite token.' using errcode = '22023';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'This invite has been revoked.' using errcode = '22023';
  end if;
  if v_invite.used_at is not null then
    raise exception 'This invite has already been used.' using errcode = '22023';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'This invite has expired.' using errcode = '22023';
  end if;

  -- Create the official identity. Role/barangay come from the ROW only.
  insert into public.app_profiles (
    id, role, first_name, last_name, middle_name,
    email, phone_number, barangay_id, status, email_verified_at
  )
  values (
    auth.uid(), v_invite.role, p_first_name, p_last_name,
    nullif(p_middle_name, ''), v_user.email, nullif(p_phone_number, ''),
    v_invite.barangay_id, 'active', v_user.email_confirmed_at
  )
  on conflict (id) do update
    set role              = excluded.role,
        first_name        = excluded.first_name,
        last_name         = excluded.last_name,
        middle_name       = excluded.middle_name,
        email             = excluded.email,
        phone_number      = excluded.phone_number,
        barangay_id       = excluded.barangay_id,
        email_verified_at = excluded.email_verified_at,
        updated_at        = now()
  returning * into v_profile;

  -- Same transaction: the token is now spent.
  update public.invites
     set used_at = now(),
         used_by = auth.uid()
   where id = v_invite.id;

  return v_profile;
end;
$$;

revoke execute on function
  public.redeem_invite(text, text, text, text, text) from public, anon;
grant execute on function
  public.redeem_invite(text, text, text, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. First mayor / admin BOOTSTRAP (fresh production database).
--    Invites require an existing mayor/admin, so the very first one cannot
--    be invited. Create it out-of-band with the service_role / SQL editor:
--
--      1. Create the auth user (Dashboard > Authentication > Add user, or
--         auth.admin.createUser via a trusted server) with a confirmed email.
--      2. Insert the identity row (run as service_role / in SQL editor):
--
--         insert into public.app_profiles
--           (id, role, first_name, last_name, status, email_verified_at)
--         values
--           ('<that-auth-user-uuid>', 'admin', 'System', 'Administrator',
--            'active', now());
--
--    Do this ONCE per environment. Never ship a hardcoded bootstrap account
--    in a migration -- credentials differ per environment.
-- ---------------------------------------------------------------------------
