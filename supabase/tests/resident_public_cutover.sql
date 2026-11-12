begin;
select no_plan();

-- Fixed families and rollback keep these tests independent of development data.
create function pg_temp.public_id(family integer,item integer) returns uuid language sql immutable as $$
  select ('b' || family || '000000-0000-4000-8000-' || lpad(item::text,12,'0'))::uuid;
$$;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
select pg_temp.public_id(1,item),'authenticated','authenticated','public-cutover-' || item || '@example.test',
  '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb from generate_series(1,6) item;
insert into public.barangays(id,name) values(pg_temp.public_id(2,1),'Public Local'),(pg_temp.public_id(2,2),'Public Other');
insert into public.app_profiles(id,role,first_name,last_name,barangay_id,status) values
  (pg_temp.public_id(1,1),'resident','Private','Reporter',pg_temp.public_id(2,1),'active'),
  (pg_temp.public_id(1,2),'resident','Other','Resident',pg_temp.public_id(2,1),'active'),
  (pg_temp.public_id(1,3),'officer','Local','Officer',pg_temp.public_id(2,1),'active'),
  (pg_temp.public_id(1,4),'officer','Municipal','Officer',null,'active'),
  (pg_temp.public_id(1,5),'mayor','Test','Mayor',null,'active'),
  (pg_temp.public_id(1,6),'officer','Other','Officer',pg_temp.public_id(2,2),'active');
insert into public.reports(id,reporter_id,title,description,barangay_id,location,device_location,incident_type,incident_type_other)
select pg_temp.public_id(3,item),pg_temp.public_id(1,1),'Private title','Private description and contact',pg_temp.public_id(2,1),
  extensions.st_setsrid(extensions.st_makepoint(123.80317,10.25123),4326)::extensions.geography,
  extensions.st_setsrid(extensions.st_makepoint(123.80318,10.25124),4326)::extensions.geography,'other','Private other description'
from generate_series(1,8) item;
insert into public.incident_cases(id,source_report_id,barangay_id,incident_type,incident_type_other,location,
  verification,state,lead_office,lead_barangay_id,confirmed_at,withdrawn_at,public_correction,is_sensitive,public_location_mode)
select pg_temp.public_id(4,item),pg_temp.public_id(3,item),pg_temp.public_id(2,1),'other','Private other description',
  extensions.st_setsrid(extensions.st_makepoint(123.80317,10.25123),4326)::extensions.geography,
  case when item=4 then 'pending' when item>=6 then 'not_confirmed' else 'confirmed' end::public.incident_verification,
  case when item>=6 then 'closed' else 'active' end::public.incident_state,
  'barangay',pg_temp.public_id(2,1),case when item<>4 then now()-interval '10 days' end,
  case when item=7 then now()-interval '8 days' when item>=6 then now()-interval '1 day' end,
  case when item>=6 then 'The earlier confirmation was withdrawn.' end,
  item in (5,8),case when item in (5,8) then 'barangay_only' else 'approximate_area' end
from generate_series(1,8) item where item not in (2,3);
select set_config('disasterlink.report_transition','1',true);
update public.reports set incident_case_id=pg_temp.public_id(4,case when id=pg_temp.public_id(3,2) then 1 else right(id::text,12)::integer end),
  review_outcome=(case when id=pg_temp.public_id(3,2) then 'linked' when id=pg_temp.public_id(3,4) then 'needs_assessment' else 'verified' end)::public.report_review_outcome
where id::text like 'b3000000-%' and id<>pg_temp.public_id(3,3);
select set_config('disasterlink.report_transition','',true);
insert into public.report_media(id,report_id,type,storage_path,display_storage_path,thumbnail_storage_path,position,public_approved_by,public_approved_at) values
  (pg_temp.public_id(5,1),pg_temp.public_id(3,1),'photo',pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,1)::text||'/original.jpg',
    pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,1)::text||'/display.jpg',
    pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,1)::text||'/thumbnail.jpg',0,pg_temp.public_id(1,3),now()),
  (pg_temp.public_id(5,2),pg_temp.public_id(3,1),'photo',pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,2)::text||'/original.jpg',
    pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,2)::text||'/display.jpg',
    pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,2)::text||'/thumbnail.jpg',1,pg_temp.public_id(1,3),now());
