import type { Href } from 'expo-router';
import { getActiveSession, logout } from './auth';
import { supabase } from './supabase';
import { fetchActiveOfficialAccess } from './officialRegistration';

/** Destinations after a valid session is resolved by role/status. */
export type PortalDestination = Href;

/**
 * Resolve where an authenticated user belongs.
 * Active officials land on the Official Access success panel (/official).
 * Admins land on /admin. Residents land on the resident home shell.
 */
export async function resolveSessionDestination(): Promise<PortalDestination | null> {
  const session = await getActiveSession();
  if (!session) return null;

  const { data: isAdmin, error: adminError } = await supabase.rpc('am_i_admin');
  if (adminError) {
    await logout();
    return null;
  }

  if (isAdmin) {
    return '/admin' as Href;
  }

  const { scope, error: officialError } = await fetchActiveOfficialAccess();
  if (officialError) {
    await logout();
    return null;
  }

  if (scope) {
    return '/official' as Href;
  }

  const { data: profile, error: profileError } = await supabase
    .from('app_profiles_public')
    .select('status, role')
    .eq('id', session.user.id)
    .maybeSingle();

  if (profileError) {
    await logout();
    return null;
  }

  // Suspended / missing non-resident rows cannot stay signed in here.
  if (profile && profile.status !== 'active') {
    await logout();
    return null;
  }

  // Mayor/officer without passing the access check (pending/incomplete) → out.
  if (profile && (profile.role === 'mayor' || profile.role === 'officer')) {
    await logout();
    return null;
  }

  // Missing app_profiles row still maps to resident (matches current_app_role()).
  return '/(main)/home' as Href;
}

/** True when the current session is an active administrator. */
export async function requireActiveAdmin(): Promise<boolean> {
  const session = await getActiveSession();
  if (!session) return false;

  const { data: isAdmin, error } = await supabase.rpc('am_i_admin');
  if (error || !isAdmin) return false;
  return true;
}

/**
 * True when the current session is an active mayor / MDRRMO / BDRRMO.
 * Uses the parameterless check_active_official_access() RPC.
 */
export async function requireActiveOfficialPortal(): Promise<boolean> {
  const session = await getActiveSession();
  if (!session) return false;

  const { scope } = await fetchActiveOfficialAccess();
  return !!scope;
}
