-- =====================================================================
-- Active-profile and BDRRMO scope enforcement.
--
-- A valid Auth session is not sufficient for protected operations. Every
-- role helper and protected official boundary below also requires an active
-- app_profiles row, so suspending an account takes effect immediately.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. Shared authorization predicates
-- ---------------------------------------------------------------------------
create or replace function public.has_active_profile()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.app_profiles
      where id = auth.uid()
        and status = 'active'
    );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.has_active_profile()
    and public.current_app_role() = 'admin';
$$;

create or replace function public.is_mayor()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.has_active_profile()
    and public.current_app_role() = 'mayor';
$$;

create or replace function public.is_officer()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.has_active_profile()
    and public.current_app_role() = 'officer';
$$;

create or replace function public.is_mdrrmo()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_officer()
    and public.current_app_barangay_id() is null;
$$;

create or replace function public.is_bdrrmo()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_officer()
    and public.current_app_barangay_id() is not null;
$$;

create or replace function public.can_manage_municipality()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_admin()
    or public.is_mayor()
    or public.is_mdrrmo();
$$;

create or replace function public.is_official()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_admin()
    or public.is_mayor()
    or public.is_officer();
$$;

revoke all on function public.has_active_profile() from public, anon;
grant execute on function public.has_active_profile() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Read and moderation scope helpers
-- ---------------------------------------------------------------------------
create or replace function public.can_read_report(p_report public.reports)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_active_profile() then
    return false;
  end if;

  -- BDRRMO report access is limited to the assigned barangay.
  if public.is_bdrrmo() then
    return p_report.barangay_id is not distinct from public.current_app_barangay_id();
  end if;

  return true;
end;
$$;

