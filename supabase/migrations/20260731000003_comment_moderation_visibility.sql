-- Hidden comments are visible only to an official who is authorized to
-- moderate that report. Residents and Mayor accounts cannot query them.
drop policy if exists "Comments readable by authenticated" on public.comments;
create policy "Visible comments or scoped moderation review"
  on public.comments for select to authenticated
  using (
    not is_hidden
    or public.can_moderate_report_comment(report_id)
  );
