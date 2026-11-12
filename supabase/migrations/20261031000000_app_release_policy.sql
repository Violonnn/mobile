-- Public release guidance is available before login. Only a trusted database
-- operator can change it; an app administrator has no client write privilege.
create table public.app_release_policy (
  platform text primary key check (platform in ('android', 'ios')),
  minimum_supported_version text not null check (
    length(minimum_supported_version) <= 20
    and minimum_supported_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'
  ),
  latest_version text not null check (
    length(latest_version) <= 20
    and latest_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'
  ),
  download_url text check (
    download_url is null or (length(download_url) <= 2048 and download_url ~ '^https://[^[:space:]]+$')
  ),
  enforce boolean not null default false,
  update_message text check (length(update_message) <= 1000),
  emergency_numbers jsonb not null default '[{"label":"National emergency","number":"911"}]'::jsonb
    check (jsonb_typeof(emergency_numbers) = 'array' and jsonb_array_length(emergency_numbers) between 1 and 12),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint enforced_release_has_download check (not enforce or download_url is not null)
);

create trigger app_release_policy_set_updated_at
  before update on public.app_release_policy
  for each row execute function public.set_updated_at();

alter table public.app_release_policy enable row level security;
revoke all on public.app_release_policy from public, anon, authenticated;
grant select on public.app_release_policy to anon, authenticated;
grant all on public.app_release_policy to service_role;
create policy "Release policy readable before login"
  on public.app_release_policy for select to anon, authenticated using (true);

-- No download exists for Expo Go; never seed an enforced policy or a store URL.
insert into public.app_release_policy (platform, minimum_supported_version, latest_version)
values ('android', '1.0.0', '1.0.1'), ('ios', '1.0.0', '1.0.1');

create table public.app_client_versions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  app_version text not null check (
    length(app_version) <= 20 and app_version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'
  ),
  last_seen_at timestamptz not null default now()
);

alter table public.app_client_versions enable row level security;
revoke all on public.app_client_versions from public, anon, authenticated;
grant all on public.app_client_versions to service_role;

create or replace function public.record_app_version(p_platform text, p_app_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_active_profile() then
    raise exception 'An active account is required.' using errcode = '42501';
  end if;

  if p_platform is null or p_platform not in ('android', 'ios') then
    raise exception 'Invalid app platform.' using errcode = '22023';
  end if;

  if p_app_version is null or length(p_app_version) > 20
     or p_app_version !~ '^[0-9]+[.][0-9]+[.][0-9]+$' then
    raise exception 'App version must use major.minor.patch (at most 20 characters).'
      using errcode = '22023';
  end if;

  -- The caller cannot supply another user's id or a fabricated last-seen time.
  insert into public.app_client_versions (user_id, platform, app_version, last_seen_at)
  values (auth.uid(), p_platform, p_app_version, now())
  on conflict (user_id) do update
    set platform = excluded.platform,
        app_version = excluded.app_version,
        last_seen_at = excluded.last_seen_at;
end;
$$;

revoke all on function public.record_app_version(text, text) from public, anon;
grant execute on function public.record_app_version(text, text) to authenticated;

comment on table public.app_client_versions is
  'Private, self-reported last-seen version per account; not a device inventory or proof that an older install has been retired. Compare recent Auth sign-ins with missing check-ins before enforcing.';
