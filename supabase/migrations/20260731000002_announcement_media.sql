-- Private attachments for MDRRMO announcements. Announcement creation stays in
-- the Edge Function so clients never insert announcement/media rows directly.

create table if not exists public.announcement_media (
  id uuid primary key,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  type text not null check (type in ('photo', 'video')),
  storage_path text not null unique,
  duration_seconds numeric,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  constraint announcement_media_duration check (
    (type = 'photo' and duration_seconds is null)
    or (type = 'video' and duration_seconds > 0)
  )
);

create index if not exists idx_announcement_media_announcement_position
  on public.announcement_media (announcement_id, position);

alter table public.announcement_media enable row level security;

drop policy if exists "Announcement media readable by authenticated" on public.announcement_media;
create policy "Announcement media readable by authenticated"
  on public.announcement_media for select to authenticated using (true);

grant select on table public.announcement_media to authenticated;
-- Only the Edge Function's service role may attach uploaded files to an
-- announcement. Clients retain read-only access through the RLS policy.
grant select, insert on table public.announcement_media to service_role;

-- No client insert/update/delete policy: the authenticated user may upload a
-- private object, but only the server can attach it to an announcement.

insert into storage.buckets (id, name, public)
values ('announcement-media', 'announcement-media', false)
on conflict (id) do update set public = false;

drop policy if exists "Users upload own announcement media" on storage.objects;
create policy "Users upload own announcement media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'announcement-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update own announcement media" on storage.objects;
create policy "Users update own announcement media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'announcement-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'announcement-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own announcement media" on storage.objects;
create policy "Users delete own announcement media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'announcement-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Authenticated users read published announcement media" on storage.objects;
create policy "Authenticated users read published announcement media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'announcement-media'
    and (
      -- Storage needs SELECT to return a newly inserted private draft object.
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or exists (
        select 1
        from public.announcement_media media
        where media.storage_path = name
      )
    )
  );

-- Signed URLs are produced client-side only after the media rows pass this
-- read policy; the bucket itself remains private.
