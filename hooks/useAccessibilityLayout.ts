import { useWindowDimensions } from 'react-native';

// This breakpoint changes layout only. Text continues to use the system scale.
const LARGE_TEXT_FONT_SCALE = 1.3;

export function useAccessibilityLayout() {
  const { fontScale } = useWindowDimensions();

  return {
    isLargeText: fontScale >= LARGE_TEXT_FONT_SCALE,
  };
}
