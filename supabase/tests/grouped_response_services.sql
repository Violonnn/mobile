begin;
select no_plan();

create function pg_temp.group_id(family integer, item integer) returns uuid
language sql immutable as $$
  select ('b' || family::text || '000000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid;
$$;
create function pg_temp.group_actor(item integer) returns text language sql as $$
  select set_config('request.jwt.claim.sub', pg_temp.group_id(1, item)::text, true);
$$;
create function pg_temp.group_case(item integer) returns uuid
language sql security definer set search_path = '' as $$
  select id from public.incident_cases where source_report_id = pg_temp.group_id(3, item);
$$;
-- The same category in two towns is deliberate: identity includes municipality.
create function pg_temp.group_payload(item integer, event_type text default 'hotline_contacted') returns jsonb
language sql as $$
  select jsonb_build_object('submission_id', pg_temp.group_id(4, item)::text, 'services',
    jsonb_agg(jsonb_build_object('details', jsonb_build_object(
      'service', case when service_number = 3 then 'pnp' else 'bfp' end,
      'service_name', case when service_number = 3 then 'Police Station' else 'Fire Station' end,
      'municipality', case when service_number = 2 then 'Talisay' else 'Minglanilla' end)
      || case event_type
        when 'hotline_contacted' then '{"outcome":"reached"}'::jsonb
        when 'assistance_requested' then '{"requested":"Additional response crew"}'::jsonb
        when 'dispatch_confirmed' then '{"confirmed_by":"Duty officer","method":"radio"}'::jsonb
        else '{}'::jsonb end,
      'note', case when service_number = 1 then '  Primary team  ' else null end)
      order by service_number))
  from generate_series(1, 3) service_number;
$$;

insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
select pg_temp.group_id(1, item), 'authenticated', 'authenticated', 'group-' || item || '@example.test',
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb from generate_series(1, 4) item;
insert into public.barangays(id, name) values
  (pg_temp.group_id(2, 1), 'Grouped Local'), (pg_temp.group_id(2, 2), 'Grouped Other');
insert into public.app_profiles(id, role, first_name, last_name, barangay_id, status) values
  (pg_temp.group_id(1, 1), 'resident', 'Grouped', 'Resident', pg_temp.group_id(2, 1), 'active'),
  (pg_temp.group_id(1, 2), 'officer', 'Grouped', 'Lead', pg_temp.group_id(2, 1), 'active'),
  (pg_temp.group_id(1, 3), 'officer', 'Grouped', 'Other', pg_temp.group_id(2, 2), 'active'),
  (pg_temp.group_id(1, 4), 'officer', 'Grouped', 'Municipal', null, 'active');
insert into public.reports(id, reporter_id, title, description, barangay_id, location)
select pg_temp.group_id(3, item), pg_temp.group_id(1, 1), '', 'Grouped report ' || item,
  pg_temp.group_id(2, 1),
  extensions.st_setsrid(extensions.st_makepoint(123.8, 10.25), 4326)::extensions.geography
from generate_series(1, 4) item;
insert into public.report_media(report_id, type, storage_path, position)
select pg_temp.group_id(3, item), 'photo', 'grouped/' || item || '/original.jpg', 0 from generate_series(1, 4) item;
insert into public.report_media(report_id, type, storage_path, duration_seconds, position)
select pg_temp.group_id(3, item), 'video', 'grouped/' || item || '/video.mp4', 5, 1 from generate_series(1, 4) item;
set constraints all immediate;
set constraints all deferred;

set local role authenticated;
select pg_temp.group_actor(2);
select public.claim_report_review(pg_temp.group_id(3, 1));
select public.review_report(pg_temp.group_id(3, 1), 'verify');
select throws_ok($$select public.validate_response_event('hotline_contacted', pg_temp.group_payload(1))$$,
  '42501', null, 'validator remains inaccessible as a client RPC');

select pg_temp.group_actor(1);
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted', pg_temp.group_payload(1), null)$$,
  '42501', null, 'resident cannot log a grouped incident activity');
