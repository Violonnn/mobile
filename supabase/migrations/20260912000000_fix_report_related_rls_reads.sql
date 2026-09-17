-- The incident-location migration intentionally removed table-wide SELECT on
-- reports so immutable device GPS fields cannot be fetched by app clients.
-- Related-table RLS policies must therefore avoid passing a whole reports row
-- to can_read_report(), because that implicitly requires every report column.

create or replace function public.can_read_report_id(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_active_profile()
    and exists (
      select 1
      from public.reports report
      where report.id = p_report_id
        and (
          not public.is_bdrrmo()
          or report.barangay_id is not distinct from public.current_app_barangay_id()
        )
    );
$$;

create or replace function public.is_current_user_report_owner(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_active_profile()
    and exists (
      select 1
      from public.reports report
      where report.id = p_report_id
        and report.reporter_id = auth.uid()
    );
$$;

revoke all on function public.can_read_report_id(uuid) from public, anon;
revoke all on function public.is_current_user_report_owner(uuid) from public, anon;
grant execute on function public.can_read_report_id(uuid) to authenticated, service_role;
grant execute on function public.is_current_user_report_owner(uuid) to authenticated, service_role;

-- Report attachments inherit the parent report's role/barangay visibility.
drop policy if exists "Report media readable by authenticated" on public.report_media;
create policy "Report media readable by authenticated"
  on public.report_media for select to authenticated
  using (public.can_read_report_id(report_id));

drop policy if exists "Reporters manage own report media" on public.report_media;
create policy "Reporters manage own report media"
  on public.report_media for all to authenticated
  using (public.is_current_user_report_owner(report_id))
  with check (public.is_current_user_report_owner(report_id));

-- Keep voting and report history on the same parent-report scope check.
drop policy if exists "Upvotes readable by authenticated" on public.report_upvotes;
create policy "Upvotes readable by authenticated"
  on public.report_upvotes for select to authenticated
  using (public.can_read_report_id(report_id));

drop policy if exists "Users manage own upvote" on public.report_upvotes;
create policy "Users manage own upvote"
  on public.report_upvotes for all to authenticated
  using (
    user_id = auth.uid()
    and public.can_read_report_id(report_id)
  )
  with check (
    user_id = auth.uid()
    and public.can_read_report_id(report_id)
  );

drop policy if exists "Report history readable by authenticated"
  on public.report_status_history;
create policy "Report history readable by authenticated"
  on public.report_status_history for select to authenticated
  using (public.can_read_report_id(report_id));

-- Comment views are security-invoker, so these base-table policies remain the
-- source of truth for highlights, threads, replies, and moderation visibility.
drop policy if exists "Visible comments or scoped moderation review" on public.comments;
drop policy if exists "Comments readable by authenticated" on public.comments;
create policy "Visible comments or scoped moderation review"
  on public.comments for select to authenticated
  using (
    public.can_read_report_id(report_id)
    and (not is_hidden or public.can_moderate_report_comment(report_id))
  );

drop policy if exists "Users create own comments" on public.comments;
create policy "Users create own comments"
  on public.comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.can_read_report_id(report_id)
  );

drop policy if exists "Authors edit or officers moderate comments" on public.comments;
drop policy if exists "Authors edit or officials moderate comments" on public.comments;
create policy "Authors edit or officers moderate comments"
  on public.comments for update to authenticated
  using (
    public.can_read_report_id(report_id)
    and (
      user_id = auth.uid()
      or public.can_moderate_report_comment(report_id)
    )
  )
  with check (
    public.can_read_report_id(report_id)
    and (
      user_id = auth.uid()
      or public.can_moderate_report_comment(report_id)
    )
  );

-- Storage URL checks should also avoid a whole-row reports reference.
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
    where media.storage_path = p_storage_path
      and public.can_read_report_id(media.report_id)
  );
$$;

revoke all on function public.can_read_report_media_path(text) from public, anon;
grant execute on function public.can_read_report_media_path(text)
  to authenticated, service_role;
