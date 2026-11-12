import Constants from 'expo-constants';
// Keep this named import: Metro's dynamic import() evaluates every native getter.
import { Platform } from 'react-native';

import { isAppVersion, parseReleasePolicy, withReleaseTimeout } from './appVersionPolicy';
import type { ReleasePolicy } from './appVersionPolicy';
import { supabase } from './supabase';

export {
  canEnforceNativeUpdate,
  compareAppVersions,
  evaluateUpdateRequirement,
  parseReleasePolicy,
  withReleaseTimeout,
} from './appVersionPolicy';
export type { ReleasePolicy, UpdateRequirement } from './appVersionPolicy';

export function getInstalledAppVersion(): string | null {
  const version = Constants.expoConfig?.version;
  return isAppVersion(version) ? version : null;
}

export async function fetchReleasePolicy(platform: 'android' | 'ios'): Promise<{
  policy: ReleasePolicy | null;
  error: string | null;
}> {
  try {
    return await withReleaseTimeout(async (signal) => {
      const { data, error } = await supabase.from('app_release_policy')
        .select('platform, minimum_supported_version, latest_version, download_url, enforce, update_message, emergency_numbers')
        .eq('platform', platform).abortSignal(signal).maybeSingle();
      if (error) return { policy: null, error: error.message };
      const policy = parseReleasePolicy(data);
      return { policy, error: data && !policy ? 'Invalid release policy.' : null };
    });
  } catch (error) {
    return { policy: null, error: error instanceof Error ? error.message : 'Could not check app updates.' };
  }
}

export async function recordAppVersion(): Promise<void> {
  try {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    const version = getInstalledAppVersion();
    if (!version) return;
    const platform = Platform.OS;
    await withReleaseTimeout(async (signal) => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || signal.aborted) return;
      const { error } = await supabase.rpc('record_app_version', {
        p_platform: platform, p_app_version: version,
      }).abortSignal(signal);
      if (error && __DEV__) console.warn('App version check-in failed:', error.message);
    });
  } catch (error) {
    // Version telemetry must never prevent signing in or using the emergency app.
    if (__DEV__) console.warn('App version check-in unavailable:', error);
  }
}
