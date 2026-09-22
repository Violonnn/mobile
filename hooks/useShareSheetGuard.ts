import { useCallback, useEffect, useRef } from 'react';
import { Share } from 'react-native';

type SharePayload = Parameters<typeof Share.share>[0];

const SHARE_DISMISS_GUARD_MS = 450;

/** Prevents a parent feed card from receiving the press released by a native share sheet. */
export function useShareSheetGuard() {
  const cardPressBlocked = useRef(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
    },
    [],
  );

  const shareSafely = useCallback(async (payload: SharePayload) => {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    cardPressBlocked.current = true;

    try {
      await Share.share(payload);
    } catch {
      // Cancelling or closing an unavailable native share sheet is harmless.
    } finally {
      // Android can dispatch the finishing touch after its share activity closes.
      releaseTimer.current = setTimeout(() => {
        cardPressBlocked.current = false;
        releaseTimer.current = null;
      }, SHARE_DISMISS_GUARD_MS);
    }
  }, []);

  const canOpenCard = useCallback(() => !cardPressBlocked.current, []);

  return { shareSafely, canOpenCard };
}
