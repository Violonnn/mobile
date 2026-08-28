// styles/screens/admin.styles.ts
// Shared styles for the admin portal: Overview, Invitations, and Accounts.

import { StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, radius, spacing } from '../theme';
import { adminNavMetrics } from '../components/adminBottomNav.styles';

/** Extra bottom padding so scroll content clears the fixed admin bottom bar. */
const BOTTOM_BAR_CLEARANCE = adminNavMetrics.barHeight + spacing.lg;

// Soft wash of the nav highlight blue for light fills (tiles, chips, marks).
const navBlueSoft = 'rgba(170, 192, 220, 0.28)';

export const adminStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    // Clear the fixed AdminBottomNav + home-indicator overlap.
    paddingBottom: BOTTOM_BAR_CLEARANCE + spacing.xl,
    gap: spacing.lg,
  },

  // ---- Identity header ----
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: navBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkImage: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
  },
  headerTextGroup: {
    flex: 1,
    gap: 2,
  },
  brandLabel: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.themeSoft,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xl,
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  logoutButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.text,
  },

  // ---- Flat sections (Overview activity / recent — no card chrome) ----
  section: {
    gap: spacing.md,
  },

  // ---- Cards ----
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  sectionHint: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  linkAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  linkActionText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.themeSoft,
  },

  // ---- Metric tiles (Overview) ----
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricTile: {
    flexGrow: 1,
    flexBasis: '42%',
    minWidth: 132,
    backgroundColor: navBlueSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 96,
  },
  metricTileTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  metricValue: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xxl,
    color: colors.text,
    letterSpacing: -0.6,
  },
  metricLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
  metricArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Recent invitation rows (Overview) ----
  recentList: {
    gap: 0,
  },
  recentRow: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  recentRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  recentRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  recentKind: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  recentEmail: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  recentDate: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statusChipActive: {
    backgroundColor: navBlueSoft,
  },
  statusChipUsed: {
    backgroundColor: '#ECFDF5',
  },
  statusChipText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
  },
  statusChipTextActive: {
    color: colors.themeSoft,
  },
  statusChipTextUsed: {
    color: '#047857',
  },

  // ---- Primary CTA ----
  primaryButton: {
    backgroundColor: colors.themeSoft,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.white,
  },

  // ---- Form fields (Invitations) ----
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  roleChip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: navBlueSoft,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChipSelected: {
    backgroundColor: colors.themeSoft,
    borderColor: colors.themeSoft,
  },
  roleChipText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.themeSoft,
  },
  roleChipTextSelected: {
    color: colors.white,
  },
  fieldLabel: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text,
    minHeight: 48,
  },
  textInputError: {
    borderColor: '#DC2626',
  },
  selectBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  selectOption: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    justifyContent: 'center',
  },
  selectOptionSelected: {
    backgroundColor: navBlueSoft,
  },
  selectOptionText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  successBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successTitle: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: '#047857',
  },
  successLink: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  copyButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  copyButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.white,
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: '#DC2626',
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  retryButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: navBlueSoft,
  },
  retryButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.themeSoft,
  },

  // ---- Invite list rows (Invitations) ----
  inviteRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
  },
  inviteRowActive: {
    backgroundColor: colors.white,
  },
  inviteRowUsed: {
    backgroundColor: '#F8FAFC',
  },
  inviteRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  inviteKind: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  inviteMeta: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  revokeButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: '#FEF2F2',
  },
  revokeButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: '#DC2626',
  },
  listGap: {
    gap: spacing.sm,
  },

  // ---- Accounts placeholder ----
  emptyStateCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyStateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: navBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.text,
    textAlign: 'center',
  },
  emptyStateBody: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  capabilityList: {
    width: '100%',
    marginTop: spacing.sm,
    gap: 0,
  },
  capabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  capabilityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capabilityTextGroup: {
    flex: 1,
    gap: 2,
  },
  capabilityTitle: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  capabilityHint: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
});