select throws_ok($$select public.log_report_contact(pg_temp.group_id(3, 2), 'hotline_contacted', pg_temp.group_payload(1))$$,
  '42501', null, 'resident cannot log grouped pre-incident contacts');
select pg_temp.group_actor(3);
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted', pg_temp.group_payload(1), null)$$,
  '42501', null, 'another office cannot log a grouped incident activity');
select throws_ok($$select public.log_report_contact(pg_temp.group_id(3, 2), 'hotline_contacted', pg_temp.group_payload(1))$$,
  '42501', null, 'another office cannot log grouped pre-incident contacts');

select pg_temp.group_actor(2);
select lives_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted', pg_temp.group_payload(1), '  Coordinated response  ')$$,
  'three services including an external town create one activity');
select is((select count(*) from public.incident_events where incident_case_id = pg_temp.group_case(1)
  and event_type = 'hotline_contacted'), 1::bigint, 'three service selections create exactly one event row');
select is((select jsonb_array_length(details->'services') from public.incident_events where incident_case_id = pg_temp.group_case(1)
  and event_type = 'hotline_contacted'), 3, 'one activity retains all three services');
select is((select details#>>'{services,0,note}' from public.incident_events where incident_case_id = pg_temp.group_case(1)
  and event_type = 'hotline_contacted'), 'Primary team', 'per-service notes are normalized');
select is((select details#>>'{services,1,details,municipality}' from public.incident_events where incident_case_id = pg_temp.group_case(1)
  and event_type = 'hotline_contacted'), 'Talisay', 'external municipality is retained without a local jurisdiction lookup');
select is((public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted', pg_temp.group_payload(1), 'Coordinated response')).id,
  (select id from public.incident_events where incident_case_id = pg_temp.group_case(1) and event_type = 'hotline_contacted'),
  'retry returns the original activity ID using normalized notes');
select is((select count(*) from public.incident_events where incident_case_id = pg_temp.group_case(1)
  and details->>'submission_id' = pg_temp.group_id(4, 1)::text), 1::bigint, 'retry never appends another audit row');
select lives_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(1), '{submission_id}', to_jsonb(upper(pg_temp.group_id(4, 1)::text))), 'Coordinated response')$$,
  'UUID casing is normalized before retry matching');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted', pg_temp.group_payload(1), 'Changed note')$$,
  '22023', null, 'same submission ID with a changed note is rejected');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(1), '{services,2,details,outcome}', '"no_answer"'), 'Coordinated response')$$,
  '22023', null, 'same submission ID with changed service details is rejected');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'dispatch_confirmed',
  pg_temp.group_payload(1, 'dispatch_confirmed'), 'Coordinated response')$$,
  '22023', null, 'same submission ID with another event type is rejected');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted', pg_temp.group_payload(1),
  'Coordinated response', false, now())$$, '22023', null, 'retry cannot replace the original occurrence time');

select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(2), '{services,2,details,outcome}', '"invented"'), null)$$,
  '22023', null, 'invalid final nested entry rejects the whole activity');
select is((select count(*) from public.incident_events where incident_case_id = pg_temp.group_case(1)
  and details->>'submission_id' = pg_temp.group_id(4, 2)::text), 0::bigint, 'invalid nested entry inserts no partial event');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(2), '{services,1,details}',
    '{"service":"bfp","service_name":"  fIRE   sTATION  ","municipality":"  mINGLANILLA  ","outcome":"no_answer"}'), null)$$,
  '22023', null, 'duplicate identities ignore case and repeated whitespace, even with different outcomes');
select lives_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(2), '{services,1,details}',
    '{"service":"bfp","service_name":"North Fire Team","municipality":"Minglanilla","outcome":"reached"}'), null)$$,
  'same category and municipality with a different team is distinct');
