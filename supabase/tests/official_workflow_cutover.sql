begin;
select no_plan();

create function pg_temp.workflow_id(family integer, item integer) returns uuid language sql immutable as $$
  select ('c' || family::text || '000000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid;
$$;
create function pg_temp.workflow_actor(item integer) returns text language sql as $$
  select set_config('request.jwt.claim.sub', pg_temp.workflow_id(1, item)::text, true);
$$;
create function pg_temp.workflow_case(item integer) returns uuid language sql security definer set search_path = '' as $$
  select incident_case_id from public.reports where id = pg_temp.workflow_id(3, item);
$$;
create function pg_temp.workflow_request(item integer) returns uuid language sql as $$
  select id from public.incident_support_requests where incident_case_id = pg_temp.workflow_case(item) and status = 'requested';
$$;
insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
select pg_temp.workflow_id(1, item), 'authenticated', 'authenticated', 'workflow-' || item || '@example.test',
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb from generate_series(1, 8) item;
insert into public.barangays(id, name, centroid) values
  (pg_temp.workflow_id(2, 1), 'Workflow Local', extensions.st_setsrid(extensions.st_makepoint(123.8, 10.25), 4326)::extensions.geography),
  (pg_temp.workflow_id(2, 2), 'Workflow Other', extensions.st_setsrid(extensions.st_makepoint(123.85, 10.3), 4326)::extensions.geography),
  (pg_temp.workflow_id(2, 3), 'Workflow No Office', null);
insert into public.app_profiles(id, role, first_name, last_name, barangay_id, status) values
  (pg_temp.workflow_id(1, 1), 'resident', 'Workflow', 'Reporter', pg_temp.workflow_id(2, 1), 'active'),
  (pg_temp.workflow_id(1, 2), 'officer', 'Workflow', 'Local', pg_temp.workflow_id(2, 1), 'active'),
  (pg_temp.workflow_id(1, 3), 'officer', 'Workflow', 'Other', pg_temp.workflow_id(2, 2), 'active'),
  (pg_temp.workflow_id(1, 4), 'officer', 'Workflow', 'Municipal', null, 'active'),
  (pg_temp.workflow_id(1, 5), 'mayor', 'Workflow', 'Mayor', null, 'active'),
  (pg_temp.workflow_id(1, 6), 'officer', 'Workflow', 'Suspended', pg_temp.workflow_id(2, 1), 'suspended'),
  (pg_temp.workflow_id(1, 7), 'officer', 'Workflow', 'Colleague', pg_temp.workflow_id(2, 1), 'active'),
  (pg_temp.workflow_id(1, 8), 'resident', 'Workflow', 'Other Resident', pg_temp.workflow_id(2, 1), 'active');
insert into public.reports(id, reporter_id, title, description, barangay_id, location, jurisdiction_status)
select pg_temp.workflow_id(3, item), pg_temp.workflow_id(1, 1), '', 'Workflow report ' || item,
  case when item = 31 then pg_temp.workflow_id(2, 2) when item = 32 then pg_temp.workflow_id(2, 3) else pg_temp.workflow_id(2, 1) end,
  extensions.st_setsrid(extensions.st_makepoint(123.8, 10.25), 4326)::extensions.geography,
  case when item = 33 then 'needs_check' else 'in_coverage' end::public.report_jurisdiction_status
from generate_series(1, 33) item;
insert into public.report_media(report_id, type, storage_path, position)
select pg_temp.workflow_id(3, item), 'photo', 'workflow/' || item || '/original.jpg', 0 from generate_series(1, 33) item;
insert into public.report_media(report_id, type, storage_path, duration_seconds, position)
select pg_temp.workflow_id(3, item), 'video', 'workflow/' || item || '/video.mp4', 5, 1 from generate_series(1, 33) item;
set constraints all immediate;
set constraints all deferred;

set local role authenticated;
select pg_temp.workflow_actor(1);
select throws_ok($$select public.list_official_workflow_report_ids('all')$$, '42501', null, 'residents cannot list official queue ids');
select throws_ok($$select public.get_report_intake_routing(10.25, 123.8)$$, '42501', null, 'routing helper is service-only');
select pg_temp.workflow_actor(5);
select throws_ok($$select public.list_official_workflow_report_ids('all')$$, '42501', null, 'Mayor cannot list raw operational queues');
select pg_temp.workflow_actor(6);
select throws_ok($$select public.list_official_workflow_report_ids('all')$$, '42501', null, 'suspended official cannot list queues');
select pg_temp.workflow_actor(2);
select throws_ok($$select public.list_official_workflow_report_ids('invalid')$$, '22023', null, 'unknown queue rejected');
select is((public.list_official_workflow_report_ids('needs_review')->'counts'->>'total')::integer, 30, 'queue counts all matching reports before pagination');
select is(jsonb_array_length(public.list_official_workflow_report_ids('needs_review', 20, 0)->'ids'), 20, 'first page has twenty reports');
select is(jsonb_array_length(public.list_official_workflow_report_ids('needs_review', 20, 20)->'ids'), 10, 'second page reaches older matching reports');
select is(jsonb_array_length(public.list_official_workflow_report_ids('jurisdiction_check')->'ids'), 0, 'jurisdiction decisions remain municipal');
select is(jsonb_array_length(public.list_official_workflow_report_ids('needs_review', 20, 100)->'ids'), 0, 'offset beyond end returns an empty page');
select public.claim_report_review(pg_temp.workflow_id(3, 1));
select is((public.list_official_workflow_report_ids('mine')->'counts'->>'total')::integer, 1, 'claim enters my queue');
select is((public.list_official_workflow_report_ids('under_review')->'counts'->>'total')::integer, 1, 'claim enters office queue');
select pg_temp.workflow_actor(7);
select is((public.list_official_workflow_report_ids('mine')->'counts'->>'total')::integer, 0, 'colleague does not inherit my queue');
select public.claim_report_review(pg_temp.workflow_id(3, 1), true);
select is((public.list_official_workflow_report_ids('mine')->'counts'->>'total')::integer, 1, 'takeover moves the report to the new reviewer');
select public.review_report(pg_temp.workflow_id(3, 1), 'needs_assessment');
select is((public.list_official_workflow_report_ids('being_assessed')->'counts'->>'total')::integer, 1, 'provisional assessment has its own queue');
select public.request_municipal_support(pg_temp.workflow_case(1), 'transfer', 'Municipal assessment needed');
select is((select count(*) from public.reports where id = pg_temp.workflow_id(3, 1)), 1::bigint, 'barangay retains the pending transfer');
select is((public.list_official_workflow_report_ids('awaiting_mdrrmo')->'counts'->>'total')::integer, 1, 'pending transfer enters awaiting queue');
select pg_temp.workflow_actor(3);
select is((select count(*) from public.reports where id = pg_temp.workflow_id(3, 1)), 0::bigint, 'unrelated barangay cannot read transferred report');
select pg_temp.workflow_actor(4);
select is((public.list_official_workflow_report_ids('incoming_requests')->'counts'->>'total')::integer, 1, 'MDRRMO sees incoming request');
select is((public.list_official_workflow_report_ids('jurisdiction_check')->'counts'->>'total')::integer, 1, 'MDRRMO sees jurisdiction queue');
select public.respond_support_request(pg_temp.workflow_request(1), 'accept');
select is((public.list_official_workflow_report_ids('municipal_review')->'counts'->>'total')::integer, 1, 'accepted provisional transfer needs a finding');
select pg_temp.workflow_actor(2);
select is((select count(*) from public.reports where id = pg_temp.workflow_id(3, 1)), 1::bigint, 'barangay retains supporting read access after acceptance');
select lives_ok($$select public.log_incident_event(pg_temp.workflow_case(1), 'internal_note', '{"text":"Barangay team available"}', null)$$, 'supporter can log internal activity');
select throws_ok($$select public.record_incident_finding(pg_temp.workflow_case(1), 'confirmed', 'Supporter attempt')$$, '42501', null, 'supporter cannot record a lead finding');
select throws_ok($$select public.resolve_incident(pg_temp.workflow_case(1), 'Supporter attempt', 'Done')$$, '42501', null, 'supporter cannot resolve');
select throws_ok($$select public.log_incident_event(pg_temp.workflow_case(1), 'progress_update', '{"text":"Supporter update"}', null, true)$$, '42501', null, 'supporter cannot publish progress');
set local role service_role;
select throws_ok($$select public.correct_report_incident_location(pg_temp.workflow_id(1, 2), pg_temp.workflow_id(3, 1), 10.25, 123.8,
  'Forbidden supporter edit', pg_temp.workflow_id(2, 1), 'Attempt after acceptance')$$, '42501', null, 'trusted location RPC blocks supporter edits after acceptance');
select lives_ok($$select public.correct_report_incident_location(pg_temp.workflow_id(1, 4), pg_temp.workflow_id(3, 1), 10.25, 123.8,
  'Municipal correction', pg_temp.workflow_id(2, 1), 'Lead correction')$$, 'municipal lead may correct location');
select is(current_setting('disasterlink.location_actor', true), '', 'successful correction clears edit attribution');
select is(current_setting('disasterlink.location_correction_note', true), '', 'successful correction clears its note');
set local role authenticated;
select pg_temp.workflow_actor(4);
select lives_ok($$select public.record_incident_finding(pg_temp.workflow_case(1), 'confirmed', 'Municipal field team confirmed')$$, 'finding is not blocked by an earlier edit in this transaction');
select is((public.list_official_workflow_report_ids('municipal_review')->'counts'->>'total')::integer, 0, 'finding removes municipal-review queue entry');
select is((public.list_official_workflow_report_ids('municipal_lead')->'counts'->>'total')::integer, 1, 'confirmed case remains with municipal lead');
select public.resolve_incident(pg_temp.workflow_case(1), 'Work completed', 'The area is safe.');
select is((public.list_official_workflow_report_ids('municipal_lead')->'counts'->>'total')::integer, 0, 'resolution leaves the active municipal queue');
select public.resolve_report_jurisdiction(pg_temp.workflow_id(3, 33), 'in_coverage', pg_temp.workflow_id(2, 1));
select is((select review_outcome::text from public.reports where id = pg_temp.workflow_id(3, 33)), 'pending', 'jurisdiction check never verifies');
select is((select review_claimed_by from public.reports where id = pg_temp.workflow_id(3, 33)), null::uuid, 'jurisdiction routing leaves report unclaimed');

-- The service-only intake overload atomically stores a review hold with media.
set local role service_role;
select lives_ok($$select public.create_report_with_media(pg_temp.workflow_id(1, 1), pg_temp.workflow_id(3, 40), '', 'Uncertain intake', 10.25, 123.8,
  null, jsonb_build_array(jsonb_build_object('id', pg_temp.workflow_id(4, 1), 'type', 'photo', 'storagePath', 'workflow/intake/photo.jpg'),
    jsonb_build_object('id', pg_temp.workflow_id(4, 2), 'type', 'video', 'storagePath', 'workflow/intake/video.mp4', 'durationSeconds', 5)),
  pg_temp.workflow_id(2, 1), 'flood', null, 10.25, 123.8, 10, 'needs_check')$$, 'trusted resident intake saves jurisdiction hold atomically');
select is((select jurisdiction_status::text from public.reports where id = pg_temp.workflow_id(3, 40)), 'needs_check', 'intake preserves uncertainty');
select is((select status::text from public.reports where id = pg_temp.workflow_id(3, 40)), 'unverified', 'uncertain intake is unverified');
select is((select nearest_barangay_id from public.get_report_intake_routing(10.25, 123.8, pg_temp.workflow_id(2, 1))), pg_temp.workflow_id(2, 1), 'routing uses nearest live centroid');
select ok((select nearest_distance_meters < 1 from public.get_report_intake_routing(10.25, 123.8)), 'centroid distance is in meters');
set local role authenticated;
select pg_temp.workflow_actor(2);
select throws_ok($$select public.claim_report_review(pg_temp.workflow_id(3, 40))$$, '22023', null, 'jurisdiction hold cannot be claimed for verification');
select throws_ok($$select public.create_report_with_media(pg_temp.workflow_id(1, 1), pg_temp.workflow_id(3, 41), '', 'Forged intake', 10.25, 123.8,
  null, '[]'::jsonb, pg_temp.workflow_id(2, 1), 'flood', null, 10.25, 123.8, 10, 'in_coverage')$$, '42501', null, 'client cannot invoke trusted intake overload');

select public.claim_report_review(pg_temp.workflow_id(3, 2));
select public.review_report(pg_temp.workflow_id(3, 2), 'reject', 'test_or_spam');
select pg_temp.workflow_actor(8);
select is((select count(*) from public.reports where id = pg_temp.workflow_id(3, 2)), 0::bigint, 'closing an unconfirmed report never publishes it to another resident');
select is((select count(*) from public.reports_map where id = pg_temp.workflow_id(3, 2)), 0::bigint, 'closed unconfirmed reports stay off another resident map');
select is(public.can_read_report_id(pg_temp.workflow_id(3, 2)), false, 'closed report related rows stay private');
select pg_temp.workflow_actor(1);
select is((select count(*) from public.reports where id = pg_temp.workflow_id(3, 2)), 1::bigint, 'reporter retains their closed report');

-- Even the official who originally authored a report becomes a supporter on
-- accepted transfer, and cannot impersonate the municipal lead through a GUC.
set local role service_role;
select public.create_official_report_with_media(pg_temp.workflow_id(1, 2), pg_temp.workflow_id(3, 50), '', 'Official observation',
  10.25, 123.8, null, '[]'::jsonb, pg_temp.workflow_id(2, 1), 'flood', null, 'official_field');
set local role authenticated;
select pg_temp.workflow_actor(2);
select public.request_municipal_support(pg_temp.workflow_case(50), 'transfer', 'Municipal lead requested');
select pg_temp.workflow_actor(4);
select public.respond_support_request(pg_temp.workflow_request(50), 'accept');
select pg_temp.workflow_actor(2);
select set_config('disasterlink.location_actor', pg_temp.workflow_id(1, 4)::text, true);
select throws_ok($$update public.reports set title = 'Forged municipal edit' where id = pg_temp.workflow_id(3, 50)$$,
  '42501', null, 'authenticated author cannot forge municipal edit attribution after transfer');
select set_config('disasterlink.location_actor', '', true);
set local role service_role;
select throws_ok($$select public.update_official_report_fields(pg_temp.workflow_id(1, 2), pg_temp.workflow_id(3, 50), '',
  'Forbidden author edit', 10.25, 123.8, null, pg_temp.workflow_id(2, 1))$$, '42501', null, 'legacy author-edit overload also respects accepted municipal lead');

select * from finish();
rollback;