insert into storage.objects(bucket_id,name,metadata) values
  ('report-media',pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,1)::text||'/original.jpg','{"mimetype":"image/jpeg","size":4096}'),
  ('report-media',pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,1)::text||'/display.jpg','{"mimetype":"image/jpeg","size":2048}'),
  ('report-media',pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,1)::text||'/thumbnail.jpg','{"mimetype":"image/jpeg","size":512}'),
  ('report-media',pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,2)::text||'/original.jpg','{"mimetype":"image/jpeg","size":4096}'),
  ('report-media',pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,2)::text||'/display.jpg','{"mimetype":"image/jpeg","size":2048}'),
  ('report-media',pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,2)::text||'/thumbnail.jpg','{"mimetype":"image/jpeg","size":512}'),
  ('report-media','public-safe/'||pg_temp.public_id(5,1)::text||'/'||repeat('a',64)||'/display.jpg','{"mimetype":"image/jpeg","size":1024}'),
  ('report-media','public-safe/'||pg_temp.public_id(5,1)::text||'/'||repeat('b',64)||'/thumbnail.jpg','{"mimetype":"image/jpeg","size":256}');
insert into public.report_public_photo_derivatives(
  media_id,report_id,source_storage_path,source_object_id,display_source_path,display_source_object_id,
  thumbnail_source_path,thumbnail_source_object_id,display_safe_path,display_safe_object_id,display_sha256,
  display_size,display_width,display_height,thumbnail_safe_path,thumbnail_safe_object_id,thumbnail_sha256,
  thumbnail_size,thumbnail_width,thumbnail_height,processor_version,verified_by
) values (
  pg_temp.public_id(5,1),pg_temp.public_id(3,1),
  pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,1)::text||'/original.jpg',
  (select id from storage.objects where bucket_id='report-media' and name=pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,1)::text||'/original.jpg'),
  pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,1)::text||'/display.jpg',
  (select id from storage.objects where bucket_id='report-media' and name=pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,1)::text||'/display.jpg'),
  pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,1)::text||'/thumbnail.jpg',
  (select id from storage.objects where bucket_id='report-media' and name=pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,1)::text||'/thumbnail.jpg'),
  'public-safe/'||pg_temp.public_id(5,1)::text||'/'||repeat('a',64)||'/display.jpg',
  (select id from storage.objects where bucket_id='report-media' and name='public-safe/'||pg_temp.public_id(5,1)::text||'/'||repeat('a',64)||'/display.jpg'),
  repeat('a',64),1024,640,480,
  'public-safe/'||pg_temp.public_id(5,1)::text||'/'||repeat('b',64)||'/thumbnail.jpg',
  (select id from storage.objects where bucket_id='report-media' and name='public-safe/'||pg_temp.public_id(5,1)::text||'/'||repeat('b',64)||'/thumbnail.jpg'),
  repeat('b',64),256,240,180,1,pg_temp.public_id(1,3)
);
insert into public.comments(id,report_id,user_id,body) values
  (pg_temp.public_id(6,1),pg_temp.public_id(3,1),pg_temp.public_id(1,1),'Private comment with an address'),
  (pg_temp.public_id(6,2),pg_temp.public_id(3,1),pg_temp.public_id(1,2),'Screened public discussion');
insert into public.incident_events(incident_case_id,event_type,note,details,is_public) values
  (pg_temp.public_id(4,1),'internal_note','Secret operational note','{"contact":"Secret contact"}',false),
  (pg_temp.public_id(4,1),'progress_update',null,'{"text":"Public safety update"}',true);

