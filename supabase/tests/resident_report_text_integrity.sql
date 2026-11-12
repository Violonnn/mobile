-- Resident statements stay authoritative through confirmation and publication.
-- Every fixture and operation is rolled back, including on the hosted runner.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(33);

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data) values
 ('f9000000-0000-4000-8000-000000000001','authenticated','authenticated','integrity-owner@example.test','{"provider":"email","providers":["email"]}','{}'),
 ('f9000000-0000-4000-8000-000000000002','authenticated','authenticated','integrity-officer@example.test','{"provider":"email","providers":["email"]}','{}'),
 ('f9000000-0000-4000-8000-000000000003','authenticated','authenticated','integrity-reader@example.test','{"provider":"email","providers":["email"]}','{}');
insert into public.barangays(id,name) values ('f9000000-0000-4000-8000-000000000004','Integrity fixture');
insert into public.app_profiles(id,role,first_name,last_name,barangay_id,status) values
 ('f9000000-0000-4000-8000-000000000001','resident','Synthetic','Owner','f9000000-0000-4000-8000-000000000004','active'),
 ('f9000000-0000-4000-8000-000000000002','officer','Synthetic','Officer','f9000000-0000-4000-8000-000000000004','active'),
 ('f9000000-0000-4000-8000-000000000003','resident','Synthetic','Reader','f9000000-0000-4000-8000-000000000004','active');
insert into public.reports(id,reporter_id,title,description,barangay_id,location,incident_type,intake_channel) values
 ('f9000000-0000-4000-8000-000000000005','f9000000-0000-4000-8000-000000000001',repeat('T',120),repeat('D',2000),
  'f9000000-0000-4000-8000-000000000004',extensions.st_setsrid(extensions.st_makepoint(123.8,10.25),4326)::extensions.geography,'flood','resident_app'),
 ('f9000000-0000-4000-8000-000000000006','f9000000-0000-4000-8000-000000000001','Original  resident title',E'First line.\n\n  Indented resident statement.',
  'f9000000-0000-4000-8000-000000000004',extensions.st_setsrid(extensions.st_makepoint(123.8,10.25),4326)::extensions.geography,'flood','resident_app'),
 ('f9000000-0000-4000-8000-000000000007','f9000000-0000-4000-8000-000000000002','Official account','Official-authored account.',
  'f9000000-0000-4000-8000-000000000004',extensions.st_setsrid(extensions.st_makepoint(123.8,10.25),4326)::extensions.geography,'flood','hotline_call');
insert into public.report_media(id,report_id,type,storage_path,position) values
 ('f9000000-0000-4000-8000-000000000008','f9000000-0000-4000-8000-000000000005','photo',
  'f9000000-0000-4000-8000-000000000001/f9000000-0000-4000-8000-000000000005/f9000000-0000-4000-8000-000000000008/original.jpg',0),
 ('f9000000-0000-4000-8000-000000000009','f9000000-0000-4000-8000-000000000006','photo',
  'f9000000-0000-4000-8000-000000000001/f9000000-0000-4000-8000-000000000006/f9000000-0000-4000-8000-000000000009/original.jpg',0);

select set_config('request.jwt.claim.sub','f9000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select throws_ok($query$update public.reports set title='Official rewrite' where id='f9000000-0000-4000-8000-000000000005'$query$,
 '42501',null::text,'An officer cannot rewrite a resident title');
select throws_ok($query$update public.reports set description='Official rewrite' where id='f9000000-0000-4000-8000-000000000005'$query$,
 '42501',null::text,'An officer cannot rewrite a resident description');
select throws_ok($query$update public.reports set intake_channel='official_field' where id='f9000000-0000-4000-8000-000000000005'$query$,
 '42501',null::text,'Reclassifying a resident statement cannot bypass its protection');
select throws_ok($query$update public.reports set reporter_id='f9000000-0000-4000-8000-000000000002' where id='f9000000-0000-4000-8000-000000000005'$query$,
 '42501',null::text,'Reassigning the author cannot bypass source protection');
