begin;

select no_plan();

-- All fixtures roll back. The roles exercise real authenticated RLS, including
-- direct storage reads (the authorization used when signing private files).
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
select
  ('f1000000-0000-4000-8000-' || lpad(identity_number::text, 12, '0'))::uuid,
  'authenticated', 'authenticated',
  'report-privacy-' || identity_number || '@example.test',
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from generate_series(1, 8) identity_number;

insert into public.barangays (id, name) values
  ('f2000000-0000-4000-8000-000000000001', 'Report Privacy Local'),
  ('f2000000-0000-4000-8000-000000000002', 'Report Privacy Other');

insert into public.app_profiles (id, role, first_name, last_name, barangay_id, status) values
  ('f1000000-0000-4000-8000-000000000001', 'resident', 'Privacy', 'Reporter', 'f2000000-0000-4000-8000-000000000001', 'active'),
  ('f1000000-0000-4000-8000-000000000002', 'resident', 'Other', 'Resident', 'f2000000-0000-4000-8000-000000000001', 'active'),
  ('f1000000-0000-4000-8000-000000000003', 'officer', 'Local', 'BDRRMO', 'f2000000-0000-4000-8000-000000000001', 'active'),
  ('f1000000-0000-4000-8000-000000000004', 'officer', 'Other', 'BDRRMO', 'f2000000-0000-4000-8000-000000000002', 'active'),
  ('f1000000-0000-4000-8000-000000000005', 'officer', 'Municipal', 'MDRRMO', null, 'active'),
  ('f1000000-0000-4000-8000-000000000006', 'mayor', 'Privacy', 'Mayor', null, 'active'),
  ('f1000000-0000-4000-8000-000000000007', 'officer', 'Suspended', 'Officer', 'f2000000-0000-4000-8000-000000000001', 'suspended'),
  ('f1000000-0000-4000-8000-000000000008', 'admin', 'Privacy', 'Admin', null, 'active');

insert into public.profiles (
  id, phone, first_name, last_name, birth_year, birth_month, barangay, pin_hash
) values (
  'f1000000-0000-4000-8000-000000000001', '+639179991001',
  'Privacy', 'Reporter', '2000', 1, 'Report Privacy Local', 'not-a-real-pin-hash'
);

insert into public.reports (
  id, reporter_id, title, description, barangay_id, location, device_location
)
select
  ('f3000000-0000-4000-8000-' || lpad(report_number::text, 12, '0'))::uuid,
  'f1000000-0000-4000-8000-000000000001',
  'Privacy fixture ' || report_number, 'Private source description',
  'f2000000-0000-4000-8000-000000000001',
  extensions.st_setsrid(extensions.st_makepoint(123.80, 10.25), 4326)::extensions.geography,
  extensions.st_setsrid(extensions.st_makepoint(123.80, 10.25), 4326)::extensions.geography
from generate_series(1, 4) report_number;

insert into public.report_media (
  report_id, type, storage_path, display_storage_path, thumbnail_storage_path, position
)
select
  id, 'photo',
  'f1000000-0000-4000-8000-000000000001/' || id || '/original.jpg',
  'f1000000-0000-4000-8000-000000000001/' || id || '/display.jpg',
  'f1000000-0000-4000-8000-000000000001/' || id || '/thumbnail.jpg', 0
from public.reports
where reporter_id = 'f1000000-0000-4000-8000-000000000001';

-- Fixture setup uses the existing transition RPC rather than disabling guards.
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000003', true);
do $$
begin
  perform public.transition_report_status('f3000000-0000-4000-8000-000000000002', 'verified', 'Private verification note');
  perform public.transition_report_status('f3000000-0000-4000-8000-000000000003', 'verified');
  perform public.transition_report_status('f3000000-0000-4000-8000-000000000003', 'escalated');
  perform public.transition_report_status('f3000000-0000-4000-8000-000000000004', 'verified');
  perform public.transition_report_status('f3000000-0000-4000-8000-000000000004', 'resolved');
end;
$$;

update public.report_status_history
set created_at = now() - interval '5 minutes'
where report_id::text like 'f3000000-%';

update public.report_status_history
set created_at = now() - interval '1 minute',
    detail = '{"old_coordinates":[123.80,10.25],"new_coordinates":[123.81,10.26]}'::jsonb
where report_id = 'f3000000-0000-4000-8000-000000000002'
  and from_status is not null;

insert into public.comments (report_id, user_id, body)
select id, 'f1000000-0000-4000-8000-000000000001', 'Reporter comment'
from public.reports where reporter_id = 'f1000000-0000-4000-8000-000000000001';

insert into public.comments (report_id, user_id, body, created_at, is_hidden) values
  ('f3000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000003', 'Visible official update', now() - interval '30 seconds', false),
  ('f3000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000003', 'Hidden official update', now() + interval '1 minute', false);

-- A different scoped official hides the comment through normal moderation.
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000005', true);
update public.comments
set is_hidden = true
where report_id = 'f3000000-0000-4000-8000-000000000002'
  and body = 'Hidden official update';

