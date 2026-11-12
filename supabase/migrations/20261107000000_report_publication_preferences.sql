-- Screened public posts belong to individual resident reports. Identity and
-- exact-location choices are independent and default to private for all rows.
create table public.report_publication_preferences (
  report_id uuid primary key references public.reports(id) on delete cascade,
  show_reporter_name boolean not null default false,
  show_reporter_avatar boolean not null default false,
  allow_exact_location boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.report_publication_preferences enable row level security;
revoke all on public.report_publication_preferences from public, anon, authenticated;

create table public.report_public_posts (
  report_id uuid primary key references public.reports(id) on delete cascade,
  public_title text not null check (length(btrim(public_title)) between 1 and 80),
  public_description text not null check (length(btrim(public_description)) between 1 and 500),
  is_published boolean not null default false,
  reporter_name_approved boolean not null default false,
  reporter_avatar_approved boolean not null default false,
  exact_location_approved boolean not null default false,
  screened_by uuid references public.app_profiles(id),
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.report_public_posts enable row level security;
revoke all on public.report_public_posts from public, anon, authenticated;

-- Create private defaults for existing and future reports without widening the
-- direct report table policies or exposing preferences in report projections.
insert into public.report_publication_preferences(report_id)
  select id from public.reports on conflict (report_id) do nothing;
create function public.initialize_report_publication_preferences()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.report_publication_preferences(report_id) values (new.id)
    on conflict (report_id) do nothing;
  return new;
end;
$$;
create trigger initialize_report_publication_preferences after insert on public.reports
  for each row execute function public.initialize_report_publication_preferences();

-- The Edge Function creates report, media, routing and the resident's choices
-- in one transaction. A repeated offline submission returns the existing report
-- without replacing preferences the owner may have edited since submission.
create function public.create_report_with_publication_preferences(
  p_reporter_id uuid, p_report_id uuid, p_title text, p_description text,
  p_latitude double precision, p_longitude double precision, p_address_text text, p_media jsonb,
  p_barangay_id uuid, p_incident_type text, p_incident_type_other text,
  p_device_latitude double precision, p_device_longitude double precision,
  p_gps_accuracy_meters double precision, p_jurisdiction_status public.report_jurisdiction_status,
  p_show_reporter_name boolean, p_show_reporter_avatar boolean, p_allow_exact_location boolean
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare created_id uuid; existing_reporter_id uuid;
begin
  if p_show_reporter_name is null or p_show_reporter_avatar is null or p_allow_exact_location is null then
    raise exception 'Choose every publication preference explicitly.' using errcode = '22023';
  end if;
  if p_reporter_id is null then
    raise exception 'Reporter is required.' using errcode = '22023';
  end if;
  if p_report_id is not null then
    -- Serialize retries of the same client-generated report id.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_report_id::text, 0));
    select reporter_id into existing_reporter_id from public.reports where id = p_report_id;
    if found then
      if existing_reporter_id <> p_reporter_id then
        raise exception 'Report id is already in use.' using errcode = '23505';
      end if;
      return p_report_id;
    end if;
  end if;

  created_id := public.create_report_with_media(p_reporter_id, p_report_id, p_title, p_description,
    p_latitude, p_longitude, p_address_text, p_media, p_barangay_id, p_incident_type,
    p_incident_type_other, p_device_latitude, p_device_longitude, p_gps_accuracy_meters,
    p_jurisdiction_status);
  update public.report_publication_preferences set
    show_reporter_name = p_show_reporter_name,
    show_reporter_avatar = p_show_reporter_avatar,
    allow_exact_location = p_allow_exact_location,
    updated_at = now()
  where report_id = created_id;
  if not found then
    raise exception 'Could not save publication preferences.' using errcode = 'P0002';
  end if;
  return created_id;
end;
$$;
revoke all on function public.create_report_with_publication_preferences(uuid,uuid,text,text,
  double precision,double precision,text,jsonb,uuid,text,text,double precision,double precision,
  double precision,public.report_jurisdiction_status,boolean,boolean,boolean)
  from public, anon, authenticated;
grant execute on function public.create_report_with_publication_preferences(uuid,uuid,text,text,
  double precision,double precision,text,jsonb,uuid,text,text,double precision,double precision,
  double precision,public.report_jurisdiction_status,boolean,boolean,boolean)
  to service_role;

-- A report linked to another case, or a case newly marked sensitive/withdrawn,
-- needs a fresh review before any of its individual posts can appear again.
create function public.invalidate_report_public_posts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'reports' then
    if new.incident_case_id is distinct from old.incident_case_id then
      update public.report_public_posts set is_published = false, reporter_name_approved = false,
        reporter_avatar_approved = false, exact_location_approved = false, updated_at = now()
      where report_id = new.id;
    end if;
    return new;
  end if;
  if (new.is_sensitive and not old.is_sensitive)
      or (new.withdrawn_at is not null and old.withdrawn_at is null) then
    update public.report_public_posts post set is_published = false, reporter_name_approved = false,
      reporter_avatar_approved = false, exact_location_approved = false, updated_at = now()
    from public.reports report where report.incident_case_id = new.id and post.report_id = report.id;
  end if;
  return new;
end;
$$;
create trigger invalidate_report_public_post_on_relink after update of incident_case_id on public.reports
  for each row execute function public.invalidate_report_public_posts();
create trigger invalidate_report_public_posts_on_incident_protection after update of is_sensitive, withdrawn_at
  on public.incident_cases for each row execute function public.invalidate_report_public_posts();

-- A lead's identity approval applies to the content they actually reviewed.
-- Changing the account name or profile picture requires another review before
-- that changed identity can appear in an already published report.
create function public.invalidate_report_identity_approvals()
returns trigger language plpgsql security definer set search_path = '' as $$
declare name_changed boolean;
begin
  name_changed := new.first_name is distinct from old.first_name
    or new.middle_name is distinct from old.middle_name
    or new.last_name is distinct from old.last_name;
  if not name_changed and (new.avatar_path is not distinct from old.avatar_path) then
    return new;
  end if;
  update public.report_public_posts post set
    reporter_name_approved = reporter_name_approved and not name_changed,
    reporter_avatar_approved = reporter_avatar_approved
      and (new.avatar_path is not distinct from old.avatar_path),
    updated_at = now()
  from public.reports report
  where report.id = post.report_id and report.reporter_id = new.id
    and ((name_changed and post.reporter_name_approved)
      or (new.avatar_path is distinct from old.avatar_path and post.reporter_avatar_approved));
  return new;
end;
$$;
create trigger invalidate_report_identity_approvals after update of first_name, middle_name,
  last_name, avatar_path on public.app_profiles for each row
  execute function public.invalidate_report_identity_approvals();

create function public.set_report_publication_preferences(
  p_report_id uuid, p_show_reporter_name boolean, p_show_reporter_avatar boolean,
  p_allow_exact_location boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare report public.reports;
begin
  if p_show_reporter_name is null or p_show_reporter_avatar is null or p_allow_exact_location is null then
    raise exception 'Choose every publication preference explicitly.' using errcode = '22023';
  end if;
  if not public.has_active_profile() then raise exception 'Report not found.' using errcode = '42501'; end if;
  select * into report from public.reports where id = p_report_id and reporter_id = auth.uid() for update;
  if not found then raise exception 'Report not found.' using errcode = '42501'; end if;
  insert into public.report_publication_preferences(report_id, show_reporter_name,
      show_reporter_avatar, allow_exact_location, updated_at)
    values (p_report_id, coalesce(p_show_reporter_name, false),
      coalesce(p_show_reporter_avatar, false), coalesce(p_allow_exact_location, false), now())
    on conflict (report_id) do update set
      show_reporter_name = excluded.show_reporter_name,
      show_reporter_avatar = excluded.show_reporter_avatar,
      allow_exact_location = excluded.allow_exact_location, updated_at = now();
  -- Revoking a preference also clears its reviewer approval. Turning it back on
  -- later requires the lead office to review and publish the disclosure again.
  update public.report_public_posts set
    reporter_name_approved = reporter_name_approved and p_show_reporter_name,
    reporter_avatar_approved = reporter_avatar_approved and p_show_reporter_avatar,
    exact_location_approved = exact_location_approved and p_allow_exact_location,
    updated_at = now()
  where report_id = p_report_id and (
    (reporter_name_approved and not p_show_reporter_name)
    or (reporter_avatar_approved and not p_show_reporter_avatar)
    or (exact_location_approved and not p_allow_exact_location));
  if report.incident_case_id is not null then
    perform public.write_incident_event(report.incident_case_id, 'public_post_changed',
      jsonb_build_object('scope', 'report_preferences', 'report_id', p_report_id,
        'show_reporter_name', p_show_reporter_name, 'show_reporter_avatar', p_show_reporter_avatar,
        'allow_exact_location', p_allow_exact_location));
  end if;
end;
$$;

create function public.get_report_publication_preferences(p_report_id uuid)
returns table(show_reporter_name boolean, show_reporter_avatar boolean,
  allow_exact_location boolean, has_public_post boolean, exact_location_approved boolean)
language sql stable security definer set search_path = '' as $$
  select preference.show_reporter_name, preference.show_reporter_avatar,
    preference.allow_exact_location, coalesce(post.is_published, false),
    coalesce(post.exact_location_approved, false)
  from public.reports report
  left join public.report_publication_preferences preference on preference.report_id = report.id
  left join public.report_public_posts post on post.report_id = report.id
  where report.id = p_report_id and report.reporter_id = auth.uid()
    and public.has_active_profile();
$$;

create function public.get_report_publication_review(p_report_id uuid)
returns table(report_id uuid, incident_case_id uuid, source_title text, source_description text,
  reporter_name text, reporter_avatar_path text,
  source_latitude double precision, source_longitude double precision,
  show_reporter_name boolean, show_reporter_avatar boolean, allow_exact_location boolean,
  is_published boolean, public_title text, public_description text,
  reporter_name_approved boolean, reporter_avatar_approved boolean, exact_location_approved boolean)
language plpgsql stable security definer set search_path = '' as $$
declare source_report public.reports; incident public.incident_cases;
begin
  select * into source_report from public.reports where id = p_report_id;
  if not found or source_report.incident_case_id is null then return; end if;
  select * into incident from public.incident_cases where id = source_report.incident_case_id;
  perform public.require_incident_lead(incident);
  return query select source_report.id, source_report.incident_case_id, source_report.title, source_report.description,
    nullif(concat_ws(' ', profile.first_name, nullif(profile.middle_name, ''), profile.last_name), ''),
    profile.avatar_path,
    extensions.st_y(source_report.location::extensions.geometry),
    extensions.st_x(source_report.location::extensions.geometry),
    coalesce(preference.show_reporter_name, false), coalesce(preference.show_reporter_avatar, false),
    coalesce(preference.allow_exact_location, false), coalesce(post.is_published, false),
    post.public_title, post.public_description, coalesce(post.reporter_name_approved, false),
    coalesce(post.reporter_avatar_approved, false), coalesce(post.exact_location_approved, false)
  from (select 1) singleton
  left join public.app_profiles profile on profile.id = source_report.reporter_id
  left join public.report_publication_preferences preference on preference.report_id = source_report.id
  left join public.report_public_posts post on post.report_id = source_report.id;
end;
$$;

create function public.set_report_public_post(p_report_id uuid, p_public_title text,
  p_public_description text, p_publish boolean, p_approve_reporter_name boolean default false,
  p_approve_reporter_avatar boolean default false, p_approve_exact_location boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare source_report public.reports; incident public.incident_cases;
  title_text text := public.report_flow_text(p_public_title, false, 80);
  description_text text := public.report_flow_text(p_public_description, false, 500);
begin
  select * into source_report from public.reports where id = p_report_id for update;
  if not found then raise exception 'Report not found.' using errcode = 'P0002'; end if;
  if source_report.incident_case_id is null then
    raise exception 'Link the report to an incident before publication.' using errcode = '22023';
  end if;
  select * into incident from public.incident_cases where id = source_report.incident_case_id for update;
  perform public.require_incident_lead(incident);
  if coalesce(p_publish, false) and (incident.verification <> 'confirmed'
      or incident.withdrawn_at is not null or incident.is_sensitive) then
    raise exception 'Only a confirmed, non-sensitive incident can have a public report.' using errcode = '22023';
  end if;
  if coalesce(p_publish, false) and (title_text is null or description_text is null) then
    raise exception 'Add a screened title and description before publishing.' using errcode = '22023';
  end if;
  if coalesce(p_approve_exact_location, false) and not exists (
    select 1 from public.report_publication_preferences preference
    where preference.report_id = p_report_id and preference.allow_exact_location
  ) then raise exception 'The reporter has not allowed exact-location publication.' using errcode = '22023'; end if;
  insert into public.report_public_posts(report_id, public_title, public_description,
      is_published, reporter_name_approved, reporter_avatar_approved, exact_location_approved,
      screened_by, published_at, updated_at)
    values (p_report_id, coalesce(title_text, 'Hidden report'), coalesce(description_text, 'Hidden report'),
      coalesce(p_publish, false), coalesce(p_publish, false) and coalesce(p_approve_reporter_name, false)
        and exists(select 1 from public.report_publication_preferences preference
          where preference.report_id = p_report_id and preference.show_reporter_name),
      coalesce(p_publish, false) and coalesce(p_approve_reporter_avatar, false)
        and exists(select 1 from public.report_publication_preferences preference
          where preference.report_id = p_report_id and preference.show_reporter_avatar),
      coalesce(p_publish, false) and coalesce(p_approve_exact_location, false),
      auth.uid(), case when coalesce(p_publish, false) then now() end, now())
    on conflict (report_id) do update set
      public_title = excluded.public_title, public_description = excluded.public_description,
      is_published = excluded.is_published,
      reporter_name_approved = excluded.reporter_name_approved,
      reporter_avatar_approved = excluded.reporter_avatar_approved,
      exact_location_approved = excluded.exact_location_approved,
      screened_by = excluded.screened_by, published_at = excluded.published_at, updated_at = now();
  perform public.write_incident_event(incident.id, 'public_post_changed',
    jsonb_build_object('scope', 'resident_report', 'report_id', p_report_id,
      'published', coalesce(p_publish, false),
      'approved_name', coalesce(p_publish, false) and coalesce(p_approve_reporter_name, false),
      'approved_avatar', coalesce(p_publish, false) and coalesce(p_approve_reporter_avatar, false),
      'approved_exact_location', coalesce(p_publish, false) and coalesce(p_approve_exact_location, false)));
end;
$$;

-- The public projection is assembled field by field. Never return source text,
-- report UUID ownership, exact coordinates, or identity without current consent.
create function public.public_report_record(p_report_id uuid)
returns table(report_id uuid, incident_case_id uuid, public_title text, public_description text,
  incident_type text, public_type_label text, barangay_name text, public_location_mode text,
  approx_latitude double precision, approx_longitude double precision,
  exact_latitude double precision, exact_longitude double precision,
  reporter_name text, reporter_avatar_path text, created_at timestamptz,
  public_status text, confirmed_at timestamptz, latest_public_update_at timestamptz,
  latest_public_update text, public_summary text, public_correction text,
  support_count integer, comment_count integer, has_supported boolean)
language sql stable security definer set search_path = '' as $$
  select report.id, incident.id, post.public_title, post.public_description,
    report.incident_type,
    coalesce(incident.public_type_label, case report.incident_type when 'other' then 'Other incident'
      when 'fire' then 'Fire' when 'flood' then 'Flood' when 'road_crash' then 'Road crash'
      when 'medical' then 'Medical emergency' else 'Incident' end),
    coalesce(barangay.name, 'Municipality'),
    case when preference.allow_exact_location and post.exact_location_approved
      and incident.public_location_mode <> 'barangay_only'
      then 'exact_shared'
      when incident.public_location_mode in ('approximate_area','exact_for_safety') then 'approximate_area'
      else 'barangay_only' end,
    case when not (preference.allow_exact_location and post.exact_location_approved)
      and incident.public_location_mode in ('approximate_area','exact_for_safety')
      then round(extensions.st_y(report.location::extensions.geometry)::numeric, 2)::double precision end,
    case when not (preference.allow_exact_location and post.exact_location_approved)
      and incident.public_location_mode in ('approximate_area','exact_for_safety')
      then round(extensions.st_x(report.location::extensions.geometry)::numeric, 2)::double precision end,
    case when preference.allow_exact_location and post.exact_location_approved
      and incident.public_location_mode <> 'barangay_only'
      then extensions.st_y(report.location::extensions.geometry) end,
    case when preference.allow_exact_location and post.exact_location_approved
      and incident.public_location_mode <> 'barangay_only'
      then extensions.st_x(report.location::extensions.geometry) end,
    case when preference.show_reporter_name and post.reporter_name_approved then nullif(concat_ws(' ', profile.first_name,
      nullif(profile.middle_name, ''), profile.last_name), '') end,
    case when preference.show_reporter_avatar and post.reporter_avatar_approved then profile.avatar_path end,
    report.created_at,
    case when incident.state = 'resolved' then 'resolved'
      when public.incident_has_current_response(incident.id) then 'response_ongoing' else 'confirmed' end,
    incident.confirmed_at, latest.occurred_at, latest.public_text,
    incident.public_summary, incident.public_correction,
    (select count(*)::integer from public.incident_upvotes vote where vote.incident_case_id = incident.id),
    (select count(*)::integer from public.incident_comments comment
      where comment.incident_case_id = incident.id and not comment.is_hidden),
    exists(select 1 from public.incident_upvotes vote
      where vote.incident_case_id = incident.id and vote.user_id = auth.uid())
  from public.reports report
  join public.report_public_posts post on post.report_id = report.id and post.is_published
  join public.report_publication_preferences preference on preference.report_id = report.id
  join public.incident_cases incident on incident.id = report.incident_case_id
  left join public.barangays barangay on barangay.id = report.barangay_id
  left join public.app_profiles profile on profile.id = report.reporter_id
  left join lateral (select event.occurred_at,
    coalesce(event.details->>'public_text', event.details->>'text') as public_text
    from public.incident_events event where event.incident_case_id = incident.id and event.is_public
      and event.event_type in ('progress_update','resolved','summary_added')
    order by event.occurred_at desc, event.id desc limit 1) latest on true
  where report.id = p_report_id and public.has_active_profile()
    and incident.verification = 'confirmed' and incident.withdrawn_at is null
    and not incident.is_sensitive;
$$;

create function public.list_public_reports(p_barangay_id uuid default null,
  p_limit integer default 50, p_offset integer default 0)
returns table(report_id uuid, incident_case_id uuid, public_title text, public_description text,
  incident_type text, public_type_label text, barangay_name text, public_location_mode text,
  approx_latitude double precision, approx_longitude double precision,
  exact_latitude double precision, exact_longitude double precision,
  reporter_name text, reporter_avatar_path text, created_at timestamptz,
  public_status text, confirmed_at timestamptz, latest_public_update_at timestamptz,
  latest_public_update text, public_summary text, public_correction text,
  support_count integer, comment_count integer, has_supported boolean)
language sql stable security definer set search_path = '' as $$
  select record.* from public.reports source
  cross join lateral public.public_report_record(source.id) record
  where (p_barangay_id is null or source.barangay_id = p_barangay_id)
  order by coalesce(record.latest_public_update_at, record.confirmed_at, record.created_at) desc, record.report_id
  limit greatest(1, least(coalesce(p_limit,50),100)) offset greatest(0,coalesce(p_offset,0));
$$;

create function public.get_public_report(p_report_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('report', to_jsonb(record), 'updates', coalesce((
    select jsonb_agg(jsonb_build_object('occurred_at', event.occurred_at, 'entry_type', event.event_type,
      'public_text', coalesce(event.details->>'public_text', event.details->>'text')) order by event.occurred_at, event.id)
    from public.incident_events event where event.incident_case_id = record.incident_case_id and event.is_public
      and event.event_type in ('progress_update','resolved','summary_added')
  ), '[]'::jsonb)) from public.public_report_record(p_report_id) record;
$$;

-- Page report posts and still-public legacy incident posts together. Filtering
-- legacy posts before pagination keeps page sizes and ordering predictable.
create function public.list_public_community_posts(p_barangay_id uuid default null,
  p_limit integer default 50, p_offset integer default 0)
returns table(post_kind text, report_id uuid, incident_case_id uuid, post_data jsonb)
language sql stable security definer set search_path = '' as $$
  with visible_posts as (
    select 'report'::text as post_kind, record.report_id, record.incident_case_id,
      to_jsonb(record) as post_data,
      coalesce(record.latest_public_update_at, record.confirmed_at, record.created_at) as sort_at
    from public.reports source
    cross join lateral public.public_report_record(source.id) record
    where p_barangay_id is null or source.barangay_id = p_barangay_id
    union all
    select 'incident'::text, null::uuid, record.incident_case_id,
      to_jsonb(record),
      coalesce(record.last_public_update_at, record.confirmed_at, incident.created_at)
    from public.incident_cases incident
    cross join lateral public.public_incident_record(incident.id) record
    where (p_barangay_id is null or incident.barangay_id = p_barangay_id)
      and (incident.withdrawn_at is null or incident.withdrawn_at >= now() - interval '7 days')
      and not exists (
        select 1 from public.reports linked_report
        join public.report_public_posts post on post.report_id = linked_report.id and post.is_published
        where linked_report.incident_case_id = incident.id
          and incident.verification = 'confirmed' and incident.withdrawn_at is null
          and not incident.is_sensitive
      )
  )
  select visible_posts.post_kind, visible_posts.report_id, visible_posts.incident_case_id,
    visible_posts.post_data
  from visible_posts
  order by visible_posts.sort_at desc, visible_posts.incident_case_id,
    visible_posts.report_id nulls last
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.set_report_publication_preferences(uuid,boolean,boolean,boolean),
  public.get_report_publication_preferences(uuid), public.set_report_public_post(uuid,text,text,boolean,boolean,boolean,boolean),
  public.get_report_publication_review(uuid),
  public.public_report_record(uuid), public.list_public_reports(uuid,integer,integer),
  public.get_public_report(uuid), public.list_public_community_posts(uuid,integer,integer)
  from public, anon;
revoke all on function public.public_report_record(uuid) from authenticated;
grant execute on function public.set_report_publication_preferences(uuid,boolean,boolean,boolean),
  public.get_report_publication_preferences(uuid), public.set_report_public_post(uuid,text,text,boolean,boolean,boolean,boolean),
  public.get_report_publication_review(uuid),
  public.list_public_reports(uuid,integer,integer), public.get_public_report(uuid),
  public.list_public_community_posts(uuid,integer,integer) to authenticated;
