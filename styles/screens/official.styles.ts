import { StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, radius, spacing } from '../theme';

export const officialStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    justifyContent: 'center',
    gap: spacing.lg,
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
    backgroundColor: 'rgba(170, 192, 220, 0.25)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.themeSoft,
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
    backgroundColor: 'rgba(170, 192, 220, 0.25)',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  scopeLabel: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.xs,
  },
  scopeValue: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.themeSoft,
  },
  scopeMeta: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  logoutButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.text,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.white,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
