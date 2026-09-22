import { supabase } from './supabase';
import { getActiveSession } from './auth';
import { isValidName, normalizeName } from './validation/name';
import { isProfilePhotoSchemaMissing } from './schemaCompatibility';

/** Safe profile row — pin_hash is not in profiles_public. */
export type PublicProfile = {
  id: string;
  phone: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  birth_year: string;
  birth_month: number;
  barangay: string;
  municipality: string;
  registration_completed_at: string;
  created_at: string;
  updated_at: string;
  avatar_path: string | null;
};

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedProfile: PublicProfile | null = null;
let cachedProfileAt = 0;
let cachedProfileUserId: string | null = null;
let profileRequest: Promise<{ profile: PublicProfile | null; error: string | null }> | null = null;

export function setCachedMyProfile(profile: PublicProfile | null): void {
  cachedProfile = profile;
  cachedProfileAt = profile ? Date.now() : 0;
  cachedProfileUserId = profile?.id ?? null;
}

export function clearMyProfileCache(): void {
  setCachedMyProfile(null);
}

/** Read the logged-in user's profile without ever touching pin_hash. */
export async function fetchMyProfile(options?: { force?: boolean }): Promise<{
  profile: PublicProfile | null;
  error: string | null;
}> {
  const { data: sessionData } = await supabase.auth.getSession();
  const currentUserId = sessionData.session?.user.id ?? null;
  const cacheIsFresh =
    cachedProfile &&
    cachedProfileUserId === currentUserId &&
    Date.now() - cachedProfileAt < PROFILE_CACHE_TTL_MS;
  if (!options?.force && cacheIsFresh) {
    return { profile: cachedProfile, error: null };
  }
  if (profileRequest) return profileRequest;

  profileRequest = fetchMyProfileFromServer().finally(() => {
    profileRequest = null;
  });
  return profileRequest;
}

async function fetchMyProfileFromServer(): Promise<{
  profile: PublicProfile | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('profiles_public')
    .select('*')
    .maybeSingle();

  if (error) {
    return { profile: null, error: error.message };
  }

  if (!data) return { profile: null, error: null };

  const residentProfile = data as Omit<PublicProfile, 'avatar_path'>;
  const { data: sharedProfile, error: sharedProfileError } = await supabase
    .from('app_profiles_public')
    .select('avatar_path')
    .eq('id', residentProfile.id)
    .maybeSingle();

  if (sharedProfileError) {
    // Profile photos are optional during deployment; never hide resident data
    // just because the new shared avatar column is not available yet.
    const profile = { ...residentProfile, avatar_path: null };
    setCachedMyProfile(profile);
    return { profile, error: null };
  }

  const profile = {
    ...residentProfile,
    avatar_path: sharedProfile?.avatar_path ? String(sharedProfile.avatar_path) : null,
  };
  setCachedMyProfile(profile);
  return { profile, error: null };
}

export type ResidentProfileUpdateInput = {
  firstName: string;
  middleName: string;
  lastName: string;
  barangay: string;
};

export type ProfileUpdateEligibility = {
  canUpdateName: boolean;
  nameNextUpdateAt: string | null;
  canUpdateBarangay: boolean;
  barangayNextUpdateAt: string | null;
};

type LegacyProfileUpdateEligibilityRow = {
  can_update: boolean;
  next_update_at: string | null;
};

type ProfileUpdateEligibilityRow = {
  can_update_name: boolean;
  name_next_update_at: string | null;
  can_update_barangay: boolean;
  barangay_next_update_at: string | null;
};

function isSeparatedProfileCooldownUnavailable(message: string): boolean {
  const normalizedMessage = message.toLocaleLowerCase();
  return (
    normalizedMessage.includes('get_my_profile_update_eligibility_v2') ||
    normalizedMessage.includes('schema cache')
  );
}

