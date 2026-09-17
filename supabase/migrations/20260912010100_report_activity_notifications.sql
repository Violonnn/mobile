-- Create in-app notifications directly in the durable per-user inbox. The
-- existing outbox remains available for a future push worker; report writes
-- never wait for an external network request.

create or replace function public.report_notification_title(p_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(trim(coalesce(p_title, '')), '') is null then 'your incident report'
    when char_length(trim(p_title)) <= 72 then '"' || trim(p_title) || '"'
    else '"' || left(trim(p_title), 69) || '..."'
  end;
$$;

revoke all on function public.report_notification_title(text)
  from public, anon, authenticated;
grant execute on function public.report_notification_title(text) to service_role;

create or replace function public.create_report_activity_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_type public.notification_type;
  v_title text;
  v_body text;
  v_report_title text;
begin
  v_actor := coalesce(
    nullif(current_setting('disasterlink.location_actor', true), '')::uuid,
    auth.uid(),
    case
      when new.status is distinct from old.status and new.status = 'resolved'
        then new.resolved_by
      when new.status is distinct from old.status and new.status = 'escalated'
        then new.escalated_by
      when new.status is distinct from old.status and new.status = 'verified'
        then coalesce(new.reverified_by, new.verified_by)
      else null
    end
  );

  -- Do not notify someone about their own edit.
  if v_actor is not null and v_actor = new.reporter_id then
    return new;
  end if;

  v_report_title := public.report_notification_title(new.title);

  if new.status is distinct from old.status then
    if new.status = 'verified' then
      v_type := 'report_verified';
      v_title := 'Report verified';
      v_body := 'Responders verified ' || v_report_title || '.';
    elsif new.status = 'escalated' then
      v_type := 'report_escalated';
      v_title := 'Report escalated';
      v_body := v_report_title || ' was escalated for municipal response.';
    elsif new.status = 'resolved' then
      v_type := 'report_resolved';
      v_title := 'Report resolved';
      v_body := 'Responders marked ' || v_report_title || ' as resolved.';
    else
      return new;
    end if;
  elsif new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.incident_type is distinct from old.incident_type
     or new.incident_type_other is distinct from old.incident_type_other
     or new.location is distinct from old.location
     or new.address_text is distinct from old.address_text
     or new.barangay_id is distinct from old.barangay_id then
    v_type := 'report_updated';
    v_title := 'Report details updated';
    v_body := 'An official updated ' || v_report_title || '.';
  else
    -- Counter/timestamp maintenance must not create notification noise.
    return new;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    title,
    body,
    related_entity_type,
    related_entity_id,
    sent_via,
    dedupe_key
  ) values (
    new.reporter_id,
    v_actor,
    v_type,
    v_title,
    v_body,
    'report',
    new.id,
    'none',
    'report-change:' || new.id::text || ':' || new.updated_at::text
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;

drop trigger if exists trg_reports_activity_notification on public.reports;
create trigger trg_reports_activity_notification
  after update on public.reports
  for each row execute function public.create_report_activity_notification();

create or replace function public.create_comment_activity_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reporter_id uuid;
  v_report_title text;
  v_parent_author_id uuid;
begin
  select report.reporter_id, public.report_notification_title(report.title)
    into v_reporter_id, v_report_title
  from public.reports report
  where report.id = new.report_id;

  if v_reporter_id is not null and v_reporter_id <> new.user_id then
    insert into public.notifications (
      user_id, actor_id, type, title, body, related_entity_type,
      related_entity_id, sent_via, dedupe_key
    ) values (
      v_reporter_id,
      new.user_id,
      'report_commented',
      'New comment on your report',
      'Someone commented on ' || v_report_title || '.',
      'report',
      new.report_id,
      'none',
      'report-comment:' || new.id::text || ':' || v_reporter_id::text
    )
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;

  if new.parent_comment_id is not null then
    select comment.user_id into v_parent_author_id
    from public.comments comment
    where comment.id = new.parent_comment_id;

    if v_parent_author_id is not null
       and v_parent_author_id <> new.user_id
       and v_parent_author_id is distinct from v_reporter_id then
      insert into public.notifications (
        user_id, actor_id, type, title, body, related_entity_type,
        related_entity_id, sent_via, dedupe_key
      ) values (
        v_parent_author_id,
        new.user_id,
        'report_commented',
        'New reply to your comment',
        'Someone replied in the discussion for ' || v_report_title || '.',
        'report',
        new.report_id,
        'none',
        'comment-reply:' || new.id::text || ':' || v_parent_author_id::text
      )
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_comments_activity_notification on public.comments;
create trigger trg_comments_activity_notification
  after insert on public.comments
  for each row execute function public.create_comment_activity_notifications();

create or replace function public.create_upvote_activity_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reporter_id uuid;
  v_report_title text;
begin
  select report.reporter_id, public.report_notification_title(report.title)
    into v_reporter_id, v_report_title
  from public.reports report
  where report.id = new.report_id;

  if v_reporter_id is null or v_reporter_id = new.user_id then
    return new;
  end if;

  insert into public.notifications (
    user_id, actor_id, type, title, body, related_entity_type,
    related_entity_id, sent_via, dedupe_key
  ) values (
    v_reporter_id,
    new.user_id,
    'report_upvoted',
    'Your report received support',
    'Someone supported ' || v_report_title || '.',
    'report',
    new.report_id,
    'none',
    'report-upvote:' || new.report_id::text || ':' || new.user_id::text
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;

drop trigger if exists trg_report_upvotes_activity_notification
  on public.report_upvotes;
create trigger trg_report_upvotes_activity_notification
  after insert on public.report_upvotes
  for each row execute function public.create_upvote_activity_notification();

-- Postgres Changes keeps the open inbox and unread badge current. RLS still
-- limits rows to notifications.user_id = auth.uid().
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

revoke all on function
  public.create_report_activity_notification(),
  public.create_comment_activity_notifications(),
  public.create_upvote_activity_notification()
from public, anon, authenticated;
