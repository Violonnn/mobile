import { StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, radius, spacing } from '../theme';
import { scaleByWidth } from '../../lib/layout';

export const homeColors = {
  navy: '#1C2B4B',
  headerMuted: colors.textMuted,
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
    color: colors.text,
  },
  announcementTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginRight: spacing.sm,
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
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  // Body-section links are black (only the header links stay white).
  seeAllTextDark: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.primary,
    textDecorationLine: 'underline',
  },

  happeningSection: {
    marginTop: spacing.lg,
  },
  nearbySection: {
    marginTop: spacing.sm,
  },
  nearbySectionHeader: {
    marginBottom: spacing.sm,
  },
  nearbyCarousel: {
    gap: spacing.md,
    paddingRight: spacing.lg,
    paddingBottom: spacing.xs,
  },
  nearbyIntroCard: {
    width: scaleByWidth(385),
    minHeight: scaleByWidth(260),
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(170, 192, 220, 0.18)',
    justifyContent: 'center',
  },
  nearbyIntroGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '72%',
    height: '78%',
  },
  nearbyReportBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.themeSoft,
  },
  nearbyReportBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.white,
  },
  nearbyIntroContent: {
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  nearbyIntroTitle: {
    fontFamily: fonts.display,
    fontSize: scaleByWidth(32),
    color: colors.text,
    textAlign: 'left',
  },
  nearbyIntroDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.lg,
    lineHeight: 24,
    color: colors.textMuted,
    textAlign: 'left',
  },
  nearbyReportCard: {
    width: scaleByWidth(385),
    minHeight: scaleByWidth(260),
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  nearbyStateCard: {
    width: scaleByWidth(385),
    minHeight: scaleByWidth(260),
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Horizontally scrolling cards preserve the shared post layout on Home.
  announcementList: {
    gap: spacing.md,
    paddingRight: spacing.lg,
    paddingBottom: spacing.xs,
  },
  announcementPostCard: {
    width: scaleByWidth(385),
    height: scaleByWidth(320),
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.9)',
    borderBottomWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 0,
    overflow: 'hidden',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
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
    color: colors.text,
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

  // ---- Welcome modal overlay (consumed by WelcomeModal) -----------------
  welcomeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 32, 68, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
});
