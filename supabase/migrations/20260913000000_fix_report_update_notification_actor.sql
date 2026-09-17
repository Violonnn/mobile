-- Report creation uses a follow-up UPDATE to store incident classification and
-- GPS verification metadata. Because creation runs with the service role,
-- auth.uid() is null during that internal update. Only create an "official
-- updated" notification when the update has an identifiable actor.

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

  -- An actor-less write is internal system work, such as the metadata update
  -- that completes report creation. It must never be presented as an official edit.
  if v_actor is null then
    return new;
  end if;

  -- Do not notify someone about their own edit.
  if v_actor = new.reporter_id then
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
      v_body := 'Responders escalated ' || v_report_title ||
        ' for municipal response.';
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

revoke all on function public.create_report_activity_notification()
  from public, anon, authenticated;

-- Every actor-less report_updated row was generated with copy that falsely
-- attributes the internal write to an official, so remove those invalid rows.
delete from public.notifications
where type = 'report_updated'
  and actor_id is null;

-- Keep replies attached to a parent from the same report. Without this check,
-- a crafted insert could notify a parent author about an unrelated report.
create or replace function public.validate_report_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_report_id uuid;
begin
  if tg_op = 'INSERT' then
    new.body := trim(new.body);
  elsif new.body is distinct from old.body then
    new.body := trim(new.body);
  end if;

  if new.body is null or new.body = '' then
    raise exception 'Comment body is required.' using errcode = '22023';
  end if;

  if tg_op = 'INSERT'
     and auth.uid() is not null
     and (
       new.is_hidden
       or new.hidden_by is not null
       or new.hidden_at is not null
     ) then
    raise exception 'New comments cannot set moderation fields.'
      using errcode = '42501';
  end if;

  if new.parent_comment_id is null then
    return new;
  end if;

  select comment.report_id into v_parent_report_id
  from public.comments comment
  where comment.id = new.parent_comment_id;

  if v_parent_report_id is null then
    raise exception 'Parent comment not found.' using errcode = 'P0002';
  end if;

  if v_parent_report_id is distinct from new.report_id then
    raise exception 'Replies must belong to the same report as their parent comment.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_comments_validate on public.comments;
create trigger trg_comments_validate
  before insert or update on public.comments
  for each row execute function public.validate_report_comment();

-- Comment authors may edit only their text. Thread identity, ownership, and
-- moderation fields remain immutable outside the scoped moderation path.
create or replace function public.guard_comment_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.user_id = auth.uid() then
    if new.user_id is distinct from old.user_id
       or new.report_id is distinct from old.report_id
       or new.parent_comment_id is distinct from old.parent_comment_id
       or new.is_hidden is distinct from old.is_hidden
       or new.hidden_by is distinct from old.hidden_by
       or new.hidden_at is distinct from old.hidden_at then
      raise exception 'Comment authors may only edit the comment body.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if not public.can_moderate_report_comment(old.report_id) then
    raise exception 'Not permitted to moderate this comment.'
      using errcode = '42501';
  end if;

  if new.body is distinct from old.body
     or new.user_id is distinct from old.user_id
     or new.report_id is distinct from old.report_id
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

-- Hidden comments are not visible to ordinary recipients and must not alert them.
drop trigger if exists trg_comments_activity_notification on public.comments;
create trigger trg_comments_activity_notification
  after insert on public.comments
  for each row
  when (not new.is_hidden)
  execute function public.create_comment_activity_notifications();

revoke all on function
  public.validate_report_comment(),
  public.guard_comment_moderation()
from public, anon, authenticated;
