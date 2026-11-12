begin;
select no_plan();

create function pg_temp.unit_id(family integer, item integer) returns uuid
language sql immutable as $$
  select ('c' || family::text || '000000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid;
$$;
create function pg_temp.unit_actor(item integer) returns text language sql as $$
  select set_config('request.jwt.claim.sub', pg_temp.unit_id(1, item)::text, true);
$$;
create function pg_temp.unit_case() returns uuid
language sql security definer set search_path = '' as $$
  select id from public.incident_cases where source_report_id = pg_temp.unit_id(3, 1);
$$;
create function pg_temp.unit_group(item integer, service_details jsonb[] default array[
  '{"service":"bfp","municipality":"Minglanilla","outcome":"reached"}'::jsonb,
  '{"service":"pnp","municipality":"Minglanilla","outcome":"no_answer"}'::jsonb
]) returns jsonb language sql as $$
  select jsonb_build_object('submission_id', pg_temp.unit_id(4, item)::text,
    'services', jsonb_agg(jsonb_build_object('details', entry.details, 'note', null) order by entry.position))
  from unnest(service_details) with ordinality as entry(details, position);
$$;
create function pg_temp.unit_details(item integer) returns jsonb language sql as $$
  select details from public.incident_events where incident_case_id = pg_temp.unit_case()
    and details->>'submission_id' = pg_temp.unit_id(4, item)::text;
$$;

insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
select pg_temp.unit_id(1, item), 'authenticated', 'authenticated', 'optional-unit-' || item || '@example.test',
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb from generate_series(1, 3) item;
insert into public.barangays(id, name) values
  (pg_temp.unit_id(2, 1), 'Optional Unit Local'), (pg_temp.unit_id(2, 2), 'Optional Unit Other');
insert into public.app_profiles(id, role, first_name, last_name, barangay_id, status) values
  (pg_temp.unit_id(1, 1), 'resident', 'Optional', 'Resident', pg_temp.unit_id(2, 1), 'active'),
  (pg_temp.unit_id(1, 2), 'officer', 'Optional', 'Lead', pg_temp.unit_id(2, 1), 'active'),
  (pg_temp.unit_id(1, 3), 'officer', 'Optional', 'Other', pg_temp.unit_id(2, 2), 'active');
insert into public.reports(id, reporter_id, title, description, barangay_id, location)
select pg_temp.unit_id(3, item), pg_temp.unit_id(1, 1), '', 'Optional service unit report ' || item,
  pg_temp.unit_id(2, 1),
  extensions.st_setsrid(extensions.st_makepoint(123.8, 10.25), 4326)::extensions.geography
from generate_series(1, 2) item;
insert into public.report_media(report_id, type, storage_path, position)
select pg_temp.unit_id(3, item), 'photo', 'optional-unit/' || item || '/original.jpg', 0 from generate_series(1, 2) item;
insert into public.report_media(report_id, type, storage_path, duration_seconds, position)
select pg_temp.unit_id(3, item), 'video', 'optional-unit/' || item || '/video.mp4', 5, 1 from generate_series(1, 2) item;
set constraints all immediate;
set constraints all deferred;

set local role authenticated;
select pg_temp.unit_actor(2);
select public.claim_report_review(pg_temp.unit_id(3, 1));
select public.review_report(pg_temp.unit_id(3, 1), 'verify');

select lives_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_group(1), null)$$,
  'category and municipality suffice for all services in a grouped activity');
select is((select count(*) from public.incident_events where incident_case_id = pg_temp.unit_case()
  and details->>'submission_id' = pg_temp.unit_id(4, 1)::text), 1::bigint, 'unnamed services still create only one activity');
select is(jsonb_array_length(pg_temp.unit_details(1)->'services'), 2, 'one activity retains both unnamed categories');
select is(pg_temp.unit_details(1)#>'{services,0,details}',
  '{"service":"bfp","municipality":"Minglanilla","outcome":"reached"}'::jsonb,
  'omitted service names stay omitted rather than being invented');
select lives_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted',
  jsonb_set(pg_temp.unit_group(2), '{services,0,details,service_name}', to_jsonb(E' \t\n '::text)), null)$$,
  'whitespace-only optional unit names are accepted');
select ok(not ((pg_temp.unit_details(2)#>'{services,0,details}') ? 'service_name'),
  'blank optional unit names normalize to an omitted property');
select is((public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_group(2), null)).id,
  (select id from public.incident_events where incident_case_id = pg_temp.unit_case()
    and details->>'submission_id' = pg_temp.unit_id(4, 2)::text),
  'retry matches blank and omitted unit names as the same normalized payload');
select lives_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted',
  '{"service":"bfp","municipality":"Minglanilla","outcome":"reached"}', 'Municipality-only single')$$,
  'a single service can provide a municipality without a unit name');
