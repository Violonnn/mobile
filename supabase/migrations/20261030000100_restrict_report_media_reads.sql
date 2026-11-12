-- Evidence is private to the active reporter and officials in report scope.
drop policy if exists "Report media readable by authenticated" on public.report_media;
create policy "Report media readable by reporter or scoped officials"
  on public.report_media for select to authenticated
  using (
    public.is_current_user_report_owner(report_id)
    or (public.is_official() and public.can_read_report_id(report_id))
  );

create or replace function public.can_read_report_media_path(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_active_profile()
    and exists (
      select 1
      from public.report_media media
      where (
          media.storage_path = p_storage_path
          or media.display_storage_path = p_storage_path
          or media.thumbnail_storage_path = p_storage_path
        )
        and (
          public.is_current_user_report_owner(media.report_id)
          or (public.is_official() and public.can_read_report_id(media.report_id))
        )
    );
$$;

revoke all on function public.can_read_report_media_path(text) from public, anon;
grant execute on function public.can_read_report_media_path(text)
  to authenticated, service_role;

-- The existing storage SELECT policy uses this function and also preserves
-- active uploaders' own-folder access for drafts not yet attached to a report.
