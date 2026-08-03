begin;

select plan(35);

-- Isolated identity, barangay, and content fixtures for RLS verification.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('e1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'permission-bdrrmo-tunghaan@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('e1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'permission-bdrrmo-wardii@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('e1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'permission-suspended@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('e1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'permission-mdrrmo@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('e1000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'permission-mayor@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('e1000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'permission-admin@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('e1000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'permission-resident@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('e1000000-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'permission-incomplete-official@example.test', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.barangays (id, name)
values
  ('e2000000-0000-4000-8000-000000000001', 'Permission Test Tunghaan'),
  ('e2000000-0000-4000-8000-000000000002', 'Permission Test Ward II');

insert into public.app_profiles (
  id, role, first_name, last_name, barangay_id, status
)
values
  ('e1000000-0000-4000-8000-000000000001', 'officer', 'BDRRMO', 'Tunghaan', 'e2000000-0000-4000-8000-000000000001', 'active'),
  ('e1000000-0000-4000-8000-000000000002', 'officer', 'BDRRMO', 'Ward II', 'e2000000-0000-4000-8000-000000000002', 'active'),
  ('e1000000-0000-4000-8000-000000000003', 'officer', 'Suspended', 'Officer', 'e2000000-0000-4000-8000-000000000001', 'suspended'),
  ('e1000000-0000-4000-8000-000000000004', 'officer', 'MDRRMO', 'Officer', null, 'active'),
  ('e1000000-0000-4000-8000-000000000005', 'mayor', 'Mayor', 'User', null, 'active'),
  ('e1000000-0000-4000-8000-000000000006', 'admin', 'Admin', 'User', null, 'active'),
  ('e1000000-0000-4000-8000-000000000007', 'resident', 'Resident', 'A', 'e2000000-0000-4000-8000-000000000001', 'active');

-- Officer-authored fixtures avoid the resident media constraint trigger.
insert into public.reports (
  id, reporter_id, title, description, location, barangay_id
)
values
  ('e3000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Local report', 'Local BDRRMO report.', extensions.st_setsrid(extensions.st_makepoint(123.80, 10.25), 4326)::extensions.geography, 'e2000000-0000-4000-8000-000000000001'),
  ('e3000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002', 'Other report', 'Other BDRRMO report.', extensions.st_setsrid(extensions.st_makepoint(123.81, 10.26), 4326)::extensions.geography, 'e2000000-0000-4000-8000-000000000002');

insert into public.hotlines (id, name, number, category, barangay_id)
values
  ('e4000000-0000-4000-8000-000000000001', 'Local hotline', '911001', 'rescue', 'e2000000-0000-4000-8000-000000000001'),
  ('e4000000-0000-4000-8000-000000000002', 'Other hotline', '911002', 'rescue', 'e2000000-0000-4000-8000-000000000002'),
  ('e4000000-0000-4000-8000-000000000003', 'National emergency', '911', 'national_emergency', null),
  ('e4000000-0000-4000-8000-000000000004', 'Archived municipal hotline', '911004', 'lgu', null, false);

insert into public.facilities (
  id, name, type, location, barangay_id, is_active
)
values
  ('e6000000-0000-4000-8000-000000000001', 'Tunghaan local facility', 'barangay_hall', extensions.st_setsrid(extensions.st_makepoint(123.80, 10.25), 4326)::extensions.geography, 'e2000000-0000-4000-8000-000000000001', true),
  ('e6000000-0000-4000-8000-000000000002', 'Municipal facility', 'municipal_hall', extensions.st_setsrid(extensions.st_makepoint(123.79, 10.24), 4326)::extensions.geography, null, true),
  ('e6000000-0000-4000-8000-000000000003', 'Archived municipal facility', 'other', extensions.st_setsrid(extensions.st_makepoint(123.78, 10.23), 4326)::extensions.geography, null, false),
  ('e6000000-0000-4000-8000-000000000004', 'Ward II facility', 'barangay_hall', extensions.st_setsrid(extensions.st_makepoint(123.81, 10.26), 4326)::extensions.geography, 'e2000000-0000-4000-8000-000000000002', true);

insert into public.evacuation_centers (
  id, name, location, barangay_id, status
)
values
  ('e7000000-0000-4000-8000-000000000001', 'Tunghaan center', extensions.st_setsrid(extensions.st_makepoint(123.80, 10.25), 4326)::extensions.geography, 'e2000000-0000-4000-8000-000000000001', 'closed_temporarily'),
  ('e7000000-0000-4000-8000-000000000002', 'Ward II center', extensions.st_setsrid(extensions.st_makepoint(123.81, 10.26), 4326)::extensions.geography, 'e2000000-0000-4000-8000-000000000002', 'closed_temporarily');

insert into public.announcements (
  id, author_id, scope, barangay_id, title, body, is_pinned
)
values
  ('e5000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000004', 'municipal', null, 'Municipal notice', 'Municipal audience.', true),
  ('e5000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', 'barangay', 'e2000000-0000-4000-8000-000000000001', 'Tunghaan notice', 'Tunghaan audience.', true),
  ('e5000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000002', 'barangay', 'e2000000-0000-4000-8000-000000000002', 'Ward II notice', 'Ward II audience.', true);

set local role authenticated;

-- An active BDRRMO can access only its assigned barangay content.
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000001', true);
select is(public.has_active_profile(), true, 'active BDRRMO has an active profile');
select is((select count(*) from public.reports), 1::bigint, 'BDRRMO only reads reports from its assigned barangay');
select is((select count(*) from public.hotlines), 2::bigint, 'BDRRMO reads local and active municipality-wide hotlines only');
select is((select count(*) from public.facilities), 2::bigint, 'BDRRMO reads local and active municipality-wide facilities only');
select is((select count(*) from public.evacuation_centers), 1::bigint, 'BDRRMO only reads evacuation centers in its assigned barangay');
select is((select count(*) from public.announcements), 2::bigint, 'BDRRMO sees municipal and assigned-barangay announcements only');
select is((select count(*) from public.report_totals_by_barangay), 1::bigint, 'BDRRMO receives analytics only for its assigned barangay');
select is(
  (
    select array_agg(id order by is_pinned desc, author_rank asc, created_at desc)
    from public.announcements_ranked
  ),
  array[
    'e5000000-0000-4000-8000-000000000001'::uuid,
    'e5000000-0000-4000-8000-000000000002'::uuid
  ],
  'The BDRRMO local pin appears below the municipal pin'
);
select is(
  (
    with changed as (
      update public.announcements
         set is_pinned = false
       where id = 'e5000000-0000-4000-8000-000000000002'
       returning id
    )
    select count(*) from changed
  ),
  1::bigint,
  'BDRRMO can change the pin on its assigned-barangay announcement'
);
select is(
  (with changed as (
    update public.hotlines
       set name = 'Cross-barangay edit'
     where id = 'e4000000-0000-4000-8000-000000000002'
     returning id
   ) select count(*) from changed),
  0::bigint,
  'BDRRMO cannot mutate a different barangay hotline'
);
select lives_ok(
  $$update public.evacuation_centers set status = 'open' where id = 'e7000000-0000-4000-8000-000000000001'$$,
  'BDRRMO can update the status of an assigned-barangay evacuation center'
);
select throws_ok(
  $$update public.evacuation_centers set capacity = 50 where id = 'e7000000-0000-4000-8000-000000000001'$$,
  '42501',
  'BDRRMO may only change status on evacuation centers.',
  'BDRRMO cannot edit evacuation-center metadata'
);
select is(
  (
    with changed as (
      update public.hotlines
         set is_active = false
       where id = 'e4000000-0000-4000-8000-000000000003'
       returning id
    )
    select count(*) from changed
  ),
  0::bigint,
  'BDRRMO cannot archive the national emergency hotline'
);
select throws_ok(
  $$insert into public.hotlines (name, number, category, barangay_id) values ('Unofficial national number', '911005', 'national_emergency', 'e2000000-0000-4000-8000-000000000001')$$,
  '42501',
  'BDRRMO may not create or modify national emergency hotlines.',
  'BDRRMO cannot create a barangay-scoped national emergency hotline'
);

-- A BDRRMO assigned to another barangay has a separate, isolated workload.
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.reports), 1::bigint, 'BDRRMO receives only reports from its assigned barangay');
select is((select count(*) from public.announcements), 2::bigint, 'BDRRMO cannot read another barangay local announcement');

-- Suspension immediately blocks direct table access despite a valid JWT subject.
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000003', true);
select is(public.has_active_profile(), false, 'suspended official does not satisfy the active-profile predicate');
select is((select count(*) from public.reports), 0::bigint, 'suspended official cannot read protected reports');
select is((select count(*) from public.hotlines), 0::bigint, 'suspended official cannot read protected resources');
select is((select count(*) from public.report_totals_by_barangay), 0::bigint, 'suspended official receives no analytics rows');

-- Municipality-wide operational roles retain their existing view.
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000004', true);
select is((select count(*) from public.reports), 2::bigint, 'MDRRMO retains municipality-wide report access');
select is((select coalesce(sum(report_count), 0)::bigint from public.report_totals_by_barangay), 2::bigint, 'MDRRMO receives municipality-wide analytics');
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000005', true);
select is((select count(*) from public.announcements), 3::bigint, 'Mayor retains municipality-wide announcement access');
select is((select coalesce(sum(report_count), 0)::bigint from public.report_totals_by_barangay), 2::bigint, 'Mayor receives municipality-wide analytics');
select is((select count(*) from public.mayor_report_activity('today', null)), 96::bigint, 'Mayor receives zero-filled hourly activity buckets');
select throws_ok(
  $$select public.transition_report_status('e3000000-0000-4000-8000-000000000001', 'verified', 'Mayor attempt')$$,
  '42501',
  'Mayor accounts cannot change report status',
  'Mayor cannot transition a report'
);
select throws_ok(
  $$select public.request_reporter_contact('e3000000-0000-4000-8000-000000000001')$$,
  '42501',
  'Reporter contact is unavailable.',
  'Mayor cannot request reporter contact'
);
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000006', true);
select is(public.is_admin(), true, 'active admin retains the admin role helper');
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000007', true);
select is((select count(*) from public.announcements), 2::bigint, 'resident sees municipal and home-barangay announcements');
select is((select count(*) from public.report_totals_by_barangay), 0::bigint, 'resident receives no analytics rows');
select throws_ok(
  $$select * from public.mayor_report_activity('today', null)$$,
  '42501',
  'Mayor report activity is unavailable for this account.',
  'resident cannot request Mayor activity buckets'
);
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000008', true);
select is((select count(*) from public.report_totals_by_barangay), 0::bigint, 'account without a completed profile receives no analytics rows');

-- The BDRRMO -> MDRRMO handoff is one-way after municipal reverification.
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.transition_report_status('e3000000-0000-4000-8000-000000000001', 'escalated', 'Needs municipal support')$$,
  'BDRRMO can escalate a locally verified report'
);
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000004', true);
select lives_ok(
  $$select public.transition_report_status('e3000000-0000-4000-8000-000000000001', 'verified', 'Municipality reverified')$$,
  'MDRRMO can reverify the escalated report'
);
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.transition_report_status('e3000000-0000-4000-8000-000000000001', 'escalated', 'Attempted duplicate escalation')$$,
  '42501',
  'A reverified report cannot be escalated again.',
  'BDRRMO cannot escalate a reverified report again'
);

select * from finish();
rollback;
