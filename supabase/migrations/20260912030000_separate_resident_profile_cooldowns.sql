-- Track name and barangay cooldowns independently while keeping all enforcement
-- inside security-definer RPCs. The audit log remains inaccessible to clients.

create or replace function public.get_my_profile_update_eligibility_v2()
returns table (
  can_update_name boolean,
  name_next_update_at timestamptz,
  can_update_barangay boolean,
  barangay_next_update_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  latest_name_change timestamptz;
  latest_barangay_change timestamptz;
begin
  if current_user_id is null then
    raise exception 'Your session has expired.';
  end if;

  if not exists (
    select 1
      from public.app_profiles app_profile
     where app_profile.id = current_user_id
       and app_profile.role = 'resident'
       and app_profile.status = 'active'
  ) then
    raise exception 'Only active resident accounts can edit this profile.';
  end if;

  select
    max(change_log.changed_at) filter (
      where change_log.changed_fields && array['first_name', 'middle_name', 'last_name']::text[]
    ),
    max(change_log.changed_at) filter (
      where 'barangay' = any(change_log.changed_fields)
    )
    into latest_name_change, latest_barangay_change
    from public.resident_profile_change_log change_log
   where change_log.resident_id = current_user_id;

  return query
  select
    latest_name_change is null or latest_name_change + interval '30 days' <= now(),
    case
      when latest_name_change is null then null
      else latest_name_change + interval '30 days'
    end,
    latest_barangay_change is null or latest_barangay_change + interval '30 days' <= now(),
    case
      when latest_barangay_change is null then null
      else latest_barangay_change + interval '30 days'
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
  latest_name_change timestamptz;
  latest_barangay_change timestamptz;
  changed_fields text[] := array[]::text[];
  name_changed boolean := false;
  barangay_changed boolean := false;
  profile_updated_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Your session has expired.';
  end if;

  if not exists (
    select 1
      from public.app_profiles app_profile
     where app_profile.id = current_user_id
       and app_profile.role = 'resident'
       and app_profile.status = 'active'
  ) then
    raise exception 'Only active resident accounts can edit this profile.';
  end if;

  -- Match the client name rules while rejecting digits and control symbols.
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
      from public.barangays barangay_option
     where barangay_option.name = normalized_barangay
       and barangay_option.municipality = 'Minglanilla'
  ) then
    raise exception 'Select a valid Minglanilla barangay.';
  end if;

  -- Lock the resident row so parallel requests cannot bypass either cooldown.
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
    name_changed := true;
  end if;
  if current_profile.middle_name is distinct from normalized_middle_name then
    changed_fields := array_append(changed_fields, 'middle_name');
    name_changed := true;
  end if;
  if current_profile.last_name is distinct from normalized_last_name then
    changed_fields := array_append(changed_fields, 'last_name');
    name_changed := true;
  end if;
  if current_profile.barangay is distinct from normalized_barangay then
    changed_fields := array_append(changed_fields, 'barangay');
    barangay_changed := true;
  end if;

  select
    max(change_log.changed_at),
    max(change_log.changed_at) filter (
      where change_log.changed_fields && array['first_name', 'middle_name', 'last_name']::text[]
    ),
    max(change_log.changed_at) filter (
      where 'barangay' = any(change_log.changed_fields)
    )
    into latest_change, latest_name_change, latest_barangay_change
    from public.resident_profile_change_log change_log
   where change_log.resident_id = current_user_id;

  -- A no-op does not consume either update window.
  if cardinality(changed_fields) = 0 then
    return query
    select current_profile.updated_at,
           case when latest_change is null then null
                else latest_change + interval '30 days' end;
    return;
  end if;

  if name_changed
     and latest_name_change is not null
     and latest_name_change + interval '30 days' > now() then
    raise exception 'Name changes are limited to once every 30 days. Try again after %.',
      to_char(latest_name_change + interval '30 days', 'Mon DD, YYYY HH12:MI AM');
  end if;

  if barangay_changed
     and latest_barangay_change is not null
     and latest_barangay_change + interval '30 days' > now() then
    raise exception 'Barangay changes are limited to once every 30 days. Try again after %.',
      to_char(latest_barangay_change + interval '30 days', 'Mon DD, YYYY HH12:MI AM');
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

revoke execute on function public.get_my_profile_update_eligibility_v2() from public, anon;
grant execute on function public.get_my_profile_update_eligibility_v2()
  to authenticated, service_role;

comment on function public.get_my_profile_update_eligibility_v2() is
  'Returns independently enforced resident name and barangay update windows.';

comment on function public.update_my_resident_profile(text, text, text, text) is
  'Updates resident display identity and barangay with independent 30-day cooldowns.';
