-- Rollback-only publication security smoke test. Every failure raises an
-- exception; the single TAP result confirms all scoped checks completed.
begin;
-- Keep fixture setup on the owner role even when the CLI uses a temporary login role.
set local role postgres;
set search_path = public, extensions;
select plan(1);

create function pg_temp.publication_id(family integer, item integer)
returns uuid language sql immutable as $$
  select ('e' || family::text || '000000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid;
$$;

create function pg_temp.require_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'Publication security: %', message; end if;
end;
$$;

create function pg_temp.expect_denied(statement text, message text)
returns void language plpgsql as $$
declare denied boolean := false;
begin
  begin
    execute statement;
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then raise exception 'Publication security: %', message; end if;
end;
$$;

create function pg_temp.expect_state(statement text, expected_state text, message text)
returns void language plpgsql as $$
declare actual_state text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual_state = returned_sqlstate;
  end;
  if actual_state is distinct from expected_state then
    raise exception 'Publication security: % (expected %, got %)', message, expected_state, actual_state;
  end if;
end;
$$;

insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
select pg_temp.publication_id(1, item), 'authenticated', 'authenticated',
  'publication-security-' || item || '@example.test',
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from generate_series(1, 5) item;

insert into public.barangays(id, name) values
  (pg_temp.publication_id(2, 1), 'Publication Local'),
  (pg_temp.publication_id(2, 2), 'Publication Other');

insert into public.app_profiles(id, role, first_name, last_name, barangay_id, status, avatar_path) values
  (pg_temp.publication_id(1, 1), 'resident', 'Private', 'Owner', pg_temp.publication_id(2, 1), 'active',
    pg_temp.publication_id(1, 1)::text || '/avatar-' || pg_temp.publication_id(1, 1)::text || '.jpg'),
  (pg_temp.publication_id(1, 2), 'resident', 'Second', 'Owner', pg_temp.publication_id(2, 1), 'active', null),
  (pg_temp.publication_id(1, 3), 'resident', 'Other', 'Reader', pg_temp.publication_id(2, 1), 'active', null),
  (pg_temp.publication_id(1, 4), 'officer', 'Local', 'Lead', pg_temp.publication_id(2, 1), 'active', null),
  (pg_temp.publication_id(1, 5), 'officer', 'Other', 'Office', pg_temp.publication_id(2, 2), 'active', null);

insert into public.reports(id, reporter_id, title, description, barangay_id, location, incident_type)
values
  (pg_temp.publication_id(3, 1), pg_temp.publication_id(1, 1), 'Secret source title one',
    'Secret source description one', pg_temp.publication_id(2, 1),
    extensions.st_setsrid(extensions.st_makepoint(123.80123, 10.25123), 4326)::extensions.geography, 'flood'),
  (pg_temp.publication_id(3, 2), pg_temp.publication_id(1, 2), 'Secret source title two',
    'Secret source description two', pg_temp.publication_id(2, 1),
    extensions.st_setsrid(extensions.st_makepoint(123.89123, 10.29123), 4326)::extensions.geography, 'flood');

insert into public.report_media(id, report_id, type, storage_path, position)
values (pg_temp.publication_id(5, 1), pg_temp.publication_id(3, 1), 'photo',
  'publication-security/original.jpg', 0);

select pg_temp.require_true(not has_function_privilege('authenticated',
  'public.create_report_with_publication_preferences(uuid,uuid,text,text,double precision,double precision,text,jsonb,uuid,text,text,double precision,double precision,double precision,public.report_jurisdiction_status,boolean,boolean,boolean)',
  'EXECUTE'), 'resident clients must not call the service-only intake wrapper');

-- Intake stores chosen preferences with the report and media. A replay of the
-- same queued id must not overwrite a later owner edit.
set local role service_role;
select public.create_report_with_publication_preferences(
  pg_temp.publication_id(1, 1), pg_temp.publication_id(3, 3), 'Queued report',
  'Queued report description', 10.25123, 123.80123, null,
  jsonb_build_array(jsonb_build_object('id', pg_temp.publication_id(5, 2),
    'type', 'photo', 'storagePath', 'publication-security/queued-original.jpg')),
  pg_temp.publication_id(2, 1), 'flood', null, 10.25123, 123.80123, null,
  'in_coverage'::public.report_jurisdiction_status, true, false, true);
set local role postgres;
select pg_temp.require_true((select show_reporter_name and not show_reporter_avatar
  and allow_exact_location from public.report_publication_preferences
  where report_id = pg_temp.publication_id(3, 3)),
  'queued preferences must be committed with the new report');
select pg_temp.require_true((select count(*) = 1 from public.report_media
  where report_id = pg_temp.publication_id(3, 3)),
  'queued report media must be committed in the same intake call');
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 1)::text, true);
select public.set_report_publication_preferences(pg_temp.publication_id(3, 3), false, false, false);
set local role postgres;
set local role service_role;
select public.create_report_with_publication_preferences(
  pg_temp.publication_id(1, 1), pg_temp.publication_id(3, 3), 'Queued report',
  'Queued report description', 10.25123, 123.80123, null,
  jsonb_build_array(jsonb_build_object('id', pg_temp.publication_id(5, 2),
    'type', 'photo', 'storagePath', 'publication-security/queued-original.jpg')),
  pg_temp.publication_id(2, 1), 'flood', null, 10.25123, 123.80123, null,
  'in_coverage'::public.report_jurisdiction_status, true, false, true);