create or replace function public.can_read_announcement(
  p_announcement public.announcements
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_active_profile() then
    return false;
  end if;

  if p_announcement.scope = 'municipal' then
    return true;
  end if;

  if public.is_admin() or public.is_mayor() or public.is_mdrrmo() then
    return true;
  end if;

  return p_announcement.barangay_id is not distinct from public.current_app_barangay_id();
end;
$$;

create or replace function public.can_read_scoped_resource(p_barangay_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_active_profile()
    and (
      not public.is_bdrrmo()
      or p_barangay_id is null
      or p_barangay_id = public.current_app_barangay_id()
    );
$$;

create or replace function public.can_read_evacuation_center(p_barangay_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_active_profile()
    and (
      not public.is_bdrrmo()
      or p_barangay_id = public.current_app_barangay_id()
    );
$$;

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
      join public.reports report on report.id = media.report_id
      where media.storage_path = p_storage_path
        and public.can_read_report(report)
    );
$$;

create or replace function public.can_delete_report_media_path(p_storage_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_active_profile() then
    return false;
  end if;

  if public.is_bdrrmo() then
    return exists (
      select 1
      from public.report_media media
      join public.reports report on report.id = media.report_id
      where media.storage_path = p_storage_path
        and report.barangay_id = public.current_app_barangay_id()
    );
  end if;

  return public.is_official();
end;
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
      join public.announcements announcement on announcement.id = media.announcement_id
      where media.storage_path = p_storage_path
        and public.can_read_announcement(announcement)
    );
$$;

create or replace function public.can_moderate_report_comment(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_active_profile()
    and (
      public.is_admin()
      or public.is_mdrrmo()
      or (
        public.is_bdrrmo()
        and exists (
          select 1
          from public.reports report
          where report.id = p_report_id
            and report.barangay_id = public.current_app_barangay_id()
        )
      )
    );
$$;

create or replace function public.can_moderate_announcement_comment(
  p_announcement_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_active_profile()
    and exists (
      select 1
      from public.announcements announcement
      where announcement.id = p_announcement_id
        and (
          public.is_admin()
          or public.is_mayor()
          or public.is_mdrrmo()
          or (
            public.is_bdrrmo()
            and announcement.scope = 'barangay'
            and announcement.barangay_id = public.current_app_barangay_id()
          )
        )
    );
$$;

revoke all on function
  public.can_read_report(public.reports),
  public.can_read_announcement(public.announcements),
  public.can_read_scoped_resource(uuid),
  public.can_read_evacuation_center(uuid),
  public.can_read_report_media_path(text),
  public.can_delete_report_media_path(text),
  public.can_read_announcement_media_path(text),
  public.can_moderate_report_comment(uuid),
  public.can_moderate_announcement_comment(uuid)
from public, anon;

grant execute on function
  public.can_read_report(public.reports),
  public.can_read_announcement(public.announcements),
  public.can_read_scoped_resource(uuid),
  public.can_read_evacuation_center(uuid),
  public.can_read_report_media_path(text),
  public.can_delete_report_media_path(text),
  public.can_read_announcement_media_path(text),
  public.can_moderate_report_comment(uuid),
  public.can_moderate_announcement_comment(uuid)
to authenticated, service_role;

-- Keep announcement-comment moderators from changing author/content fields.
create or replace function public.guard_announcement_comment_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id = auth.uid() then
    if new.announcement_id is distinct from old.announcement_id
       or new.parent_comment_id is distinct from old.parent_comment_id
       or new.is_hidden is distinct from old.is_hidden
       or new.hidden_by is distinct from old.hidden_by
       or new.hidden_at is distinct from old.hidden_at then
      raise exception 'Comment authors may only edit the comment body.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if not public.can_moderate_announcement_comment(old.announcement_id) then
    raise exception 'Not permitted to moderate this comment.'
      using errcode = '42501';
  end if;

  if new.body is distinct from old.body
     or new.user_id is distinct from old.user_id
     or new.announcement_id is distinct from old.announcement_id
     or new.parent_comment_id is distinct from old.parent_comment_id then
    raise exception 'Moderators may only change comment visibility.'
      using errcode = '42501';
  end if;

  if new.is_hidden is distinct from old.is_hidden then
    if new.is_hidden then
      new.hidden_by := auth.uid();
      new.hidden_at := now();
    else
      new.hidden_by := null;
      new.hidden_at := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_announcement_comment_moderation_guard
  on public.announcement_comments;
create trigger trg_announcement_comment_moderation_guard
  before update on public.announcement_comments
  for each row execute function public.guard_announcement_comment_moderation();

-- ---------------------------------------------------------------------------
-- 3. Report RLS: active sessions only, with BDRRMO barangay isolation.
-- ---------------------------------------------------------------------------
drop policy if exists "Reports readable by authenticated" on public.reports;
create policy "Reports readable by authenticated"
  on public.reports for select to authenticated
  using (public.can_read_report(reports));

drop policy if exists "Residents create own reports" on public.reports;
create policy "Residents create own reports"
  on public.reports for insert to authenticated
  with check (
    public.has_active_profile()
    and reporter_id = auth.uid()
    and public.current_app_role() = 'resident'
  );

drop policy if exists "Reporters update own non-status fields" on public.reports;
create policy "Reporters update own non-status fields"
  on public.reports for update to authenticated
  using (
    public.has_active_profile()
    and reporter_id = auth.uid()
  )
  with check (
    public.has_active_profile()
    and reporter_id = auth.uid()
  );

drop policy if exists "Report media readable by authenticated" on public.report_media;
create policy "Report media readable by authenticated"
  on public.report_media for select to authenticated
  using (
    public.has_active_profile()
    and exists (
      select 1
      from public.reports report
      where report.id = report_media.report_id
        and public.can_read_report(report)
    )
  );

drop policy if exists "Upvotes readable by authenticated" on public.report_upvotes;
create policy "Upvotes readable by authenticated"
  on public.report_upvotes for select to authenticated
  using (
    public.has_active_profile()
    and exists (
      select 1
      from public.reports report
      where report.id = report_upvotes.report_id
        and public.can_read_report(report)
    )
  );

drop policy if exists "Users manage own upvote" on public.report_upvotes;
create policy "Users manage own upvote"
  on public.report_upvotes for all to authenticated
  using (
    public.has_active_profile()
    and user_id = auth.uid()
    and exists (
      select 1
      from public.reports report
      where report.id = report_upvotes.report_id
        and public.can_read_report(report)
    )
  )
  with check (
    public.has_active_profile()
    and user_id = auth.uid()
    and exists (
      select 1
      from public.reports report
      where report.id = report_upvotes.report_id
        and public.can_read_report(report)
    )
  );

drop policy if exists "Reporters manage own report media" on public.report_media;
create policy "Reporters manage own report media"
  on public.report_media for all to authenticated
  using (
    public.has_active_profile()
    and exists (
      select 1
      from public.reports report
      where report.id = report_media.report_id
        and report.reporter_id = auth.uid()
    )
  )
  with check (
    public.has_active_profile()
    and exists (
      select 1
      from public.reports report
      where report.id = report_media.report_id
        and report.reporter_id = auth.uid()
    )
  );

drop policy if exists "Report history readable by authenticated" on public.report_status_history;
create policy "Report history readable by authenticated"
  on public.report_status_history for select to authenticated
  using (
    public.has_active_profile()
    and exists (
      select 1
      from public.reports report
      where report.id = report_status_history.report_id
        and public.can_read_report(report)
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Resource and evacuation-center RLS: BDRRMO stays local.
-- ---------------------------------------------------------------------------
drop policy if exists "Hotlines readable by authenticated" on public.hotlines;
create policy "Hotlines readable by authenticated"
  on public.hotlines for select to authenticated
  using (public.can_read_scoped_resource(barangay_id));

drop policy if exists "Facilities readable by authenticated" on public.facilities;
create policy "Facilities readable by authenticated"
  on public.facilities for select to authenticated
  using (public.can_read_scoped_resource(barangay_id));

drop policy if exists "Evac centers readable by authenticated" on public.evacuation_centers;
create policy "Evac centers readable by authenticated"
  on public.evacuation_centers for select to authenticated
  using (public.can_read_evacuation_center(barangay_id));

drop policy if exists "Officers write hotlines" on public.hotlines;
create policy "Officers write hotlines"
  on public.hotlines for all to authenticated
  using (
    public.has_active_profile()
    and (
      public.is_admin()
      or public.is_mdrrmo()
      or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
    )
  )
  with check (
    public.has_active_profile()
    and (
      public.is_admin()
      or public.is_mdrrmo()
      or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
    )
  );

drop policy if exists "Officers write facilities" on public.facilities;
create policy "Officers write facilities"
  on public.facilities for all to authenticated
  using (
    public.has_active_profile()
    and (
      public.is_admin()
      or public.is_mdrrmo()
      or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
    )
  )
  with check (
    public.has_active_profile()
    and (
      public.is_admin()
      or public.is_mdrrmo()
      or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
    )
  );

drop policy if exists "Managers create evac centers" on public.evacuation_centers;
create policy "Managers create evac centers"
  on public.evacuation_centers for insert to authenticated
  with check (
    public.has_active_profile()
    and (public.is_admin() or public.is_mdrrmo())
  );

drop policy if exists "Managers delete evac centers" on public.evacuation_centers;
create policy "Managers delete evac centers"
  on public.evacuation_centers for delete to authenticated
  using (
    public.has_active_profile()
    and (public.is_admin() or public.is_mdrrmo())
  );

drop policy if exists "Scoped officials update evac centers" on public.evacuation_centers;
create policy "Scoped officials update evac centers"
  on public.evacuation_centers for update to authenticated
  using (
    public.has_active_profile()
    and (
      public.is_admin()
      or public.is_mdrrmo()
      or public.is_mayor()
      or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
    )
  )
  with check (
    public.has_active_profile()
    and (
      public.is_admin()
      or public.is_mdrrmo()
      or public.is_mayor()
      or (public.is_bdrrmo() and barangay_id = public.current_app_barangay_id())
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Announcement audience, media, and moderation boundaries.
-- ---------------------------------------------------------------------------
drop policy if exists "Announcements readable by authenticated" on public.announcements;
create policy "Announcements readable by authenticated"
  on public.announcements for select to authenticated
  using (public.can_read_announcement(announcements));

-- Announcement creation is intentionally service-role-only through the Edge
-- Function, which derives the author role, scope, and barangay server-side.
drop policy if exists "Officials author announcements" on public.announcements;

drop policy if exists "Authors and managers update announcements" on public.announcements;
create policy "Authors and managers update announcements"
  on public.announcements for update to authenticated
  using (
    public.has_active_profile()
    and (
      public.is_admin()
      or public.is_mayor()
      or (public.is_mdrrmo() and scope = 'municipal')
      or (
        public.is_bdrrmo()
        and scope = 'barangay'
        and barangay_id = public.current_app_barangay_id()
      )
    )
  )
  with check (
    public.has_active_profile()
    and (
      public.is_admin()
      or public.is_mayor()
      or (public.is_mdrrmo() and scope = 'municipal')
      or (
        public.is_bdrrmo()
        and scope = 'barangay'
        and barangay_id = public.current_app_barangay_id()
      )
    )
  );

drop policy if exists "Announcement media readable by authenticated" on public.announcement_media;
create policy "Announcement media readable by authenticated"
  on public.announcement_media for select to authenticated
  using (
    public.has_active_profile()
    and exists (
      select 1
      from public.announcements announcement
      where announcement.id = announcement_media.announcement_id
        and public.can_read_announcement(announcement)
    )
  );

drop policy if exists "Announcement upvotes readable by authenticated" on public.announcement_upvotes;
create policy "Announcement upvotes readable by authenticated"
  on public.announcement_upvotes for select to authenticated
  using (
    public.has_active_profile()
    and exists (
      select 1
      from public.announcements announcement
      where announcement.id = announcement_upvotes.announcement_id
        and public.can_read_announcement(announcement)
    )
  );

drop policy if exists "Users manage own announcement upvote" on public.announcement_upvotes;
create policy "Users manage own announcement upvote"
  on public.announcement_upvotes for all to authenticated
  using (
    public.has_active_profile()
    and user_id = auth.uid()
    and exists (
      select 1
      from public.announcements announcement
      where announcement.id = announcement_upvotes.announcement_id
        and public.can_read_announcement(announcement)
    )
  )
  with check (
    public.has_active_profile()
    and user_id = auth.uid()
    and exists (
      select 1
      from public.announcements announcement
      where announcement.id = announcement_upvotes.announcement_id
        and public.can_read_announcement(announcement)
    )
  );

drop policy if exists "Announcement comments readable by authenticated" on public.announcement_comments;
create policy "Announcement comments readable by authenticated"
  on public.announcement_comments for select to authenticated
  using (
    public.has_active_profile()
    and exists (
      select 1
      from public.announcements announcement
      where announcement.id = announcement_comments.announcement_id
        and public.can_read_announcement(announcement)
    )
    and (
      not is_hidden
      or public.can_moderate_announcement_comment(announcement_id)
    )
  );

drop policy if exists "Users create own announcement comments" on public.announcement_comments;
create policy "Users create own announcement comments"
  on public.announcement_comments for insert to authenticated
  with check (
    public.has_active_profile()
    and user_id = auth.uid()
    and exists (
      select 1
      from public.announcements announcement
      where announcement.id = announcement_comments.announcement_id
        and public.can_read_announcement(announcement)
    )
  );

drop policy if exists "Authors edit or officials moderate announcement comments" on public.announcement_comments;
create policy "Authors edit or officials moderate announcement comments"
  on public.announcement_comments for update to authenticated
  using (
    public.has_active_profile()
    and (
      user_id = auth.uid()
      or public.can_moderate_announcement_comment(announcement_id)
    )
  )
  with check (
    public.has_active_profile()
    and (
      user_id = auth.uid()
      or public.can_moderate_announcement_comment(announcement_id)
    )
  );

-- Existing report-comment policies also need the active-profile gate.
drop policy if exists "Visible comments or scoped moderation review" on public.comments;
drop policy if exists "Comments readable by authenticated" on public.comments;
create policy "Visible comments or scoped moderation review"
  on public.comments for select to authenticated
  using (
    public.has_active_profile()
    and exists (
      select 1
      from public.reports report
      where report.id = comments.report_id
        and public.can_read_report(report)
    )
    and (not is_hidden or public.can_moderate_report_comment(report_id))
  );

drop policy if exists "Users create own comments" on public.comments;
create policy "Users create own comments"
  on public.comments for insert to authenticated
  with check (
    public.has_active_profile()
    and user_id = auth.uid()
    and exists (
      select 1
      from public.reports report
      where report.id = comments.report_id
        and public.can_read_report(report)
    )
  );

drop policy if exists "Authors edit or officers moderate comments" on public.comments;
drop policy if exists "Authors edit or officials moderate comments" on public.comments;
create policy "Authors edit or officers moderate comments"
  on public.comments for update to authenticated
  using (
    public.has_active_profile()
    and exists (
      select 1
      from public.reports report
      where report.id = comments.report_id
        and public.can_read_report(report)
    )
    and (
      user_id = auth.uid()
      or public.can_moderate_report_comment(report_id)
    )
  )
  with check (
    public.has_active_profile()
    and exists (
      select 1
      from public.reports report
      where report.id = comments.report_id
        and public.can_read_report(report)
    )
    and (
      user_id = auth.uid()
      or public.can_moderate_report_comment(report_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Private storage follows the same active-profile and scope checks.
-- ---------------------------------------------------------------------------
drop policy if exists "report-media upload own folder" on storage.objects;
create policy "report-media upload own folder"
  on storage.objects for insert to authenticated
  with check (
    public.has_active_profile()
    and bucket_id = 'report-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "report-media read authenticated" on storage.objects;
create policy "report-media read authenticated"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'report-media'
    and public.has_active_profile()
    and (
      -- Storage returns the newly uploaded draft object to its owner.
      (storage.foldername(name))[1] = auth.uid()::text
      or public.can_read_report_media_path(name)
    )
  );

drop policy if exists "report-media update own" on storage.objects;
create policy "report-media update own"
  on storage.objects for update to authenticated
  using (
    public.has_active_profile()
    and bucket_id = 'report-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    public.has_active_profile()
    and bucket_id = 'report-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "report-media delete own or official" on storage.objects;
create policy "report-media delete own or official"
  on storage.objects for delete to authenticated
  using (
    public.has_active_profile()
    and bucket_id = 'report-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.can_delete_report_media_path(name)
    )
  );

drop policy if exists "Users upload own announcement media" on storage.objects;
create policy "Users upload own announcement media"
  on storage.objects for insert to authenticated
  with check (
    public.has_active_profile()
    and (public.is_officer() or public.is_mayor())
    and bucket_id = 'announcement-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update own announcement media" on storage.objects;
create policy "Users update own announcement media"
  on storage.objects for update to authenticated
  using (
    public.has_active_profile()
    and (public.is_officer() or public.is_mayor())
    and bucket_id = 'announcement-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    public.has_active_profile()
    and (public.is_officer() or public.is_mayor())
    and bucket_id = 'announcement-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own announcement media" on storage.objects;
create policy "Users delete own announcement media"
  on storage.objects for delete to authenticated
  using (
    public.has_active_profile()
    and (public.is_officer() or public.is_mayor())
    and bucket_id = 'announcement-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users read own or published announcement media" on storage.objects;
drop policy if exists "Authenticated users read published announcement media" on storage.objects;
create policy "Users read own or permitted announcement media"
  on storage.objects for select to authenticated
  using (
    public.has_active_profile()
    and bucket_id = 'announcement-media'
    and (
      (
        (public.is_officer() or public.is_mayor())
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      or public.can_read_announcement_media_path(name)
    )
  );