set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.public_id(1,2)::text,true);
select is((select count(*) from public.reports where id::text like 'b3000000-%'),0::bigint,'Other resident sees no source reports');
select is((select count(*) from public.reports_map where id::text like 'b3000000-%'),0::bigint,'Map source projection remains private');
select is((select count(*) from public.report_media where report_id=pg_temp.public_id(3,1)),0::bigint,'Approved photos do not expose report_media rows');
select is((select count(*) from public.comments where report_id=pg_temp.public_id(3,1)),0::bigint,'Private report comments are not public incident discussion');
select is((select count(*) from public.report_status_history where report_id=pg_temp.public_id(3,1)),0::bigint,'Internal history is private');
select is((select count(*) from public.incident_events where incident_case_id=pg_temp.public_id(4,1)),0::bigint,'Raw internal and public event rows remain private');
select throws_ok($$select device_location from public.reports where id=pg_temp.public_id(3,1)$$,'42501',null,'Original device GPS is unavailable');
select is((select count(*) from public.list_public_incidents(pg_temp.public_id(2,1))),3::bigint,'Map list includes confirmed cases and seven-day corrections only');
select is((select public_type_label from public.list_public_incidents(pg_temp.public_id(2,1)) where incident_case_id=pg_temp.public_id(4,1)),'Other incident','Other type never publishes private free text');
select is((select linked_report_count from public.list_public_incidents(pg_temp.public_id(2,1)) where incident_case_id=pg_temp.public_id(4,1)),2,'Linked submissions share one public incident');
select is((select approx_latitude from public.list_public_incidents(pg_temp.public_id(2,1)) where incident_case_id=pg_temp.public_id(4,1)),10.25::double precision,'Approximate latitude is rounded');
select is((select approx_longitude from public.list_public_incidents(pg_temp.public_id(2,1)) where incident_case_id=pg_temp.public_id(4,1)),123.8::double precision,'Approximate longitude is rounded');
select is((select exact_latitude from public.list_public_incidents(pg_temp.public_id(2,1)) where incident_case_id=pg_temp.public_id(4,1)),null::double precision,'Approximate records have no exact pin');
select is((select approx_latitude from public.list_public_incidents(pg_temp.public_id(2,1)) where incident_case_id=pg_temp.public_id(4,5)),null::double precision,'Sensitive case has no coordinates');
select is(public.get_public_incident(pg_temp.public_id(4,4)),null::jsonb,'Provisional case is not public');
select ok(public.get_public_incident(pg_temp.public_id(4,7))->'incident'->>'public_correction' is not null,'Saved expired correction link still explains withdrawal');
select is(public.get_public_incident(pg_temp.public_id(4,8)),null::jsonb,'Sensitive withdrawn case has no public page');
select ok(public.get_public_incident(pg_temp.public_id(4,1))::text not like '%Secret%','Public detail cannot contain private event notes or contact');
select ok(public.get_public_incident(pg_temp.public_id(4,1))::text not like '%Private%','Public detail cannot contain private source or other-type text');
select is(public.get_public_incident(pg_temp.public_id(4,1))->'updates'->0->>'public_text','Public safety update','Public detail contains official public updates');
select is(public.can_read_report_media_path(pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,1)::text||'/original.jpg'),false,'Original path remains private after approval');
select is(public.can_read_report_media_path('public-safe/'||pg_temp.public_id(5,1)::text||'/'||repeat('a',64)||'/display.jpg'),true,'Approved safe display path can be signed');
select is(public.can_read_report_media_path('public-safe/'||pg_temp.public_id(5,1)::text||'/'||repeat('b',64)||'/thumbnail.jpg'),true,'Approved safe thumbnail path can be signed');
select is(public.can_read_report_media_path(pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,1)::text||'/display.jpg'),false,'Private source display derivative is not public');
select is(public.can_read_report_media_path(pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,2)::text||'/display.jpg'),false,'Forged legacy approval without a verified proof remains private');
select is((select count(*) from storage.objects where bucket_id='report-media' and name like 'public-safe/%'),2::bigint,'Actual storage policy exposes only two verified safe copies');
select lives_ok($$insert into public.incident_comments(incident_case_id,user_id,body) values(pg_temp.public_id(4,1),auth.uid(),'Public comment')$$,'Public discussion uses the incident without source access');
select is((public.toggle_incident_upvote(pg_temp.public_id(4,1))->>'upvote_count')::integer,1,'Resident support is recorded on the incident');
select is((public.toggle_incident_upvote(pg_temp.public_id(4,1))->>'upvote_count')::integer,0,'Resident can remove incident support');
select throws_ok($$select public.toggle_incident_upvote(pg_temp.public_id(4,4))$$,'42501',null,'Provisional incident cannot receive public support');
select is((select count(*) from public.incident_comment_details where report_id=pg_temp.public_id(4,1)),1::bigint,'Shared incident thread is readable');
select throws_ok($$select legacy_comment_id from public.incident_comments$$,'42501',null,'Public discussion cannot expose private source-comment identifiers');
select throws_ok($$select * from public.list_legacy_incident_comments(pg_temp.public_id(4,1))$$,'42501',null,'Residents cannot screen private source discussion');
select throws_ok($$insert into public.incident_comments(incident_case_id,user_id,body) values(pg_temp.public_id(4,4),auth.uid(),'Provisional comment')$$,'42501',null,'Resident cannot discuss a private provisional case');
select throws_ok($$select * from public.list_resident_report_timeline(pg_temp.public_id(3,1))$$,'42501','Report not found.','Other resident cannot read reporter timeline');
select is((select count(*) from public.list_resident_report_states(array[pg_temp.public_id(3,1)])),0::bigint,'Owner lifecycle projection checks reporter identity');
select throws_ok($$select public.set_report_media_public_unchecked(pg_temp.public_id(5,1),true)$$,'42501',null,'Old unchecked publication RPC is not executable');

