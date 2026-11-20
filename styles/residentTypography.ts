import type { TextStyle } from 'react-native';

import { colors, fonts, fontSizes } from './theme';

/** Shared resident body copy: matches Home and scales with the device font setting. */
export const residentTypography: {
  body: TextStyle;
  mutedBody: TextStyle;
} = {
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.lg,
    lineHeight: 22,
    color: colors.text,
  },
  mutedBody: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.lg,
    lineHeight: 22,
    color: colors.textMuted,
  },
};
