import { StyleSheet } from 'react-native';

import { colors, fonts, fontSizes, radius, spacing } from '../theme';

export const residentMapStyles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  mapSection: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
  contributionSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  errorBanner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: 'rgba(17, 24, 39, 0.86)',
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.white,
    textAlign: 'center',
  },
});
