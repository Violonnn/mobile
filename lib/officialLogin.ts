import type { Href } from 'expo-router';
import { AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { logout } from './auth';
import { resolveSessionDestination } from './portalAccess';
import { fetchActiveOfficialAccess } from './officialRegistration';

const ACCESS_DISABLED_MESSAGE =
  'Access disabled. This account cannot use official access.';

const GENERIC_CREDENTIALS_ERROR =
  'Invalid email or password. Please try again.';

export type OfficialLoginResult =
  | { destination: Href; error: null }
  | { destination: null; error: string };

/**
 * Email/password sign-in for officials (and admins).
 * Officials must pass check_active_official_access(); admins use am_i_admin().
 * SMS-verified officials are created with Auth email already confirmed.
 */
export async function loginOfficialWithPassword(input: {
  email: string;
  password: string;
}): Promise<OfficialLoginResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    return { destination: null, error: 'Enter your email and password.' };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    // Treat unconfirmed / bad credentials the same — no account enumeration,
    // and email OTP registration is retired.
    if (signInError instanceof AuthError) {
      return { destination: null, error: GENERIC_CREDENTIALS_ERROR };
    }
    return { destination: null, error: GENERIC_CREDENTIALS_ERROR };
  }

  // Admins keep the admin portal; they are not mayor/officer success-panel users.
  const { data: isAdmin, error: adminError } = await supabase.rpc('am_i_admin');
  if (!adminError && isAdmin) {
    return { destination: '/admin' as Href, error: null };
  }

  const { scope, error: accessError } = await fetchActiveOfficialAccess();
  if (accessError || !scope) {
    await logout();
    return { destination: null, error: ACCESS_DISABLED_MESSAGE };
  }

  const destination = await resolveSessionDestination();
  if (!destination || destination === ('/(main)/home' as Href)) {
    await logout();
    return { destination: null, error: ACCESS_DISABLED_MESSAGE };
  }

  return { destination, error: null };
}
