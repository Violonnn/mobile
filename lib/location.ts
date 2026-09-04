import * as Location from 'expo-location';
import { supabase } from './supabase';
import { promptOpenSettings } from './permissions';

/** Max horizontal accuracy (meters) before the resident must confirm the pin. */
export const REPORT_LOCATION_MAX_ACCURACY_METERS = 100;

export type GpsPosition = {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy from the device GPS, or null when unknown. */
  accuracyMeters: number | null;
};

/** Human-readable place for the report pin: "Barangay, Municipality". */
export type ReadableAddress = {
  barangayId: string;
  barangay: string;
  municipality: string;
  label: string;
};

/** True when accuracy is missing or worse than the report threshold. */
export function isLowConfidenceLocation(position: GpsPosition): boolean {
  return (
    position.accuracyMeters === null ||
    position.accuracyMeters > REPORT_LOCATION_MAX_ACCURACY_METERS
  );
}

/**
 * Ask for location access every time it is missing. Granted access persists,
 * so the dialog only reappears while access is denied. If the OS suppresses
 * the dialog (permanent denial), guide the user to the app settings.
 */
async function ensureLocationPermission(): Promise<string | null> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return null;

  if (current.canAskAgain) {
    const requested = await Location.requestForegroundPermissionsAsync();
    if (requested.granted) return null;
    if (!requested.canAskAgain) {
      promptOpenSettings(
        'Location access needed',
        'DisasterLink needs your location to place an accurate map pin. Enable location access in your device settings.',
      );
    }
    return 'Location permission is required to submit a report.';
  }

  promptOpenSettings(
    'Location access needed',
    'DisasterLink needs your location to place an accurate map pin. Enable location access in your device settings.',
  );
  return 'Location permission is required to submit a report.';
}

/** Request foreground permission and read a high-accuracy GPS fix once. */
export async function getCurrentGps(): Promise<{
  position: GpsPosition | null;
  error: string | null;
}> {
  const permissionError = await ensureLocationPermission();
  if (permissionError) {
    return { position: null, error: permissionError };
  }

  try {
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });

    const latitude = current.coords.latitude;
    const longitude = current.coords.longitude;
    const rawAccuracy = current.coords.accuracy;
    const accuracyMeters =
      typeof rawAccuracy === 'number' && Number.isFinite(rawAccuracy)
        ? rawAccuracy
        : null;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { position: null, error: 'Could not read a valid GPS position.' };
    }

    return {
      position: { latitude, longitude, accuracyMeters },
      error: null,
    };
  } catch {
    return {
      position: null,
      error: 'Could not get your location. Try again outdoors.',
    };
  }
}

/**
 * Read a lightweight location for the map's blue position dot without opening
 * a permission prompt. Reporting remains the flow that asks for GPS access.
 */
export async function getGrantedMapGps(): Promise<GpsPosition | null> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return null;

    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: 120_000,
      requiredAccuracy: 250,
    });
    const location =
      lastKnown ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    const latitude = location.coords.latitude;
    const longitude = location.coords.longitude;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return {
      latitude,
      longitude,
      accuracyMeters:
        typeof location.coords.accuracy === 'number' &&
        Number.isFinite(location.coords.accuracy)
          ? location.coords.accuracy
          : null,
    };
  } catch {
    return null;
  }
}

/**
 * Suggest a barangay from nearest centroids. The resident must still confirm
 * the barangay before submit — this is only a preselect/display helper.
 */
export async function resolveReadableAddress(
  position: Pick<GpsPosition, 'latitude' | 'longitude'>,
): Promise<{ address: ReadableAddress | null; error: string | null }> {
  const { data, error } = await supabase.rpc('resolve_barangay_label', {
    p_latitude: position.latitude,
    p_longitude: position.longitude,
  });

  if (error) {
    return { address: null, error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    return {
      address: null,
      error: 'Could not match your location to a barangay.',
    };
  }

  const barangayId = String(
    (row as { barangay_id?: unknown }).barangay_id ?? '',
  ).trim();
  const name = String((row as { name?: unknown }).name ?? '').trim();
  const municipality = String(
    (row as { municipality?: unknown }).municipality ?? 'Minglanilla',
  ).trim();

  if (!barangayId || !name) {
    return {
      address: null,
      error: 'Could not match your location to a barangay.',
    };
  }

  return {
    address: {
      barangayId,
      barangay: name,
      municipality,
      label: `${name}, ${municipality}`,
    },
    error: null,
  };
}

/** Reject-free timeout so the location step never hangs indefinitely. */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: T,
): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(onTimeout), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(onTimeout);
      },
    );
  });
}

/** GPS + suggested barangay/municipality for the report modal. */
export async function getCurrentGpsWithAddress(timeoutMs = 20000): Promise<{
  position: GpsPosition | null;
  address: ReadableAddress | null;
  error: string | null;
}> {
  const { position, error: gpsError } = await withTimeout(
    getCurrentGps(),
    timeoutMs,
    {
      position: null,
      error: 'Getting your location took too long. Try again.',
    },
  );
  if (!position) {
    return { position: null, address: null, error: gpsError };
  }

  const { address, error: addressError } = await resolveReadableAddress(position);
  if (!address) {
    return {
      position,
      address: null,
      error: addressError ?? 'Could not resolve barangay for this location.',
    };
  }

  return { position, address, error: null };
}