select lives_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(jsonb_set(pg_temp.group_payload(40), '{services,0,details}',
    '{"service":"bfp","service_name":"Alpha","municipality":"Beta","outcome":"reached"}'),
    '{services,1,details}', '{"service":"bfp","service_name":"Beta","municipality":"Alpha","outcome":"reached"}'), null)$$,
  'team and municipality are distinct named identity fields');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  pg_temp.group_payload(3) || '{"unexpected":"value"}', null)$$, '22023', null, 'unknown group keys are rejected');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(3), '{services,0,unexpected}', '"value"'), null)$$,
  '22023', null, 'unknown service-entry keys are rejected');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(3), '{services,0,details,phone}', '"09179990000"'), null)$$,
  '22023', null, 'phone fields inside a service are rejected');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(3), '{services,0,details}', pg_temp.group_payload(4)), null)$$,
  '22023', null, 'nested groups are rejected rather than recursively accepted');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'reporter_call', pg_temp.group_payload(3), null)$$,
  '22023', null, 'reporter calls cannot be grouped services');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'work_done', pg_temp.group_payload(3), null)$$,
  '22023', null, 'non-service activity types cannot contain groups');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(3), '{services}', '[]'), null)$$,
  '22023', null, 'a group cannot contain zero services');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(3), '{services}',
    (select jsonb_agg(pg_temp.group_payload(3)->'services'->0) from generate_series(1, 21))), null)$$,
  '22023', null, 'a group cannot exceed twenty services');
select lives_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(41), '{services}',
    (select jsonb_agg(jsonb_build_object('details', jsonb_build_object('service', 'bfp',
      'service_name', 'Crew ' || item, 'municipality', 'Minglanilla', 'outcome', 'reached'), 'note', null))
      from generate_series(1, 20) item)), null)$$,
  'exactly twenty distinct services are accepted as one activity');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(3), '{submission_id}', '"invalid"'), null)$$,
  '22023', null, 'submission IDs must be UUID strings');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  pg_temp.group_payload(3) - 'submission_id', null)$$,
  '22023', null, 'a grouped activity always requires a submission ID');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(3), '{services}', '{}'), null)$$,
  '22023', null, 'services must be an array');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(3), '{services,0}', 'null'), null)$$,
  '22023', null, 'service entries must be objects');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  pg_temp.group_payload(3) #- '{services,0,details,service_name}' #- '{services,0,details,municipality}', null)$$,
  '22023', null, 'a grouped service cannot use anonymous legacy identity');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  pg_temp.group_payload(3) #- '{services,0,details,municipality}', null)$$,
  '22023', null, 'an incomplete identity pair is rejected');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(3), '{services,0,details,municipality}', '"   "'), null)$$,
  '22023', null, 'a required municipality cannot be whitespace');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(3), '{services,0,details,municipality}', to_jsonb(repeat('a', 121))), null)$$,
  '22023', null, 'municipality is bounded to 120 characters');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(3), '{services,0,details,service_name}', to_jsonb(repeat('a', 121))), null)$$,
  '22023', null, 'service name is bounded to 120 characters');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(3), '{services,0,details,service_name}', '"Call 09179990000"'), null)$$,
  '22023', null, 'service identity cannot contain phone numbers');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(3), '{services,0,note}', '"Call 09179990000"'), null)$$,
  '22023', null, 'per-service notes cannot contain phone numbers');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(3), '{services,0,note}', to_jsonb(repeat('a', 501))), null)$$,
  '22023', null, 'per-service notes cannot exceed 500 characters');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(3), '{services,0,note}', '{}'), null)$$,
  '22023', null, 'per-service notes must be text or null');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  pg_temp.group_payload(3), 'Call 09179990000')$$,
  '22023', null, 'group-level notes preserve existing phone-number restriction');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted', pg_temp.group_payload(3), null, true)$$,
  '42501', null, 'grouped service activities cannot be published as progress updates');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  pg_temp.group_payload(3), null, false, now() + interval '1 hour')$$,
  '22023', null, 'grouped activity occurrence time cannot be in the future');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  pg_temp.group_payload(3), null, false, now() - interval '1 year')$$,
  '22023', null, 'grouped activity occurrence time cannot predate incident creation');