insert into public.report_upvotes (report_id, user_id)
select id, 'f1000000-0000-4000-8000-000000000002'
from public.reports where reporter_id = 'f1000000-0000-4000-8000-000000000001';

insert into storage.objects (bucket_id, name)
select 'report-media', media_path
from public.report_media media
cross join lateral unnest(array[
  media.storage_path, media.display_storage_path, media.thumbnail_storage_path
]) media_path
where media.report_id::text like 'f3000000-%';

insert into storage.objects (bucket_id, name) values
  ('report-media', 'f1000000-0000-4000-8000-000000000001/draft.jpg'),
  ('report-media', 'f1000000-0000-4000-8000-000000000007/draft.jpg');

-- A pre-existing contact log must remain unreadable even to scoped officials.
insert into public.report_contact_access_logs (report_id, official_id, purpose, access_event)
values ('f3000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000003', 'verification_or_coordination', 'contact_revealed');

-- This test helper runs as its caller, never as a definer. Every RETURN NEXT
-- emits an independent pgTAP assertion for each role and each access path.
create function pg_temp.check_report_privacy(
  actor_id uuid,
  actor_label text,
  visible_report_count bigint,
  visible_media_count bigint,
  can_read_internal_history boolean,
  can_read_pending boolean
)
returns setof text
language plpgsql
security invoker
as $$
declare
  media_variant text;
begin
  perform set_config('request.jwt.claim.sub', actor_id::text, true);

  return next is(
    (select count(*) from public.reports where id::text like 'f3000000-%'),
    visible_report_count, actor_label || ': report rows follow scope'
  );
  return next is(
    (select count(*) from public.reports_map where id::text like 'f3000000-%'),
    visible_report_count, actor_label || ': map rows follow scope'
  );
  return next is(
    public.can_read_report_id('f3000000-0000-4000-8000-000000000001'),
    can_read_pending, actor_label || ': copied pending report id follows scope'
  );
  return next is(
    (select exists(select 1 from public.comments where report_id = 'f3000000-0000-4000-8000-000000000001')),
    can_read_pending, actor_label || ': pending comments follow scope'
  );
  return next is(
    (select exists(select 1 from public.report_comments where report_id = 'f3000000-0000-4000-8000-000000000001')),
    can_read_pending, actor_label || ': pending comment view follows scope'
  );
  return next is(
    (select exists(select 1 from public.report_upvotes where report_id = 'f3000000-0000-4000-8000-000000000001')),
    can_read_pending, actor_label || ': pending upvotes follow scope, including own vote'
  );

  return next is(
    (select exists(select 1 from public.report_status_history where report_id = 'f3000000-0000-4000-8000-000000000002')),
    can_read_internal_history, actor_label || ': history rows follow official scope'
  );
  return next is(
    (select exists(select note from public.report_status_history where report_id = 'f3000000-0000-4000-8000-000000000002' and note = 'Private verification note')),
    can_read_internal_history, actor_label || ': internal note is protected'
  );
  return next is(
    (select exists(select detail from public.report_status_history where report_id = 'f3000000-0000-4000-8000-000000000002' and detail is not null)),
    can_read_internal_history, actor_label || ': coordinate correction detail is protected'
  );
  return next is(
    (select count(distinct report_id) from public.report_status_history where report_id::text like 'f3000000-%'),
    case when can_read_internal_history then visible_report_count else 0::bigint end,
    actor_label || ': history also respects pending and escalated scope'
  );
  return next is(
    (select count(*) from public.report_feed_activity where report_id::text like 'f3000000-%'),
    visible_report_count, actor_label || ': owner-rights activity view still checks scope'
  );
  return next is(
    (select count(*) from public.report_media where report_id::text like 'f3000000-%'),
    visible_media_count, actor_label || ': evidence rows follow owner or official scope'
  );

  foreach media_variant in array array['original', 'display', 'thumbnail'] loop
    return next is(
      (select count(*) from storage.objects where bucket_id = 'report-media'
       and name like 'f1000000-0000-4000-8000-000000000001/f3000000-%/' || media_variant || '.jpg'),
      visible_media_count, actor_label || ': storage SELECT for ' || media_variant
    );
    return next is(
      public.can_read_report_media_path('f1000000-0000-4000-8000-000000000001/f3000000-0000-4000-8000-000000000002/' || media_variant || '.jpg'),
      visible_media_count > 0, actor_label || ': path helper for ' || media_variant
    );
  end loop;

  return next is(
    (select count(phone) from public.profiles where id = 'f1000000-0000-4000-8000-000000000001' and id <> auth.uid()),
    0::bigint, actor_label || ': another user phone is hidden'
  );
  return next throws_ok(
    'select phone_number from public.app_profiles', '42501',
    'permission denied for table app_profiles', actor_label || ': raw phone column denied'
  );
  return next throws_ok(
    'select * from public.report_contact_access_logs', '42501',
    'permission denied for table report_contact_access_logs', actor_label || ': contact audit rows denied'
  );
  return next throws_ok(
    'select device_location from public.reports', '42501',
    'permission denied for table reports', actor_label || ': device GPS column denied'
  );
