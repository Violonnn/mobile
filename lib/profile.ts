import { supabase } from './supabase';

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
