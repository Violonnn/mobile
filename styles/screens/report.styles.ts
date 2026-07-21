import { StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, radius, spacing } from '../theme';

/** Shared palette for the report step flow (aligned with register tokens). */
export const reportColors = {
  primary: colors.themeSoft,
  primaryLight: 'rgba(170, 192, 220, 0.25)',
  accent: colors.danger,
  success: colors.success,
  text: '#1C2B4B',
  textLight: '#5A6A85',
  white: colors.white,
  border: colors.border,
  track: '#E4EAF5',
};

export const reportStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 32, 68, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    overflow: 'hidden',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: reportColors.text,
    letterSpacing: -0.5,
  },

  // --- Progress ---
  progressWrap: {
    marginBottom: spacing.md,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: reportColors.track,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    width: '100%',
    borderRadius: radius.full,
    backgroundColor: reportColors.primary,
    transformOrigin: 'left',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  progressLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: reportColors.textLight,
  },
  progressPercent: {
    padding: 0,
    margin: 0,
    minWidth: 48,
    textAlign: 'right',
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: reportColors.primary,
  },

  // --- Step shell ---
  // No fixed minHeight: the scroll area hugs the step's content so the modal
  // never shows dead space below the footer button. The card's maxHeight
  // (90%) still caps it on small screens, where the content scrolls.
  stepHost: {
    flexGrow: 0,
  },
  stepContent: {
    width: '100%',
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  stepTitle: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: reportColors.text,
  },
  stepSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: reportColors.textLight,
    lineHeight: 20,
    marginBottom: spacing.md,
  },

  // --- Location step ---
  locationCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  pulseStage: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: reportColors.primary,
  },
  pinBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: reportColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationLabel: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: reportColors.text,
    textAlign: 'center',
  },
  locationHint: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: reportColors.textLight,
    textAlign: 'center',
  },
  locationErrorText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: reportColors.accent,
    textAlign: 'center',
  },

  // --- Inputs (details) ---
  label: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: reportColors.text,
  },
  labelOptional: {
    fontFamily: fonts.regular,
    color: reportColors.textLight,
  },
  input: {
    borderWidth: 1,
    borderColor: reportColors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: reportColors.text,
    backgroundColor: colors.white,
  },
  textArea: {
    minHeight: 96,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: reportColors.primaryLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  gpsText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: reportColors.text,
  },

  // --- Attachments ---
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  counterText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: reportColors.textLight,
  },
  counterOver: {
    color: reportColors.accent,
  },
  mediaActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  mediaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: reportColors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  mediaButtonDisabled: {
    opacity: 0.5,
  },
  mediaButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: reportColors.primary,
  },
  mediaList: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  mediaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: reportColors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: reportColors.track,
  },
  videoThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: reportColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaChipLabel: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: reportColors.text,
  },

  // --- Media preview ---
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  previewContent: {
    width: '100%',
    aspectRatio: 3 / 4,
    maxHeight: '80%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewVideo: {
    width: '100%',
    height: '100%',
  },
  previewClose: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },

  // --- Buttons / footer ---
  errorText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: reportColors.accent,
    marginBottom: spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: reportColors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.white,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: reportColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: reportColors.textLight,
  },

  // --- Success ---
  successCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: reportColors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: reportColors.text,
    textAlign: 'center',
  },
  successAddress: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: reportColors.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
  syncChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: reportColors.primaryLight,
  },
  syncChipSynced: {
    backgroundColor: '#E7F8EE',
  },
  syncChipText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: reportColors.primary,
  },
  syncChipTextSynced: {
    color: reportColors.success,
  },
});
