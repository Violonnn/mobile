-- Return the linked profile photo only for invitations that have been used.
-- The admin-only RPC remains the access boundary for invite records.
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
  reserved_at timestamptz,
  avatar_path text
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
    i.reserved_at,
    case
      when i.used_at is not null then profile.avatar_path
      else null
    end as avatar_path
  from public.invites i
  left join public.barangays b on b.id = i.barangay_id
  left join public.app_profiles_public profile on profile.id = i.used_by
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
