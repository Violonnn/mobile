-- Resident-authored report text remains the source of truth after submission.
-- Existing public rows are left untouched; subsequent publication actions use
-- source text and cannot replace it with an independently edited copy.

alter table public.report_public_posts
  drop constraint if exists report_public_posts_public_title_check,
  drop constraint if exists report_public_posts_public_description_check;

alter table public.report_public_posts
  add constraint report_public_posts_public_title_check
    check (length(btrim(public_title)) between 1 and 120),
  add constraint report_public_posts_public_description_check
    check (length(btrim(public_description)) between 1 and 2000);

create or replace function public.prevent_resident_report_source_edits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Protect both the text and the fields that identify its author and source.
  -- This also prevents a report from being reclassified into or out of the
  -- resident channel as part of a text-changing update.
  if (old.intake_channel = 'resident_app' or new.intake_channel = 'resident_app')
      and (new.title is distinct from old.title
        or new.description is distinct from old.description
        or new.intake_channel is distinct from old.intake_channel
        or new.reporter_id is distinct from old.reporter_id) then
    raise exception 'Resident report text and authorship cannot be changed after submission.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_resident_report_source_edits()
  from public, anon, authenticated, service_role;

drop trigger if exists prevent_resident_report_source_edits on public.reports;
drop trigger if exists zz_prevent_resident_report_source_edits on public.reports;
-- Run after earlier BEFORE triggers so any normalizations are also checked.
create trigger zz_prevent_resident_report_source_edits
  before update on public.reports
  for each row execute function public.prevent_resident_report_source_edits();

create or replace function public.set_report_public_post(
  p_report_id uuid,
  p_public_title text,
  p_public_description text,
  p_publish boolean,
  p_approve_reporter_name boolean default false,
  p_approve_reporter_avatar boolean default false,
  p_approve_exact_location boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_incident_case_id uuid;
  source_report public.reports;
  incident public.incident_cases;
  title_text text;
  description_text text;
  should_publish boolean := coalesce(p_publish, false);
begin
  -- Do not reveal whether a report or incident exists to non-officers.
  if not public.has_active_profile() or not public.is_officer() then
    raise exception 'An active officer must review report publications.' using errcode = '42501';
  end if;

  -- Read the case id first, then lock the case before the report. Recheck the
  -- relationship after both locks so a concurrent relink cannot publish under
  -- the wrong incident.
  select report.incident_case_id into target_incident_case_id
  from public.reports report where report.id = p_report_id;
  if not found then
    raise exception 'Report not found.' using errcode = 'P0002';
  end if;
  if target_incident_case_id is null then
    raise exception 'Link the report to an incident before publication.' using errcode = '22023';
  end if;

  select * into incident from public.incident_cases case_row
  where case_row.id = target_incident_case_id for update;
  if not found then
    raise exception 'Incident not found.' using errcode = 'P0002';
  end if;

  select * into source_report from public.reports report
  where report.id = p_report_id for update;
  if not found then
    raise exception 'Report not found.' using errcode = 'P0002';
  end if;
  if source_report.incident_case_id is distinct from target_incident_case_id then
    raise exception 'Report attachment changed during publication. Try again.' using errcode = '40001';
  end if;

  perform public.require_incident_lead(incident);
  if should_publish and (incident.verification <> 'confirmed'
      or incident.withdrawn_at is not null or incident.is_sensitive) then
    raise exception 'Only a confirmed, non-sensitive incident can have a public report.' using errcode = '22023';
  end if;

  if source_report.intake_channel = 'resident_app' then
    -- Always mirror resident source text, including when hiding. During
    -- publication only, reject an explicitly supplied different copy.
    if should_publish and p_public_title is not null
        and p_public_title is distinct from source_report.title then
      raise exception 'Resident public title must match the submitted report.' using errcode = '22023';
    end if;
    if should_publish and p_public_description is not null
        and p_public_description is distinct from source_report.description then
      raise exception 'Resident public description must match the submitted report.' using errcode = '22023';
    end if;
    title_text := source_report.title;
    description_text := source_report.description;
  elsif should_publish then
    -- Official-authored source edits remain available through their existing
    -- audited path. When no override is supplied, publish the current source.
    title_text := coalesce(
      public.report_flow_text(p_public_title, false, 120),
      public.report_flow_text(source_report.title, false, 120)
    );
    description_text := coalesce(
      public.report_flow_text(p_public_description, false, 2000),
      public.report_flow_text(source_report.description, false, 2000)
    );
  else
    -- Hiding must work even when old text differs from the current source.
    title_text := coalesce(
      public.report_flow_text(p_public_title, false, 120),
      public.report_flow_text(source_report.title, false, 120),
      'Hidden report'
    );
    description_text := coalesce(
      public.report_flow_text(p_public_description, false, 2000),
      public.report_flow_text(source_report.description, false, 2000),
      'Hidden report'
    );
  end if;

  if should_publish and (title_text is null or description_text is null) then
    raise exception 'Report source text is required before publication.' using errcode = '22023';
  end if;
  if should_publish and coalesce(p_approve_exact_location, false) and not exists (
    select 1 from public.report_publication_preferences preference
    where preference.report_id = p_report_id and preference.allow_exact_location
  ) then
    raise exception 'The reporter has not allowed exact-location publication.' using errcode = '22023';
  end if;

  insert into public.report_public_posts as existing_post(
      report_id, public_title, public_description, is_published,
      reporter_name_approved, reporter_avatar_approved, exact_location_approved,
      screened_by, published_at, updated_at)
    values (
      p_report_id,
      coalesce(title_text, 'Hidden report'),
      coalesce(description_text, 'Hidden report'),
      should_publish,
      should_publish and coalesce(p_approve_reporter_name, false)
        and exists(select 1 from public.report_publication_preferences preference
          where preference.report_id = p_report_id and preference.show_reporter_name),
      should_publish and coalesce(p_approve_reporter_avatar, false)
        and exists(select 1 from public.report_publication_preferences preference
          where preference.report_id = p_report_id and preference.show_reporter_avatar),
      should_publish and coalesce(p_approve_exact_location, false),
      auth.uid(), case when should_publish then now() end, now())
    on conflict (report_id) do update set
      public_title = case when should_publish then excluded.public_title else existing_post.public_title end,
      public_description = case when should_publish then excluded.public_description else existing_post.public_description end,
      is_published = excluded.is_published,
      reporter_name_approved = excluded.reporter_name_approved,
      reporter_avatar_approved = excluded.reporter_avatar_approved,
      exact_location_approved = excluded.exact_location_approved,
      screened_by = excluded.screened_by,
      published_at = excluded.published_at,
      updated_at = now();

  perform public.write_incident_event(incident.id, 'public_post_changed',
    jsonb_build_object('scope', 'resident_report', 'report_id', p_report_id,
      'published', should_publish,
      'approved_name', should_publish and coalesce(p_approve_reporter_name, false),
      'approved_avatar', should_publish and coalesce(p_approve_reporter_avatar, false),
      'approved_exact_location', should_publish and coalesce(p_approve_exact_location, false)));
end;
$$;
