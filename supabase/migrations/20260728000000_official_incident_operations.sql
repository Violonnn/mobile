-- =====================================================================
-- Official incident operations MVP:
--   - reverified_by / reverified_at for MDRRMO re-verification attribution
--   - transition_report_status RPC (role + scope + status gated)
--   - report_contact_access_logs + request_reporter_contact RPC
--   - Block direct client updates to status/attribution columns
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. MDRRMO re-verification attribution columns
-- ---------------------------------------------------------------------------
alter table public.reports
  add column if not exists reverified_by uuid references public.app_profiles (id),
  add column if not exists reverified_at timestamptz;

create index if not exists idx_reports_reverified_by
  on public.reports (reverified_by)
  where reverified_by is not null;

-- ---------------------------------------------------------------------------
-- 2. Contact access audit log (no phone stored; RLS on, no client policies)
-- ---------------------------------------------------------------------------
create table if not exists public.report_contact_access_logs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  official_id uuid not null references public.app_profiles (id),
  purpose text not null default 'verification_or_coordination'
    check (purpose = 'verification_or_coordination'),
  access_event text not null default 'contact_revealed'
    check (access_event = 'contact_revealed'),
  created_at timestamptz not null default now()
);

create index if not exists idx_report_contact_logs_report
  on public.report_contact_access_logs (report_id, created_at desc);

create index if not exists idx_report_contact_logs_official
  on public.report_contact_access_logs (official_id, created_at desc);

comment on table public.report_contact_access_logs is
  'Audit trail for protected reporter-contact reveals. Phone numbers are never stored here.';

alter table public.report_contact_access_logs enable row level security;

-- No authenticated policies on purpose: inserts happen only inside the RPC
-- (security definer). Back-office / DPO review uses service_role.
revoke all on public.report_contact_access_logs from anon, authenticated;
grant select, insert, update, delete on public.report_contact_access_logs to service_role;

-- ---------------------------------------------------------------------------
-- 3. Guard: status/attribution fields only change via transition RPC
-- ---------------------------------------------------------------------------
create or replace function public.guard_report_status_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- RPC sets disasterlink.report_transition = '1' for the transaction.
  if current_setting('disasterlink.report_transition', true) = '1' then
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

drop trigger if exists trg_reports_guard_status on public.reports;
create trigger trg_reports_guard_status
  before update on public.reports
  for each row execute function public.guard_report_status_columns();

-- History trigger: attach optional transition note from session GUC.
create or replace function public.log_report_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text;
begin
  if tg_op = 'INSERT' then
    insert into public.report_status_history
      (report_id, event_type, from_status, to_status, changed_by)
    values
      (new.id, 'status_change', null, new.status, new.reporter_id);
    return new;
  end if;

  if new.status is distinct from old.status then
    v_note := nullif(
      trim(current_setting('disasterlink.transition_note', true)),
      ''
    );

    insert into public.report_status_history
      (report_id, event_type, from_status, to_status, changed_by, note)
    values
      (new.id, 'status_change', old.status, new.status, auth.uid(), v_note);
  end if;

  if new.barangay_id is distinct from old.barangay_id then
    insert into public.report_status_history
      (report_id, event_type, changed_by, detail)
    values
      (new.id, 'barangay_change', auth.uid(),
       jsonb_build_object('from', old.barangay_id, 'to', new.barangay_id));
  end if;

  return new;
end;
$$;

