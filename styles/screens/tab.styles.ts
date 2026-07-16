// styles/screens/tab.styles.ts — shared layout for tab screens that use the
// reusable AppHeader (feed, map).
import { StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, radius, spacing } from '../theme';

export const tabStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },

  // ---- Feed: stacked sections ------------------------------------------
  feedContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    // Leave room for the floating bottom navigation bar.
    paddingBottom: 132,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeading: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: colors.text,
  },
  emptyBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  emptyLine: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },

  // ---- Map: fills the space under the header ---------------------------
  mapFill: {
    flex: 1,
  },
});
