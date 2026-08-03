// lib/resources.ts
// Typed helpers for hotlines, facilities, and evacuation centers.
// Resident fetches are active-only; official fetches include inactive + dates.

import { Linking } from 'react-native';
import { supabase } from './supabase';
import { getActiveSession } from './auth';
import { validateHotlineNumber } from './validation/hotline';

export type HotlineCategory =
  | 'police'
  | 'fire'
  | 'medical'
  | 'rescue'
  | 'lgu'
  | 'utility'
  | 'other'
  | 'national_emergency';

export type FacilityType =
  | 'rhu'
  | 'hospital'
  | 'fire_station'
  | 'police_station'
  | 'barangay_hall'
  | 'municipal_hall'
  | 'other';

export type EvacuationStatus = 'open' | 'full' | 'closed_temporarily';

export type HotlineRecord = {
  id: string;
  name: string;
  number: string;
  category: HotlineCategory;
  barangayId: string | null;
  facilityId: string | null;
  isActive: boolean;
  lastVerifiedAt: string | null;
  lastVerifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FacilityRecord = {
  id: string;
  name: string;
  type: FacilityType;
  latitude: number;
  longitude: number;
  address: string | null;
  contact: string | null;
  barangayId: string | null;
  isActive: boolean;
  lastVerifiedAt: string | null;
  lastVerifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EvacuationCenterRecord = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  capacity: number | null;
  status: EvacuationStatus;
  isPriority: boolean;
  barangayId: string | null;
  managedBy: string | null;
  lastUpdatedBy: string | null;
  lastUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const REVIEW_OVERDUE_DAYS = 90;
const MAX_NAME = 120;
const MAX_ADDRESS = 300;
const MAX_CONTACT = 64;

function asHotlineCategory(value: unknown): HotlineCategory {
  if (
    value === 'police' ||
    value === 'fire' ||
    value === 'medical' ||
    value === 'rescue' ||
    value === 'lgu' ||
    value === 'utility' ||
    value === 'national_emergency' ||
    value === 'other'
  ) {
    return value;
  }
  return 'other';
}

function asFacilityType(value: unknown): FacilityType {
  if (
    value === 'rhu' ||
    value === 'hospital' ||
    value === 'fire_station' ||
    value === 'police_station' ||
    value === 'barangay_hall' ||
    value === 'municipal_hall' ||
    value === 'other'
  ) {
    return value;
  }
  return 'other';
}

function asEvacuationStatus(value: unknown): EvacuationStatus {
  if (value === 'open' || value === 'full' || value === 'closed_temporarily') {
    return value;
  }
  return 'closed_temporarily';
}

function parsePointLocation(raw: unknown): { latitude: number; longitude: number } {
  // PostgREST may return GeoJSON { type, coordinates: [lng, lat] } or a WKT string.
  if (raw && typeof raw === 'object') {
    const coords = (raw as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const longitude = Number(coords[0]);
      const latitude = Number(coords[1]);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
    }
  }
  if (typeof raw === 'string') {
    const match = raw.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      const longitude = Number(match[1]);
      const latitude = Number(match[2]);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
    }
  }
  return { latitude: 0, longitude: 0 };
}

function mapHotline(row: Record<string, unknown>): HotlineRecord {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    number: String(row.number ?? ''),
    category: asHotlineCategory(row.category),
    barangayId: row.barangay_id ? String(row.barangay_id) : null,
    facilityId: row.facility_id ? String(row.facility_id) : null,
    isActive: row.is_active !== false,
    lastVerifiedAt: row.last_verified_at ? String(row.last_verified_at) : null,
    lastVerifiedBy: row.last_verified_by ? String(row.last_verified_by) : null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function mapFacility(row: Record<string, unknown>): FacilityRecord {
  // Prefer facilities_map lat/lng columns; fall back to geography parsing.
  const latitudeDirect = Number(row.latitude);
  const longitudeDirect = Number(row.longitude);
  const point =
    Number.isFinite(latitudeDirect) && Number.isFinite(longitudeDirect)
      ? { latitude: latitudeDirect, longitude: longitudeDirect }
      : parsePointLocation(row.location);

  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    type: asFacilityType(row.type),
    latitude: point.latitude,
    longitude: point.longitude,
    address: row.address ? String(row.address) : null,
    contact: row.contact ? String(row.contact) : null,
    barangayId: row.barangay_id ? String(row.barangay_id) : null,
    isActive: row.is_active !== false,
    lastVerifiedAt: row.last_verified_at ? String(row.last_verified_at) : null,
    lastVerifiedBy: row.last_verified_by ? String(row.last_verified_by) : null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function mapCenter(row: Record<string, unknown>): EvacuationCenterRecord {
  const latitudeDirect = Number(row.latitude);
  const longitudeDirect = Number(row.longitude);
  const point =
    Number.isFinite(latitudeDirect) && Number.isFinite(longitudeDirect)
      ? { latitude: latitudeDirect, longitude: longitudeDirect }
      : parsePointLocation(row.location);

  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    latitude: point.latitude,
    longitude: point.longitude,
    capacity: row.capacity == null ? null : Number(row.capacity),
    status: asEvacuationStatus(row.status),
    isPriority: Boolean(row.is_priority),
    barangayId: row.barangay_id ? String(row.barangay_id) : null,
    managedBy: row.managed_by ? String(row.managed_by) : null,
    lastUpdatedBy: row.last_updated_by ? String(row.last_updated_by) : null,
    lastUpdatedAt: row.last_updated_at ? String(row.last_updated_at) : null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

/** True when last verification is older than 90 days (or never verified). */
export function isReviewOverdue(lastVerifiedAt: string | null | undefined): boolean {
  if (!lastVerifiedAt) return true;
  const verifiedMs = Date.parse(lastVerifiedAt);
  if (!Number.isFinite(verifiedMs)) return true;
  const ageMs = Date.now() - verifiedMs;
  return ageMs > REVIEW_OVERDUE_DAYS * 24 * 60 * 60 * 1000;
}

function pointWkt(latitude: number, longitude: number): string {
  return `SRID=4326;POINT(${longitude} ${latitude})`;
}

// ---- Hotlines ----

export async function fetchActiveHotlines(): Promise<{
  hotlines: HotlineRecord[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('hotlines')
    .select(
      'id, name, number, category, barangay_id, facility_id, is_active, last_verified_at, last_verified_by, created_at, updated_at',
    )
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    // Fallback when migration columns are not applied yet.
    const legacy = await supabase
      .from('hotlines')
      .select('id, name, number, category, barangay_id, created_at, updated_at')
      .order('name', { ascending: true });
    if (legacy.error) {
      return { hotlines: [], error: legacy.error.message };
    }
    return {
      hotlines: (legacy.data ?? []).map((row) =>
        mapHotline(row as Record<string, unknown>),
      ),
      error: null,
    };
  }

  return {
    hotlines: (data ?? []).map((row) => mapHotline(row as Record<string, unknown>)),
    error: null,
  };
}

export async function fetchOfficialHotlines(options?: {
  barangayId?: string | null;
}): Promise<{ hotlines: HotlineRecord[]; error: string | null }> {
  let query = supabase
    .from('hotlines')
    .select(
      'id, name, number, category, barangay_id, facility_id, is_active, last_verified_at, last_verified_by, created_at, updated_at',
    )
    .order('name', { ascending: true });

  if (options?.barangayId) {
    // BDRRMO keeps its scoped records plus municipality-wide active entries.
    query = query.or(
      `barangay_id.eq.${options.barangayId},and(barangay_id.is.null,is_active.eq.true)`,
    );
  }

  const { data, error } = await query;
  if (error) {
    return { hotlines: [], error: error.message };
  }
  return {
    hotlines: (data ?? []).map((row) => mapHotline(row as Record<string, unknown>)),
    error: null,
  };
}

export async function createHotline(input: {
  name: string;
  number: string;
  category: HotlineCategory;
  barangayId?: string | null;
  facilityId?: string | null;
  isActive?: boolean;
}): Promise<{ hotline: HotlineRecord | null; error: string | null }> {
  const name = input.name.trim();
  if (!name || name.length > MAX_NAME) {
    return { hotline: null, error: 'Enter a hotline name (max 120 characters).' };
  }

  const dial = validateHotlineNumber(input.number);
  if (dial.error || !dial.normalized) {
    return { hotline: null, error: dial.error || 'Invalid hotline number.' };
  }

  const session = await getActiveSession();
  if (!session?.user?.id) {
    return { hotline: null, error: 'Sign in to manage hotlines.' };
  }

  const { data, error } = await supabase
    .from('hotlines')
    .insert({
      name,
      number: dial.normalized,
      category: input.category,
      barangay_id: input.barangayId ?? null,
      facility_id: input.facilityId ?? null,
      is_active: input.isActive ?? true,
    })
    .select(
      'id, name, number, category, barangay_id, facility_id, is_active, last_verified_at, last_verified_by, created_at, updated_at',
    )
    .maybeSingle();

  if (error) {
    return { hotline: null, error: error.message };
  }
  if (!data) {
    return { hotline: null, error: 'Could not create hotline.' };
  }
  return { hotline: mapHotline(data as Record<string, unknown>), error: null };
}

export async function updateHotline(
  id: string,
  patch: {
    name?: string;
    number?: string;
    category?: HotlineCategory;
    barangayId?: string | null;
    facilityId?: string | null;
    isActive?: boolean;
  },
): Promise<{ hotline: HotlineRecord | null; error: string | null }> {
  const updates: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name || name.length > MAX_NAME) {
      return { hotline: null, error: 'Enter a hotline name (max 120 characters).' };
    }
    updates.name = name;
  }
  if (patch.number !== undefined) {
    const dial = validateHotlineNumber(patch.number);
    if (dial.error || !dial.normalized) {
      return { hotline: null, error: dial.error || 'Invalid hotline number.' };
    }
    updates.number = dial.normalized;
  }
  if (patch.category !== undefined) updates.category = patch.category;
  if (patch.barangayId !== undefined) updates.barangay_id = patch.barangayId;
  if (patch.facilityId !== undefined) updates.facility_id = patch.facilityId;
  if (patch.isActive !== undefined) updates.is_active = patch.isActive;

  if (Object.keys(updates).length === 0) {
    return { hotline: null, error: 'Nothing to update.' };
  }

  const { data, error } = await supabase
    .from('hotlines')
    .update(updates)
    .eq('id', id)
    .select(
      'id, name, number, category, barangay_id, facility_id, is_active, last_verified_at, last_verified_by, created_at, updated_at',
    )
    .maybeSingle();

  if (error) {
    return { hotline: null, error: error.message };
  }
  if (!data) {
    return { hotline: null, error: 'Hotline not found or not permitted.' };
  }
  return { hotline: mapHotline(data as Record<string, unknown>), error: null };
}

export async function openHotlineDialer(
  number: string,
): Promise<{ error: string | null }> {
  const dial = validateHotlineNumber(number);
  if (dial.error || !dial.normalized) {
    return { error: dial.error || 'Invalid hotline number.' };
  }
  const tel = dial.normalized.replace(/x/g, ',');
  try {
    await Linking.openURL(`tel:${tel}`);
    return { error: null };
  } catch {
    return { error: 'Could not open the phone dialer.' };
  }
}

// ---- Facilities ----

export async function fetchActiveFacilities(): Promise<{
  facilities: FacilityRecord[];
  error: string | null;
}> {
  // Prefer facilities_map for reliable lat/lng over raw geography.
  const mapped = await supabase
    .from('facilities_map')
    .select(
      'id, name, type, latitude, longitude, address, contact, barangay_id, is_active, last_verified_at, last_verified_by, created_at, updated_at',
    )
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (!mapped.error) {
    return {
      facilities: (mapped.data ?? []).map((row) =>
        mapFacility(row as Record<string, unknown>),
      ),
      error: null,
    };
  }

  const { data, error } = await supabase
    .from('facilities')
    .select(
      'id, name, type, location, address, contact, barangay_id, is_active, last_verified_at, last_verified_by, created_at, updated_at',
    )
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    const legacy = await supabase
      .from('facilities')
      .select(
        'id, name, type, location, address, contact, barangay_id, created_at, updated_at',
      )
      .order('name', { ascending: true });
    if (legacy.error) {
      return { facilities: [], error: legacy.error.message };
    }
    return {
      facilities: (legacy.data ?? []).map((row) =>
        mapFacility(row as Record<string, unknown>),
      ),
      error: null,
    };
  }

  return {
    facilities: (data ?? []).map((row) =>
      mapFacility(row as Record<string, unknown>),
    ),
    error: null,
  };
}

export async function fetchOfficialFacilities(options?: {
  barangayId?: string | null;
}): Promise<{ facilities: FacilityRecord[]; error: string | null }> {
  let mappedQuery = supabase
    .from('facilities_map')
    .select(
      'id, name, type, latitude, longitude, address, contact, barangay_id, is_active, last_verified_at, last_verified_by, created_at, updated_at',
    )
    .order('name', { ascending: true });

  if (options?.barangayId) {
    // BDRRMO keeps its scoped records plus municipality-wide active entries.
    mappedQuery = mappedQuery.or(
      `barangay_id.eq.${options.barangayId},and(barangay_id.is.null,is_active.eq.true)`,
    );
  }

  const mapped = await mappedQuery;
  if (!mapped.error) {
    return {
      facilities: (mapped.data ?? []).map((row) =>
        mapFacility(row as Record<string, unknown>),
      ),
      error: null,
    };
  }

  let query = supabase
    .from('facilities')
    .select(
      'id, name, type, location, address, contact, barangay_id, is_active, last_verified_at, last_verified_by, created_at, updated_at',
    )
    .order('name', { ascending: true });

  if (options?.barangayId) {
    // BDRRMO keeps its scoped records plus municipality-wide active entries.
    query = query.or(
      `barangay_id.eq.${options.barangayId},and(barangay_id.is.null,is_active.eq.true)`,
    );
  }

  const { data, error } = await query;
  if (error) {
    return { facilities: [], error: error.message };
  }
  return {
    facilities: (data ?? []).map((row) =>
      mapFacility(row as Record<string, unknown>),
    ),
    error: null,
  };
}

export async function createFacility(input: {
  name: string;
  type: FacilityType;
  latitude: number;
  longitude: number;
  address?: string | null;
  contact?: string | null;
  barangayId?: string | null;
  isActive?: boolean;
}): Promise<{ facility: FacilityRecord | null; error: string | null }> {
  const name = input.name.trim();
  if (!name || name.length > MAX_NAME) {
    return { facility: null, error: 'Enter a facility name (max 120 characters).' };
  }
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    return { facility: null, error: 'Facility location is required.' };
  }
  const address = (input.address ?? '').trim();
  if (address.length > MAX_ADDRESS) {
    return { facility: null, error: 'Address is too long.' };
  }
  const contact = (input.contact ?? '').trim();
  if (contact.length > MAX_CONTACT) {
    return { facility: null, error: 'Contact is too long.' };
  }

  const session = await getActiveSession();
  if (!session?.user?.id) {
    return { facility: null, error: 'Sign in to manage facilities.' };
  }

  const { data, error } = await supabase
    .from('facilities')
    .insert({
      name,
      type: input.type,
      location: pointWkt(input.latitude, input.longitude),
      address: address || null,
      contact: contact || null,
      barangay_id: input.barangayId ?? null,
      is_active: input.isActive ?? true,
    })
    .select(
      'id, name, type, location, address, contact, barangay_id, is_active, last_verified_at, last_verified_by, created_at, updated_at',
    )
    .maybeSingle();

  if (error) {
    return { facility: null, error: error.message };
  }
  if (!data) {
    return { facility: null, error: 'Could not create facility.' };
  }
  return { facility: mapFacility(data as Record<string, unknown>), error: null };
}

