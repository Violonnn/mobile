-- Purpose-sized private media derivatives and verified delivery metadata.
-- Columns remain nullable so reports and announcements created by older app
-- versions continue to render as placeholders until opened in detail.

alter table public.report_media
  add column if not exists thumbnail_storage_path text,
  add column if not exists display_storage_path text,
  add column if not exists file_size_bytes bigint,
  add column if not exists width integer,
  add column if not exists height integer;

alter table public.announcement_media
  add column if not exists thumbnail_storage_path text,
  add column if not exists display_storage_path text,
  add column if not exists file_size_bytes bigint,
  add column if not exists width integer,
  add column if not exists height integer;

alter table public.report_media
  drop constraint if exists report_media_verified_metadata,
  add constraint report_media_verified_metadata check (
    (file_size_bytes is null or file_size_bytes between 1 and 20971520)
    and (width is null or width between 1 and 20000)
    and (height is null or height between 1 and 20000)
    and storage_path not like '%..%'
    and (thumbnail_storage_path is null or thumbnail_storage_path not like '%..%')
    and (display_storage_path is null or display_storage_path not like '%..%')
    and (type = 'photo' or display_storage_path is null)
  );

alter table public.announcement_media
  drop constraint if exists announcement_media_verified_metadata,
  add constraint announcement_media_verified_metadata check (
    (file_size_bytes is null or file_size_bytes between 1 and 20971520)
    and (width is null or width between 1 and 20000)
    and (height is null or height between 1 and 20000)
    and storage_path not like '%..%'
    and (thumbnail_storage_path is null or thumbnail_storage_path not like '%..%')
    and (display_storage_path is null or display_storage_path not like '%..%')
    and (type = 'photo' or display_storage_path is null)
  );

create unique index if not exists idx_report_media_thumbnail_path
  on public.report_media (thumbnail_storage_path)
  where thumbnail_storage_path is not null;
create unique index if not exists idx_report_media_display_path
  on public.report_media (display_storage_path)
  where display_storage_path is not null;
create unique index if not exists idx_announcement_media_thumbnail_path
  on public.announcement_media (thumbnail_storage_path)
  where thumbnail_storage_path is not null;
create unique index if not exists idx_announcement_media_display_path
  on public.announcement_media (display_storage_path)
  where display_storage_path is not null;

-- The bucket cap protects videos. Trusted create functions separately enforce
-- the smaller 2 MB display-image and 300 KB thumbnail/poster budgets.
update storage.buckets
set public = false,
    file_size_limit = 20971520,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/quicktime'
    ]::text[]
where id in ('report-media', 'announcement-media');

comment on column public.report_media.thumbnail_storage_path is
  '480 px feed thumbnail or video poster; never an original video URL.';
comment on column public.report_media.display_storage_path is
  'Purpose-sized detail image. Null for videos and legacy rows.';
comment on column public.announcement_media.thumbnail_storage_path is
  '480 px feed thumbnail or video poster; never an original video URL.';
comment on column public.announcement_media.display_storage_path is
  'Purpose-sized detail image. Null for videos and legacy rows.';
