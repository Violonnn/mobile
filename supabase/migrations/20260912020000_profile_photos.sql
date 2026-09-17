-- Cross-role profile pictures with owner-only writes and public viewing.

alter table public.app_profiles
  add column if not exists avatar_path text;

alter table public.app_profiles
  drop constraint if exists app_profiles_avatar_path_check,
  add constraint app_profiles_avatar_path_check check (
    avatar_path is null
    or (
      length(avatar_path) <= 160
      and avatar_path ~ '^[0-9a-f-]{36}/avatar-[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
    )
  );

comment on column public.app_profiles.avatar_path is
  'Owner-scoped object path in the public profile-photos bucket.';

-- Include avatar_path in the safe identity projection used by every role.
revoke all on public.app_profiles_public from authenticated, service_role;
create or replace view public.app_profiles_public
with (security_invoker = true)
as
select
  id,
  role,
  first_name,
  last_name,
  middle_name,
  barangay_id,
  status,
  created_at,
  updated_at,
  avatar_path
from public.app_profiles;

comment on view public.app_profiles_public is
  'Client-safe identity and profile-picture fields for cross-role attribution.';

revoke all on public.app_profiles from authenticated, anon;
grant select (
  id,
  role,
  first_name,
  last_name,
  middle_name,
  barangay_id,
  status,
  email_verified_at,
  created_at,
  updated_at,
  avatar_path
) on public.app_profiles to authenticated;
grant select on public.app_profiles_public to authenticated, service_role;

-- Only this function may change an avatar reference from an app client.
create or replace function public.update_my_avatar_path(p_avatar_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized_path text := nullif(trim(coalesce(p_avatar_path, '')), '');
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.app_profiles profile
    where profile.id = v_user_id
      and profile.status = 'active'
  ) then
    raise exception 'An active DisasterLink profile is required.' using errcode = '42501';
  end if;

  if v_normalized_path is not null and (
    length(v_normalized_path) > 160
    or v_normalized_path !~ (
      '^' || v_user_id::text || '/avatar-[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
    )
  ) then
    raise exception 'Invalid profile picture path.' using errcode = '22023';
  end if;

  update public.app_profiles
     set avatar_path = v_normalized_path
   where id = v_user_id;

  return v_normalized_path;
end;
$$;

revoke all on function public.update_my_avatar_path(text) from public, anon;
grant execute on function public.update_my_avatar_path(text) to authenticated, service_role;

-- Public objects allow residents and every official role to see one another.
-- Storage RLS still limits mutations to the authenticated owner's UUID folder.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-photos',
  'profile-photos',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Profile photos readable by everyone" on storage.objects;
create policy "Profile photos readable by everyone"
  on storage.objects
  for select
  to public
  using (bucket_id = 'profile-photos');

drop policy if exists "Users upload own profile photos" on storage.objects;
create policy "Users upload own profile photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ (
      '^' || auth.uid()::text || '/avatar-[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
    )
  );

drop policy if exists "Users update own profile photos" on storage.objects;
create policy "Users update own profile photos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ (
      '^' || auth.uid()::text || '/avatar-[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
    )
  );

drop policy if exists "Users delete own profile photos" on storage.objects;
create policy "Users delete own profile photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Add avatar paths to report/feed projections without exposing private fields.
create or replace view public.reports_map
with (security_invoker = true)
as
select
  r.id,
  r.title,
  r.description,
  r.status,
  r.barangay_id,
  r.created_at,
  r.reporter_id,
  r.address_text,
  r.upvote_count,
  r.comment_count,
  ap.first_name as reporter_first_name,
  ap.last_name as reporter_last_name,
  ap.middle_name as reporter_middle_name,
  extensions.st_y(r.location::extensions.geometry) as latitude,
  extensions.st_x(r.location::extensions.geometry) as longitude,
  r.incident_type,
  r.incident_type_other,
  ap.avatar_path as reporter_avatar_path
from public.reports r
join public.app_profiles_public ap on ap.id = r.reporter_id;

grant select on public.reports_map to authenticated, service_role;

create or replace view public.report_comments
with (security_invoker = true)
as
select
  c.id,
  c.report_id,
  c.user_id,
  c.body,
  c.parent_comment_id,
  c.is_hidden,
  c.created_at,
  c.updated_at,
  ap.first_name as author_first_name,
  ap.last_name as author_last_name,
  ap.middle_name as author_middle_name,
  (
    select count(*)::integer
    from public.comments reply
    where reply.parent_comment_id = c.id
      and reply.is_hidden = false
  ) as reply_count,
  ap.role as author_role,
  ap.avatar_path as author_avatar_path
from public.comments c
join public.app_profiles_public ap on ap.id = c.user_id;

grant select on public.report_comments to authenticated, service_role;

create or replace view public.announcement_comments_view
with (security_invoker = true)
as
select
  c.id,
  c.announcement_id,
  c.user_id,
  c.body,
  c.parent_comment_id,
  c.is_hidden,
  c.created_at,
  c.updated_at,
  ap.first_name as author_first_name,
  ap.last_name as author_last_name,
  ap.middle_name as author_middle_name,
  (
    select count(*)::integer
    from public.announcement_comments reply
    where reply.parent_comment_id = c.id
      and reply.is_hidden = false
  ) as reply_count,
  ap.avatar_path as author_avatar_path
from public.announcement_comments c
join public.app_profiles_public ap on ap.id = c.user_id;

grant select on public.announcement_comments_view to authenticated, service_role;
