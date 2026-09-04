// hooks/useKeyboardHeight.ts — tracks the on-screen keyboard height.
// KeyboardAvoidingView does not work inside a statusBarTranslucent Modal on
// Android (the window never resizes, so the keyboard covers the content) and
// lags on iOS, so the report-detail modals lift themselves manually using
// this value instead.
import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

export function useKeyboardHeight(enabled: boolean = true): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [previousEnabled, setPreviousEnabled] = useState(enabled);

  if (enabled !== previousEnabled) {
    setPreviousEnabled(enabled);
    if (!enabled) setKeyboardHeight(0);
  }

  useEffect(() => {
    if (!enabled) return;

    // iOS fires "will" events before the slide animation, letting the sheet
    // move in step with the keyboard; Android only reliably fires "did".
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [enabled]);

  return keyboardHeight;
}
