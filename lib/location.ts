import * as Location from 'expo-location';
import { supabase } from './supabase';
import { promptOpenSettings } from './permissions';

export type GpsPosition = {
  latitude: number;
  longitude: number;
};

/** Human-readable place for the report pin: "Barangay, Municipality". */
export type ReadableAddress = {
  barangay: string;
  municipality: string;
  label: string;
};

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
        'DisasterLink needs your location to pin the report on the map. Enable location access in your device settings.',
      );
    }
    return 'Location permission is required to submit a report.';
  }

  promptOpenSettings(
    'Location access needed',
    'DisasterLink needs your location to pin the report on the map. Enable location access in your device settings.',
  );
  return 'Location permission is required to submit a report.';
}

/** Request foreground permission and read the device GPS once. */
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
      accuracy: Location.Accuracy.Balanced,
    });

    const latitude = current.coords.latitude;
    const longitude = current.coords.longitude;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { position: null, error: 'Could not read a valid GPS position.' };
    }

    return { position: { latitude, longitude }, error: null };
  } catch {
    return {
      position: null,
      error: 'Could not get your location. Try again outdoors.',
    };
  }
}

/** Map lat/lng to nearest barangay label from the seeded centroids. */
export async function resolveReadableAddress(
  position: GpsPosition,
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

  const name = String((row as { name?: unknown }).name ?? '').trim();
  const municipality = String(
    (row as { municipality?: unknown }).municipality ?? 'Minglanilla',
  ).trim();

  if (!name) {
    return {
      address: null,
      error: 'Could not match your location to a barangay.',
    };
  }

  return {
    address: {
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

/** GPS + readable barangay/municipality for the report modal. */
export async function getCurrentGpsWithAddress(timeoutMs = 15000): Promise<{
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