export async function updateFacility(
  id: string,
  patch: {
    name?: string;
    type?: FacilityType;
    latitude?: number;
    longitude?: number;
    address?: string | null;
    contact?: string | null;
    barangayId?: string | null;
    isActive?: boolean;
  },
): Promise<{ facility: FacilityRecord | null; error: string | null }> {
  const updates: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name || name.length > MAX_NAME) {
      return { facility: null, error: 'Enter a facility name (max 120 characters).' };
    }
    updates.name = name;
  }
  if (patch.type !== undefined) updates.type = patch.type;
  if (patch.latitude !== undefined || patch.longitude !== undefined) {
    if (
      !Number.isFinite(patch.latitude) ||
      !Number.isFinite(patch.longitude)
    ) {
      return { facility: null, error: 'Facility location is required.' };
    }
    updates.location = pointWkt(Number(patch.latitude), Number(patch.longitude));
  }
  if (patch.address !== undefined) {
    const address = (patch.address ?? '').trim();
    if (address.length > MAX_ADDRESS) {
      return { facility: null, error: 'Address is too long.' };
    }
    updates.address = address || null;
  }
  if (patch.contact !== undefined) {
    const contact = (patch.contact ?? '').trim();
    if (contact.length > MAX_CONTACT) {
      return { facility: null, error: 'Contact is too long.' };
    }
    updates.contact = contact || null;
  }
  if (patch.barangayId !== undefined) updates.barangay_id = patch.barangayId;
  if (patch.isActive !== undefined) updates.is_active = patch.isActive;

  if (Object.keys(updates).length === 0) {
    return { facility: null, error: 'Nothing to update.' };
  }

  const { data, error } = await supabase
    .from('facilities')
    .update(updates)
    .eq('id', id)
    .select(
      'id, name, type, location, address, contact, barangay_id, is_active, last_verified_at, last_verified_by, created_at, updated_at',
    )
    .maybeSingle();

  if (error) {
    return { facility: null, error: error.message };
  }
  if (!data) {
    return { facility: null, error: 'Facility not found or not permitted.' };
  }
  return { facility: mapFacility(data as Record<string, unknown>), error: null };
}