end;
$$;

set local role authenticated;

select * from pg_temp.check_report_privacy('f1000000-0000-4000-8000-000000000001', 'Reporter', 4, 4, false, true);
select * from pg_temp.check_report_privacy('f1000000-0000-4000-8000-000000000002', 'Other resident', 0, 0, false, false);
select * from pg_temp.check_report_privacy('f1000000-0000-4000-8000-000000000003', 'Local BDRRMO', 4, 4, true, true);
select * from pg_temp.check_report_privacy('f1000000-0000-4000-8000-000000000004', 'Other BDRRMO', 0, 0, false, false);
select * from pg_temp.check_report_privacy('f1000000-0000-4000-8000-000000000005', 'MDRRMO', 4, 4, true, true);
select * from pg_temp.check_report_privacy('f1000000-0000-4000-8000-000000000006', 'Mayor', 0, 0, false, false);
select * from pg_temp.check_report_privacy('f1000000-0000-4000-8000-000000000007', 'Suspended officer', 0, 0, false, false);
select * from pg_temp.check_report_privacy('f1000000-0000-4000-8000-000000000008', 'Admin', 4, 4, true, true);

select columns_are('public', 'report_feed_activity', array[
  'report_id', 'latest_status_activity_at', 'latest_status_update_at', 'latest_official_comment_at'
], 'Activity projection contains only the id and three existing timestamps');

-- Verify the actual ordering values while the resident cannot select history.
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000001', true);
select is(
  (select latest_status_activity_at from public.report_feed_activity where report_id = 'f3000000-0000-4000-8000-000000000002'),
  now() - interval '1 minute', 'Resident feed retains the latest status activity timestamp'
);
select is(
  (select latest_status_update_at from public.report_feed_activity where report_id = 'f3000000-0000-4000-8000-000000000002'),
  now() - interval '1 minute', 'Resident feed retains the private status-transition timestamp'
);
select is(
  (select latest_official_comment_at from public.report_feed_activity where report_id = 'f3000000-0000-4000-8000-000000000002'),
  now() - interval '30 seconds', 'Resident feed ignores newer hidden official comments'
);

-- Contact preview returns a denial row; reveal raises the existing generic error.
reset role;
create function pg_temp.check_denied_contact(actor_id uuid, actor_label text)
returns setof text language plpgsql security invoker as $contact$
begin
  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  return next is(
    (select can_contact from public.preview_reporter_contact('f3000000-0000-4000-8000-000000000002')),
    false, actor_label || ': contact preview denied'
  );
  return next is(
    (select masked_phone from public.preview_reporter_contact('f3000000-0000-4000-8000-000000000002')),
    null::text, actor_label || ': masked phone not disclosed'
  );
  return next throws_ok(
    $$select public.request_reporter_contact('f3000000-0000-4000-8000-000000000002')$$,
    '42501', 'Reporter contact is unavailable.', actor_label || ': contact reveal denied'
  );
end;
$contact$;

set local role authenticated;

select * from pg_temp.check_denied_contact('f1000000-0000-4000-8000-000000000001', 'Reporter');
select * from pg_temp.check_denied_contact('f1000000-0000-4000-8000-000000000002', 'Other resident');
select * from pg_temp.check_denied_contact('f1000000-0000-4000-8000-000000000006', 'Mayor');
select * from pg_temp.check_denied_contact('f1000000-0000-4000-8000-000000000007', 'Suspended officer');

select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select * from public.get_report_location_verification('f3000000-0000-4000-8000-000000000002')$$,
  '42501', 'Official access required.', 'Other resident cannot use GPS verification RPC'
);
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select * from public.get_report_location_verification('f3000000-0000-4000-8000-000000000002')$$,
  '42501', 'Official access required.', 'Reporter cannot use GPS verification RPC'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'report-media' and name = 'f1000000-0000-4000-8000-000000000001/draft.jpg'),
  1::bigint, 'Active reporter retains own-folder draft access'
);
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000007', true);
select is(
  (select count(*) from storage.objects where bucket_id = 'report-media' and name = 'f1000000-0000-4000-8000-000000000007/draft.jpg'),
  0::bigint, 'Suspension also denies own-folder drafts'
);

select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000003', true);
select is(
  (select can_contact from public.preview_reporter_contact('f3000000-0000-4000-8000-000000000002')),
  true, 'Local BDRRMO retains allowed contact preview'
);
select is(
  public.request_reporter_contact('f3000000-0000-4000-8000-000000000002'),
  '+639179991001', 'Local BDRRMO retains audited contact reveal'
);
select is(
  (select count(*) from public.get_report_location_verification('f3000000-0000-4000-8000-000000000002')),
  1::bigint, 'Local BDRRMO retains scoped GPS verification'
);
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000004', true);
select is(
  (select count(*) from public.get_report_location_verification('f3000000-0000-4000-8000-000000000002')),
  0::bigint, 'Other BDRRMO cannot use the GPS RPC outside its scope'
);

select * from finish();
rollback;
