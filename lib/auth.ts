import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

/** Return the persisted Supabase session, refreshing when needed. */
export async function getActiveSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;

  const expiresAt = data.session.expires_at ?? 0;
  const expiresSoon = expiresAt * 1000 - Date.now() < 60_000;

  if (!expiresSoon) return data.session;

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed.session) return data.session;

  return refreshed.session;
}

/** End the current session and clear stored credentials. */
export async function logout(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error?.message ?? null };
}
