import { getActiveSession, logout } from './auth';
import {
  validateOfficialPasswordForm,
} from './officialRegistration';
import { supabase } from './supabase';

const GENERIC_REAUTH_ERROR = 'The current password is incorrect.';

/**
 * Change an official's Supabase Auth password after reauthentication.
 * A successful change ends all app sessions so the new credential is required.
 */
export async function changeOfficialPassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ error: string | null; warning: string | null }> {
  if (!input.currentPassword) {
    return { error: 'Enter your current password.', warning: null };
  }

  const validationErrors = validateOfficialPasswordForm({
    password: input.newPassword,
    confirmPassword: input.confirmPassword,
  });
  const validationError = validationErrors.password || validationErrors.confirmPassword;
  if (validationError) return { error: validationError, warning: null };

  if (input.currentPassword === input.newPassword) {
    return { error: 'Choose a new password that is different from the current password.', warning: null };
  }

  const currentSession = await getActiveSession();
  const email = currentSession?.user.email?.trim().toLowerCase();
  if (!currentSession?.user.id || !email) {
    return { error: 'Your official session has expired. Please sign in again.', warning: null };
  }

  const reauthenticated = await supabase.auth.signInWithPassword({
    email,
    password: input.currentPassword,
  });
  if (reauthenticated.error || reauthenticated.data.user?.id !== currentSession.user.id) {
    return { error: GENERIC_REAUTH_ERROR, warning: null };
  }

  const updated = await supabase.auth.updateUser({ password: input.newPassword });
  if (updated.error) {
    return { error: updated.error.message || 'The password could not be changed.', warning: null };
  }

  const signOutResult = await logout();
  return {
    error: null,
    warning: signOutResult.error
      ? 'The password changed, but this device could not close the old session automatically.'
      : null,
  };
}
