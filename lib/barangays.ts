import { supabase } from './supabase';

export type BarangayOption = {
  id: string;
  name: string;
};

/** Load Minglanilla barangays for the BDRRMO invite selector. */
export async function fetchBarangays(): Promise<{
  barangays: BarangayOption[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('barangays')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) {
    return { barangays: [], error: error.message };
  }

  return { barangays: (data ?? []) as BarangayOption[], error: null };
}
