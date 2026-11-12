-- Transactional Phase 4 confirmation/publication regression checks. All fixtures roll back.
begin;
-- The hosted CLI connects through a login role; select the intended fixture owner explicitly.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(36);
select ok((select relrowsecurity from pg_class where oid='public.report_public_photo_derivatives'::regclass),
 'Photo proof records have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.report_publication_operations'::regclass),
 'Retry operation records have RLS enabled');
select ok(not has_table_privilege('authenticated','public.report_public_photo_derivatives','SELECT,INSERT,UPDATE,DELETE')
 and not has_table_privilege('anon','public.report_public_photo_derivatives','SELECT,INSERT,UPDATE,DELETE'),
 'Clients cannot read or forge trusted photo proof rows');
select ok(not has_table_privilege('authenticated','public.report_publication_operations','SELECT,INSERT,UPDATE,DELETE')
 and not has_table_privilege('anon','public.report_publication_operations','SELECT,INSERT,UPDATE,DELETE'),
 'Clients cannot inspect or replace private retry operations');
select ok(not has_function_privilege('authenticated','public.is_verified_public_report_photo(uuid,uuid)','EXECUTE')
 and not has_function_privilege('anon','public.is_verified_public_report_photo(uuid,uuid)','EXECUTE'),
 'Internal proof lookups cannot bypass scoped report projections');
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
 ('f8000000-0000-4000-8000-000000000001','authenticated','authenticated','phase4-review-owner@example.test','{"provider":"email","providers":["email"]}','{}'),
 ('f8000000-0000-4000-8000-000000000002','authenticated','authenticated','phase4-review-officer@example.test','{"provider":"email","providers":["email"]}','{}');
insert into public.barangays(id,name) values ('f8000000-0000-4000-8000-000000000003','Phase4 reviewer fixture');
insert into public.app_profiles(id,role,first_name,last_name,barangay_id,status) values
 ('f8000000-0000-4000-8000-000000000001','resident','Synthetic','Owner','f8000000-0000-4000-8000-000000000003','active'),
 ('f8000000-0000-4000-8000-000000000002','officer','Synthetic','Reviewer','f8000000-0000-4000-8000-000000000003','active');
insert into public.reports(id,reporter_id,title,description,barangay_id,location,incident_type) values
 ('f8000000-0000-4000-8000-000000000004','f8000000-0000-4000-8000-000000000001','Private synthetic title','Private synthetic description',
 'f8000000-0000-4000-8000-000000000003',extensions.st_setsrid(extensions.st_makepoint(123.8,10.25),4326)::extensions.geography,'flood');
