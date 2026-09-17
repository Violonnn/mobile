-- Keep the resident evidence rule aligned with the safety-first report UI:
-- one clear photo OR video is enough. Residents should never be encouraged
-- to approach danger just to satisfy a second media format.

create or replace function public.check_report_media(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_total int;
  v_photos int;
  v_duration numeric;
begin
  -- A report deleted in the same transaction no longer needs validation.
  select profile.role into v_role
  from public.reports report
  join public.app_profiles profile on profile.id = report.reporter_id
  where report.id = p_report_id;

  if v_role is null or v_role is distinct from 'resident' then
    return;
  end if;

  select
    count(*),
    count(*) filter (where type = 'photo'),
    coalesce(sum(duration_seconds) filter (where type = 'video'), 0)
  into v_total, v_photos, v_duration
  from public.report_media
  where report_id = p_report_id;

  if v_total < 1 then
    raise exception 'Resident reports require at least one photo or video.'
      using errcode = '23514';
  end if;

  if v_photos > 3 then
    raise exception 'Resident reports allow at most 3 photos (got %).', v_photos
      using errcode = '23514';
  end if;

  if v_duration > 30 then
    raise exception 'Combined video duration must not exceed 30 seconds (got % seconds).',
      v_duration using errcode = '23514';
  end if;
end;
$$;
