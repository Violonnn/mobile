import { supabase } from './supabase';
import { getActiveSession } from './auth';
import { isValidName, normalizeName } from './validation/name';

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
};

/** Read the logged-in user's profile without ever touching pin_hash. */
export async function fetchMyProfile(): Promise<{
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

  return { profile: data as PublicProfile | null, error: null };
}

export type ResidentProfileUpdateInput = {
  firstName: string;
  middleName: string;
  lastName: string;
  barangay: string;
};

export type ProfileUpdateEligibility = {
  canUpdate: boolean;
  nextUpdateAt: string | null;
};

type ProfileUpdateEligibilityRow = {
  can_update: boolean;
  next_update_at: string | null;
};

/** Read the server-enforced resident profile update window. */
export async function fetchProfileUpdateEligibility(): Promise<{
  eligibility: ProfileUpdateEligibility | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('get_my_profile_update_eligibility');

  if (error) {
    return { eligibility: null, error: error.message };
  }

  const row = (Array.isArray(data) ? data[0] : data) as ProfileUpdateEligibilityRow | null;
  if (!row) {
    return { eligibility: null, error: 'Could not check when your profile can be updated.' };
  }

  return {
    eligibility: {
      canUpdate: row.can_update,
      nextUpdateAt: row.next_update_at,
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
  const profileResult = await fetchMyProfile();
  if (profileResult.error || !profileResult.profile) {
    return {
      profile: null,
      eligibility: null,
      error: profileResult.error || 'Your profile was updated, but could not be reloaded.',
    };
  }

  return {
    profile: profileResult.profile,
    eligibility: {
      canUpdate: !nextUpdateAt || new Date(nextUpdateAt).getTime() <= Date.now(),
      nextUpdateAt,
    },
    error: null,
  };
}

export type OfficialPublicProfile = Pick<
  PublicProfile,
  'id' | 'first_name' | 'last_name' | 'middle_name'
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
    .select('id, first_name, last_name, middle_name')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return { profile: null, error: error.message };
  }

  return { profile: data as OfficialPublicProfile | null, error: null };
}