select lives_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted', '{"service":"bfp","outcome":"reached"}', null)$$,
  'legacy single-service payload without identity remains valid');
select lives_ok($$select public.log_incident_event(pg_temp.group_case(1), 'reporter_call', '{"outcome":"reached"}', null)$$,
  'legacy reporter-call payload remains valid');
select lives_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  '{"service":"bfp","outcome":"reached","service_name":"  Fire   Crew  ","municipality":"  Minglanilla  "}', null)$$,
  'single-service payload can include an explicit identity pair');
select is((select details->>'service_name' from public.incident_events where incident_case_id = pg_temp.group_case(1)
  and details ? 'service_name'), 'Fire Crew', 'single-service identity collapses internal whitespace');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted',
  '{"service":"bfp","outcome":"reached","service_name":"Fire Crew"}', null)$$,
  '22023', null, 'single-service identity must include municipality when named');
select lives_ok($$select public.log_incident_event(pg_temp.group_case(1), 'assistance_requested', pg_temp.group_payload(5, 'assistance_requested'), null)$$,
  'grouped assistance requests use existing requested-details validation');
select lives_ok($$select public.log_incident_event(pg_temp.group_case(1), 'dispatch_confirmed', pg_temp.group_payload(6, 'dispatch_confirmed'), null)$$,
  'grouped dispatch confirmations use existing confirmer and method validation');
select lives_ok($$select public.log_incident_event(pg_temp.group_case(1), 'responders_on_site', pg_temp.group_payload(7, 'responders_on_site'), null)$$,
  'grouped responder arrivals are valid incident activities');

-- A pre-incident group is one history item, then one event when reviewed.
select lives_ok($$select public.log_report_contact(pg_temp.group_id(3, 2), 'hotline_contacted', pg_temp.group_payload(10), '  Contacted teams  ')$$,
  'pre-incident grouped contact succeeds');
select is((select count(*) from public.report_status_history where report_id = pg_temp.group_id(3, 2)
  and event_type = 'contact_logged'), 1::bigint, 'three pre-incident services create exactly one history row');
select is((select jsonb_array_length(detail->'details'->'services') from public.report_status_history
  where report_id = pg_temp.group_id(3, 2) and event_type = 'contact_logged'), 3, 'pre-incident history retains the three services');
select lives_ok($$select public.log_report_contact(pg_temp.group_id(3, 2), 'hotline_contacted', pg_temp.group_payload(10), 'Contacted teams')$$,
  'pre-incident grouped retry succeeds');
select is((select count(*) from public.report_status_history where report_id = pg_temp.group_id(3, 2)
  and event_type = 'contact_logged'), 1::bigint, 'pre-incident retry inserts no new history');
select throws_ok($$select public.log_report_contact(pg_temp.group_id(3, 2), 'hotline_contacted', pg_temp.group_payload(10), 'Changed')$$,
  '22023', null, 'pre-incident retry rejects a changed note');
select throws_ok($$select public.log_report_contact(pg_temp.group_id(3, 2), 'hotline_contacted',
  jsonb_set(pg_temp.group_payload(11), '{services,2,details,outcome}', '"invalid"'))$$,
  '22023', null, 'invalid pre-incident nested entry fails atomically');
select is((select count(*) from public.report_status_history where report_id = pg_temp.group_id(3, 2)
  and event_type = 'contact_logged'), 1::bigint, 'invalid pre-incident group inserts no history');
