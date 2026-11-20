/** Normal resident adjustment area, widened only when GPS is less precise. */
export const REPORT_LOCATION_BASE_ADJUSTMENT_METERS = 150;
export const REPORT_LOCATION_MAX_ADJUSTMENT_METERS = 300;
/** Report startup may reuse a strict OS fix from the last 30 seconds. */
export const REPORT_GPS_CACHE_MAX_AGE_MS = 30_000;
export const REPORT_LOCATION_MAX_ACCURACY_METERS = 100;

export type ReportGpsCacheCandidate = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  timestamp: number;
};

export type ReportGpsPosition = Omit<ReportGpsCacheCandidate, 'timestamp'>;

/** Track independent GPS and address requests so obsolete async work can be ignored. */
export function createLocationRequestTracker() {
  let currentGeneration = 0;

  return {
    start: () => ++currentGeneration,
    invalidate: () => {
      currentGeneration += 1;
    },
    isCurrent: (generation: number) => generation === currentGeneration,
  };
}

/** A cached fix is usable only when recent, precise, and inside valid coordinates. */
export function getRecentAccurateReportGpsPosition(
  candidate: ReportGpsCacheCandidate | null,
  now = Date.now(),
): ReportGpsPosition | null {
  if (!candidate) return null;
  if (
    !Number.isFinite(candidate.latitude) ||
    candidate.latitude < -90 ||
    candidate.latitude > 90 ||
    !Number.isFinite(candidate.longitude) ||
    candidate.longitude < -180 ||
    candidate.longitude > 180 ||
    typeof candidate.accuracyMeters !== 'number' ||
    !Number.isFinite(candidate.accuracyMeters) ||
    candidate.accuracyMeters < 0 ||
    candidate.accuracyMeters > REPORT_LOCATION_MAX_ACCURACY_METERS ||
    !Number.isFinite(candidate.timestamp) ||
    candidate.timestamp > now ||
    now - candidate.timestamp > REPORT_GPS_CACHE_MAX_AGE_MS
  ) {
    return null;
  }

  return {
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    accuracyMeters: candidate.accuracyMeters,
  };
}

/** Reuse an eligible cached fix, otherwise request the normal fresh fix. */
export async function getCachedOrFreshReportGpsPosition(
  candidate: ReportGpsCacheCandidate | null,
  getFreshPosition: () => Promise<ReportGpsCacheCandidate>,
  now = Date.now(),
): Promise<ReportGpsPosition> {
  const cachedPosition = getRecentAccurateReportGpsPosition(candidate, now);
  if (cachedPosition) return cachedPosition;

  const freshPosition = await getFreshPosition();
  return {
    latitude: freshPosition.latitude,
    longitude: freshPosition.longitude,
    accuracyMeters: freshPosition.accuracyMeters,
  };
}

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