select set_config('request.jwt.claim.sub','f8000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select lives_ok($query$select public.claim_report_review('f8000000-0000-4000-8000-000000000004')$query$,'claim runtime');
select throws_ok($query$select public.review_report_with_publication(
 'f8000000-0000-4000-8000-000000000005','f8000000-0000-4000-8000-000000000004','verify',null,'Synthetic review')$query$,
 '22023','Add screened public text or mark the incident sensitive.','confirmation cannot silently remain private');
select ok((select incident_case_id is null from public.reports where id='f8000000-0000-4000-8000-000000000004'),
 'failed publication rolls back case creation');
select lives_ok($query$select public.review_report_with_publication(
 'f8000000-0000-4000-8000-000000000005','f8000000-0000-4000-8000-000000000004','verify',null,'Synthetic review',null,
 null,null,true,false,false,false,'{}',true)$query$,'atomic confirmation runtime');
select ok(public.report_public_post_is_current('f8000000-0000-4000-8000-000000000004'),'screened report is public in same action');
select lives_ok($query$select public.review_report_with_publication(
 'f8000000-0000-4000-8000-000000000005','f8000000-0000-4000-8000-000000000004','verify',null,'Synthetic review',null,
 null,null,true,false,false,false,'{}',true)$query$,'retry returns existing result');
select is((select count(*)::integer from public.incident_cases where source_report_id='f8000000-0000-4000-8000-000000000004'),1,'retry creates no duplicate case');

insert into public.reports(id,reporter_id,title,description,barangay_id,location,incident_type) values
 ('f8000000-0000-4000-8000-000000000006','f8000000-0000-4000-8000-000000000001','Private assessment title','Private assessment description',
 'f8000000-0000-4000-8000-000000000003',extensions.st_setsrid(extensions.st_makepoint(123.8,10.25),4326)::extensions.geography,'flood');
select lives_ok($query$select public.claim_report_review('f8000000-0000-4000-8000-000000000006')$query$,'claim assessment runtime');
select lives_ok($query$select public.review_report_with_publication(
 'f8000000-0000-4000-8000-000000000007','f8000000-0000-4000-8000-000000000006','needs_assessment',null,'Synthetic assessment')$query$,'assessment remains provisional');
select throws_ok($query$select public.record_incident_finding_with_publication(
 'f8000000-0000-4000-8000-000000000008',
 (select incident_case_id from public.reports where id='f8000000-0000-4000-8000-000000000006'),
 'confirmed','Synthetic field finding')$query$,'22023',null::text,'field confirmation requires screened publication');
select ok((select incident.verification='pending' from public.incident_cases incident join public.reports source_report
 on source_report.incident_case_id=incident.id where source_report.id='f8000000-0000-4000-8000-000000000006'),
 'failed finding publication rolls back confirmation');
select lives_ok($query$select public.record_incident_finding_with_publication(
 'f8000000-0000-4000-8000-000000000008',
 (select incident_case_id from public.reports where id='f8000000-0000-4000-8000-000000000006'),
 'confirmed','Synthetic field finding',null,jsonb_build_array(jsonb_build_object(
 'reportId','f8000000-0000-4000-8000-000000000006','publish',true,
 'publicationAcknowledged',true,'photoMediaIds','[]'::jsonb)))$query$,
 'field finding publishes source in same transaction');
select ok(public.report_public_post_is_current('f8000000-0000-4000-8000-000000000006'),'field source is currently public');
select lives_ok($query$select public.record_incident_finding_with_publication(
 'f8000000-0000-4000-8000-000000000008',
 (select incident_case_id from public.reports where id='f8000000-0000-4000-8000-000000000006'),
 'confirmed','Synthetic field finding',null,jsonb_build_array(jsonb_build_object(
 'reportId','f8000000-0000-4000-8000-000000000006','publish',true,
 'publicationAcknowledged',true,'photoMediaIds','[]'::jsonb)))$query$,
 'field finding retry succeeds');

insert into public.reports(id,reporter_id,title,description,barangay_id,location,incident_type) values
 ('f8000000-0000-4000-8000-000000000010','f8000000-0000-4000-8000-000000000001','Private sensitive title','Private sensitive description',
 'f8000000-0000-4000-8000-000000000003',extensions.st_setsrid(extensions.st_makepoint(123.8,10.25),4326)::extensions.geography,'medical');
select public.claim_report_review('f8000000-0000-4000-8000-000000000010');
select lives_ok($query$select public.review_report_with_publication(
 'f8000000-0000-4000-8000-000000000011','f8000000-0000-4000-8000-000000000010','needs_assessment',null,'Synthetic sensitive assessment')$query$,
 'sensitive assessment starts provisional');
select lives_ok($query$select public.record_incident_finding_with_publication(
 'f8000000-0000-4000-8000-000000000012',
 (select incident_case_id from public.reports where id='f8000000-0000-4000-8000-000000000010'),
 'confirmed','Synthetic sensitive finding',null,'[]',true,'Synthetic sensitivity reason')$query$,
 'sensitivity can be recorded with the finding');
select ok((select incident.is_sensitive and incident.verification='confirmed' from public.incident_cases incident join public.reports source_report
 on source_report.incident_case_id=incident.id where source_report.id='f8000000-0000-4000-8000-000000000010')
 and not public.report_public_post_is_current('f8000000-0000-4000-8000-000000000010'),'sensitive finding withholds private post');

-- Linking a second source to a confirmed incident screens that source in the
-- same transaction and must not create another case or overwrite its sibling.
insert into public.reports(id,reporter_id,title,description,barangay_id,location,incident_type) values
 ('f8000000-0000-4000-8000-000000000017','f8000000-0000-4000-8000-000000000001','Private linked title','Private linked description',
 'f8000000-0000-4000-8000-000000000003',extensions.st_setsrid(extensions.st_makepoint(123.8,10.25),4326)::extensions.geography,'flood');
select lives_ok($query$select public.claim_report_review('f8000000-0000-4000-8000-000000000017')$query$,'claim linked source');
select throws_ok($query$select public.review_report_with_publication(
 'f8000000-0000-4000-8000-000000000018','f8000000-0000-4000-8000-000000000017','link',null,null,
 (select incident_case_id from public.reports where id='f8000000-0000-4000-8000-000000000004'))$query$,
 '22023','Add screened public text or mark the incident sensitive.','confirmed link cannot silently omit its public review');
select ok((select incident_case_id is null from public.reports where id='f8000000-0000-4000-8000-000000000017'),
 'failed public review rolls back report linking');
select lives_ok($query$select public.review_report_with_publication(
 'f8000000-0000-4000-8000-000000000018','f8000000-0000-4000-8000-000000000017','link',null,null,
 (select incident_case_id from public.reports where id='f8000000-0000-4000-8000-000000000004'),
 null,null,true,false,false,false,'{}',true)$query$,'link and publish commit together');
select ok(public.report_public_post_is_current('f8000000-0000-4000-8000-000000000017')
 and public.report_public_post_is_current('f8000000-0000-4000-8000-000000000004'),'both screened source posts remain available');
select lives_ok($query$select public.review_report_with_publication(
 'f8000000-0000-4000-8000-000000000018','f8000000-0000-4000-8000-000000000017','link',null,null,
 (select incident_case_id from public.reports where id='f8000000-0000-4000-8000-000000000004'),
 null,null,true,false,false,false,'{}',true)$query$,'linked publication retries are idempotent');
select throws_ok($query$select public.review_report_with_publication(
 'f8000000-0000-4000-8000-000000000018','f8000000-0000-4000-8000-000000000017','link',null,null,
 (select incident_case_id from public.reports where id='f8000000-0000-4000-8000-000000000004'),
 'Changed linked title',null,true,false,false,false,'{}',true)$query$,
 '23505','This operation id is already bound to a different request.','changed payload cannot reuse a committed operation');

select set_config('request.jwt.claim.role','service_role',true);
select lives_ok($query$select public.create_official_report_with_publication(
 'f8000000-0000-4000-8000-000000000013','f8000000-0000-4000-8000-000000000002','f8000000-0000-4000-8000-000000000014',
 'Private field title','Private field description',10.25,123.8,null,'[]','f8000000-0000-4000-8000-000000000003','flood',null,
 'official_field',null,null,true,true)$query$,'official observation publishes atomically');
select ok(public.report_public_post_is_current('f8000000-0000-4000-8000-000000000014'),'official source post is public');
select lives_ok($query$select public.create_official_report_with_publication(
 'f8000000-0000-4000-8000-000000000013','f8000000-0000-4000-8000-000000000002','f8000000-0000-4000-8000-000000000014',
 'Private field title','Private field description',10.25,123.8,null,'[]','f8000000-0000-4000-8000-000000000003','flood',null,
 'official_field',null,null,true,true)$query$,'official observation retry succeeds');
select is((select count(*)::integer from public.incident_cases where source_report_id='f8000000-0000-4000-8000-000000000014'),1,'official retry creates one incident');
select ok(not has_function_privilege('authenticated',
 'public.create_official_report_with_publication(uuid,uuid,uuid,text,text,double precision,double precision,text,jsonb,uuid,text,text,public.report_intake_channel,text,text,boolean,boolean,jsonb,boolean,text)',
 'EXECUTE'),'resident clients cannot call service intake');
select lives_ok($query$select public.create_official_report_with_publication(
 'f8000000-0000-4000-8000-000000000015','f8000000-0000-4000-8000-000000000002','f8000000-0000-4000-8000-000000000016',
 'Private hotline title','Private hotline description',10.25,123.8,null,'[]','f8000000-0000-4000-8000-000000000003','flood',null,
 'hotline_call',null,null,false,false)$query$,'hotline intake remains recorded');
select ok((select incident_case_id is null and review_outcome='pending' from public.reports
 where id='f8000000-0000-4000-8000-000000000016'),'hotline account is unconfirmed and private');

select * from finish();
rollback;
