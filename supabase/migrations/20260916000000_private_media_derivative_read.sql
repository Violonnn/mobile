-- Allow authorized readers to sign original, thumbnail, and display variants.
-- The derivative columns were added after the original path policy was written.

create or replace function public.can_read_report_media_path(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.report_media media
    where (
        media.storage_path = p_storage_path
        or media.thumbnail_storage_path = p_storage_path
        or media.display_storage_path = p_storage_path
      )
      and public.can_read_report_id(media.report_id)
  );
$$;

create or replace function public.can_read_announcement_media_path(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_active_profile()
    and exists (
      select 1
      from public.announcement_media media
      join public.announcements announcement
        on announcement.id = media.announcement_id
      where (
          media.storage_path = p_storage_path
          or media.thumbnail_storage_path = p_storage_path
          or media.display_storage_path = p_storage_path
        )
        and public.can_read_announcement(announcement)
    );
$$;

revoke all on function public.can_read_report_media_path(text) from public, anon;
revoke all on function public.can_read_announcement_media_path(text) from public, anon;

grant execute on function public.can_read_report_media_path(text)
  to authenticated, service_role;
grant execute on function public.can_read_announcement_media_path(text)
  to authenticated, service_role;
