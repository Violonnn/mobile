// Provisional until the LGU supplies official municipal/barangay boundaries.
export const REPORT_COVERAGE = {
  latitudeMin: 10.15,
  latitudeMax: 10.35,
  longitudeMin: 123.70,
  longitudeMax: 123.90,
  uncertainDistanceMeters: 1500,
};

export function isInsideReportCoverage(
  latitude: number,
  longitude: number,
): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= REPORT_COVERAGE.latitudeMin &&
    latitude <= REPORT_COVERAGE.latitudeMax &&
    longitude >= REPORT_COVERAGE.longitudeMin &&
    longitude <= REPORT_COVERAGE.longitudeMax;
}

export function intakeJurisdiction(input: {
  nearestDistanceMeters: number | null;
  selectedDistanceMeters: number | null;
  selectedBarangayId: string | null;
  nearestBarangayId: string | null;
}): 'needs_check' | 'in_coverage' {
  if (
    input.nearestDistanceMeters == null ||
    !Number.isFinite(input.nearestDistanceMeters) ||
    input.nearestDistanceMeters > REPORT_COVERAGE.uncertainDistanceMeters
  ) return 'needs_check';
  if (
    input.selectedBarangayId &&
    input.selectedBarangayId !== input.nearestBarangayId &&
    (input.selectedDistanceMeters == null ||
      !Number.isFinite(input.selectedDistanceMeters) ||
      input.selectedDistanceMeters > REPORT_COVERAGE.uncertainDistanceMeters)
  ) return 'needs_check';
  return 'in_coverage';
}
