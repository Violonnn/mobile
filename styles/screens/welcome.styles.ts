import { StyleSheet } from 'react-native';
import { colors, fontSizes, fontWeights, radius, spacing } from '../theme';
import { layout, scaleByWidth } from '../../lib/layout';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },

  header: {
    alignItems: 'center',
  },
  logo: {
    width: scaleByWidth(160),
    height: scaleByWidth(100),
    resizeMode: 'contain',
  },

  heroSection: {
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: scaleByWidth(30),
    fontWeight: fontWeights.extrabold,
    color: colors.text,
    textAlign: 'center',
    lineHeight: scaleByWidth(36),
  },
  heroTitleAccent: {
    fontSize: scaleByWidth(26),
    fontWeight: fontWeights.extrabold,
    color: colors.primary,
    textAlign: 'center',
    lineHeight: scaleByWidth(32),
  },
  heroSubtitle: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },

  conceptSection: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  conceptImageWrapper: {
    width: '100%',
    maxWidth: layout.screenWidth * 0.88,
    aspectRatio: 1.15,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  conceptImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },

  buttonsSection: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  getStartedButton: {
    paddingVertical: spacing.lg,
    borderRadius: radius.full,
    alignItems: 'center',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  getStartedText: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
  },
  loginButton: {
    paddingVertical: spacing.lg,
    borderRadius: radius.full,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  loginText: {
    color: colors.primary,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.3,
  },
});
