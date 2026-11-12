-- Private operational records. Public projections are a later phase.
create table public.incident_cases (
  id uuid primary key default gen_random_uuid(),
  source_report_id uuid not null unique references public.reports(id),
  barangay_id uuid references public.barangays(id),
  incident_type text check (incident_type in ('fire', 'flood', 'road_crash', 'medical', 'other')),
  incident_type_other text,
  public_type_label text check (length(public_type_label) between 1 and 80),
  location extensions.geography(Point, 4326) not null,
  address_text text,
  verification public.incident_verification not null default 'pending',
  state public.incident_state not null default 'active',
  coordination public.incident_coordination not null default 'local',
  lead_office public.incident_lead_office not null default 'barangay',
  lead_barangay_id uuid references public.barangays(id),
  confirmed_by uuid references public.app_profiles(id),
  confirmed_at timestamptz,
  confirmation_basis public.incident_confirmation_basis,
  municipal_finding public.incident_verification check (municipal_finding <> 'pending'),
  municipal_finding_by uuid references public.app_profiles(id),
  municipal_finding_at timestamptz,
  resolved_by uuid references public.app_profiles(id),
  resolved_at timestamptz,
  public_summary text check (length(btrim(public_summary)) between 1 and 280),
  legacy_resolution boolean not null default false,
  withdrawn_at timestamptz,
  public_correction text check (length(btrim(public_correction)) between 1 and 280),
  is_sensitive boolean not null default false,
  public_location_mode text not null default 'approximate_area'
    check (public_location_mode in ('barangay_only', 'approximate_area', 'exact_for_safety')),
  public_location_reason text check (length(btrim(public_location_reason)) between 1 and 500),
  closed_by uuid references public.app_profiles(id),
  closed_at timestamptz,
  created_by uuid references public.app_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  check ((lead_office = 'municipal' and lead_barangay_id is null)
    or (lead_office = 'barangay' and lead_barangay_id is not null)),
  check (state <> 'resolved' or (verification = 'confirmed' and resolved_at is not null
    and (legacy_resolution or public_summary is not null))),
  check (withdrawn_at is null or public_correction is not null),
  check (not is_sensitive or public_location_mode = 'barangay_only'),
  check (public_location_mode <> 'exact_for_safety' or public_location_reason is not null)
);

alter table public.reports
  add column incident_case_id uuid references public.incident_cases(id),
  add column review_outcome public.report_review_outcome not null default 'pending',
  add column review_reason_code text,
  add column reviewed_by uuid references public.app_profiles(id),
  add column reviewed_at timestamptz,
  add column review_claimed_by uuid references public.app_profiles(id),
  add column review_claimed_at timestamptz,
  add column jurisdiction_status public.report_jurisdiction_status not null default 'in_coverage',
  add column intake_channel public.report_intake_channel not null default 'resident_app',
  add constraint reports_claim_pair check ((review_claimed_by is null) = (review_claimed_at is null));
-- Preserve the existing GPS column restriction; do not grant SELECT *.
grant select (incident_case_id, review_outcome, review_reason_code, reviewed_by, reviewed_at,
  review_claimed_by, review_claimed_at, jurisdiction_status, intake_channel) on public.reports to authenticated;

create table public.incident_support_requests (
  id uuid primary key default gen_random_uuid(),
  incident_case_id uuid not null references public.incident_cases(id),
  kind public.support_request_kind not null,
  status public.support_request_status not null default 'requested',
  previous_coordination public.incident_coordination not null
    check (previous_coordination in ('local', 'support_active')),
  requested_by uuid references public.app_profiles(id),
  requesting_barangay_id uuid not null references public.barangays(id),
  request_note text check (length(btrim(request_note)) between 1 and 500),
  responded_by uuid references public.app_profiles(id),
  responded_at timestamptz,
  response_note text check (length(btrim(response_note)) between 1 and 500),
  is_legacy boolean not null default false,
  legacy_label text,
  created_at timestamptz not null default now(),
  check (kind <> 'transfer' or request_note is not null or is_legacy),
  check (not is_legacy or legacy_label is not null)
);
create unique index incident_one_requested_support on public.incident_support_requests(incident_case_id)
  where status = 'requested';

