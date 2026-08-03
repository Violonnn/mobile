-- Seed verified national emergency directory only (911).
-- Local LGU numbers must be added by officers after confirmation —
-- never hardcode unverified local contacts.
-- Reference: https://ehotlines.e.gov.ph/

insert into public.hotlines (
  name,
  number,
  category,
  barangay_id,
  is_active,
  last_verified_at
)
select
  'National Emergency Hotline',
  '911',
  'national_emergency'::public.hotline_category,
  null,
  true,
  now()
where not exists (
  select 1
  from public.hotlines
  where number = '911'
    and category = 'national_emergency'::public.hotline_category
);
