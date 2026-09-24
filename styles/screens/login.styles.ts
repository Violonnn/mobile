import { StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, radius, spacing } from '../theme';
import { layout, scaleByWidth } from '../../lib/layout';

export const loginColors = {
  background: colors.background,
  white: '#ffffff',
  text: colors.text,
  textMuted: '#6B7280',
  textLight: '#5A6A85',
  gray: '#8A94A6',
  grayLight: '#D1D9E6',
  grayMuted: '#BCC5D3',
  error: '#EF4444',
  primary: colors.primary,
  logoSkyBlue: '#009EF9',
  headlineAccent: '#C71246',
  signInButton: '#042C5C',
  inputBg: '#F5F6F8',
  inputBorder: '#E5E7EB',
};

export const loginStyles = StyleSheet.create({
  /* ── Root containers ── */
  container: {
    flex: 1,
    backgroundColor: loginColors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },

  loginLogoWrap: {
    alignItems: 'center',
    paddingTop: layout.isSmallScreen ? spacing.lg : spacing.xl,
  },
  loginLogo: {
    height: layout.isSmallScreen ? 120 : 152,
    width: layout.isSmallScreen ? 120 : 152,
  },
  loginContentShell: {
    flex: 1,
  },
  loginMainContent: {
    flex: 1,
    justifyContent: 'center',
  },

  /* ── Login content ── */
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    color: loginColors.textMuted,
    marginBottom: spacing.xs,
  },
  headline: {
    fontFamily: fonts.extrabold,
    fontSize: scaleByWidth(30),
    color: loginColors.text,
    letterSpacing: -0.8,
    lineHeight: scaleByWidth(36),
    marginBottom: layout.isSmallScreen ? spacing.sm : spacing.md,
  },
  headlineAccent: {
    color: loginColors.headlineAccent,
  },
  /* ── Field styling ── */
  fieldWrap: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: loginColors.textMuted,
    marginBottom: spacing.xs,
  },
  fieldErrorText: {
    fontFamily: fonts.regular,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 50,
    backgroundColor: loginColors.white,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: loginColors.inputBorder,
  },
  fieldRowFocused: {
    borderColor: loginColors.primary,
    borderWidth: 1.5,
  },
  fieldRowError: {
    borderColor: loginColors.error,
    borderWidth: 1.5,
  },
  phonePrefixBox: {
    paddingRight: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: loginColors.grayLight,
    marginRight: spacing.sm,
  },
  phonePrefixText: {
    fontFamily: fonts.semibold,
    color: loginColors.text,
    fontSize: fontSizes.lg,
  },
  phoneInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.regular,
    color: loginColors.text,
    fontSize: fontSizes.lg,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  phoneDisplayText: {
    fontFamily: fonts.regular,
    color: loginColors.text,
    fontSize: fontSizes.lg,
    lineHeight: fontSizes.lg + 4,
    paddingVertical: 0,
  },
  phoneDisplayPlaceholder: {
    color: loginColors.grayMuted,
  },
  phoneLockedValue: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  // Keeps the saved-phone lookup from changing the input's size after first paint.
  phoneLoadingValue: {
    flex: 1,
    justifyContent: 'center',
  },
  phoneLoadingBlock: {
    width: '58%',
    height: fontSizes.lg,
  },
  /* ── PIN field ── */
  pinIconBox: {
    paddingRight: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: loginColors.grayLight,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinInputWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignSelf: 'stretch',
    position: 'relative',
  },
  pinDisplayText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.lg,
    color: loginColors.text,
    paddingVertical: 0,
    letterSpacing: 6,
    lineHeight: fontSizes.lg + 6,
    textAlign: 'left',
  },
  pinHiddenInput: {
    ...StyleSheet.absoluteFill,
    color: 'transparent',
    fontSize: 1,
    letterSpacing: 0,
    padding: 0,
    margin: 0,
  },

  /* ── Forgot PIN link ── */
  forgotPinRow: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  forgotPinText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: loginColors.logoSkyBlue,
  },

  /* ── Login button (pill with arrow) ── */
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: loginColors.signInButton,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    marginTop: spacing.xs,
    width: '100%',
  },
  loginButtonDisabled: {
    backgroundColor: loginColors.grayLight,
  },
  loginButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xl,
    color: loginColors.white,
    letterSpacing: 0.2,
  },
  /* ── Community safety carousel ── */
  safetyCarousel: {
    marginTop: spacing.sm,
    width: '100%',
  },
  safetyCarouselContent: {
    paddingRight: spacing.sm,
  },
  safetyCarouselCard: {
    height: 188,
    overflow: 'hidden',
    backgroundColor: loginColors.white,
    borderRadius: radius.md,
  },
  safetyCarouselImage: {
    width: '100%',
    height: 96,
  },
  safetyCarouselCopy: {
    flex: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm,
  },
  safetyCarouselTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: loginColors.text,
    marginBottom: spacing.xs,
  },
  safetyCarouselDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: loginColors.textMuted,
    lineHeight: fontSizes.sm + 4,
  },
  /* ── Sign up row ── */
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  signUpPrompt: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: loginColors.textMuted,
  },
  signUpLink: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: loginColors.logoSkyBlue,
  },

  /* ── Official login section (preserved from current design) ── */
  officialSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: layout.isSmallScreen ? spacing.md : spacing.lg,
    width: '100%',
  },
  officialLoginContent: {
    alignSelf: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  officialLoginTitle: {
    fontFamily: fonts.semibold,
    color: loginColors.text,
    fontSize: fontSizes.lg,
    letterSpacing: 0.2,
  },
  officialLoginArrow: {
    marginLeft: spacing.sm,
  },
});