select set_config('request.jwt.claim.sub',pg_temp.public_id(1,1)::text,true);
select is((select count(*) from public.reports where id::text like 'b3000000-%'),8::bigint,'Reporter retains every own source submission');
select is((select count(*) from public.report_media where report_id=pg_temp.public_id(3,1)),2::bigint,'Reporter retains original evidence rows');
select is(public.can_read_report_media_path(pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,1)::text||'/original.jpg'),true,'Reporter can sign original evidence');
select ok((select count(*) from public.list_resident_report_timeline(pg_temp.public_id(3,1)))>0,'Reporter gets a limited timeline');
select ok((select bool_and(public_text not like '%Secret%') from public.list_resident_report_timeline(pg_temp.public_id(3,1))),'Reporter timeline excludes internal notes and contact');
select is((select lifecycle_facts->>'incidentVerification' from public.list_resident_report_states(array[pg_temp.public_id(3,1)])),'confirmed','Reporter lifecycle follows incident facts');

select set_config('request.jwt.claim.sub',pg_temp.public_id(1,3)::text,true);
select is((select count(*) from public.list_legacy_incident_comments(pg_temp.public_id(4,1))),2::bigint,'Only lead can load private comments for screening');
select lives_ok($$select public.publish_legacy_incident_comment(pg_temp.public_id(6,2))$$,'Lead may explicitly copy an eligible screened legacy comment');
select is((select count(*) from public.incident_comments where incident_case_id=pg_temp.public_id(4,1) and body='Private comment with an address'),0::bigint,'Unscreened private body is never automatically copied');
select lives_ok($$select public.publish_legacy_incident_comment(pg_temp.public_id(6,2))$$,'Legacy copy is idempotent');
select throws_ok($$select public.set_report_media_public(pg_temp.public_id(5,2),true)$$,'22023','Photo publication requires a confirmed non-sensitive incident and verified safe copies.','Lead cannot bypass metadata precheck');
select lives_ok($$select public.set_incident_public_location(pg_temp.public_id(4,1),'exact_for_safety','Road closure assembly point')$$,'Lead publishes a justified safety location');
select lives_ok($$select public.claim_report_review(pg_temp.public_id(3,3))$$,'Lead starts pending review');
select lives_ok($$select public.log_incident_event(pg_temp.public_id(4,1),'responders_on_site','{"service":"bdrrmo_team"}',null)$$,'Qualifying response action is recorded without public operational notes');
select lives_ok($$select public.reroute_report_barangay(pg_temp.public_id(3,3),pg_temp.public_id(2,2),'Wrong office')$$,'Reroute records new responsible office');
select set_config('request.jwt.claim.sub',pg_temp.public_id(1,1)::text,true);
select ok((select exists(select 1 from public.list_resident_report_timeline(pg_temp.public_id(3,3)) where entry_type='routing_changed' and responsible_office_label='Brgy. Public Other BDRRMO')),'Resident timeline names the rerouted office');
select ok((select exists(select 1 from public.list_resident_report_timeline(pg_temp.public_id(3,3)) where entry_type='review_claimed' and responsible_office_label='Brgy. Public Local BDRRMO')),'Earlier timeline responsibility is preserved');
select ok((select exists(select 1 from public.notifications where user_id=auth.uid() and title='Response action recorded' and body not like '%service%')),'Resident response notice contains only safe public copy');
select set_config('request.jwt.claim.sub',pg_temp.public_id(1,2)::text,true);
select is(public.get_public_incident(pg_temp.public_id(4,1))->'incident'->>'safety_location_reason','Road closure assembly point','Safety reason is public');
select is((public.get_public_incident(pg_temp.public_id(4,1))->'incident'->>'exact_latitude')::double precision,10.25123::double precision,'Safety exception alone publishes exact location');
select set_config('request.jwt.claim.sub',pg_temp.public_id(1,3)::text,true);
select lives_ok($$select public.set_incident_sensitive(pg_temp.public_id(4,1),true,'Identifiable homes')$$,'Sensitivity revokes previously approved media');
select throws_ok($$select public.set_incident_public_location(pg_temp.public_id(4,1),'exact_for_safety','Private safety pin')$$,'22023',null,'Sensitive case cannot publish exact safety location');
select set_config('request.jwt.claim.sub',pg_temp.public_id(1,2)::text,true);
select is(public.can_read_report_media_path('public-safe/'||pg_temp.public_id(5,1)::text||'/'||repeat('a',64)||'/display.jpg'),false,'Revocation immediately denies storage authorization');
select is(jsonb_array_length(public.get_public_incident(pg_temp.public_id(4,1))->'incident'->'public_photo_display_paths'),0,'Sensitive public projection has no photo paths');
select is(public.get_public_incident(pg_temp.public_id(4,1))->'incident'->>'exact_latitude',null::text,'Sensitive public projection has no exact coordinates');

