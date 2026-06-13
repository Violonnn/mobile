import { useEffect } from 'react';
import { BackHandler } from 'react-native';

/**
 * Wires the Android hardware back button to wizard back navigation.
 * Disabled after registration completes (screen should unmount via replace anyway).
 */
export function useRegistrationBackHandler(onBack: () => boolean, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => subscription.remove();
  }, [enabled, onBack]);
}
