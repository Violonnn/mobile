import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/** Prevents repeated taps from stacking duplicate resident and official login routes. */
export function useAccessSwitch(onSwitch: () => void) {
  const [isSwitchingAccess, setIsSwitchingAccess] = useState(false);
  const accessSwitchLocked = useRef(false);

  useFocusEffect(
    useCallback(() => {
      // Unlock when returning to this access screen so it can be selected again.
      accessSwitchLocked.current = false;
      setIsSwitchingAccess(false);
    }, []),
  );

  const switchAccess = useCallback(() => {
    if (accessSwitchLocked.current) return;

    // A ref locks the next tap immediately, before state has a chance to re-render.
    accessSwitchLocked.current = true;
    setIsSwitchingAccess(true);
    onSwitch();
  }, [onSwitch]);

  return { isSwitchingAccess, switchAccess };
}