set local role postgres;
select pg_temp.require_true((select not show_reporter_name and not show_reporter_avatar
  and not allow_exact_location from public.report_publication_preferences
  where report_id = pg_temp.publication_id(3, 3)),
  'offline retry must preserve later owner preference changes');
select pg_temp.require_true((select count(*) = 1 from public.report_media
  where report_id = pg_temp.publication_id(3, 3)),
  'offline retry must not duplicate media');

insert into public.incident_cases(id, source_report_id, barangay_id, incident_type, location,
  verification, lead_office, lead_barangay_id, confirmed_at, public_location_mode, public_title, public_caption)
values (pg_temp.publication_id(4, 1), pg_temp.publication_id(3, 1), pg_temp.publication_id(2, 1), 'flood',
  extensions.st_setsrid(extensions.st_makepoint(123.81234, 10.26234), 4326)::extensions.geography,
  'confirmed', 'barangay', pg_temp.publication_id(2, 1), now(), 'approximate_area',
  'Legacy screened title', 'Legacy screened caption');

-- A resident can choose the defaults before confirmation/linking.
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 1)::text, true);
select public.set_report_publication_preferences(pg_temp.publication_id(3, 1), false, false, false);
set local role postgres;

select set_config('disasterlink.report_transition', '1', true);
update public.reports set incident_case_id = pg_temp.publication_id(4, 1),
  review_outcome = case when id = pg_temp.publication_id(3, 1) then 'verified' else 'linked' end::public.report_review_outcome
where id in (pg_temp.publication_id(3, 1), pg_temp.publication_id(3, 2));
select set_config('disasterlink.report_transition', '', true);

select pg_temp.require_true((select relrowsecurity from pg_class where oid = 'public.report_publication_preferences'::regclass),
  'preferences must have RLS enabled');
select pg_temp.require_true((select relrowsecurity from pg_class where oid = 'public.report_public_posts'::regclass),
  'public posts must have RLS enabled');
select pg_temp.require_true(not has_table_privilege('authenticated', 'public.report_publication_preferences', 'UPDATE'),
  'authenticated must not update preferences directly');
select pg_temp.require_true(not has_table_privilege('authenticated', 'public.report_public_posts', 'UPDATE'),
  'authenticated must not update public posts directly');
select pg_temp.require_true((select count(*) = 2 from public.report_publication_preferences
  where report_id in (pg_temp.publication_id(3, 1), pg_temp.publication_id(3, 2))
    and not show_reporter_name and not show_reporter_avatar and not allow_exact_location),
  'new and existing style reports must start with all sharing off');
select pg_temp.require_true((select count(*) = 0 from public.report_public_posts
  where report_id in (pg_temp.publication_id(3, 1), pg_temp.publication_id(3, 2))),
  'incident confirmation and linking must not publish source posts');

set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 3)::text, true);
select pg_temp.require_true((select count(*) = 0 from public.reports
  where id in (pg_temp.publication_id(3, 1), pg_temp.publication_id(3, 2))),
  'other residents must not read source reports');
select pg_temp.require_true((select count(*) = 0 from public.list_public_reports(pg_temp.publication_id(2, 1))),
  'confirmation alone must not create public posts');
select pg_temp.require_true((select count(*) = 1 from public.list_public_community_posts(pg_temp.publication_id(2, 1))
  where post_kind = 'incident' and report_id is null),
  'a confirmed legacy incident must remain in the public community list');
select pg_temp.expect_denied('update public.report_publication_preferences set show_reporter_name = true',
  'direct preference update must be denied');
select pg_temp.expect_denied('update public.report_public_posts set is_published = true',
  'direct post update must be denied');