select lives_ok($query$update public.reports set title=title,description=description where id='f9000000-0000-4000-8000-000000000005'$query$,
 'An unchanged statement does not prevent ordinary report updates');
select lives_ok($query$update public.reports set description='Updated official-authored account.' where id='f9000000-0000-4000-8000-000000000007'$query$,
 'The resident guard leaves official-authored account updates available');

-- A metadata update can also change text through an earlier BEFORE trigger.
-- Protect the final row, not just the columns named by the caller's UPDATE.
create function pg_temp.integrity_fixture_text_mutator() returns trigger language plpgsql as $$
begin
  if new.id='f9000000-0000-4000-8000-000000000005' and new.address_text='integrity-trigger-fixture' then
    new.description := 'A different trigger attempted to rewrite the resident statement.';
  end if;
  return new;
end;
$$;
create trigger zy_integrity_fixture_text_mutator before update on public.reports
 for each row execute function pg_temp.integrity_fixture_text_mutator();
select throws_ok($query$update public.reports set address_text='integrity-trigger-fixture' where id='f9000000-0000-4000-8000-000000000005'$query$,
 '42501',null::text,'A metadata-only update cannot rewrite text through another trigger');
drop trigger zy_integrity_fixture_text_mutator on public.reports;

select lives_ok($query$select public.claim_report_review('f9000000-0000-4000-8000-000000000005')$query$,'Claim full-length resident report');
select throws_ok($query$select public.review_report_with_publication(
 p_operation_id=>'f9000000-0000-4000-8000-000000000010',p_report_id=>'f9000000-0000-4000-8000-000000000005',
 p_decision=>'verify',p_public_title=>'Changed resident title',p_public_description=>'Changed resident description',
 p_publish=>true,p_publication_acknowledged=>true)$query$,'22023',null::text,'A public rewrite rejects the complete confirmation transaction');
select ok((select incident_case_id is null and review_outcome='pending' from public.reports where id='f9000000-0000-4000-8000-000000000005'),
 'Rejected tampering leaves the incident unconfirmed');
select is((select count(*)::integer from public.report_publication_operations where operation_id='f9000000-0000-4000-8000-000000000010'),0,
 'Rejected tampering leaves no completed retry operation');
select lives_ok($query$select public.review_report_with_publication(
 p_operation_id=>'f9000000-0000-4000-8000-000000000010',p_report_id=>'f9000000-0000-4000-8000-000000000005',
 p_decision=>'verify',p_public_title=>null,p_public_description=>null,p_publish=>true,p_publication_acknowledged=>true)$query$,
 'Confirmation can derive the authoritative resident text on the server');
select is((select public_title from public.report_public_posts where report_id='f9000000-0000-4000-8000-000000000005'),repeat('T',120),
 'The entire 120-character submitted title is preserved');
select is((select public_description from public.report_public_posts where report_id='f9000000-0000-4000-8000-000000000005'),repeat('D',2000),
 'The entire 2000-character submitted description is preserved');
select ok((select title=repeat('T',120) and description=repeat('D',2000) from public.reports where id='f9000000-0000-4000-8000-000000000005'),
 'Publication never rewrites the private source statement');
select throws_ok($query$select public.set_report_public_post('f9000000-0000-4000-8000-000000000005','Edited title',null,true)$query$,
 '22023',null::text,'The standalone publication RPC rejects a title override');
select throws_ok($query$select public.set_report_public_post('f9000000-0000-4000-8000-000000000005',null,'Edited description',true)$query$,
 '22023',null::text,'The standalone publication RPC rejects a description override');
select lives_ok($query$select public.set_report_public_post('f9000000-0000-4000-8000-000000000005','Old public copy','Old public copy',false)$query$,
 'Officials can hide an existing post without submitting matching text');
select ok((select not is_published and public_title=repeat('T',120) and public_description=repeat('D',2000)
 from public.report_public_posts where report_id='f9000000-0000-4000-8000-000000000005'),
 'Hiding preserves the canonical resident statement');
