/** Normal resident adjustment area, widened only when GPS is less precise. */
export const REPORT_LOCATION_BASE_ADJUSTMENT_METERS = 150;
export const REPORT_LOCATION_MAX_ADJUSTMENT_METERS = 300;

type Coordinate = {
  latitude: number;
  longitude: number;
};

/**
 * A precise fix gets 150 m. Reported inaccuracy can widen the allowance, but
 * it never exceeds the municipality-safe 300 m maximum.
 */
export function getReportLocationAdjustmentLimit(
  accuracyMeters: number | null | undefined,
): number {
  if (typeof accuracyMeters !== 'number' || !Number.isFinite(accuracyMeters)) {
    return REPORT_LOCATION_BASE_ADJUSTMENT_METERS;
  }

  return Math.min(
    REPORT_LOCATION_MAX_ADJUSTMENT_METERS,
    Math.max(REPORT_LOCATION_BASE_ADJUSTMENT_METERS, accuracyMeters),
  );
}

/** Haversine distance in meters between two WGS84 coordinates. */
export function distanceBetweenCoordinates(
  first: Coordinate,
  second: Coordinate,
): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

