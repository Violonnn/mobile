-- A BDRRMO may escalate a report once. After MDRRMO re-verifies it, the
-- existing escalation stamp remains part of the audit trail and must prevent
-- a stale or malicious client from escalating the report a second time.

create or replace function public.guard_report_status_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- transition_report_status() is the only permitted status mutation path.
  if current_setting('disasterlink.report_transition', true) = '1' then
    if old.status = 'verified'
       and new.status = 'escalated'
       and old.escalated_at is not null then
      raise exception 'A reverified report cannot be escalated again.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status
     or new.verified_by is distinct from old.verified_by
     or new.verified_at is distinct from old.verified_at
     or new.reverified_by is distinct from old.reverified_by
     or new.reverified_at is distinct from old.reverified_at
     or new.escalated_by is distinct from old.escalated_by
     or new.escalated_at is distinct from old.escalated_at
     or new.escalated_to is distinct from old.escalated_to
     or new.resolved_by is distinct from old.resolved_by
     or new.resolved_at is distinct from old.resolved_at
  then
    raise exception 'Report status changes must use transition_report_status()'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
