import * as SplashScreen from 'expo-splash-screen';

let splashHideRequested = false;

/**
 * Expo throws when hideAsync is called again after the native view controller
 * has already released its splash screen. Coordinate every route through one
 * process-level guard so navigation can never trigger that invalid second call.
 */
export async function hideNativeSplashOnce(): Promise<void> {
  if (splashHideRequested) return;
  splashHideRequested = true;

  try {
    await SplashScreen.hideAsync();
  } catch {
    // A warm reload may start after native already removed the splash screen.
  }
}
