begin;
select no_plan();

create function pg_temp.post_id(family integer, item integer) returns uuid
language sql immutable as $$
  select ('d' || family::text || '000000-0000-4000-8000-' || lpad(item::text, 12, '0'))::uuid;
$$;
create function pg_temp.post_actor(item integer) returns text language sql as $$
  select set_config('request.jwt.claim.sub', pg_temp.post_id(1, item)::text, true);
$$;
create function pg_temp.post_case() returns uuid
language sql security definer set search_path = '' as $$
  select id from public.incident_cases where source_report_id = pg_temp.post_id(3, 1);
$$;
insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
select pg_temp.post_id(1, item), 'authenticated', 'authenticated', 'public-post-' || item || '@example.test',
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb from generate_series(1, 4) item;
insert into public.barangays(id, name) values
  (pg_temp.post_id(2, 1), 'Public Post Local'), (pg_temp.post_id(2, 2), 'Public Post Other');
insert into public.app_profiles(id, role, first_name, last_name, barangay_id, status) values
  (pg_temp.post_id(1, 1), 'resident', 'Post', 'Reporter', pg_temp.post_id(2, 1), 'active'),
  (pg_temp.post_id(1, 2), 'officer', 'Post', 'Lead', pg_temp.post_id(2, 1), 'active'),
  (pg_temp.post_id(1, 3), 'officer', 'Post', 'Other', pg_temp.post_id(2, 2), 'active'),
  (pg_temp.post_id(1, 4), 'resident', 'Post', 'Neighbor', pg_temp.post_id(2, 1), 'active');
insert into public.reports(id, reporter_id, title, description, barangay_id, location)
values (pg_temp.post_id(3, 1), pg_temp.post_id(1, 1), 'Private resident title', 'Private resident description',
  pg_temp.post_id(2, 1), extensions.st_setsrid(extensions.st_makepoint(123.8, 10.25), 4326)::extensions.geography);

set local role authenticated;
select pg_temp.post_actor(2);
select public.claim_report_review(pg_temp.post_id(3, 1));
select public.review_report(pg_temp.post_id(3, 1), 'verify');

select pg_temp.post_actor(4);
select is((select public_title from public.list_public_incidents(pg_temp.post_id(2, 1))
  where incident_case_id = pg_temp.post_case()), null,
  'the resident title is never copied into the public record automatically');
select is((select public_caption from public.list_public_incidents(pg_temp.post_id(2, 1))
  where incident_case_id = pg_temp.post_case()), null,
  'the resident description is never copied into the public record automatically');

select pg_temp.post_actor(1);
select throws_ok($$select public.set_incident_public_post(pg_temp.post_case(), 'Title', 'Caption', null)$$,
  '42501', null, 'a resident cannot publish an incident post');
select pg_temp.post_actor(3);
select throws_ok($$select public.set_incident_public_post(pg_temp.post_case(), 'Title', 'Caption', null)$$,
  '42501', null, 'another barangay office cannot publish the lead office post');

select pg_temp.post_actor(2);
select throws_ok($$select public.set_incident_public_post(pg_temp.post_case(), 'Title only', null, null)$$,
  '22023', null, 'a title needs a caption');
select throws_ok($$select public.set_incident_public_post(pg_temp.post_case(), null, null, 'Near the chapel')$$,
  '22023', null, 'a landmark cannot be published without a post');
select throws_ok($$select public.set_incident_public_post(pg_temp.post_case(), repeat('a', 81), 'Caption', null)$$,
  '22023', null, 'public titles are limited to 80 characters');
select lives_ok($$select public.set_incident_public_post(pg_temp.post_case(), '  Flooded road  ',
  'Knee-deep water on the main road.', 'Near the chapel')$$, 'the lead office publishes a screened post');
select is((select count(*) from public.incident_events where incident_case_id = pg_temp.post_case()
  and event_type = 'public_post_changed'), 1::bigint, 'publishing the post is audited');

select pg_temp.post_actor(4);
select is((select public_title from public.list_public_incidents(pg_temp.post_id(2, 1))
  where incident_case_id = pg_temp.post_case()), 'Flooded road', 'another resident sees the trimmed public title');
select is((select public_landmark from public.list_public_incidents(pg_temp.post_id(2, 1))
  where incident_case_id = pg_temp.post_case()), 'Near the chapel', 'the screened landmark is public for an approximate area');
select is((public.get_public_incident(pg_temp.post_case())->'incident'->>'public_caption'),
  'Knee-deep water on the main road.', 'the detail record carries the caption');

select public.toggle_incident_upvote(pg_temp.post_case());
insert into public.incident_comments(incident_case_id, user_id, body)
  values (pg_temp.post_case(), pg_temp.post_id(1, 4), 'Stay safe everyone');
select is((select support_count from public.list_public_incidents(pg_temp.post_id(2, 1))
  where incident_case_id = pg_temp.post_case()), 1, 'support count is included in the list');
select is((select comment_count from public.list_public_incidents(pg_temp.post_id(2, 1))
  where incident_case_id = pg_temp.post_case()), 1, 'comment count is included in the list');
select ok((select has_supported from public.list_public_incidents(pg_temp.post_id(2, 1))
  where incident_case_id = pg_temp.post_case()), 'the caller sees their own support');
select pg_temp.post_actor(1);
select ok(not (select has_supported from public.list_public_incidents(pg_temp.post_id(2, 1))
  where incident_case_id = pg_temp.post_case()), 'support state is per caller');

select pg_temp.post_actor(2);
select public.set_incident_public_location(pg_temp.post_case(), 'barangay_only', null);
select pg_temp.post_actor(4);
select is((select public_landmark from public.list_public_incidents(pg_temp.post_id(2, 1))
  where incident_case_id = pg_temp.post_case()), null, 'a landmark is withheld for barangay-only publication');

select pg_temp.post_actor(2);
select lives_ok($$select public.set_incident_public_post(pg_temp.post_case(), null, null, null)$$,
  'the lead office can clear the post');
select pg_temp.post_actor(4);
select is((select public_caption from public.list_public_incidents(pg_temp.post_id(2, 1))
  where incident_case_id = pg_temp.post_case()), null, 'a cleared post disappears from the public record');

select * from finish();
rollback;
