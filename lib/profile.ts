import { supabase } from './supabase';
import { getActiveSession } from './auth';

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
