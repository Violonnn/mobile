import { StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, radius, spacing } from '../theme';
import { layout, scaleByWidth } from '../../lib/layout';

// Responsive hero height: smaller on compact devices to leave room for content
const IMAGE_HEIGHT_RATIO = layout.isSmallScreen ? 0.46 : 0.55;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },

  /* ── Hero image area ── */
  heroImageWrapper: {
    width: '100%',
    height: layout.screenHeight * IMAGE_HEIGHT_RATIO,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.lg,
  },
  brandText: {
    fontFamily: fonts.medium,
    fontSize: scaleByWidth(20),
    color: colors.white,
    letterSpacing: 0.5,
  },
  locationBlock: {
    gap: 2,
  },
  locationName: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.white,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  locationCoords: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.2,
  },

  /* ── Content area below the image ── */
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: layout.isSmallScreen ? spacing.md : spacing.lg,
    justifyContent: 'space-between',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: fonts.extrabold,
    fontSize: scaleByWidth(34),
    color: colors.text,
    letterSpacing: -1,
    lineHeight: scaleByWidth(40),
    marginTop: layout.isSmallScreen ? spacing.sm : spacing.md,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    lineHeight: 22,
    marginTop: spacing.sm,
  },

  /* ── CTA section ── */
  ctaSection: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.text,
    borderRadius: radius.xl,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
  },
  getStartedText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.lg,
    color: colors.white,
    letterSpacing: 0.2,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  loginPrompt: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  loginLink: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.text,
    textDecorationLine: 'underline',
  },
});
