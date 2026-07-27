-- =====================================================================
-- Fix official invite Auth signup trigger.
--
-- BEFORE INSERT wrote pending_official_registrations / invites.reserved_by
-- while auth.users(id) did not exist yet → FK failure → Auth error
-- "Database error saving new user".
--
-- Switch to AFTER INSERT and clear metadata via UPDATE auth.users.
-- =====================================================================

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
