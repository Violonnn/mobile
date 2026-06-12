import { StyleSheet, Dimensions } from 'react-native';
import {fontSizes, fontWeights, radius, spacing } from '../theme';

const { width } = Dimensions.get('window');

export const colors = {
  background: '#ffffff',
  stepNode: '#e8f2ff',
  navyLight: '#1A3260',
  accent: '#000000',
  accentLight: '#FF6B4A',
  white: '#ffffff',
  offWhite: '#F5F7FA',
  gray: '#8A94A6',
  grayLight: '#D1D9E6',
  grayMuted: '#BCC5D3',
  text: '#1C2B4B',
  textLight: '#5A6A85',
  success: '#22C55E',
  error: '#EF4444',
  inputBg: '#ffffff',
  inputBorder: '#D1D9E6',
  inputBorderFocus: '#0F2044',
  primary: '#1A56DB',
};

export const registerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ─── Header image area ───────────────────────────────────────────────
  imageContainer: {
    width: '100%',
    height: 350,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    color: colors.grayMuted,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // ─── Back button ──────────────────────────────────────────────────────
  backButton: {
    position: 'absolute',
    top: 52,
    left: 20,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15,32,68,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: colors.white,
    fontSize: 18,
    lineHeight: 20,
    marginTop: -1,
  },

  // ─── Stepper ──────────────────────────────────────────────────────────
  stepperWrapper: {
    paddingTop: 28,
    paddingBottom: 8,
    paddingHorizontal: 36,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  stepNode: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stepNodeInactive: {
    backgroundColor: colors.grayLight,
    borderWidth: 2,
    borderColor: colors.grayLight,
  },
  stepNodeActive: {
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  stepNodeDone: {
    backgroundColor: colors.stepNode,
    borderWidth: 2,
    borderColor: colors.stepNode,
  },
  stepNodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  stepNodeTextInactive: {
    color: colors.gray,
  },
  stepConnector: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    marginHorizontal: 4,
  },
  stepConnectorInactive: {
    backgroundColor: colors.grayLight,
  },
  stepConnectorDone: {
    backgroundColor: colors.stepNode,
  },
  stepLabelsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  stepLabel: {
    fontSize: 10,
    textAlign: 'center',
    width: 70,
  },
  stepLabelInactive: {
    color: colors.grayMuted,
  },
  stepLabelActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  stepLabelDone: {
    color: colors.stepNode,
    fontWeight: '600',
  },

  // ─── Scroll container (centered) ─────────────────────────────────────
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 48,
  },

  // ─── Card / content ────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.white,
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 32,
  },

  divider: {
    height: 1,
    backgroundColor: colors.grayLight,
    marginBottom: 28,
  },
stepContent: {
  width: '100%',
  alignItems: 'center',
},
  // ─── Step 1: Phone ────────────────────────────────────────────────────
  stepTitle: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
    marginBottom: 6,
    letterSpacing: -1.7,
  },
  stepSubtitle: {
    fontSize: 16,
    letterSpacing: 1,
    color: colors.primary,
    lineHeight: 21,
    marginBottom: 32,
    textAlign: 'center',
  },
  stepSubtitleBold: {
    fontWeight: '900',
    color: colors.primary,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textLight,
    letterSpacing: 0.8,
    marginBottom: 10,
    textAlign: 'center',
  },
 phoneRow: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'rgb(255, 255, 255)',  // semi-transparent
  borderRadius: 14,
  paddingHorizontal: 10,
  paddingVertical: 13,
  marginHorizontal: 95,
  // Shadow
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 10,
  elevation: 5,
},
  phoneRowFocused: {
  shadowOpacity: 0.2,
  shadowRadius: 14,
  elevation: 8,
  backgroundColor: 'rgb(255, 255, 255)',  // slightly more visible on focus
},
 phonePrefixBox: {
  paddingRight: 10,
  borderRightWidth: 1,
  borderRightColor: 'rgb(255, 255, 255)',  // subtle divider
  marginRight: 10,
},
 phonePrefixText: {
  color: colors.text,
  fontSize: 25,
  fontWeight: '600',
},
 phoneInput: {
  color: colors.text,
  flex: 1, 
  fontSize: 25,
  paddingVertical: 0,
  backgroundColor: 'transparent',  // ← important
},
  phoneHint: {
    fontSize: 11,
    color: colors.gray,
    marginBottom: 36,
    marginTop: 2,
  },
  phoneHintError: {
    color: colors.error,
  },

  // ─── Step 2: OTP ──────────────────────────────────────────────────────
  otpTargetText: {
    fontSize: 14,
    color: colors.textLight,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 32,
  },
  otpTargetNumber: {
    fontWeight: '700',
    color: colors.text,
  },
  otpBoxRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 32,
  },
  otpBox: {
    width: 62,
    height: 72,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: colors.stepNode,
    backgroundColor: colors.white,
    shadowColor: colors.stepNode,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  otpBoxActive: {
    borderColor: colors.accent,
    backgroundColor: colors.white,
  },
  otpBoxText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
    gap: 4,
  },
  resendLabel: {
    fontSize: 13,
    color: colors.textLight,
  },
  resendButton: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  resendButtonDisabled: {
    color: colors.grayMuted,
  },
  resendTimer: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray,
  },

  // ─── Primary button ───────────────────────────────────────────────────
  primaryButton: {
  paddingVertical: 20,
   backgroundColor: colors.accent,
  marginTop: spacing.xxl,
  width: '100%',
  borderRadius: radius.full,
  alignItems: 'center',
  shadowColor: colors.text,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.35,
  shadowRadius: 12,
  elevation: 8,
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 5,
},
  primaryButtonDisabled: {
    backgroundColor: colors.grayLight,
    shadowOpacity: 0,
    elevation: 0,
  },
 primaryButtonText: {
  color: colors.white,
  fontSize: fontSizes.lg,
  fontWeight: fontWeights.bold,
  letterSpacing: 0.5,
},
  primaryButtonTextDisabled: {
    color: colors.gray,
  },
});