// ---- Evacuation centers ----

export async function fetchEvacuationCenters(options?: {
  barangayId?: string | null;
  priorityOnly?: boolean;
}): Promise<{ centers: EvacuationCenterRecord[]; error: string | null }> {
  let mappedQuery = supabase
    .from('evacuation_centers_map')
    .select(
      'id, name, latitude, longitude, capacity, status, is_priority, barangay_id, managed_by, last_updated_by, last_updated_at, created_at, updated_at',
    )
    .order('name', { ascending: true });

  if (options?.barangayId) {
    mappedQuery = mappedQuery.eq('barangay_id', options.barangayId);
  }
  if (options?.priorityOnly) {
    mappedQuery = mappedQuery.eq('is_priority', true);
  }

  const mapped = await mappedQuery;
  if (!mapped.error) {
    return {
      centers: (mapped.data ?? []).map((row) =>
        mapCenter(row as Record<string, unknown>),
      ),
      error: null,
    };
  }

  let query = supabase
    .from('evacuation_centers')
    .select(
      'id, name, location, capacity, status, is_priority, barangay_id, managed_by, last_updated_by, last_updated_at, created_at, updated_at',
    )
    .order('name', { ascending: true });

  if (options?.barangayId) {
    query = query.eq('barangay_id', options.barangayId);
  }
  if (options?.priorityOnly) {
    query = query.eq('is_priority', true);
  }

  const { data, error } = await query;
  if (error) {
    return { centers: [], error: error.message };
  }
  return {
    centers: (data ?? []).map((row) => mapCenter(row as Record<string, unknown>)),
    error: null,
  };
}

