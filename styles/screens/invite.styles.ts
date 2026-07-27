import { StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, radius, spacing } from '../theme';

export const inviteStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#0F2044',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: fontSizes.xxl,
    color: colors.text,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    lineHeight: 22,
  },
  scopeBox: {
    marginTop: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
  },
  scopeLabel: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  scopeValue: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  placeholderNote: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  homeButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.text,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  homeButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.white,
  },
});