select pg_temp.expect_denied('select public.set_report_publication_preferences(''' || pg_temp.publication_id(3, 1)
  || ''', true, true, true)', 'another resident must not change owner choices');
select pg_temp.require_true((select count(*) = 0 from public.get_report_publication_preferences(pg_temp.publication_id(3, 1))),
  'another resident must not read owner preferences');
select pg_temp.expect_denied('select * from public.get_report_publication_review('''
  || pg_temp.publication_id(3, 1) || ''')',
  'another resident must not read original identity or coordinates through the review RPC');

select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 5)::text, true);
select pg_temp.expect_denied('select public.set_report_public_post(''' || pg_temp.publication_id(3, 1)
  || ''', ''Wrong office'', ''Wrong office'', true, false, false, false)',
  'another office must not publish the source post');

select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 4)::text, true);
select pg_temp.require_true((select reporter_name = 'Private Owner'
    and reporter_avatar_path is not null and source_latitude = 10.25123
    and source_longitude = 123.80123
  from public.get_report_publication_review(pg_temp.publication_id(3, 1))),
  'lead review must show the submitted identity and exact location for screening');
select pg_temp.expect_denied('select public.set_report_publication_preferences(''' || pg_temp.publication_id(3, 1)
  || ''', true, true, true)', 'an official must not change owner choices');
select pg_temp.expect_state('select public.set_report_media_public(''' || pg_temp.publication_id(5, 1)
  || ''', true)', '22023', 'photo approval must remain closed pending metadata verification');
select public.set_report_public_post(pg_temp.publication_id(3, 1), null,
  null, true, false, false, false);
select public.set_report_public_post(pg_temp.publication_id(3, 2), null,
  null, true, false, false, false);

select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 3)::text, true);
select pg_temp.require_true((select count(*) = 2 from public.list_public_reports(pg_temp.publication_id(2, 1))),
  'two linked reports must appear as separate posts');
select pg_temp.require_true((select count(*) = 2 from public.list_public_community_posts(pg_temp.publication_id(2, 1))
  where post_kind = 'report'),
  'screened report posts must replace the legacy list row without duplication');
select pg_temp.require_true((select count(distinct report_id) = 2 from (
  select report_id from public.list_public_community_posts(pg_temp.publication_id(2, 1), 1, 0)
  union all
  select report_id from public.list_public_community_posts(pg_temp.publication_id(2, 1), 1, 1)
  ) pages), 'mixed community pagination must retain both distinct report posts');
select pg_temp.require_true((select count(distinct incident_case_id) = 1
  from public.list_public_reports(pg_temp.publication_id(2, 1))),
  'linked posts must retain one shared incident');
select pg_temp.require_true((select bool_and(reporter_name is null and reporter_avatar_path is null
  and exact_latitude is null and exact_longitude is null)
  from public.list_public_reports(pg_temp.publication_id(2, 1))),
  'default sharing must hide name, avatar and exact GPS');
select pg_temp.require_true((select approx_latitude = 10.25 and approx_longitude = 123.8
  from public.list_public_reports(pg_temp.publication_id(2, 1))
  where report_id = pg_temp.publication_id(3, 1)),
  'approximate post coordinate must derive from its own submitted report');
select pg_temp.require_true((select approx_latitude = 10.29 and approx_longitude = 123.89
  from public.list_public_reports(pg_temp.publication_id(2, 1))
  where report_id = pg_temp.publication_id(3, 2)),
  'the second linked post must use its distinct submitted location');
select pg_temp.require_true(
  public.get_public_report(pg_temp.publication_id(3, 1))->'report'->>'public_title' = 'Secret source title one'
  and public.get_public_report(pg_temp.publication_id(3, 1))->'report'->>'public_description' = 'Secret source description one',
  'public detail mirrors the source text explicitly approved by the lead');
select pg_temp.require_true(public.get_public_report(pg_temp.publication_id(3, 1))::text not like '%storage_path%',
  'source public detail must not expose media paths');
select pg_temp.require_true(public.can_read_incident_discussion(pg_temp.publication_id(4, 1)),
  'existing shared incident discussion must remain available');

-- Turning sharing on cannot expand an already published post. The lead must
-- explicitly review and approve each newly disclosed field.
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 1)::text, true);
select public.set_report_publication_preferences(pg_temp.publication_id(3, 1), true, true, true);
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 3)::text, true);
select pg_temp.require_true((select reporter_name is null and reporter_avatar_path is null
  and exact_latitude is null from public.list_public_reports(pg_temp.publication_id(2, 1))
  where report_id = pg_temp.publication_id(3, 1)),
  'owner opt-in alone must not upgrade an existing public post');
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 4)::text, true);
select public.set_report_public_post(pg_temp.publication_id(3, 1), null,
  null, true, true, true, true);
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 3)::text, true);
select pg_temp.require_true((select reporter_name = 'Private Owner'
    and reporter_avatar_path is not null and public_location_mode = 'exact_shared'
    and exact_latitude = 10.25123 and exact_longitude = 123.80123
  from public.list_public_reports(pg_temp.publication_id(2, 1))
  where report_id = pg_temp.publication_id(3, 1)),
  'public identity and exact source GPS require owner and lead approval');
select pg_temp.require_true((select reporter_name is null and exact_latitude is null
  from public.list_public_reports(pg_temp.publication_id(2, 1))
  where report_id = pg_temp.publication_id(3, 2)),
  'one report approval must not expose another linked reporter');

-- A profile edit must not publish newly changed identity under an old approval.
set local role postgres;
update public.app_profiles set first_name = 'Changed'
where id = pg_temp.publication_id(1, 1);
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 3)::text, true);
select pg_temp.require_true((select reporter_name is null and reporter_avatar_path is not null
  from public.list_public_reports(pg_temp.publication_id(2, 1))
  where report_id = pg_temp.publication_id(3, 1)),
  'a changed name must wait for renewed review without hiding the approved avatar');
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 4)::text, true);
select public.set_report_public_post(pg_temp.publication_id(3, 1), null,
  null, true, true, true, true);
set local role postgres;
update public.app_profiles set avatar_path = pg_temp.publication_id(1, 1)::text
  || '/avatar-' || pg_temp.publication_id(1, 5)::text || '.jpg'
where id = pg_temp.publication_id(1, 1);
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 3)::text, true);
select pg_temp.require_true((select reporter_name = 'Changed Owner' and reporter_avatar_path is null
  from public.list_public_reports(pg_temp.publication_id(2, 1))
  where report_id = pg_temp.publication_id(3, 1)),
  'a changed avatar must wait for renewed review without hiding the approved name');

-- The official barangay-only restriction overrides even dual approval.
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 4)::text, true);
select public.set_incident_public_location(pg_temp.publication_id(4, 1), 'barangay_only', null);
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 3)::text, true);
select pg_temp.require_true((select exact_latitude is null and exact_longitude is null
  from public.list_public_reports(pg_temp.publication_id(2, 1))
  where report_id = pg_temp.publication_id(3, 1)),
  'barangay-only incident mode must suppress exact submitted GPS');
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 4)::text, true);
select public.set_incident_public_location(pg_temp.publication_id(4, 1), 'approximate_area', null);

select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 1)::text, true);
select public.set_report_publication_preferences(pg_temp.publication_id(3, 1), false, false, false);
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 3)::text, true);
select pg_temp.require_true((select reporter_name is null and reporter_avatar_path is null
  and exact_latitude is null from public.list_public_reports(pg_temp.publication_id(2, 1))
  where report_id = pg_temp.publication_id(3, 1)),
  'owner revocation must hide every approved field on a fresh read');
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 1)::text, true);
select public.set_report_publication_preferences(pg_temp.publication_id(3, 1), true, true, true);
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 3)::text, true);
select pg_temp.require_true((select reporter_name is null and reporter_avatar_path is null
  and exact_latitude is null from public.list_public_reports(pg_temp.publication_id(2, 1))
  where report_id = pg_temp.publication_id(3, 1)),
  're-enabling sharing must require renewed lead review');

select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 4)::text, true);
select public.set_incident_sensitive(pg_temp.publication_id(4, 1), true, 'Private homes near incident');
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 3)::text, true);
select pg_temp.require_true((select count(*) = 0 from public.list_public_reports(pg_temp.publication_id(2, 1))),
  'sensitive incident must revoke both source posts on fresh list reads');
select pg_temp.require_true(public.get_public_report(pg_temp.publication_id(3, 1)) is null,
  'sensitive incident must revoke a saved source post link');
select pg_temp.require_true((public.get_public_incident(pg_temp.publication_id(4, 1))->'incident'->>'public_title') is null,
  'sensitive incident must mask legacy incident post copy');

select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 4)::text, true);
select public.set_incident_sensitive(pg_temp.publication_id(4, 1), false, 'Safety review complete');
select public.set_report_public_post(pg_temp.publication_id(3, 1), null,
  null, true, false, false, false);
select public.set_report_public_post(pg_temp.publication_id(3, 2), null,
  null, true, false, false, false);

-- Fixture-only state change tests read-time withdrawal gating independently
-- of the operational transition path, which has its own test coverage.
set local role postgres;
update public.incident_cases set verification = 'not_confirmed', withdrawn_at = now(),
  public_correction = 'Field review withdrew confirmation.'
where id = pg_temp.publication_id(4, 1);
set local role authenticated;
select set_config('request.jwt.claim.sub', pg_temp.publication_id(1, 3)::text, true);
select pg_temp.require_true((select count(*) = 0 from public.list_public_reports(pg_temp.publication_id(2, 1))),
  'withdrawn incident must revoke source posts on fresh list reads');
select pg_temp.require_true(public.get_public_report(pg_temp.publication_id(3, 2)) is null,
  'withdrawn incident must revoke a saved linked post link');
select pg_temp.expect_denied('select count(*) from public.report_public_posts',
  'private publication rows must not be readable directly');

select pass('Publication security assertions passed');
select * from finish();
rollback;