export async function createEvacuationCenter(input: {
  name: string;
  latitude: number;
  longitude: number;
  capacity?: number | null;
  status?: EvacuationStatus;
  barangayId?: string | null;
  isPriority?: boolean;
}): Promise<{ center: EvacuationCenterRecord | null; error: string | null }> {
  const name = input.name.trim();
  if (!name || name.length > MAX_NAME) {
    return { center: null, error: 'Enter a center name (max 120 characters).' };
  }
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    return { center: null, error: 'Center location is required.' };
  }
  if (
    input.capacity != null &&
    (!Number.isInteger(input.capacity) || input.capacity < 0)
  ) {
    return { center: null, error: 'Capacity must be a whole number of zero or more.' };
  }

  const session = await getActiveSession();
  if (!session?.user?.id) {
    return { center: null, error: 'Sign in to manage evacuation centers.' };
  }

  const { data, error } = await supabase
    .from('evacuation_centers')
    .insert({
      name,
      location: pointWkt(input.latitude, input.longitude),
      capacity: input.capacity ?? null,
      status: input.status ?? 'closed_temporarily',
      barangay_id: input.barangayId ?? null,
      is_priority: input.isPriority ?? false,
      managed_by: session.user.id,
    })
    .select(
      'id, name, location, capacity, status, is_priority, barangay_id, managed_by, last_updated_by, last_updated_at, created_at, updated_at',
    )
    .maybeSingle();

  if (error) {
    return { center: null, error: error.message };
  }
  if (!data) {
    return { center: null, error: 'Could not create evacuation center.' };
  }
  return { center: mapCenter(data as Record<string, unknown>), error: null };
}

