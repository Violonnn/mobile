import { StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, radius, spacing } from '../theme';
import { layout, scaleByWidth } from '../../lib/layout';

const HERO_HEIGHT_RATIO = layout.isSmallScreen ? 0.22 : 0.28;

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

  /* ── Hero image section ── */
  heroWrapper: {
    width: '100%',
    height: layout.screenHeight * HERO_HEIGHT_RATIO,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.xxl,
  },
  heroBrandText: {
    fontFamily: fonts.medium,
    fontSize: scaleByWidth(20),
    color: colors.white,
    letterSpacing: 0.5,
  },

  /* ── Back button ── */
  backButton: {
    position: 'absolute',
    top: spacing.xxl,
    left: spacing.md,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15,32,68,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Content section below the hero ── */
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: loginColors.textMuted,
    marginBottom: spacing.xs,
  },
  headline: {
    fontFamily: fonts.extrabold,
    fontSize: scaleByWidth(30),
    color: loginColors.text,
    letterSpacing: -0.8,
    lineHeight: scaleByWidth(36),
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: loginColors.textMuted,
    lineHeight: 22,
    marginTop: spacing.xs,
    marginBottom: layout.isSmallScreen ? spacing.sm : spacing.md,
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
  phoneSwapIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  phoneSwapIconBtnPressed: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: loginColors.primary,
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
    color: loginColors.primary,
  },

  /* ── Login button (pill with arrow) ── */
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: loginColors.text,
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
    fontSize: fontSizes.lg,
    color: loginColors.white,
    letterSpacing: 0.2,
  },
  loginButtonArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Sign up row ── */
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  signUpPrompt: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: loginColors.textMuted,
  },
  signUpLink: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: loginColors.primary,
  },

  /* ── Official login section (preserved from current design) ── */
  officialSection: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    marginTop: layout.isSmallScreen ? spacing.md : spacing.lg,
    borderTopWidth: 1,
    borderTopColor: loginColors.grayLight,
  },
  officialLoginContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  officialLoginLogo: {
    width: layout.isSmallScreen ? 56 : 76,
    height: layout.isSmallScreen ? 56 : 76,
    borderRadius: layout.isSmallScreen ? 28 : 38,
  },
  officialLoginTextGroup: {
    alignItems: 'center',
    flexShrink: 1,
  },
  officialLoginTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  officialLoginTitle: {
    fontFamily: fonts.bold,
    color: loginColors.text,
    fontSize: fontSizes.lg,
    letterSpacing: 0.4,
    lineHeight: 22,
    textAlign: 'center',
  },
  officialLoginSubtitle: {
    fontFamily: fonts.regular,
    color: loginColors.textLight,
    fontSize: fontSizes.md,
    lineHeight: 20,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
