// styles/components/header.styles.ts — shared styles for the reusable AppHeader.
// Extracted from the home screen so the location + notification + profile bar
// can be reused across the feed, map, and profile tabs.
import { StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, radius, spacing } from '../theme';

export const headerColors = {
  // In-app theme: soft desaturated blue with white text (per design).
  header: colors.themeSoft,
  ink: '#1C2B4B',
  muted: 'rgba(255, 255, 255, 0.85)',
  pill: 'rgba(255, 255, 255, 0.35)',
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

  // ---- Greeting variant (home) -------------------------------------------
  // Icons are bottom-aligned so they sit level with the location line,
  // not the greeting line.
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  greetingTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  greetingTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  greetingLocationWrap: {
    gap: 1,
  },
  greetingLocationLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: headerColors.muted,
    letterSpacing: 0.4,
  },
  greetingLocationValue: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.white,
  },
  greetingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  plainBellButton: {
    padding: spacing.xs,
  },
  // User avatar next to the bell — same initial-in-circle format used
  // across the app (no profile pictures yet).
  greetingAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingAvatarText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.primary,
  },

  // ---- Notifications placeholder sheet -----------------------------------
  notifOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  notifBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
  },
  notifCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  notifIconCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: 'rgba(170, 192, 220, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  notifTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  notifSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  notifCloseButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    backgroundColor: colors.themeSoft,
  },
  notifCloseText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.white,
  },
  brandTitle: {
    flex: 1,
    marginRight: spacing.md,
    fontFamily: fonts.regular,
    fontSize: fontSizes.lg,
    color: headerColors.ink,
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
    color: headerColors.ink,
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