select lives_ok($query$select public.set_report_public_post('f9000000-0000-4000-8000-000000000005',null,null,true)$query$,
 'Republication can use the stored original without editable fields');

set local role authenticated;
select set_config('request.jwt.claim.sub','f9000000-0000-4000-8000-000000000003',true);
select is(public.get_public_report('f9000000-0000-4000-8000-000000000005')->'report'->>'public_title',repeat('T',120),
 'Other residents receive the complete approved original title');
select is(public.get_public_report('f9000000-0000-4000-8000-000000000005')->'report'->>'public_description',repeat('D',2000),
 'Other residents receive the complete approved original description');
select is((select count(*)::integer from public.reports where id='f9000000-0000-4000-8000-000000000005'),0,
 'Publishing text does not expose the private source row');
select throws_ok($query$select public.set_report_public_post('f9000000-0000-4000-8000-000000000005',null,null,true)$query$,
 '42501',null::text,'A resident cannot publish another source report');
select set_config('request.jwt.claim.sub','f9000000-0000-4000-8000-000000000001',true);
select throws_ok($query$update public.reports set description='Changed after submission' where id='f9000000-0000-4000-8000-000000000005'$query$,
 '42501',null::text,'The submitted resident statement is also protected from owner-side updates');

set local role postgres;
select set_config('request.jwt.claim.sub','f9000000-0000-4000-8000-000000000002',true);
select lives_ok($query$select public.claim_report_review('f9000000-0000-4000-8000-000000000006')$query$,'Claim whitespace fixture');
select lives_ok($query$select public.review_report_with_publication(
 p_operation_id=>'f9000000-0000-4000-8000-000000000011',p_report_id=>'f9000000-0000-4000-8000-000000000006',
 p_decision=>'verify',p_publish=>true,p_publication_acknowledged=>true)$query$,'Publish the original whitespace fixture');
select ok((select public_title='Original  resident title' and public_description=E'First line.\n\n  Indented resident statement.'
 from public.report_public_posts where report_id='f9000000-0000-4000-8000-000000000006'),
 'Publication preserves resident spacing and line breaks');
-- Simulate a confirmed source that has never had a publication row.
delete from public.report_public_posts where report_id='f9000000-0000-4000-8000-000000000006';
select lives_ok($query$select public.set_report_public_post('f9000000-0000-4000-8000-000000000006',repeat('X',500),repeat('Y',5000),false)$query$,
 'Even overlong stale client text cannot prevent a privacy withdrawal');
select ok((select not is_published and public_title='Original  resident title'
 and public_description=E'First line.\n\n  Indented resident statement.' from public.report_public_posts
 where report_id='f9000000-0000-4000-8000-000000000006'),
 'The first hidden publication row also uses canonical resident text');
set local role authenticated;
select set_config('request.jwt.claim.sub','f9000000-0000-4000-8000-000000000001',true);
select is((select count(*)::integer from public.reports where id='f9000000-0000-4000-8000-000000000005'),1,
 'The owner retains access to the unchanged source report');

set local role postgres;
select set_config('request.jwt.claim.role','service_role',true);
select lives_ok($query$select public.create_official_report_with_publication(
 'f9000000-0000-4000-8000-000000000012','f9000000-0000-4000-8000-000000000002','f9000000-0000-4000-8000-000000000013',
 '', 'Official observation without a title.',10.25,123.8,null,'[]',
 'f9000000-0000-4000-8000-000000000004','flood',null,'hotline_call',null,null,false,false)$query$,
 'Private hotline intake still supports an omitted title');
select ok((select btrim(source_report.title)='' and not exists (
 select 1 from public.report_public_posts post where post.report_id=source_report.id)
 from public.reports source_report where source_report.id='f9000000-0000-4000-8000-000000000013'),
 'An untitled hotline report does not acquire a public post');

select * from finish();
rollback;
