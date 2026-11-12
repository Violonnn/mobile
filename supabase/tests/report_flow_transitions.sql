begin;
select no_plan();

-- Fixed UUID families keep these fixtures isolated from other test files.
create function pg_temp.flow_id(family integer, item integer) returns uuid
language sql immutable as $$
  select ('d' || family::text || '000000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid;
$$;
create function pg_temp.flow_actor(item integer) returns text language sql as $$
  select set_config('request.jwt.claim.sub', pg_temp.flow_id(1, item)::text, true);
$$;
-- Test-only ID lookup lets privacy assertions still use known IDs under RLS.
create function pg_temp.flow_case(item integer) returns uuid language sql security definer set search_path = '' as $$
  select id from public.incident_cases where source_report_id = pg_temp.flow_id(3, item);
$$;
create function pg_temp.flow_request(item integer) returns uuid language sql as $$
  select id from public.incident_support_requests where incident_case_id = pg_temp.flow_case(item)
    and status = 'requested';
$$;

insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
select pg_temp.flow_id(1, item), 'authenticated', 'authenticated', 'flow-' || item || '@example.test',
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb from generate_series(1, 9) item;
insert into public.barangays(id, name) values
  (pg_temp.flow_id(2, 1), 'Flow Local'), (pg_temp.flow_id(2, 2), 'Flow Other'), (pg_temp.flow_id(2, 3), 'Flow No Office');
insert into public.app_profiles(id, role, first_name, last_name, barangay_id, status) values
  (pg_temp.flow_id(1, 1), 'resident', 'Flow', 'Reporter', pg_temp.flow_id(2, 1), 'active'),
  (pg_temp.flow_id(1, 2), 'officer', 'Flow', 'Reviewer', pg_temp.flow_id(2, 1), 'active'),
  (pg_temp.flow_id(1, 3), 'officer', 'Flow', 'Colleague', pg_temp.flow_id(2, 1), 'active'),
  (pg_temp.flow_id(1, 4), 'officer', 'Flow', 'Other Office', pg_temp.flow_id(2, 2), 'active'),
  (pg_temp.flow_id(1, 5), 'officer', 'Flow', 'Municipal', null, 'active'),
  (pg_temp.flow_id(1, 6), 'mayor', 'Flow', 'Mayor', null, 'active'),
  (pg_temp.flow_id(1, 7), 'officer', 'Flow', 'Suspended', pg_temp.flow_id(2, 1), 'suspended'),
  (pg_temp.flow_id(1, 8), 'admin', 'Flow', 'Admin', null, 'active'),
  (pg_temp.flow_id(1, 9), 'resident', 'Flow', 'Second Reporter', pg_temp.flow_id(2, 1), 'active');
insert into public.reports(id, reporter_id, title, description, barangay_id, location, jurisdiction_status)
select pg_temp.flow_id(3, item), pg_temp.flow_id(1, case when item = 2 then 9 else 1 end), '', 'Flow report ' || item,
  case when item = 12 then pg_temp.flow_id(2, 3) else pg_temp.flow_id(2, 1) end,
  extensions.st_setsrid(extensions.st_makepoint(123.8, 10.25), 4326)::extensions.geography,
  case when item in (10, 11) then 'needs_check' else 'in_coverage' end::public.report_jurisdiction_status
from generate_series(1, 18) item;
-- Resident media constraints are deferred, but fixtures remain valid at commit.
insert into public.report_media(report_id, type, storage_path, position)
select pg_temp.flow_id(3, item), 'photo', 'flow/' || item || '/original.jpg', 0 from generate_series(1, 18) item;
insert into public.report_media(report_id, type, storage_path, duration_seconds, position)
select pg_temp.flow_id(3, item), 'video', 'flow/' || item || '/video.mp4', 5, 1 from generate_series(1, 18) item;
set constraints all immediate;
set constraints all deferred;

set local role authenticated;
select pg_temp.flow_actor(1);
select throws_ok($$select public.claim_report_review(pg_temp.flow_id(3, 1))$$, '42501', null, 'resident cannot claim');
select throws_ok($$select public.sync_report_compat_status(pg_temp.flow_id(3, 1))$$, '42501', null, 'internal compatibility RPC is inaccessible');
select is((select count(*) from public.incident_cases), 0::bigint, 'resident cannot read raw cases');
-- A previous legitimate RPC in the same transaction must not leave a guard bypass.
select set_config('disasterlink.report_transition', '1', true);
select throws_ok($$update public.reports set review_outcome = 'verified' where id = pg_temp.flow_id(3, 1)$$,
  '42501', null, 'caller-set GUC cannot forge a review');
select set_config('disasterlink.report_transition', '', true);
select pg_temp.flow_actor(7);
select throws_ok($$select public.claim_report_review(pg_temp.flow_id(3, 1))$$, '42501', null, 'suspended officer cannot claim');
select pg_temp.flow_actor(6);
select throws_ok($$select public.claim_report_review(pg_temp.flow_id(3, 1))$$, '42501', null, 'Mayor cannot claim');
select pg_temp.flow_actor(5);
select throws_ok($$select public.claim_report_review(pg_temp.flow_id(3, 1))$$, '42501', null, 'MDRRMO cannot claim an active BDRRMO queue');
select lives_ok($$select public.claim_report_review(pg_temp.flow_id(3, 12))$$, 'MDRRMO claims when no active BDRRMO exists');
select lives_ok($$select public.review_report(pg_temp.flow_id(3, 12), 'verify')$$, 'MDRRMO reviews an unstaffed barangay');
select is((select status::text from public.reports where id = pg_temp.flow_id(3, 12)), 'verified', 'municipal intake is confirmed without a fictitious transfer');

select pg_temp.flow_actor(2);
select throws_ok($$select public.review_report(pg_temp.flow_id(3, 1), 'verify')$$, '42501', null, 'review needs own claim');
select lives_ok($$select public.claim_report_review(pg_temp.flow_id(3, 1))$$, 'claim pending report');
select is((select status::text from public.reports where id = pg_temp.flow_id(3, 1)), 'unverified', 'claim does not confirm');
select is((select incident_case_id from public.reports where id = pg_temp.flow_id(3, 1)), null::uuid, 'claim creates no incident');
select pg_temp.flow_actor(3);
select throws_ok($$select public.claim_report_review(pg_temp.flow_id(3, 1))$$, '42501', null, 'takeover must be explicit');
select lives_ok($$select public.claim_report_review(pg_temp.flow_id(3, 1), true)$$, 'same office can take over');
select is((select detail->>'previous_claimant' from public.report_status_history where report_id = pg_temp.flow_id(3, 1)
  and event_type = 'review_taken_over'), pg_temp.flow_id(1, 2)::text, 'takeover records previous reviewer');
select pg_temp.flow_actor(2);
select throws_ok($$select public.release_report_review(pg_temp.flow_id(3, 1))$$, '42501', null, 'previous claimant cannot release');
select pg_temp.flow_actor(3);
select lives_ok($$select public.release_report_review(pg_temp.flow_id(3, 1), 'End of duty')$$, 'claimant releases');
select is((select review_claimed_by from public.reports where id = pg_temp.flow_id(3, 1)), null::uuid, 'release clears claim');
select pg_temp.flow_actor(4);
select throws_ok($$select public.claim_report_review(pg_temp.flow_id(3, 1), true)$$, '42501', null, 'different office cannot take over');

select pg_temp.flow_actor(2);
select public.claim_report_review(pg_temp.flow_id(3, 1));
select lives_ok($$select public.log_report_contact(pg_temp.flow_id(3, 1), 'reporter_call', '{"outcome":"reached"}')$$, 'reporter call recorded');
select lives_ok($$select public.log_report_contact(pg_temp.flow_id(3, 1), 'hotline_contacted', '{"service":"bfp","outcome":"reached"}')$$, 'hotline contact recorded separately');
select lives_ok($$select public.log_report_contact(pg_temp.flow_id(3, 1), 'assistance_requested', '{"service":"bfp","requested":"Fire response"}')$$, 'assistance request recorded separately');
select throws_ok($$select public.log_report_contact(pg_temp.flow_id(3, 1), 'dispatch_confirmed', '{"service":"bfp"}')$$, '22023', null, 'dispatch needs confirmer and method');
select throws_ok($$select public.log_report_contact(pg_temp.flow_id(3, 1), 'reporter_call', '{"outcome":"reached","phone":"09179990000"}')$$, '22023', null, 'contact cannot store phone field');
select throws_ok($$select public.log_report_contact(pg_temp.flow_id(3, 1), 'external_info', '{"source":"Call 09179990000"}')$$, '22023', null, 'contact cannot embed a phone number');
select lives_ok($$select public.log_report_contact(pg_temp.flow_id(3, 1), 'dispatch_confirmed', '{"service":"bfp","confirmed_by":"Duty officer","method":"radio"}')$$, 'confirmed dispatch recorded');
select is((select review_outcome::text from public.reports where id = pg_temp.flow_id(3, 1)), 'pending', 'contact and dispatch never verify');
select lives_ok($$select public.review_report(pg_temp.flow_id(3, 1), 'verify', null, 'Evidence confirms incident')$$, 'verify creates a confirmed incident');
select is((select count(*) from public.incident_events where incident_case_id = pg_temp.flow_case(1)
  and event_type in ('reporter_call','hotline_contacted','assistance_requested','dispatch_confirmed')), 4::bigint, 'pre-incident events copied exactly once');
select throws_ok($$select public.review_report(pg_temp.flow_id(3, 1), 'verify')$$, '42501', null, 'repeated review cannot create another incident');
select is((select count(*) from public.incident_cases where source_report_id = pg_temp.flow_id(3, 1)), 1::bigint, 'one source report has one case');
select throws_ok($$select public.reopen_report_review(pg_temp.flow_id(3, 1), 'Retry')$$, '22023', null, 'confirmed review cannot be reopened as a pending report');

select public.claim_report_review(pg_temp.flow_id(3, 2));
select throws_ok($$select public.review_report(pg_temp.flow_id(3, 2), 'reject', 'other')$$, '22023', null, 'other rejection needs note');
select throws_ok($$select public.review_report(pg_temp.flow_id(3, 2), 'reject', 'made_up')$$, '22023', null, 'rejection vocabulary is enforced');
select lives_ok($$select public.review_report(pg_temp.flow_id(3, 2), 'reject', 'test_or_spam')$$, 'reject with approved reason');
select is((select status::text from public.reports where id = pg_temp.flow_id(3, 2)), 'closed', 'rejection maps to closed');
select lives_ok($$select public.reopen_report_review(pg_temp.flow_id(3, 2), 'New information')$$, 'rejected review reopens');
select public.claim_report_review(pg_temp.flow_id(3, 2));
select throws_ok($$select public.review_report(pg_temp.flow_id(3, 2), 'could_not_confirm')$$, '22023', null, 'could-not-confirm needs explanation');
select lives_ok($$select public.review_report(pg_temp.flow_id(3, 2), 'could_not_confirm', null, 'No confirming evidence')$$, 'could-not-confirm closes review');
select lives_ok($$select public.reopen_report_review(pg_temp.flow_id(3, 2), 'Evidence arrived')$$, 'could-not-confirm review reopens');
select public.claim_report_review(pg_temp.flow_id(3, 2));
select lives_ok($$select public.review_report(pg_temp.flow_id(3, 2), 'link', null, null, pg_temp.flow_case(1))$$, 'report links to active case');
select is((select incident_case_id from public.reports where id = pg_temp.flow_id(3, 2)), pg_temp.flow_case(1), 'linked reports share case');
select is((select count(*) from public.list_incident_link_candidates(pg_temp.flow_id(3, 3), -1, 9999)), 1::bigint, 'candidate inputs clamped with scope');
select cmp_ok(public.count_nearby_pending_reports(pg_temp.flow_id(3, 3), -1, 9999), '>', 0, 'nearby pending count works');

select public.claim_report_review(pg_temp.flow_id(3, 3));
select lives_ok($$select public.review_report(pg_temp.flow_id(3, 3), 'needs_assessment')$$, 'assessment creates provisional case');
select is((select verification::text from public.incident_cases where id = pg_temp.flow_case(3)), 'pending', 'provisional case unconfirmed');
select throws_ok($$select public.resolve_incident(pg_temp.flow_case(3), 'Done', 'All safe')$$, '22023', null, 'provisional case cannot resolve');
select lives_ok($$select public.request_municipal_support(pg_temp.flow_case(3), 'support', 'Assessment assistance')$$, 'provisional case can request support');
select throws_ok($$select public.request_municipal_support(pg_temp.flow_case(3), 'support', 'Duplicate')$$, '42501', null, 'one open support request');
select pg_temp.flow_actor(5);
select throws_ok($$select public.respond_support_request(pg_temp.flow_request(3), 'return')$$, '22023', null, 'return requires note');
select lives_ok($$select public.respond_support_request(pg_temp.flow_request(3), 'return', 'Use local team first')$$, 'return restores local coordination');
select is((select coordination::text from public.incident_cases where id = pg_temp.flow_case(3)), 'local', 'returned support is local');
select pg_temp.flow_actor(2);
select public.request_municipal_support(pg_temp.flow_case(3), 'support', null);
select lives_ok($$select public.cancel_support_request(pg_temp.flow_request(3), 'Local team available')$$, 'lead cancels support');
select public.request_municipal_support(pg_temp.flow_case(3), 'support', null);
select pg_temp.flow_actor(5);
select lives_ok($$select public.respond_support_request(pg_temp.flow_request(3), 'accept')$$, 'MDRRMO accepts provisional support');
select is((select coordination::text from public.incident_cases where id = pg_temp.flow_case(3)), 'support_active', 'accepted support does not transfer lead');
select lives_ok($$select public.log_incident_event(pg_temp.flow_case(3), 'responders_on_site', '{"service":"mdrrmo_rescue"}', null)$$, 'supporter records internal action');
select throws_ok($$select public.log_incident_event(pg_temp.flow_case(3), 'progress_update', '{"text":"Assessing"}', null, true)$$, '42501', null, 'supporter cannot publish');
select pg_temp.flow_actor(2);
select public.request_municipal_support(pg_temp.flow_case(3), 'transfer', 'Municipal equipment needed');
select pg_temp.flow_actor(5);
select lives_ok($$select public.respond_support_request(pg_temp.flow_request(3), 'return', 'Continue support')$$, 'transfer return restores support_active');
select is((select coordination::text from public.incident_cases where id = pg_temp.flow_case(3)), 'support_active', 'previous support coordination preserved');
select pg_temp.flow_actor(2);
select public.request_municipal_support(pg_temp.flow_case(3), 'transfer', 'Municipal lead required');
select pg_temp.flow_actor(5);
select lives_ok($$select public.respond_support_request(pg_temp.flow_request(3), 'accept')$$, 'provisional transfer accepted');
select lives_ok($$select public.record_incident_finding(pg_temp.flow_case(3), 'confirmed', 'Field team confirms')$$, 'municipal lead records single provisional finding');
select is((select municipal_finding::text from public.incident_cases where id = pg_temp.flow_case(3)), 'confirmed', 'field finding also supplies municipal finding');
select throws_ok($$select public.record_incident_finding(pg_temp.flow_case(3), 'confirmed', 'Duplicate')$$, '22023', null, 'second finding refused');
select pg_temp.flow_actor(2);
select throws_ok($$select public.resolve_incident(pg_temp.flow_case(3), 'Done', 'All safe')$$, '42501', null, 'supporting BDRRMO cannot resolve');
select lives_ok($$select public.log_incident_event(pg_temp.flow_case(3), 'work_done', '{"action":"Cleared debris"}', null)$$, 'BDRRMO retains internal supporting actions');
select pg_temp.flow_actor(5);
select throws_ok($$select public.resolve_incident(pg_temp.flow_case(3), 'Done', '')$$, '22023', null, 'public summary required');
select lives_ok($$select public.resolve_incident(pg_temp.flow_case(3), 'Work completed', 'Road cleared and safe')$$, 'lead resolves confirmed incident');
select throws_ok($$select public.log_incident_event(pg_temp.flow_case(3), 'work_done', '{"action":"More work"}', null)$$, '22023', null, 'resolved case rejects response actions');
select lives_ok($$select public.reopen_incident(pg_temp.flow_case(3), 'New flooding')$$, 'resolved case reopens confirmed');
select is((select verification::text from public.incident_cases where id = pg_temp.flow_case(3)), 'confirmed', 'resolved reopening retains confirmation');

select pg_temp.flow_actor(2);
select public.claim_report_review(pg_temp.flow_id(3, 4));
select public.review_report(pg_temp.flow_id(3, 4), 'needs_assessment');
select lives_ok($$select public.record_incident_finding(pg_temp.flow_case(4), 'not_confirmed', 'Field check found no incident')$$, 'provisional not-confirmed closes privately');
select is((select withdrawn_at from public.incident_cases where id = pg_temp.flow_case(4)), null::timestamptz, 'never-public case has no withdrawal');
select lives_ok($$select public.reopen_incident(pg_temp.flow_case(4), 'New evidence')$$, 'closed provisional case reopens');
select lives_ok($$select public.record_incident_finding(pg_temp.flow_case(4), 'confirmed', 'Field evidence confirms')$$, 'local field finding confirms');
select public.request_municipal_support(pg_temp.flow_case(4), 'transfer', 'Municipal review needed');
select pg_temp.flow_actor(5);
select public.respond_support_request(pg_temp.flow_request(4), 'accept');
select throws_ok($$select public.record_incident_finding(pg_temp.flow_case(4), 'not_confirmed', 'Incorrect confirmation')$$, '22023', null, 'public withdrawal requires correction');
select lives_ok($$select public.record_incident_finding(pg_temp.flow_case(4), 'not_confirmed', 'Incorrect confirmation', 'Field review did not confirm this incident.')$$, 'withdraw public confirmation with correction');
select is((select state::text from public.incident_cases where id = pg_temp.flow_case(4)), 'closed', 'withdrawn case closed');
select lives_ok($$select public.reopen_incident(pg_temp.flow_case(4), 'Further evidence')$$, 'withdrawn case reopens provisional');
select is((select verification::text from public.incident_cases where id = pg_temp.flow_case(4)), 'pending', 'withdrawn reopening requires new finding');
select lives_ok($$select public.record_incident_finding(pg_temp.flow_case(4), 'confirmed', 'New evidence confirms')$$, 'reopened withdrawn case can confirm again');
select is((select withdrawn_at from public.incident_cases where id = pg_temp.flow_case(4)), null::timestamptz, 'new confirmation clears current withdrawal marker');

select pg_temp.flow_actor(2);
select public.claim_report_review(pg_temp.flow_id(3, 5));
select throws_ok($$select public.reroute_report_barangay(pg_temp.flow_id(3, 5), pg_temp.flow_id(2, 2), '')$$, '22023', null, 'reroute reason required');
select lives_ok($$select public.reroute_report_barangay(pg_temp.flow_id(3, 5), pg_temp.flow_id(2, 2), 'Wrong barangay selected')$$, 'receiving BDRRMO reroutes across barangays');
select pg_temp.flow_actor(4);
select is((select review_claimed_by from public.reports where id = pg_temp.flow_id(3, 5)), null::uuid, 'reroute clears old claim');
select alike((select detail->>'public_text' from public.report_status_history where report_id = pg_temp.flow_id(3, 5)
  and event_type = 'routing_changed'), '%Flow Other%', 'routing timeline names new office');
select pg_temp.flow_actor(2);
select throws_ok($$select public.claim_report_review(pg_temp.flow_id(3, 10))$$, '22023', null, 'boundary report cannot be claimed before jurisdiction check');
select throws_ok($$select public.resolve_report_jurisdiction(pg_temp.flow_id(3, 10), 'in_coverage')$$, '42501', null, 'BDRRMO cannot decide jurisdiction');
select pg_temp.flow_actor(5);
select lives_ok($$select public.resolve_report_jurisdiction(pg_temp.flow_id(3, 10), 'in_coverage', pg_temp.flow_id(2, 2))$$, 'MDRRMO checks jurisdiction and routes');
select is((select verified_at from public.reports where id = pg_temp.flow_id(3, 10)), null::timestamptz, 'jurisdiction never verifies');
select is((select reviewed_at from public.reports where id = pg_temp.flow_id(3, 10)), null::timestamptz, 'jurisdiction never records a review decision');
select is((select incident_case_id from public.reports where id = pg_temp.flow_id(3, 10)), null::uuid, 'jurisdiction creates no incident');
select lives_ok($$select public.resolve_report_jurisdiction(pg_temp.flow_id(3, 11), 'outside_coverage')$$, 'MDRRMO closes outside coverage');
select is((select status::text from public.reports where id = pg_temp.flow_id(3, 11)), 'closed', 'outside coverage maps closed');

-- A NULL barangay must deny scope, rather than falling through a SQL IF NULL.
reset role;
update public.reports set barangay_id = null where id = pg_temp.flow_id(3, 18);
set local role authenticated;
select pg_temp.flow_actor(2);
select throws_ok($$select public.reroute_report_barangay(pg_temp.flow_id(3,18), pg_temp.flow_id(2,1), 'Not my queue')$$,
  '42501', null, 'unassigned report is not a BDRRMO reroute target');
select pg_temp.flow_actor(5);
select public.claim_report_review(pg_temp.flow_id(3,18));
select public.review_report(pg_temp.flow_id(3,18), 'verify');
select pg_temp.flow_actor(2);
select public.claim_report_review(pg_temp.flow_id(3,9));
select throws_ok($$select public.review_report(pg_temp.flow_id(3,9), 'link', null, null, pg_temp.flow_case(18))$$,
  '42501', null, 'NULL barangay municipal case cannot bypass BDRRMO link scope');

select pg_temp.flow_actor(2);
select lives_ok($$select public.log_incident_event(pg_temp.flow_case(1), 'progress_update', '{"text":"Responders assessing the area"}', null, true)$$, 'lead posts public update');
select throws_ok($$select public.log_incident_event(pg_temp.flow_case(1), 'progress_update', '{"text":"Another update"}', null, true)$$, '22023', null, 'public update throttled');
select throws_ok($$select public.log_incident_event(pg_temp.flow_case(1), 'work_done', '{"action":"Cleared"}', null, true)$$, '42501', null, 'response action cannot masquerade as public update');
select throws_ok($$select public.log_incident_event(pg_temp.flow_case(1), 'work_done', '{"action":"Cleared"}', null, false, now() + interval '1 hour')$$, '22023', null, 'future event rejected');
select throws_ok($$select public.log_incident_event(pg_temp.flow_case(1), 'work_done', '{"action":"Cleared"}', null, false, now() - interval '1 year')$$, '22023', null, 'pre-creation event rejected');
select lives_ok($$select public.set_incident_public_location(pg_temp.flow_case(1), 'exact_for_safety', 'Road closure')$$, 'lead publishes exact safety location');
select throws_ok($$select public.set_incident_public_location(pg_temp.flow_case(1), 'exact_for_safety', '')$$, '22023', null, 'exact location requires reason');
select lives_ok($$select public.set_incident_sensitive(pg_temp.flow_case(1), true, 'Identifiable home')$$, 'mark sensitive');
select is((select public_location_mode from public.incident_cases where id = pg_temp.flow_case(1)), 'barangay_only', 'sensitive incident forces coarse location');
select throws_ok($$select public.set_incident_public_location(pg_temp.flow_case(1), 'approximate_area')$$, '22023', null, 'sensitive incident refuses coordinates');
select lives_ok($$select public.set_incident_sensitive(pg_temp.flow_case(1), false, 'Screening complete')$$, 'lead removes sensitivity with reason');

select pg_temp.flow_actor(6);
select throws_ok($$select public.request_mayor_update()$$, '22023', null, 'Mayor request needs exactly one target');
select lives_ok($$select public.request_mayor_update(null, pg_temp.flow_case(1), 'Current progress?')$$, 'Mayor requests office update');
select throws_ok($$select public.request_mayor_update(null, pg_temp.flow_case(1))$$, '23505', null, 'one open request per target');
select is((select count(*) from public.incident_cases), 0::bigint, 'Mayor cannot select raw incident cases');
select pg_temp.flow_actor(4);
select throws_ok($$select public.acknowledge_update_request((select id from public.incident_update_requests limit 1))$$,
  'P0002', null, 'different office cannot see or acknowledge request');
select pg_temp.flow_actor(2);
select lives_ok($$select public.acknowledge_update_request((select id from public.incident_update_requests where incident_case_id = pg_temp.flow_case(1)))$$, 'responsible office acknowledges');
select throws_ok($$select public.answer_update_request((select id from public.incident_update_requests where incident_case_id = pg_temp.flow_case(1)), '')$$, '22023', null, 'Mayor answer required');
select lives_ok($$select public.answer_update_request((select id from public.incident_update_requests where incident_case_id = pg_temp.flow_case(1)), 'Team is assessing the area')$$, 'office answers');
select pg_temp.flow_actor(6);
select lives_ok($$select public.request_mayor_update(pg_temp.flow_id(3, 6))$$, 'Mayor requests pending report update');
select lives_ok($$select public.cancel_update_request((select id from public.incident_update_requests where report_id = pg_temp.flow_id(3, 6)))$$, 'Mayor cancels own open request');
select pg_temp.flow_actor(2);
select throws_ok($$select public.request_mayor_update(pg_temp.flow_id(3, 6))$$, '42501', null, 'officer cannot request Mayor update');
select throws_ok($$select public.cancel_update_request((select id from public.incident_update_requests limit 1))$$, '42501', null, 'officer cannot cancel Mayor request');

-- Legacy wrapper parity: local resolve and municipal reverify/resolve.
select lives_ok($$select public.transition_report_status(pg_temp.flow_id(3, 7), 'verified', 'Legacy review')$$, 'legacy BDRRMO verify');
select lives_ok($$select public.transition_report_status(pg_temp.flow_id(3, 7), 'resolved')$$, 'legacy local resolve');
select is((select public_summary from public.incident_cases where id = pg_temp.flow_case(7)), null::text, 'legacy resolution never fabricates summary');
select is((select legacy_resolution from public.incident_cases where id = pg_temp.flow_case(7)), true, 'legacy summary absence explicit');
select lives_ok($$select public.add_public_summary(pg_temp.flow_case(7), 'Area is now safe')$$, 'lead supplies legacy summary');
select throws_ok($$select public.add_public_summary(pg_temp.flow_case(7), 'Replace outcome')$$, '22023', null, 'summary addition cannot overwrite recorded outcome');
select public.transition_report_status(pg_temp.flow_id(3, 8), 'verified');
select lives_ok($$select public.transition_report_status(pg_temp.flow_id(3, 8), 'escalated')$$, 'legacy transfer request');
select pg_temp.flow_actor(5);
select lives_ok($$select public.transition_report_status(pg_temp.flow_id(3, 8), 'verified')$$, 'legacy MDRRMO accepts and records finding');
select lives_ok($$select public.transition_report_status(pg_temp.flow_id(3, 8), 'resolved')$$, 'legacy MDRRMO resolves');
select pg_temp.flow_actor(2);
select throws_ok($$select public.transition_report_status(pg_temp.flow_id(3, 8), 'escalated')$$, '42501', null, 'legacy BDRRMO cannot re-escalate municipal case');

reset role;
-- Backfill fixtures deliberately model rows before the lifecycle existed.
set constraints all immediate;
alter table public.reports disable trigger trg_reports_normalize;
alter table public.reports disable trigger trg_reports_official_case;
insert into public.reports(id, reporter_id, title, description, location, barangay_id, status,
  verified_by, verified_at, escalated_by, escalated_at, reverified_by, reverified_at, resolved_by, resolved_at,
  intake_channel)
select pg_temp.flow_id(3, 20 + item), pg_temp.flow_id(1, case when item = 5 then 5 else 2 end), '', 'Legacy fixture',
  extensions.st_setsrid(extensions.st_makepoint(123.8, 10.25), 4326)::extensions.geography, pg_temp.flow_id(2, 1),
  case item when 2 then 'escalated' when 4 then 'resolved' else 'verified' end::public.report_status,
  pg_temp.flow_id(1, 2), now() - interval '2 days',
  case when item in (2,3) then pg_temp.flow_id(1, 2) end,
  case when item in (2,3) then now() - interval '1 day' end,
  case when item = 3 then pg_temp.flow_id(1, 5) end, case when item = 3 then now() - interval '12 hours' end,
  case when item = 4 then pg_temp.flow_id(1, 2) end, case when item = 4 then now() - interval '1 hour' end,
  'official_field'::public.report_intake_channel
from generate_series(1,5) item;
alter table public.reports enable trigger trg_reports_normalize;
alter table public.reports enable trigger trg_reports_official_case;
create temp table flow_notification_count as select count(*) as total from public.notifications;
select lives_ok($$select public.backfill_incident_cases()$$, 'legacy backfill runs');
select lives_ok($$select public.backfill_incident_cases()$$, 'legacy backfill reruns idempotently');
select is((select count(*) from public.notifications), (select total from flow_notification_count), 'backfill emits no notifications');
select is((select count(*) from public.incident_cases where source_report_id in (
  select pg_temp.flow_id(3, item) from generate_series(21,25) item)), 5::bigint, 'one case per legacy source');
select is((select lead_office::text from public.incident_cases where id = pg_temp.flow_case(22)), 'barangay', 'legacy escalation leaves barangay responsible');
select is((select legacy_label from public.incident_support_requests where incident_case_id = pg_temp.flow_case(22)),
  'Legacy escalation — MDRRMO acceptance not recorded', 'legacy request label explicit');
select is((select municipal_finding_at from public.incident_cases where id = pg_temp.flow_case(23)),
  (select reverified_at from public.reports where id = pg_temp.flow_id(3,23)), 'backfill preserves municipal finding time');
select is((select count(*) from public.incident_support_requests where incident_case_id = pg_temp.flow_case(23)), 0::bigint, 'Q5 invents no acceptance row');
select alike((select details->>'legacy_label' from public.incident_events where incident_case_id = pg_temp.flow_case(23)),
  '%separate transfer acceptance was not recorded%', 'Q5 handoff label explains missing acceptance');
select is((select public_summary from public.incident_cases where id = pg_temp.flow_case(24)), null::text, 'backfill leaves historical summary absent');
select is((select status::text from public.reports where id = pg_temp.flow_id(3,25)), 'verified', 'municipal authorship alone does not turn a verified legacy report into an escalation');
select is((select lead_office::text from public.incident_cases where id = pg_temp.flow_case(25)), 'barangay', 'routed legacy case stays barangay-led without a recorded handoff');
select is((select municipal_finding::text from public.incident_cases where id = pg_temp.flow_case(25)), null::text, 'legacy authorship does not invent a municipal finding');

-- Official intake exercises service-only RPC plus both old overload contracts.
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select lives_ok($$select public.create_official_report_with_media(pg_temp.flow_id(1,2), pg_temp.flow_id(3,30), '', 'Hotline account',
  10.25, 123.8, null, '[]', pg_temp.flow_id(2,1), 'fire', null, 'hotline_call')$$, 'official hotline account intake');
select lives_ok($$select public.create_official_report_with_media(pg_temp.flow_id(1,2), pg_temp.flow_id(3,31), '', 'Saw incident',
  10.25, 123.8, null, '[]', pg_temp.flow_id(2,1), 'fire', null)$$, 'default official field observation');
select lives_ok($$select public.create_official_report_with_media(pg_temp.flow_id(1,2), pg_temp.flow_id(3,32), '', 'Old field client',
  10.25, 123.8, null, '[]', pg_temp.flow_id(2,1))$$, 'nine-argument official intake preserved');
set local role authenticated;
select pg_temp.flow_actor(2);
select is((select status::text from public.reports where id = pg_temp.flow_id(3,30)), 'unverified', 'hotline account recorded, not confirmed');
select is((select incident_case_id from public.reports where id = pg_temp.flow_id(3,30)), null::uuid, 'hotline intake creates no incident');
select is((select confirmation_basis::text from public.incident_cases where id = pg_temp.flow_case(31)), 'official_observation', 'field observation confirmed with explicit basis');
select public.claim_report_review(pg_temp.flow_id(3,30));
select throws_ok($$select public.review_report(pg_temp.flow_id(3,30), 'verify')$$, '22023', null, 'hotline confirmation needs evidence note');
select lives_ok($$select public.review_report(pg_temp.flow_id(3,30), 'verify', null, 'Field team supplied confirming evidence')$$, 'hotline confirmed through normal review');
select throws_ok($$select public.set_report_media_public((select id from public.report_media where report_id = pg_temp.flow_id(3,1) and type = 'video'), true)$$,
  '22023', null, 'videos cannot be published');
select throws_ok($$select public.set_report_media_public((select id from public.report_media where report_id = pg_temp.flow_id(3,1) and type = 'photo'), true)$$,
  '22023', null, 'photo publication requires processed derivatives');

reset role;
update public.report_media set display_storage_path = 'flow/1/display.jpg', thumbnail_storage_path = 'flow/1/thumbnail.jpg'
  where report_id = pg_temp.flow_id(3,1) and type = 'photo';
insert into storage.objects(bucket_id, name) values ('report-media', 'flow/1/display.jpg'), ('report-media', 'flow/1/thumbnail.jpg');
set local role authenticated;
select pg_temp.flow_actor(2);
select throws_ok($$select public.set_report_media_public((select id from public.report_media where report_id = pg_temp.flow_id(3,1) and type = 'photo'), true)$$,
  '22023', 'Photo publication requires a confirmed non-sensitive incident and verified safe copies.', 'MIME and size alone cannot authorize publication');
select ok((select public_approved_at is null from public.report_media where report_id = pg_temp.flow_id(3,1) and type = 'photo'), 'unverified metadata cannot receive approval');
select lives_ok($$select public.set_incident_sensitive(pg_temp.flow_case(1), true, 'People identifiable')$$, 'sensitivity revokes photo approval');
select is((select public_approved_at from public.report_media where report_id = pg_temp.flow_id(3,1) and type = 'photo'), null::timestamptz, 'sensitive photo revoked');
select throws_ok($$select public.set_report_media_public((select id from public.report_media where report_id = pg_temp.flow_id(3,1) and type = 'photo'), true)$$,
  '22023', null, 'sensitive photo cannot be republished');
select public.set_incident_sensitive(pg_temp.flow_case(1), false, 'Screening finished');
select throws_ok($$select public.set_report_media_public((select id from public.report_media where report_id = pg_temp.flow_id(3,1) and type = 'photo'), true)$$,
  '22023', null, 'removing sensitivity does not bypass metadata verification');
select lives_ok($$select public.set_report_media_public((select id from public.report_media where report_id = pg_temp.flow_id(3,1) and type = 'photo'), false, 'Revoke')$$,
  'lead revokes photo publication');
select is((select storage_path from public.report_media where report_id = pg_temp.flow_id(3,1) and type = 'photo'), 'flow/1/original.jpg', 'publication never changes original path');
select pg_temp.flow_actor(1);
select throws_ok($$update public.report_media set public_approved_by = pg_temp.flow_id(1,1), public_approved_at = now()
  where report_id = pg_temp.flow_id(3,1) and type = 'photo'$$, '42501', null, 'reporter cannot forge approval');
select throws_ok($$select public.set_incident_sensitive(pg_temp.flow_case(1), false, 'Forged')$$, '42501', null, 'resident cannot change case privacy');
select throws_ok($$select public.log_report_contact(pg_temp.flow_id(3,6), 'reporter_call', '{"outcome":"reached"}')$$,
  '42501', null, 'resident cannot log official contact');
select throws_ok($$select public.count_nearby_pending_reports(pg_temp.flow_id(3,6))$$,
  '42501', null, 'resident cannot count private pending reports');
select throws_ok($$select * from public.list_incident_link_candidates(pg_temp.flow_id(3,6))$$,
  '42501', null, 'resident cannot list raw incident candidates');
select throws_ok($$select public.resolve_incident_legacy(pg_temp.flow_case(1), null)$$, '42501', null, 'legacy resolution internal RPC denied');
select pg_temp.flow_actor(6);
select throws_ok($$select public.set_report_media_public(pg_temp.flow_id(5,99), true)$$,
  '42501', null, 'Mayor cannot probe unknown photo ids');
select throws_ok($$select public.set_report_media_public((select id from public.report_media where report_id = pg_temp.flow_id(3,1) and type = 'photo'), true)$$,
  '42501', null, 'Mayor cannot publish photos');
select throws_ok($$select public.reopen_incident(pg_temp.flow_case(7), 'Mayor attempt')$$, '42501', null, 'Mayor cannot reopen incidents');

select public.request_mayor_update(pg_temp.flow_id(3,6), null, 'Pending update');
select pg_temp.flow_actor(2);
select public.claim_report_review(pg_temp.flow_id(3,6));
select public.review_report(pg_temp.flow_id(3,6), 'verify');
select is((select report_id from public.incident_update_requests where incident_case_id = pg_temp.flow_case(6)), null::uuid,
  'pending update request moves onto the new incident');
select public.request_municipal_support(pg_temp.flow_case(6), 'transfer', 'Municipal lead needed');
select pg_temp.flow_actor(5);
select public.respond_support_request(pg_temp.flow_request(6), 'accept');
select is((select responsible_office::text from public.incident_update_requests where incident_case_id = pg_temp.flow_case(6)),
  'municipal', 'open Mayor request follows transferred responsibility');

set local role authenticated;
select pg_temp.flow_actor(2);
select public.request_municipal_support(pg_temp.flow_case(1), 'transfer', 'Municipal finding required');
select pg_temp.flow_actor(5);
select public.respond_support_request(pg_temp.flow_request(1), 'accept');
select public.record_incident_finding(pg_temp.flow_case(1), 'not_confirmed', 'New field review', 'Review did not confirm this incident.');
reset role;
select is((select count(*) from public.notifications where type = 'report_withdrawn' and related_entity_id in (
  pg_temp.flow_id(3,1), pg_temp.flow_id(3,2))), 2::bigint, 'withdrawal notifies every distinct linked reporter once');
select is((select count(*) from (select dedupe_key from public.notifications where dedupe_key like 'incident-event:%'
  group by dedupe_key having count(*) > 1) duplicates), 0::bigint, 'event-recipient notifications deduplicated');
select is((select count(*) from public.notifications where type = 'mayor_update_answered'
  and user_id = pg_temp.flow_id(1,6)), 2::bigint, 'Mayor receives acknowledgement and answer once each');
select ok(not exists (select 1 from pg_proc function join pg_namespace namespace on namespace.oid = function.pronamespace
  where namespace.nspname = 'public' and function.proname in ('sync_report_compat_status', 'resolve_incident_legacy', 'backfill_incident_cases')
  and has_function_privilege('authenticated', function.oid, 'EXECUTE')), 'internal mutation routines not exposed');
select * from finish();
rollback;
