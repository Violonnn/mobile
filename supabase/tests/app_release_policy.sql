begin;
select no_plan();

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('f1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'release-active@example.test', 'not-used', now(), '{}', '{}'),
  ('f1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'release-other@example.test', 'not-used', now(), '{}', '{}'),
  ('f1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'release-suspended@example.test', 'not-used', now(), '{}', '{}'),
  ('f1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'release-incomplete@example.test', 'not-used', now(), '{}', '{}');
insert into public.app_profiles (id, role, first_name, last_name, status)
values
  ('f1000000-0000-4000-8000-000000000001', 'resident', 'Release', 'Active', 'active'),
  ('f1000000-0000-4000-8000-000000000002', 'admin', 'Release', 'Admin', 'active'),
  ('f1000000-0000-4000-8000-000000000003', 'officer', 'Release', 'Suspended', 'suspended');

select is((select count(*) from pg_class where oid in ('public.app_release_policy'::regclass, 'public.app_client_versions'::regclass) and relrowsecurity), 2::bigint, 'Both tables have RLS');
select is((select count(*) from public.app_release_policy where enforce or download_url is not null), 0::bigint, 'Seed policies never enforce or invent download links');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.record_app_version(text,text)'::regprocedure), 'Check-in uses security definer and an empty search path');
update public.app_release_policy set updated_at = '2000-01-01' where platform = 'ios';
select ok((select updated_at = now() from public.app_release_policy where platform = 'ios'), 'Policy changes use the shared updated_at trigger');

set local role anon;
select is((select count(*) from public.app_release_policy), 2::bigint, 'Policy readable before login');
select is((select emergency_numbers->0->>'number' from public.app_release_policy where platform = 'ios'), '911', 'Emergency number available before login');
select throws_ok($$select * from public.app_client_versions$$, '42501', null, 'Anon cannot read check-ins');
select throws_ok($$select public.record_app_version('ios', '1.0.1')$$, '42501', null, 'Anon cannot call check-in');
select throws_ok($$update public.app_release_policy set enforce = true$$, '42501', null, 'Anon cannot update policy');
select throws_ok($$insert into public.app_release_policy (platform, minimum_supported_version, latest_version) values ('ios', '1.0.0', '1.0.1')$$, '42501', null, 'Anon cannot insert policy');
select throws_ok($$delete from public.app_release_policy$$, '42501', null, 'Anon cannot delete policy');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000001', true);
select is((select count(*) from public.app_release_policy), 2::bigint, 'Authenticated policy reads succeed');
select lives_ok($$select public.record_app_version('ios', '1.0.1')$$, 'Active resident checks in');
select throws_ok($$select * from public.app_client_versions$$, '42501', null, 'Resident cannot read even own telemetry');
select throws_ok($$insert into public.app_client_versions (user_id, platform, app_version) values ('f1000000-0000-4000-8000-000000000002', 'ios', '1.0.1')$$, '42501', null, 'Cannot spoof another user through direct insert');
select throws_ok($$update public.app_client_versions set app_version = '9.9.9'$$, '42501', null, 'Direct check-in updates denied');
select throws_ok($$delete from public.app_client_versions$$, '42501', null, 'Direct check-in deletion denied');
select throws_ok($$select public.record_app_version('web', '1.0.1')$$, '22023', null, 'Invalid platform refused');
select throws_ok($$select public.record_app_version(null, '1.0.1')$$, '22023', null, 'Null platform refused');
select throws_ok($$select public.record_app_version('ios', null)$$, '22023', null, 'Null version refused');
select throws_ok($$select public.record_app_version('ios', '1.2')$$, '22023', null, 'Incomplete version refused');
select throws_ok($$select public.record_app_version('ios', '1.2.3-beta')$$, '22023', null, 'Prerelease refused');
select throws_ok($$select public.record_app_version('ios', '12345678901234567.0.0')$$, '22023', null, 'Overlong version refused');
select throws_ok($$select public.record_app_version('ios', E'1.2.3\n')$$, '22023', null, 'Trailing newline refused');
select lives_ok($$select public.record_app_version('android', '1.0.2')$$, 'Subsequent check-in upserts');

reset role;
select is((select count(*) from public.app_client_versions where user_id = 'f1000000-0000-4000-8000-000000000001'), 1::bigint, 'One record per user');
select is((select platform || '/' || app_version from public.app_client_versions where user_id = 'f1000000-0000-4000-8000-000000000001'), 'android/1.0.2', 'Latest check-in replaces platform and version');
select ok((select last_seen_at = now() from public.app_client_versions where user_id = 'f1000000-0000-4000-8000-000000000001'), 'Server sets last-seen time');
select is((select count(*) from public.app_client_versions where user_id = 'f1000000-0000-4000-8000-000000000002'), 0::bigint, 'Other account was not changed');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000002', true);
select lives_ok($$select public.record_app_version('ios', '1.0.1')$$, 'Active admin checks in');
select throws_ok($$select * from public.app_client_versions$$, '42501', null, 'App admins cannot enumerate check-ins');
select throws_ok($$update public.app_release_policy set enforce = true$$, '42501', null, 'App admins cannot enforce updates');
select throws_ok($$insert into public.app_release_policy (platform, minimum_supported_version, latest_version) values ('ios', '1.0.0', '1.0.1')$$, '42501', null, 'App admins cannot insert policy');
select throws_ok($$delete from public.app_release_policy$$, '42501', null, 'App admins cannot delete policy');
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000003', true);
select throws_ok($$select public.record_app_version('ios', '1.0.1')$$, '42501', null, 'Suspended account cannot check in');
select is((select count(*) from public.app_release_policy), 2::bigint, 'Suspended user can still access public release guidance');
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000004', true);
select throws_ok($$select public.record_app_version('ios', '1.0.1')$$, '42501', null, 'Incomplete profile cannot check in');
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select public.record_app_version('ios', '1.0.1')$$, '42501', null, 'Missing identity cannot check in');

select * from finish();
rollback;
