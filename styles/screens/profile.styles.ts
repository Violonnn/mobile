import { StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, spacing } from '../theme';

export const profileStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 130,
  },
  screenTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxl,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  loadingContainer: {
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: '#D8E3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: colors.primary,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  identityName: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    lineHeight: 27,
    color: colors.text,
  },
  identityPhone: {
    marginTop: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  viewProfileButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  viewProfileText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    color: colors.primary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#CBD5E1',
    marginHorizontal: -spacing.sm,
  },
  section: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: '#53617A',
    letterSpacing: 0.35,
    marginBottom: spacing.sm,
  },
  settingsRow: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: fonts.medium,
    fontSize: 18,
    color: colors.text,
  },
  rowSubtitle: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    lineHeight: 21,
    color: '#62708A',
  },
  rowValue: {
    maxWidth: '30%',
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: '#62708A',
    textAlign: 'right',
  },
  logoutRow: {
    minHeight: 104,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logoutTitle: {
    fontFamily: fonts.medium,
    fontSize: 18,
    color: colors.unverified,
  },
  errorCard: {
    marginTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.primary,
  },
});
