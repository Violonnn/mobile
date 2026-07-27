-- PostgreSQL cannot change RETURNS TABLE shape via CREATE OR REPLACE.
-- Drop first, then recreate with invited_email so the client can
-- field-validate that the registrant uses the email bound to this invite.
-- Possession of the opaque token already implies knowledge of that email
-- (it was delivered via the invite).

drop function if exists public.validate_invite_token(text);

create function public.validate_invite_token(p_token text)
returns table (
  role public.app_role,
  barangay_id uuid,
  barangay_name text,
  invited_email text
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
    i.invited_email
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
