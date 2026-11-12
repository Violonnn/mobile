import type { Href } from 'expo-router';
import { getActiveSession, logout } from './auth';
import { supabase } from './supabase';
import { fetchActiveOfficialAccess } from './officialRegistration';
import { isAuthorizationFailure } from './adminInvitePolicy';

/** Destinations after a valid session is resolved by role/status. */
export type PortalDestination = Href;

/**
 * Resolve where an authenticated user belongs.
 * Active officials land on the official incident-operations workspace (/official).
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

export type ActiveAdminAccessResult =
  | { status: 'allowed'; userId: string }
  | { status: 'denied' }
  | { status: 'error'; message: string };

function readPostgresErrorDetails(error: unknown): {
  code: string | null;
} {
  if (!error || typeof error !== 'object') return { code: null };
  const record = error as { code?: unknown };
  return {
    code: typeof record.code === 'string' ? record.code : null,
  };
}

/** Keep network failures retryable while treating explicit access denials as denied. */
export async function checkActiveAdminAccess(): Promise<ActiveAdminAccessResult> {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      const details = readPostgresErrorDetails(sessionError);
      if (isAuthorizationFailure(details.code, null)) {
        return { status: 'denied' };
      }
      return {
        status: 'error',
        message: 'Could not check administrator access. Check your connection and retry.',
      };
    }

    let session = sessionData.session;
    if (!session) return { status: 'denied' };

    const expiresAt = session.expires_at ?? 0;
    if (expiresAt * 1000 - Date.now() < 60_000) {
      const { data: refreshedData, error: refreshError } =
        await supabase.auth.refreshSession();
      if (!refreshError && refreshedData.session) session = refreshedData.session;
    }

    const { data: isAdmin, error: adminError, status: adminStatus } =
      await supabase.rpc('am_i_admin');
    if (adminError) {
      const details = readPostgresErrorDetails(adminError);
      if (isAuthorizationFailure(details.code, adminStatus)) {
        return { status: 'denied' };
      }
      return {
        status: 'error',
        message: 'Could not check administrator access. Check your connection and retry.',
      };
    }

    if (!isAdmin) return { status: 'denied' };
    return { status: 'allowed', userId: session.user.id };
  } catch {
    return {
      status: 'error',
      message: 'Could not check administrator access. Check your connection and retry.',
    };
  }
}

/** True when the current session is an active administrator. */
export async function requireActiveAdmin(): Promise<boolean> {
  const result = await checkActiveAdminAccess();
  return result.status === 'allowed';
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