/** Read the server-enforced resident profile update window. */
export async function fetchProfileUpdateEligibility(): Promise<{
  eligibility: ProfileUpdateEligibility | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('get_my_profile_update_eligibility_v2');

  if (error && !isSeparatedProfileCooldownUnavailable(error.message)) {
    return { eligibility: null, error: error.message };
  }

  if (error) {
    // Keep the app usable while the separate name/barangay cooldown migration deploys.
    const legacyResult = await supabase.rpc('get_my_profile_update_eligibility');
    if (legacyResult.error) {
      return { eligibility: null, error: legacyResult.error.message };
    }

    const legacyRow = (Array.isArray(legacyResult.data)
      ? legacyResult.data[0]
      : legacyResult.data) as LegacyProfileUpdateEligibilityRow | null;
    if (!legacyRow) {
      return { eligibility: null, error: 'Could not check when your profile can be updated.' };
    }

    return {
      eligibility: {
        canUpdateName: legacyRow.can_update,
        nameNextUpdateAt: legacyRow.next_update_at,
        canUpdateBarangay: legacyRow.can_update,
        barangayNextUpdateAt: legacyRow.next_update_at,
      },
      error: null,
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as ProfileUpdateEligibilityRow | null;
  if (!row) {
    return { eligibility: null, error: 'Could not check when your profile can be updated.' };
  }

  return {
    eligibility: {
      canUpdateName: row.can_update_name,
      nameNextUpdateAt: row.name_next_update_at,
      canUpdateBarangay: row.can_update_barangay,
      barangayNextUpdateAt: row.barangay_next_update_at,
    },
    error: null,
  };
}

/**
 * Update only the resident fields exposed by the server RPC. Phone, birth
 * details, role, and PIN cannot be changed through this client method.
 */
export async function updateMyResidentProfile(input: ResidentProfileUpdateInput): Promise<{
  profile: PublicProfile | null;
  eligibility: ProfileUpdateEligibility | null;
  error: string | null;
}> {
  const firstName = normalizeName(input.firstName);
  const middleName = input.middleName.trim() ? normalizeName(input.middleName) : '';
  const lastName = normalizeName(input.lastName);
  const barangay = input.barangay.trim();

  if (!isValidName(firstName)) {
    return { profile: null, eligibility: null, error: 'Enter a valid first name.' };
  }
  if (middleName && !isValidName(middleName)) {
    return {
      profile: null,
      eligibility: null,
      error: 'Enter a valid middle name or leave it blank.',
    };
  }
  if (!isValidName(lastName)) {
    return { profile: null, eligibility: null, error: 'Enter a valid last name.' };
  }
  if (!barangay) {
    return { profile: null, eligibility: null, error: 'Select your barangay.' };
  }

  const { data, error } = await supabase.rpc('update_my_resident_profile', {
    p_first_name: firstName,
    p_middle_name: middleName,
    p_last_name: lastName,
    p_barangay: barangay,
  });

  if (error) {
    return { profile: null, eligibility: null, error: error.message };
  }

  const resultRow = (Array.isArray(data) ? data[0] : data) as {
    next_update_at?: string | null;
  } | null;
  const nextUpdateAt = resultRow?.next_update_at ?? null;
  const [profileResult, eligibilityResult] = await Promise.all([
    fetchMyProfile({ force: true }),
    fetchProfileUpdateEligibility(),
  ]);
  if (profileResult.error || !profileResult.profile) {
    return {
      profile: null,
      eligibility: null,
      error: profileResult.error || 'Your profile was updated, but could not be reloaded.',
    };
  }

  return {
    profile: profileResult.profile,
    eligibility:
      eligibilityResult.eligibility ?? {
        canUpdateName: !nextUpdateAt || new Date(nextUpdateAt).getTime() <= Date.now(),
        nameNextUpdateAt: nextUpdateAt,
        canUpdateBarangay: !nextUpdateAt || new Date(nextUpdateAt).getTime() <= Date.now(),
        barangayNextUpdateAt: nextUpdateAt,
      },
    error: null,
  };
}

export type OfficialPublicProfile = Pick<
  PublicProfile,
  'id' | 'first_name' | 'last_name' | 'middle_name' | 'avatar_path'
>;

/** Read the signed-in official's display identity from the safe public view. */
export async function fetchMyOfficialPublicProfile(): Promise<{
  profile: OfficialPublicProfile | null;
  error: string | null;
}> {
  const session = await getActiveSession();
  const userId = session?.user?.id;
  if (!userId) {
    return { profile: null, error: 'Your session has expired.' };
  }

  const { data, error } = await supabase
    .from('app_profiles_public')
    .select('id, first_name, last_name, middle_name, avatar_path')
    .eq('id', userId)
    .maybeSingle();

  if (error && isProfilePhotoSchemaMissing(error.message)) {
    const legacyResult = await supabase
      .from('app_profiles_public')
      .select('id, first_name, last_name, middle_name')
      .eq('id', userId)
      .maybeSingle();

    if (legacyResult.error) {
      return { profile: null, error: legacyResult.error.message };
    }

    return {
      profile: legacyResult.data
        ? { ...legacyResult.data, avatar_path: null } as OfficialPublicProfile
        : null,
      error: null,
    };
  }

  if (error) {
    return { profile: null, error: error.message };
  }

  return { profile: data as OfficialPublicProfile | null, error: null };
}