select throws_ok($$select public.log_report_contact(pg_temp.group_id(3, 2), 'responders_on_site', pg_temp.group_payload(11, 'responders_on_site'))$$,
  '22023', null, 'pre-incident event-type restrictions remain unchanged');
select public.claim_report_review(pg_temp.group_id(3, 2));
select lives_ok($$select public.review_report(pg_temp.group_id(3, 2), 'verify')$$,
  'review copies the grouped contact into its new incident');
select is((select count(*) from public.incident_events where incident_case_id = pg_temp.group_case(2)
  and details->>'submission_id' = pg_temp.group_id(4, 10)::text), 1::bigint, 'review preserves one grouped activity');
select is((select jsonb_array_length(details->'services') from public.incident_events where incident_case_id = pg_temp.group_case(2)
  and details->>'submission_id' = pg_temp.group_id(4, 10)::text), 3, 'review copy preserves nested service data');
select lives_ok($$select public.log_report_contact(pg_temp.group_id(3, 2), 'hotline_contacted', pg_temp.group_payload(10), 'Contacted teams')$$,
  'retry after review finds the copied incident event');
select is((select count(*) from public.incident_events where incident_case_id = pg_temp.group_case(2)
  and details->>'submission_id' = pg_temp.group_id(4, 10)::text), 1::bigint, 'post-review retry never duplicates the copied activity');
select throws_ok($$select public.log_report_contact(pg_temp.group_id(3, 2), 'hotline_contacted', pg_temp.group_payload(10), 'Changed after review')$$,
  '22023', null, 'post-review retry cannot mutate a copied contact');

-- The supporter shares incident permissions but never obtains public-update rights.
select public.request_municipal_support(pg_temp.group_case(1), 'support', 'Additional crews');
select pg_temp.group_actor(4);
select public.respond_support_request((select id from public.incident_support_requests
  where incident_case_id = pg_temp.group_case(1) and status = 'requested'), 'accept');
select lives_ok($$select public.log_incident_event(pg_temp.group_case(1), 'dispatch_confirmed', pg_temp.group_payload(20, 'dispatch_confirmed'), null)$$,
  'authorized supporting office can log one grouped activity');
select lives_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted', pg_temp.group_payload(1), 'Another actor')$$,
  'submission IDs are scoped to actor as well as target');
select pg_temp.group_actor(2);
select lives_ok($$select public.log_incident_event(pg_temp.group_case(2), 'hotline_contacted', pg_temp.group_payload(1), 'Another target')$$,
  'submission IDs are scoped to incident target');
select public.resolve_incident(pg_temp.group_case(1), 'Response completed', 'The area is safe.');
select lives_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted', pg_temp.group_payload(1), 'Coordinated response')$$,
  'authorized exact retry remains successful after incident resolution');
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted', pg_temp.group_payload(30), null)$$,
  '22023', null, 'a fresh grouped activity is still forbidden on a resolved incident');
select pg_temp.group_actor(3);
select throws_ok($$select public.log_incident_event(pg_temp.group_case(1), 'hotline_contacted', pg_temp.group_payload(1), 'Coordinated response')$$,
  '42501', null, 'retry never bypasses current office authorization');

select pg_temp.group_actor(2);
select public.log_report_contact(pg_temp.group_id(3, 3), 'hotline_contacted', pg_temp.group_payload(31));
select public.claim_report_review(pg_temp.group_id(3, 3));
select public.review_report(pg_temp.group_id(3, 3), 'reject', 'test_or_spam');
select lives_ok($$select public.log_report_contact(pg_temp.group_id(3, 3), 'hotline_contacted', pg_temp.group_payload(31))$$,
  'authorized existing pre-incident retry succeeds after a terminal review');
select throws_ok($$select public.log_report_contact(pg_temp.group_id(3, 3), 'hotline_contacted', pg_temp.group_payload(32))$$,
  '22023', null, 'new pre-incident grouped contacts remain forbidden after terminal review');

select * from finish();
rollback;