select set_config('request.jwt.claim.sub',pg_temp.public_id(1,5)::text,true);
select is((select count(*) from public.reports where id::text like 'b3000000-%'),0::bigint,'Mayor has no raw source report access');
select is((select count(*) from public.report_media where report_id=pg_temp.public_id(3,1)),0::bigint,'Mayor has no raw evidence access');
select is(public.can_read_report_media_path(pg_temp.public_id(1,1)::text||'/'||pg_temp.public_id(3,1)::text||'/'||pg_temp.public_id(5,1)::text||'/original.jpg'),false,'Mayor cannot sign original evidence');
select ok((select count(*) from public.report_totals_by_barangay where barangay_id=pg_temp.public_id(2,1))>0,'Existing Mayor aggregate chart remains usable');
select set_config('request.jwt.claim.sub',pg_temp.public_id(1,6)::text,true);
select is((select count(*) from public.reports where id=pg_temp.public_id(3,1)),0::bigint,'Other barangay officer cannot read source evidence out of scope');
select throws_ok($$select public.set_incident_sensitive(pg_temp.public_id(4,1),false,'Other office attempt')$$,'42501',null,'Other office cannot change publication settings');

select set_config('request.jwt.claim.sub',pg_temp.public_id(1,3)::text,true);
select lives_ok($$select public.request_municipal_support(pg_temp.public_id(4,1),'transfer','Municipal resources required')$$,'Lead requests municipal transfer');
select set_config('request.jwt.claim.sub',pg_temp.public_id(1,4)::text,true);
select lives_ok($$select public.respond_support_request((select id from public.incident_support_requests where incident_case_id=pg_temp.public_id(4,1) and status='requested'),'accept',null)$$,'MDRRMO accepts transfer');
select set_config('request.jwt.claim.sub',pg_temp.public_id(1,1)::text,true);
select ok((select exists(select 1 from public.list_resident_report_timeline(pg_temp.public_id(3,1)) where entry_type='transfer_requested' and responsible_office_label='Brgy. Public Local BDRRMO')),'Forwarding timeline preserves barangay responsibility');
select ok((select exists(select 1 from public.list_resident_report_timeline(pg_temp.public_id(3,1)) where entry_type='transfer_accepted' and responsible_office_label='MDRRMO')),'Accepted transfer timeline names MDRRMO responsibility');

select * from finish();
rollback;
