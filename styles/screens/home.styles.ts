import { StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, radius, spacing } from '../theme';
import { scaleByWidth } from '../../lib/layout';

export const homeColors = {
  navy: '#1C2B4B',
  // Brand blue nudged slightly toward sky blue for a softer header.
  header: '#2E6DED',
  // Recent Today card: a bit darker than the header for subtle contrast.
  recentCard: '#2159D6',
  headerMuted: 'rgba(255, 255, 255, 0.78)',
  headerHairline: 'rgba(255, 255, 255, 0.18)',
  pill: 'rgba(255, 255, 255, 0.18)',
  dot: '#F97316',
};

export const homeStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },

  // ---- Sections ---------------------------------------------------------
  scrollContent: {
    flexGrow: 1,
    // Leave room for the floating bottom navigation bar.
    paddingBottom: 132,
  },
  headerSection: {
    marginTop: spacing.lg,
  },
  bodySection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: scaleByWidth(18),
    color: colors.white,
  },
  announcementTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginRight: spacing.sm,
  },
  headerLocationRow: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  headerLocation: {
    flexShrink: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: homeColors.headerMuted,
  },
  sectionTitleDark: {
    fontFamily: fonts.bold,
    fontSize: scaleByWidth(18),
    color: homeColors.navy,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  seeAllText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: 'rgba(255, 255, 255, 0.92)',
  },
  seeAllTextDark: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },

  // Recent Today lives in the white body but keeps the announcement's blue.
  recentCard: {
    backgroundColor: homeColors.recentCard,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  happeningSection: {
    marginTop: spacing.lg,
  },

  // ---- Empty states (transparent, single unbold line) -------------------
  emptyCard: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.md,
    paddingLeft: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  emptyCardDark: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.md,
    paddingLeft: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  emptyTitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  emptyTitleDark: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },

  // ---- Map preview ------------------------------------------------------
  mapCard: {
    marginTop: spacing.md,
    height: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapWebview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  mapFallbackText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },

  // ---- Welcome modal overlay (consumed by WelcomeModal) -----------------
  welcomeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 32, 68, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
});