export async function updateEvacuationCenter(
  id: string,
  patch: {
    name?: string;
    latitude?: number;
    longitude?: number;
    capacity?: number | null;
    status?: EvacuationStatus;
    barangayId?: string | null;
    isPriority?: boolean;
  },
): Promise<{ center: EvacuationCenterRecord | null; error: string | null }> {
  const updates: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name || name.length > MAX_NAME) {
      return { center: null, error: 'Enter a center name (max 120 characters).' };
    }
    updates.name = name;
  }
  if (patch.latitude !== undefined || patch.longitude !== undefined) {
    if (
      !Number.isFinite(patch.latitude) ||
      !Number.isFinite(patch.longitude)
    ) {
      return { center: null, error: 'Center location is required.' };
    }
    updates.location = pointWkt(Number(patch.latitude), Number(patch.longitude));
  }
  if (patch.capacity !== undefined) {
    if (
      patch.capacity != null &&
      (!Number.isInteger(patch.capacity) || patch.capacity < 0)
    ) {
      return {
        center: null,
        error: 'Capacity must be a whole number of zero or more.',
      };
    }
    updates.capacity = patch.capacity;
  }
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.barangayId !== undefined) updates.barangay_id = patch.barangayId;
  if (patch.isPriority !== undefined) updates.is_priority = patch.isPriority;

  if (Object.keys(updates).length === 0) {
    return { center: null, error: 'Nothing to update.' };
  }

  const { data, error } = await supabase
    .from('evacuation_centers')
    .update(updates)
    .eq('id', id)
    .select(
      'id, name, location, capacity, status, is_priority, barangay_id, managed_by, last_updated_by, last_updated_at, created_at, updated_at',
    )
    .maybeSingle();

  if (error) {
    return { center: null, error: error.message };
  }
  if (!data) {
    return { center: null, error: 'Center not found or not permitted.' };
  }
  return { center: mapCenter(data as Record<string, unknown>), error: null };
}

export function facilityTypeLabel(type: FacilityType): string {
  if (type === 'rhu') return 'RHU';
  if (type === 'hospital') return 'Hospital';
  if (type === 'fire_station') return 'Fire station';
  if (type === 'police_station') return 'Police station';
  if (type === 'barangay_hall') return 'Barangay hall';
  if (type === 'municipal_hall') return 'Municipal hall';
  return 'Other';
}

export function hotlineCategoryLabel(category: HotlineCategory): string {
  if (category === 'national_emergency') return 'National emergency';
  if (category === 'police') return 'Police';
  if (category === 'fire') return 'Fire';
  if (category === 'medical') return 'Medical';
  if (category === 'rescue') return 'Rescue';
  if (category === 'lgu') return 'LGU';
  if (category === 'utility') return 'Utility';
  return 'Other';
}

export function evacuationStatusLabel(status: EvacuationStatus): string {
  if (status === 'open') return 'Open';
  if (status === 'full') return 'Full';
  return 'Closed temporarily';
}