select lives_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted',
  '{"service":"bfp","service_name":"   ","municipality":"Minglanilla","outcome":"reached"}', 'Blank-unit single')$$,
  'a blank optional unit name is accepted for a single service');
select ok(not ((select details from public.incident_events where incident_case_id = pg_temp.unit_case()
  and note = 'Blank-unit single') ? 'service_name'), 'single-service normalization omits blank optional names');
select lives_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted',
  '{"service":"bfp","outcome":"reached"}', 'Legacy single')$$,
  'legacy single-service calls without municipality or unit remain valid');
select lives_ok($$select public.log_incident_event(pg_temp.unit_case(), 'reporter_call', '{"outcome":"no_answer"}', null)$$,
  'reporter-call legacy payload remains valid');
select throws_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted',
  '{"service":"bfp","service_name":"North crew","outcome":"reached"}', null)$$,
  '22023', null, 'a named service unit still requires its municipality');
select throws_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted',
  pg_temp.unit_group(3) #- '{services,0,details,municipality}', null)$$,
  '22023', null, 'an unnamed grouped entry cannot omit municipality');
select throws_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted',
  jsonb_set(pg_temp.unit_group(3), '{services,0,details,municipality}', '"   "'), null)$$,
  '22023', null, 'a grouped entry cannot provide a blank municipality');
select throws_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted',
  pg_temp.unit_group(3) #- '{services,0,details,service}', null)$$,
  '22023', null, 'a grouped entry still requires a service category');

select throws_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_group(4, array[
  '{"service":"bfp","municipality":"  Minglanilla  ","outcome":"reached"}'::jsonb,
  '{"service":"bfp","service_name":"   ","municipality":"mINGLANILLA","outcome":"no_answer"}'::jsonb]), null)$$,
  '22023', null, 'repeated unnamed category and municipality is rejected after case and whitespace folding');
select is((select count(*) from public.incident_events where incident_case_id = pg_temp.unit_case()
  and details->>'submission_id' = pg_temp.unit_id(4, 4)::text), 0::bigint, 'duplicate unnamed entries insert no partial activity');
select lives_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_group(5, array[
  '{"service":"bfp","municipality":"Minglanilla","outcome":"reached"}'::jsonb,
  '{"service":"bfp","municipality":"Talisay","outcome":"reached"}'::jsonb]), null)$$,
  'unnamed services in different municipalities remain distinct');
select lives_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_group(6, array[
  '{"service":"bfp","service_name":"North crew","municipality":"Minglanilla","outcome":"reached"}'::jsonb,
  '{"service":"bfp","service_name":"South crew","municipality":"Minglanilla","outcome":"reached"}'::jsonb]), null)$$,
  'different named units in the same municipality remain distinct');
select lives_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_group(7, array[
  '{"service":"bfp","municipality":"Minglanilla","outcome":"reached"}'::jsonb,
  '{"service":"bfp","service_name":"North crew","municipality":"Minglanilla","outcome":"reached"}'::jsonb]), null)$$,
  'an unnamed category and a particular named unit have distinct identities');
select throws_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_group(8, array[
  '{"service":"bfp","service_name":"North   crew","municipality":"Minglanilla","outcome":"reached"}'::jsonb,
  '{"service":"bfp","service_name":"  north CREW ","municipality":"minglanilla","outcome":"reached"}'::jsonb]), null)$$,
  '22023', null, 'named-unit duplicate matching still folds case and whitespace');

select throws_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_group(10, array[
  '{"service":"other","municipality":"Minglanilla","outcome":"reached"}'::jsonb]), null)$$,
  '22023', null, 'Other services still require the actual service name');
select throws_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_group(10, array[
  '{"service":"other","service_other":" ","municipality":"Minglanilla","outcome":"reached"}'::jsonb]), null)$$,
  '22023', null, 'Other service name cannot be blank');
select lives_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_group(11, array[
  '{"service":"other","service_other":"Road engineering","municipality":"Minglanilla","outcome":"reached"}'::jsonb,
  '{"service":"other","service_other":"Utility response","municipality":"Minglanilla","outcome":"reached"}'::jsonb]), null)$$,
  'two distinct named Other services need no invented unit names');
select throws_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_group(12, array[
  '{"service":"other","service_other":"Road   engineering","municipality":"Minglanilla","outcome":"reached"}'::jsonb,
  '{"service":"other","service_other":"  ROAD engineering  ","municipality":"Minglanilla","outcome":"no_answer"}'::jsonb]), null)$$,
  '22023', null, 'Other service duplicate matching also folds its name case and whitespace');