-- Tighten direct UPDATEs: officials no longer update via table policy.
-- Reporters may still update their own non-status fields (guard enforces).
-- Municipality managers / BDRRMO status work goes through the RPC only.
drop policy if exists "Reporters and scoped officials update reports" on public.reports;
create policy "Reporters update own non-status fields"
  on public.reports
  for update
  to authenticated
  using (reporter_id = auth.uid())
  with check (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Display mask for PH mobiles (matches client maskInvitePhone)
-- ---------------------------------------------------------------------------
create or replace function public.mask_ph_mobile_display(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_normalized text;
  v_digits text;
  v_local text;
begin
  v_normalized := public.normalize_ph_mobile(p_phone);
  if v_normalized is null then
    return null;
  end if;

  v_digits := regexp_replace(v_normalized, '\D', '', 'g');
  -- Expect 639XXXXXXXXX
  if length(v_digits) <> 12 or left(v_digits, 2) <> '63' then
    return '••••••••••';
  end if;

  v_local := substring(v_digits from 3);
  return '+63 ' || left(v_local, 3) || ' *** **' || right(v_local, 2);
end;
$$;

revoke all on function public.mask_ph_mobile_display(text) from public;
grant execute on function public.mask_ph_mobile_display(text)
  to authenticated, service_role;

-- Resolve reporter phone without exposing it to clients.
-- Residents store phone on profiles; officials may have app_profiles.phone_number.
create or replace function public.reporter_phone_for_contact(p_reporter_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_phone text;
begin
  select public.normalize_ph_mobile(p.phone)
    into v_phone
    from public.profiles p
   where p.id = p_reporter_id;

  if v_phone is not null then
    return v_phone;
  end if;

  select public.normalize_ph_mobile(ap.phone_number)
    into v_phone
    from public.app_profiles ap
   where ap.id = p_reporter_id;

  return v_phone;
end;
$$;

revoke all on function public.reporter_phone_for_contact(uuid) from public;
-- Internal helper only — not granted to authenticated/anon.

-- Shared authorization for protected reporter contact.
create or replace function public.can_request_reporter_contact(p_report public.reports)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Mayor never gets contact access.
  if public.is_mayor() then
    return false;
  end if;

  if public.is_bdrrmo() then
    if p_report.barangay_id is distinct from public.current_app_barangay_id() then
      return false;
    end if;
    -- Unverified, or verified that has not been escalated.
    if p_report.status = 'unverified' then
      return true;
    end if;
    if p_report.status = 'verified' and p_report.escalated_at is null then
      return true;
    end if;
    return false;
  end if;

  if public.is_mdrrmo() then
    if p_report.status = 'escalated' then
      return true;
    end if;
    -- Re-verified by MDRRMO and not yet resolved.
    if p_report.status = 'verified'
       and p_report.reverified_at is not null
       and p_report.resolved_at is null
    then
      return true;
    end if;
    return false;
  end if;

  return false;
end;
$$;

revoke all on function public.can_request_reporter_contact(public.reports) from public;

-- ---------------------------------------------------------------------------
-- 5. transition_report_status
-- ---------------------------------------------------------------------------
create or replace function public.transition_report_status(
  p_report_id uuid,
  p_target_status public.report_status,
  p_note text default null
)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
  v_note text;
  v_allowed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_report_id is null then
    raise exception 'Invalid report id' using errcode = '22023';
  end if;

  -- Cap notes at 500 characters after trim.
  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Note must be 500 characters or fewer' using errcode = '22023';
  end if;

  -- Lock the row for the transition decision.
  select * into v_report
    from public.reports
   where id = p_report_id
   for update;

  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  -- Role / scope / current-status matrix.
  if public.is_bdrrmo() then
    if v_report.barangay_id is distinct from public.current_app_barangay_id() then
      raise exception 'Not authorized for this report' using errcode = '42501';
    end if;

    if v_report.status = 'unverified' and p_target_status = 'verified' then
      v_allowed := true;
    elsif v_report.status = 'verified'
          and p_target_status = 'resolved'
          and v_report.escalated_at is null
    then
      v_allowed := true;
    elsif v_report.status = 'verified' and p_target_status = 'escalated' then
      v_allowed := true;
    end if;

  elsif public.is_mdrrmo() then
    if v_report.status = 'escalated' and p_target_status = 'verified' then
      v_allowed := true;
    elsif v_report.status = 'verified'
          and p_target_status = 'resolved'
          and v_report.escalated_at is not null
          and v_report.reverified_at is not null
    then
      v_allowed := true;
    end if;

  elsif public.is_mayor() then
    raise exception 'Mayor accounts cannot change report status' using errcode = '42501';
  else
    raise exception 'Not authorized for this report' using errcode = '42501';
  end if;

  if not v_allowed then
    raise exception 'This status transition is not allowed' using errcode = '42501';
  end if;

  -- Mark this update as an authorized RPC transition (for guard + history note).
  perform set_config('disasterlink.report_transition', '1', true);
  perform set_config(
    'disasterlink.transition_note',
    coalesce(v_note, ''),
    true
  );

  if public.is_bdrrmo() and v_report.status = 'unverified' and p_target_status = 'verified' then
    update public.reports
       set status = 'verified',
           verified_by = auth.uid(),
           verified_at = now()
     where id = p_report_id
     returning * into v_report;

  elsif public.is_bdrrmo() and v_report.status = 'verified' and p_target_status = 'resolved' then
    update public.reports
       set status = 'resolved',
           resolved_by = auth.uid(),
           resolved_at = now()
     where id = p_report_id
     returning * into v_report;

  elsif public.is_bdrrmo() and v_report.status = 'verified' and p_target_status = 'escalated' then
    update public.reports
       set status = 'escalated',
           escalated_by = auth.uid(),
           escalated_at = now(),
           escalated_to = 'mdrrmo'
     where id = p_report_id
     returning * into v_report;

  elsif public.is_mdrrmo() and v_report.status = 'escalated' and p_target_status = 'verified' then
    update public.reports
       set status = 'verified',
           reverified_by = auth.uid(),
           reverified_at = now()
     where id = p_report_id
     returning * into v_report;

  elsif public.is_mdrrmo() and v_report.status = 'verified' and p_target_status = 'resolved' then
    update public.reports
       set status = 'resolved',
           resolved_by = auth.uid(),
           resolved_at = now()
     where id = p_report_id
     returning * into v_report;

  else
    raise exception 'This status transition is not allowed' using errcode = '42501';
  end if;

  return v_report;
end;
$$;

revoke all on function public.transition_report_status(uuid, public.report_status, text)
  from public, anon;
grant execute on function public.transition_report_status(uuid, public.report_status, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Masked contact preview (no audit row) + full contact reveal (audited)
-- ---------------------------------------------------------------------------
create or replace function public.preview_reporter_contact(p_report_id uuid)
returns table (
  can_contact boolean,
  masked_phone text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
  v_phone text;
  v_allowed boolean;
begin
  if auth.uid() is null then
    return query select false, null::text;
    return;
  end if;

  select * into v_report
    from public.reports
   where id = p_report_id;

  if not found then
    return query select false, null::text;
    return;
  end if;

  v_allowed := public.can_request_reporter_contact(v_report);
  if not v_allowed then
    return query select false, null::text;
    return;
  end if;

  -- Role/status allows contact; mask may be null when no usable number exists.
  v_phone := public.reporter_phone_for_contact(v_report.reporter_id);
  return query select true, public.mask_ph_mobile_display(v_phone);
end;
$$;

revoke all on function public.preview_reporter_contact(uuid) from public, anon;
grant execute on function public.preview_reporter_contact(uuid)
  to authenticated, service_role;

create or replace function public.request_reporter_contact(p_report_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
  v_phone text;
  -- One generic message for unauthorized / unavailable cases.
  c_generic constant text := 'Reporter contact is unavailable.';
begin
  if auth.uid() is null then
    raise exception '%', c_generic using errcode = '42501';
  end if;

  if p_report_id is null then
    raise exception '%', c_generic using errcode = '22023';
  end if;

  select * into v_report
    from public.reports
   where id = p_report_id
   for update;

  if not found then
    raise exception '%', c_generic using errcode = 'P0002';
  end if;

  if not public.can_request_reporter_contact(v_report) then
    raise exception '%', c_generic using errcode = '42501';
  end if;

  v_phone := public.reporter_phone_for_contact(v_report.reporter_id);
  if v_phone is null then
    raise exception '%', c_generic using errcode = 'P0002';
  end if;

  -- Audit before returning the number (never store the phone in the log).
  insert into public.report_contact_access_logs (
    report_id, official_id, purpose, access_event
  ) values (
    p_report_id,
    auth.uid(),
    'verification_or_coordination',
    'contact_revealed'
  );

  return v_phone;
end;
$$;

revoke all on function public.request_reporter_contact(uuid) from public, anon;
grant execute on function public.request_reporter_contact(uuid)
  to authenticated, service_role;
