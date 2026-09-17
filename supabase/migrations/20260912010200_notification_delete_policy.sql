-- Residents and officials may clean up only their own inbox rows. Restrict
-- updates to is_read so clients cannot rewrite notification content or actors.

drop policy if exists "Users delete own notifications"
  on public.notifications;
create policy "Users delete own notifications"
  on public.notifications
  for delete
  to authenticated
  using (user_id = auth.uid());

revoke update on table public.notifications from authenticated;
grant update (is_read) on table public.notifications to authenticated;
grant delete on table public.notifications to authenticated;