select lives_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_group(13, array[
  '{"service":"other","service_other":"Road engineering","service_name":"Crew Alpha","municipality":"Minglanilla","outcome":"reached"}'::jsonb,
  '{"service":"other","service_other":"Utility response","service_name":"Crew Alpha","municipality":"Minglanilla","outcome":"reached"}'::jsonb]), null)$$,
  'distinct Other service names remain distinct even with the same unit name');

select throws_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted',
  jsonb_set(pg_temp.unit_group(14), '{services,0,details,service_name}', '"Call 09179990000"'), null)$$,
  '22023', null, 'optional names cannot contain phone numbers');
select throws_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted',
  jsonb_set(pg_temp.unit_group(14), '{services,0,details,municipality}', '"Call 09179990000"'), null)$$,
  '22023', null, 'required municipalities cannot contain phone numbers');
select throws_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_group(14, array[
  '{"service":"other","service_other":"Call 09179990000","municipality":"Minglanilla","outcome":"reached"}'::jsonb]), null)$$,
  '22023', null, 'Other service names preserve phone-number privacy');
select throws_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted',
  jsonb_set(pg_temp.unit_group(14), '{services,0,details,service_name}', to_jsonb(repeat('a', 121))), null)$$,
  '22023', null, 'optional names remain bounded to 120 characters');
select throws_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted',
  jsonb_set(pg_temp.unit_group(14), '{services,0,details,phone}', '"09179990000"'), null)$$,
  '22023', null, 'unknown nested keys are still rejected');
select throws_ok($$select public.validate_response_event('hotline_contacted', pg_temp.unit_group(14))$$,
  '42501', null, 'the replacement validator remains private to trusted RPCs');

-- This literal represents a normalized row written by the previous validator.
-- Its Other name deliberately has internal spaces, which must remain unchanged.
reset role;
insert into public.incident_events(incident_case_id, event_type, actor_id, actor_office, actor_barangay_id, details, note)
values (pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_id(1, 2), 'barangay', pg_temp.unit_id(2, 1),
  pg_temp.unit_group(90, array['{"service":"other","service_other":"Road   engineering","service_name":"North Crew","municipality":"Minglanilla","outcome":"reached"}'::jsonb]),
  'Earlier activity');
set local role authenticated;
select pg_temp.unit_actor(2);
select lives_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_group(90, array[
  '{"service":"other","service_other":"  Road   engineering  ","service_name":"  North   Crew  ","municipality":"  Minglanilla  ","outcome":"reached"}'::jsonb]),
  'Earlier activity')$$, 'a previously stored named-unit payload remains exactly retryable');
select is((select count(*) from public.incident_events where incident_case_id = pg_temp.unit_case()
  and details->>'submission_id' = pg_temp.unit_id(4, 90)::text), 1::bigint, 'old named-unit retry does not insert another event');
select is(pg_temp.unit_details(90)#>>'{services,0,details,service_other}', 'Road   engineering',
  'identity matching does not rewrite the stored Other service name');

select lives_ok($$select public.log_report_contact(pg_temp.unit_id(3, 2), 'hotline_contacted', pg_temp.unit_group(20))$$,
  'pre-incident groups also accept category and municipality without unit names');
select lives_ok($$select public.log_report_contact(pg_temp.unit_id(3, 2), 'hotline_contacted',
  jsonb_set(pg_temp.unit_group(20), '{services,0,details,service_name}', '"  "'))$$,
  'pre-incident retries normalize blank unit names identically');
select is((select count(*) from public.report_status_history where report_id = pg_temp.unit_id(3, 2)
  and event_type = 'contact_logged'), 1::bigint, 'unnamed pre-incident retry retains one history row');
select throws_ok($$select public.log_report_contact(pg_temp.unit_id(3, 2), 'hotline_contacted',
  pg_temp.unit_group(21) #- '{services,1,details,municipality}')$$,
  '22023', null, 'a missing municipality in the final nested entry rejects the whole contact');
select is((select count(*) from public.report_status_history where report_id = pg_temp.unit_id(3, 2)
  and event_type = 'contact_logged'), 1::bigint, 'invalid nested entry inserts no partial pre-incident history');
select public.claim_report_review(pg_temp.unit_id(3, 2));
select public.review_report(pg_temp.unit_id(3, 2), 'verify');
select lives_ok($$select public.log_report_contact(pg_temp.unit_id(3, 2), 'hotline_contacted', pg_temp.unit_group(20))$$,
  'unnamed contact retry still finds its incident event after report review');

select pg_temp.unit_actor(1);
select throws_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_group(30), null)$$,
  '42501', null, 'optional service names do not weaken resident authorization');
select pg_temp.unit_actor(3);
select throws_ok($$select public.log_incident_event(pg_temp.unit_case(), 'hotline_contacted', pg_temp.unit_group(30), null)$$,
  '42501', null, 'optional service names do not weaken office authorization');

select * from finish();
rollback;
