import { StyleSheet } from 'react-native';

import { colors, fonts, fontSizes, radius, spacing } from '../theme';

export const quickAccessModalStyles = StyleSheet.create({
  sheet: {
    backgroundColor: '#FFFEFC',
  },
  content: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    lineHeight: 18,
    color: colors.textMuted,
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 6,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  resourceCard: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E7E3DE',
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    shadowColor: '#20252C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  hotlineCardIcon: {
    backgroundColor: 'transparent',
  },
  facilityCardIcon: {
    backgroundColor: 'transparent',
  },
  evacuationCardIcon: {
    backgroundColor: 'transparent',
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    lineHeight: 18,
    color: colors.text,
  },
  cardMeta: {
    marginTop: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    lineHeight: 14,
    color: colors.textMuted,
  },
  cardAction: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  callActionIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.unverified,
  },
  callActionText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: colors.unverified,
  },
  viewActionIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  facilityViewActionIcon: {
    backgroundColor: '#E4ECF9',
  },
  evacuationViewActionIcon: {
    backgroundColor: '#6F9B75',
  },
  viewActionText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
  },
  facilityViewActionText: {
    color: '#7897CC',
  },
  evacuationViewActionText: {
    color: '#56805D',
  },
  stateBlock: {
    flex: 1,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  stateText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    lineHeight: 19,
    textAlign: 'center',
    color: colors.textMuted,
  },
  retryButton: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  retryText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.white,
  },
});
