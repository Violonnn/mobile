-- Resident profile self-service updates.
--
-- The mobile client remains unable to update public.profiles directly because
-- that table also stores pin_hash. This narrowly scoped RPC only accepts the
-- editable display fields and enforces a server-side 30-day change limit.

create table if not exists public.resident_profile_change_log (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references auth.users (id) on delete cascade,
  changed_fields text[] not null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_resident_profile_change_log_latest
  on public.resident_profile_change_log (resident_id, changed_at desc);

alter table public.resident_profile_change_log enable row level security;

-- No client policies: the audit log is available only through the safe
-- eligibility RPC below. It intentionally stores field names, not old/new PII.
revoke all on public.resident_profile_change_log from public, anon, authenticated;
grant select, insert on public.resident_profile_change_log to service_role;

create or replace function public.get_my_profile_update_eligibility()
returns table (
  can_update boolean,
  next_update_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  latest_change timestamptz;
begin
  if current_user_id is null then
    raise exception 'Your session has expired.';
  end if;

  if not exists (
    select 1
      from public.app_profiles ap
     where ap.id = current_user_id
       and ap.role = 'resident'
       and ap.status = 'active'
  ) then
    raise exception 'Only active resident accounts can edit this profile.';
  end if;

  select max(log.changed_at)
    into latest_change
    from public.resident_profile_change_log log
   where log.resident_id = current_user_id;

  return query
  select
    latest_change is null or latest_change + interval '30 days' <= now(),
    case
      when latest_change is null then null
      else latest_change + interval '30 days'
    end;
end;
$$;

create or replace function public.update_my_resident_profile(
  p_first_name text,
  p_middle_name text,
  p_last_name text,
  p_barangay text
)
returns table (
  updated_at timestamptz,
  next_update_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_first_name text := btrim(coalesce(p_first_name, ''));
  normalized_middle_name text := btrim(coalesce(p_middle_name, ''));
  normalized_last_name text := btrim(coalesce(p_last_name, ''));
  normalized_barangay text := btrim(coalesce(p_barangay, ''));
  current_profile public.profiles%rowtype;
  latest_change timestamptz;
  changed_fields text[] := array[]::text[];
  profile_updated_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Your session has expired.';
  end if;

  if not exists (
    select 1
      from public.app_profiles ap
     where ap.id = current_user_id
       and ap.role = 'resident'
       and ap.status = 'active'
  ) then
    raise exception 'Only active resident accounts can edit this profile.';
  end if;

  -- Match the app's name rules while rejecting digits and control symbols.
  if char_length(normalized_first_name) not between 1 and 100
     or normalized_first_name !~ '^[[:alpha:]][[:alpha:] .''-]*$' then
    raise exception 'Enter a valid first name.';
  end if;

  if char_length(normalized_last_name) not between 1 and 100
     or normalized_last_name !~ '^[[:alpha:]][[:alpha:] .''-]*$' then
    raise exception 'Enter a valid last name.';
  end if;

  if char_length(normalized_middle_name) > 100
     or (normalized_middle_name <> ''
         and normalized_middle_name !~ '^[[:alpha:]][[:alpha:] .''-]*$') then
    raise exception 'Enter a valid middle name or leave it blank.';
  end if;

  if not exists (
    select 1
      from public.barangays barangay
     where barangay.name = normalized_barangay
       and barangay.municipality = 'Minglanilla'
  ) then
    raise exception 'Select a valid Minglanilla barangay.';
  end if;

  -- Lock the resident row so concurrent requests cannot bypass the cooldown.
  select profile.*
    into current_profile
    from public.profiles profile
   where profile.id = current_user_id
   for update;

  if not found then
    raise exception 'Resident profile not found.';
  end if;

  if current_profile.first_name is distinct from normalized_first_name then
    changed_fields := array_append(changed_fields, 'first_name');
  end if;
  if current_profile.middle_name is distinct from normalized_middle_name then
    changed_fields := array_append(changed_fields, 'middle_name');
  end if;
  if current_profile.last_name is distinct from normalized_last_name then
    changed_fields := array_append(changed_fields, 'last_name');
  end if;
  if current_profile.barangay is distinct from normalized_barangay then
    changed_fields := array_append(changed_fields, 'barangay');
  end if;

  -- A no-op does not consume the resident's next allowed update.
  if cardinality(changed_fields) = 0 then
    select max(log.changed_at)
      into latest_change
      from public.resident_profile_change_log log
     where log.resident_id = current_user_id;

    return query
    select current_profile.updated_at,
           case when latest_change is null then null
                else latest_change + interval '30 days' end;
    return;
  end if;

  select max(log.changed_at)
    into latest_change
    from public.resident_profile_change_log log
   where log.resident_id = current_user_id;

  if latest_change is not null and latest_change + interval '30 days' > now() then
    raise exception 'Profile changes are limited to once every 30 days. Try again after %.',
      to_char(latest_change + interval '30 days', 'Mon DD, YYYY');
  end if;

  update public.profiles profile
     set first_name = normalized_first_name,
         middle_name = normalized_middle_name,
         last_name = normalized_last_name,
         barangay = normalized_barangay
   where profile.id = current_user_id
  returning profile.updated_at into profile_updated_at;

  insert into public.resident_profile_change_log (resident_id, changed_fields)
  values (current_user_id, changed_fields)
  returning changed_at into latest_change;

  return query
  select profile_updated_at, latest_change + interval '30 days';
end;
$$;

revoke execute on function public.get_my_profile_update_eligibility() from public, anon;
revoke execute on function public.update_my_resident_profile(text, text, text, text) from public, anon;

grant execute on function public.get_my_profile_update_eligibility()
  to authenticated, service_role;
grant execute on function public.update_my_resident_profile(text, text, text, text)
  to authenticated, service_role;

comment on function public.update_my_resident_profile(text, text, text, text) is
  'Updates only resident display identity and barangay, with validation and a 30-day cooldown.';
