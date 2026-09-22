import { supabase } from './supabase';

export type BarangayOption = {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
};

const BARANGAY_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
let cachedBarangays: BarangayOption[] | null = null;
let cachedBarangaysAt = 0;
let barangayRequest: Promise<{ barangays: BarangayOption[]; error: string | null }> | null = null;

function parseCentroid(raw: unknown): {
  latitude: number | null;
  longitude: number | null;
} {
  // PostgREST returns PostGIS points as GeoJSON in current Supabase projects.
  if (raw && typeof raw === 'object') {
    const coordinates = (raw as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      const longitude = Number(coordinates[0]);
      const latitude = Number(coordinates[1]);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
    }
  }

  // Keep compatibility with databases configured to serialize geography as WKT.
  if (typeof raw === 'string') {
    const pointMatch = raw.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (pointMatch) {
      const longitude = Number(pointMatch[1]);
      const latitude = Number(pointMatch[2]);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
    }
  }

  return { latitude: null, longitude: null };
}

/** Load Minglanilla barangays for the BDRRMO invite selector. */
export async function fetchBarangays(options?: { force?: boolean }): Promise<{
  barangays: BarangayOption[];
  error: string | null;
}> {
  const cacheIsFresh = Date.now() - cachedBarangaysAt < BARANGAY_CACHE_TTL_MS;
  if (!options?.force && cachedBarangays && cacheIsFresh) {
    return { barangays: cachedBarangays, error: null };
  }
  if (barangayRequest) return barangayRequest;

  barangayRequest = fetchBarangaysFromServer().finally(() => {
    barangayRequest = null;
  });
  return barangayRequest;
}

async function fetchBarangaysFromServer(): Promise<{
  barangays: BarangayOption[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('barangays')
    .select('id, name, centroid')
    .order('name', { ascending: true });

  if (error) {
    return { barangays: [], error: error.message };
  }

  const barangays = (data ?? []).map((row) => {
      const centroid = parseCentroid(row.centroid);
      return {
        id: String(row.id),
        name: String(row.name),
        latitude: centroid.latitude,
        longitude: centroid.longitude,
      };
    });
  cachedBarangays = barangays;
  cachedBarangaysAt = Date.now();
  return { barangays, error: null };
}
