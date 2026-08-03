-- Supabase Storage uses INSERT ... RETURNING for uploads. A creator needs to
-- read their just-created private object before the Edge Function attaches it
-- to a published announcement. This is limited to that user's folder in the
-- announcement-media bucket; other users still read published media only.
drop policy if exists "Authenticated users read published announcement media"
  on storage.objects;

create policy "Users read own or published announcement media"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'announcement-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or exists (
        select 1
        from public.announcement_media media
        where media.storage_path = name
      )
    )
  );
