-- =====================================================================
-- Storage: private bucket for report photos/videos.
--
-- Path convention (enforced by the policies below):
--     report-media/{reporter_user_id}/{report_id}/{media_id}.{ext}
--   - folder[1] = the uploading user's auth uid  -> ownership check
--   - folder[2] = report_id                      -> groups a report's media
--
-- Bucket is PRIVATE. Feed/map display and the PDF export use signed URLs
-- minted server-side (or a scoped read policy for signed-in users). Public
-- objects would leak resident-submitted media, so the bucket is not public.
--
-- Supabase Storage already edge-caches objects, so no extra CDN is needed.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. Bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('report-media', 'report-media', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Policies on storage.objects (scoped to this bucket).
-- ---------------------------------------------------------------------------

-- Upload: only into your own {user_id}/... folder (live capture upload path).
drop policy if exists "report-media upload own folder" on storage.objects;
create policy "report-media upload own folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'report-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read: any signed-in user may read report media (feed + map show it to all).
-- Bucket stays private so anonymous/direct URLs still require a signed URL.
drop policy if exists "report-media read authenticated" on storage.objects;
create policy "report-media read authenticated"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'report-media');

-- Update/replace: only your own objects.
drop policy if exists "report-media update own" on storage.objects;
create policy "report-media update own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'report-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'report-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: owner, or an official (moderation / takedown of inappropriate media).
drop policy if exists "report-media delete own or official" on storage.objects;
create policy "report-media delete own or official"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'report-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_official()
    )
  );
