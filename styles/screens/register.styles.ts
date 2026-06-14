import { StyleSheet } from 'react-native';
import { colors as themeColors, fontSizes, fontWeights, radius, spacing } from '../theme';
import { layout, scaleByWidth } from '../../lib/layout';

export const registerColors = {
  background: '#ffffff',
  stepNode: '#e8f2ff',
  accent: '#000000',
  white: '#ffffff',
  gray: '#8A94A6',
  grayLight: '#D1D9E6',
  grayMuted: '#BCC5D3',
  text: '#1C2B4B',
  textLight: '#5A6A85',
  error: '#EF4444',
  inputBg: '#ffffff',
  inputBorder: '#D1D9E6',
  primary: themeColors.primary,
};

export const registerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: registerColors.background,
  },

  fixedContent: {
    flex: 1,
    justifyContent: 'center',
  },

  centeredBlock: {
    width: '100%',
  },

  fixedScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: spacing.md,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.lg,
  },

  backButton: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15,32,68,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: registerColors.white,
    fontSize: 18,
    lineHeight: 20,
    marginTop: -1,
  },

  screenTitle: {
    fontSize: scaleByWidth(28),
    fontWeight: '800',
    textAlign: 'center',
    color: registerColors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    letterSpacing: -1,
  },

  imageContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
  },

  stepperWrapper: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
    backgroundColor: registerColors.white,
    alignItems: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
  },
  stepMarkerSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stepMarkerPlaceholder: {
    width: 28,
    height: 28,
  },
  activeMarkerLayer: {
    position: 'absolute',
    top: 2,
    left: 0,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  stepConnectorTrack: {
    flex: 1,
    height: 3,
    marginHorizontal: 4,
    position: 'relative',
    justifyContent: 'center',
  },
  stepConnector: {
    height: 3,
    borderRadius: 2,
  },
  stepConnectorFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    transformOrigin: 'left',
  },
  stepConnectorInactive: {
    backgroundColor: registerColors.grayLight,
    width: '100%',
  },
  stepConnectorDone: {
    backgroundColor: registerColors.primary,
  },
  stepLabelsRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: spacing.sm,
  },
    stepColumn: {
    width: 40,
    alignItems: 'center',
  },
  stepLabelUnderMarker: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 4,
    width: 52, // a bit wider so "Details" fits; still centered under marker
  },
 stepLabel: {
  fontSize: 9,
  textAlign: 'center',
  width: 40,        // match stepMarkerSlot width exactly
},
stepLabelSpacer: {
  flex: 1,
},
  stepLabelInactive: {
    color: registerColors.grayMuted,
  },
  stepLabelActive: {
    color: registerColors.accent,
    fontWeight: '700',
  },
  stepLabelDone: {
    color: registerColors.primary,
    fontWeight: '600',
  },

  card: {
    backgroundColor: registerColors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },

  stepContent: {
    width: '100%',
    alignItems: 'stretch',
  },

  stepTitle: {
    fontSize: scaleByWidth(32),
    fontWeight: '800',
    textAlign: 'center',
    color: registerColors.text,
    marginBottom: 10,
    letterSpacing: -1,
  },
  stepSubtitle: {
    fontSize: fontSizes.md,
    letterSpacing: 0.5,
    color: registerColors.primary,
    lineHeight: 20,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  stepSubtitleBold: {
    fontWeight: '900',
    color: registerColors.primary,
  },

  fieldLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: registerColors.textLight,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 340,
    minHeight: 64,
    backgroundColor: registerColors.white,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
    borderWidth: 1.5,
    borderColor: registerColors.primary,
  },
  phonePrefixBox: {
    paddingRight: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: registerColors.grayLight,
    marginRight: spacing.sm,
  },
  phonePrefixText: {
    color: registerColors.text,
    fontSize: scaleByWidth(20),
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    minWidth: 0,
    color: registerColors.text,
    fontSize: scaleByWidth(20),
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  phoneHint: {
    fontSize: fontSizes.xs,
    color: registerColors.gray,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  phoneHintLarge: {
    fontSize: fontSizes.lg,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  phoneHintError: {
    color: registerColors.error,
  },
  continueVerificationButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  continueVerificationText: {
    color: registerColors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    textAlign: 'center',
  },

  otpTargetText: {
    fontSize: fontSizes.md,
    color: registerColors.textLight,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  otpTargetNumber: {
    fontWeight: '700',
    color: registerColors.text,
  },
  otpBoxRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    marginBottom: spacing.lg,
  },
  otpBox: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: registerColors.inputBorder,
    backgroundColor: registerColors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: registerColors.stepNode,
    backgroundColor: registerColors.white,
  },
  otpBoxActive: {
    borderColor: registerColors.primary,
    borderWidth: 2,
  },
  otpBoxError: {
    borderColor: registerColors.error,
    borderWidth: 2,
  },
  otpBoxText: {
    fontWeight: '800',
    color: registerColors.text,
  },

  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
    gap: 4,
  },
  resendLabel: {
    fontSize: fontSizes.sm,
    color: registerColors.textLight,
  },
  resendButton: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: registerColors.accent,
  },
  resendButtonDisabled: {
    color: registerColors.grayMuted,
  },
  resendTimer: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: registerColors.gray,
  },

  primaryButton: {
    paddingVertical: spacing.lg,
    backgroundColor: registerColors.accent,
    marginTop: spacing.lg,
    width: '100%',
    borderRadius: radius.full,
    alignItems: 'center',
    shadowColor: registerColors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  primaryButtonDisabled: {
    backgroundColor: registerColors.grayLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: registerColors.white,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
  },
  primaryButtonTextDisabled: {
    color: registerColors.gray,
  },

  detailsScroll: {
    flex: 1,
  },
  detailsScrollContent: {
    paddingBottom: spacing.xl,
  },

  fieldGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: registerColors.text,
    marginBottom: 2,
    marginLeft: spacing.sm,
  },
  required: {
    color: registerColors.error,
  },
  input: {
    backgroundColor: '#F5F6F8',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.lg,
    color: registerColors.text,
    minHeight: 52,
  },
  inputFocused: {
    borderWidth: 1.5,
    borderColor: '#acacac',
    backgroundColor: registerColors.white,
  },
  inputError: {
    borderWidth: 1.5,
    borderColor: registerColors.error,
  },
  dropdownInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  disabledInput: {
    backgroundColor: '#EAEAEA',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex1: {
    flex: 1,
  },
  errorText: {
    color: registerColors.error,
    fontSize: fontSizes.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
    fontWeight: '500',
  },
  fieldErrorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    alignSelf: 'stretch',
  },
  fieldErrorText: {
    flex: 1,
    color: registerColors.error,
    fontSize: fontSizes.sm,
    lineHeight: 18,
    textAlign: 'left',
  },
  inputWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F6F8',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputWithIconRowFocused: {
    borderColor: '#acacac',
    backgroundColor: registerColors.white,
  },
  inputWithIconRowError: {
    borderColor: registerColors.error,
    backgroundColor: registerColors.white,
  },
  fieldLeadingIconBox: {
    paddingRight: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: registerColors.grayLight,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWithIconField: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSizes.lg,
    color: registerColors.text,
    paddingVertical: 0,
  },
  checkboxError: {
    borderWidth: 1.5,
    borderColor: registerColors.error,
  },

  modernCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  circularCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CCC',
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: registerColors.white,
  },
  circularCheckboxActive: {
    backgroundColor: registerColors.primary,
    borderColor: registerColors.primary,
  },
  checkboxText: {
    flex: 1,
    fontSize: fontSizes.sm,
    color: registerColors.textLight,
  },
  linkText: {
    color: registerColors.primary,
    fontWeight: '600',
  },

  modernButton: {
    backgroundColor: registerColors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  modernButtonText: {
    color: registerColors.white,
    fontSize: fontSizes.xl,
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: registerColors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '60%',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: registerColors.grayLight,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: 'bold',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  modalOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  modalOptionSelected: {
    backgroundColor: registerColors.stepNode,
    borderRadius: radius.md,
  },
  modalOptionText: {
    fontSize: fontSizes.lg,
    color: registerColors.text,
    textAlign: 'center',
  },
  modalOptionTextSelected: {
    color: registerColors.primary,
    fontWeight: '700',
  },
  modalCloseButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#f5f5f5',
    borderRadius: radius.sm,
  },
  modalCloseText: {
    textAlign: 'center',
    fontSize: fontSizes.lg,
    fontWeight: 'bold',
    color: registerColors.error,
  },

  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F6F8',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 52,
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: fontSizes.lg,
    color: registerColors.text,
    flex: 1,
  },
  dropdownPlaceholder: {
    fontSize: fontSizes.lg,
    color: '#aaa',
    flex: 1,
  },
  dropdownIcon: {
    fontSize: fontSizes.lg,
    color: '#aaa',
  },

  pinHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  pinHintText: {
    flex: 1,
    fontSize: fontSizes.sm,
    color: registerColors.gray,
    lineHeight: 18,
  },
  pinInputInner: {
    flex: 1,
    fontSize: fontSizes.lg,
    color: registerColors.text,
    paddingVertical: 0,
    letterSpacing: 6,
    backgroundColor: 'transparent',
  },
  pinInputWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignSelf: 'stretch',
    position: 'relative',
  },
  pinDisplayText: {
    fontSize: fontSizes.lg,
    color: registerColors.text,
    paddingVertical: 0,
    letterSpacing: 6,
    lineHeight: fontSizes.lg + 6,
    textAlign: 'left',
  },
  pinHiddenInput: {
    ...StyleSheet.absoluteFillObject,
    color: 'transparent',
    fontSize: 1,
    letterSpacing: 0,
    padding: 0,
    margin: 0,
  },

  loginFieldWrap: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 340,
    marginBottom: spacing.md,
  },
  loginFieldLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: registerColors.textLight,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  phoneEditIconsCol: {
    marginLeft: spacing.sm,
    alignItems: 'center',
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
    borderColor: registerColors.primary,
  },
  phoneDisplayText: {
    color: registerColors.text,
    fontSize: scaleByWidth(20),
    lineHeight: scaleByWidth(24),
    paddingVertical: 0,
    includeFontPadding: false,
  },
  phoneDisplayPlaceholder: {
    color: registerColors.grayMuted,
  },
  phoneLockedValue: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  pinIconBox: {
    paddingRight: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: registerColors.grayLight,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginPinRow: {
    flex: 1,
    minWidth: 0,
  },
  forgotPasswordRow: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 340,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  forgotPasswordText: {
    fontSize: fontSizes.sm,
    color: registerColors.gray,
    textAlign: 'left',
  },
  forgotPasswordLink: {
    fontWeight: '800',
    color: registerColors.primary,
  },
  socialFollowSection: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 340,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: registerColors.grayLight,
    gap: spacing.sm,
  },
  loginSignUpButton: {
    paddingVertical: spacing.lg,
    width: '100%',
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginBottom: spacing.sm,
  },
  loginSignUpButtonText: {
    color: registerColors.accent,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
  },
  socialFollowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xs,
  },
  legalModalSheet: {
    backgroundColor: registerColors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    height: '85%',
    paddingBottom: spacing.xl,
  },
  legalModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: registerColors.grayLight,
  },
  legalModalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: registerColors.text,
  },
  legalModalClose: {
    padding: 4,
  },
  legalModalScroll: {
    flex: 1,
  },
  legalModalScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  legalModalBody: {
    fontSize: fontSizes.sm,
    color: registerColors.textLight,
    lineHeight: 22,
  },
  legalModalScrollAnchor: {
    height: 1,
  },
  legalScrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
  },
  legalScrollHintText: {
    fontSize: fontSizes.xs,
    color: registerColors.gray,
  },
  legalAcceptButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: registerColors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  legalAcceptButtonDisabled: {
    backgroundColor: registerColors.grayLight,
  },
  legalAcceptButtonText: {
    color: registerColors.white,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  legalAcceptButtonTextDisabled: {
    color: registerColors.gray,
  },
});