create table public.incident_events (
  id uuid primary key default gen_random_uuid(),
  incident_case_id uuid not null references public.incident_cases(id),
  report_id uuid references public.reports(id),
  event_type text not null check (event_type in (
    'reporter_call', 'hotline_contacted', 'assistance_requested', 'dispatch_confirmed',
    'responders_on_site', 'assistance_given', 'work_done', 'external_info', 'internal_note',
    'progress_update', 'incident_created', 'report_linked', 'finding_recorded', 'support_requested',
    'transfer_requested', 'support_accepted', 'transfer_accepted', 'request_returned',
    'request_cancelled', 'resolved', 'summary_added', 'reopened', 'withdrawn', 'legacy_handoff',
    'photo_published', 'photo_unpublished', 'public_location_changed', 'sensitivity_changed',
    'update_request_rerouted')),
  actor_id uuid references public.app_profiles(id),
  actor_office public.incident_lead_office,
  actor_barangay_id uuid references public.barangays(id),
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),
  note text check (length(btrim(note)) between 1 and 500),
  is_public boolean not null default false,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.incident_update_requests (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id),
  incident_case_id uuid references public.incident_cases(id),
  responsible_office public.incident_lead_office not null,
  responsible_barangay_id uuid references public.barangays(id),
  requested_by uuid not null references public.app_profiles(id),
  request_note text check (length(btrim(request_note)) between 1 and 500),
  status public.update_request_status not null default 'open',
  acknowledged_by uuid references public.app_profiles(id),
  acknowledged_at timestamptz,
  answered_by uuid references public.app_profiles(id),
  answered_at timestamptz,
  answer_text text check (length(btrim(answer_text)) between 1 and 500),
  answer_event_id uuid references public.incident_events(id),
  created_at timestamptz not null default now(),
  check (num_nonnulls(report_id, incident_case_id) = 1),
  check ((responsible_office = 'municipal' and responsible_barangay_id is null)
    or (responsible_office = 'barangay' and responsible_barangay_id is not null))
);
create unique index incident_one_open_update on public.incident_update_requests(incident_case_id)
  where status in ('open', 'acknowledged');
create unique index report_one_open_update on public.incident_update_requests(report_id)
  where status in ('open', 'acknowledged');

alter table public.report_media
  add column public_approved_by uuid references public.app_profiles(id),
  add column public_approved_at timestamptz,
  add constraint report_media_approval_pair check ((public_approved_by is null) = (public_approved_at is null));

create table public.incident_comments (
  id uuid primary key default gen_random_uuid(),
  incident_case_id uuid not null references public.incident_cases(id),
  user_id uuid not null references public.app_profiles(id),
  body text not null check (length(btrim(body)) between 1 and 2000),
  parent_comment_id uuid references public.incident_comments(id),
  is_hidden boolean not null default false,
  hidden_by uuid references public.app_profiles(id),
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index incident_cases_barangay_created on public.incident_cases(barangay_id, created_at desc);
create index incident_cases_location on public.incident_cases using gist(location);
create index reports_incident_case on public.reports(incident_case_id);
create index incident_events_case_time on public.incident_events(incident_case_id, occurred_at);
create index incident_support_case on public.incident_support_requests(incident_case_id, created_at);
create index incident_comments_case on public.incident_comments(incident_case_id, created_at);
create index incident_update_office on public.incident_update_requests(responsible_office, responsible_barangay_id, status);

do $$
declare table_name text;
begin
  foreach table_name in array array['incident_cases', 'incident_support_requests', 'incident_events',
    'incident_update_requests', 'incident_comments'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
