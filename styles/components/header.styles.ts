// styles/components/header.styles.ts — shared styles for the reusable AppHeader.
// Extracted from the home screen so the location + notification + profile bar
// can be reused across the feed, map, and profile tabs.
import { StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, radius, spacing } from '../theme';

export const headerColors = {
  // Brand blue nudged slightly toward sky blue for a softer header.
  header: '#2E6DED',
  muted: 'rgba(255, 255, 255, 0.78)',
  pill: 'rgba(255, 255, 255, 0.18)',
  dot: '#F97316',
};

export const headerStyles = StyleSheet.create({
  header: {
    backgroundColor: headerColors.header,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandTitle: {
    flex: 1,
    marginRight: spacing.md,
    fontFamily: fonts.regular,
    fontSize: fontSizes.lg,
    color: colors.white,
    letterSpacing: 0.3,
  },
  centerTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.lg,
    color: colors.white,
    letterSpacing: 0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: headerColors.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: headerColors.dot,
    borderWidth: 1.5,
    borderColor: headerColors.header,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.primary,
  },

  // ---- Search bar (shown on home, feed, map via searchPlaceholder) ------
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    height: 50,
    shadowColor: '#1C2B4B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  searchPlaceholder: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
});
