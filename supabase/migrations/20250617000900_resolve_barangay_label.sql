-- Client-readable barangay + municipality label from GPS (nearest centroid).
-- Used by the Report modal to show "Barangay, Municipality" instead of raw coords.

create or replace function public.resolve_barangay_label(
  p_latitude double precision,
  p_longitude double precision
)
returns table (
  barangay_id uuid,
  name text,
  municipality text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.name, b.municipality
  from public.barangays b
  where b.centroid is not null
  order by extensions.st_distance(
    b.centroid,
    extensions.st_setsrid(
      extensions.st_makepoint(p_longitude, p_latitude),
      4326
    )::extensions.geography
  )
  limit 1;
$$;

revoke all on function public.resolve_barangay_label(double precision, double precision)
  from public, anon;
grant execute on function public.resolve_barangay_label(double precision, double precision)
  to authenticated, service_role;
