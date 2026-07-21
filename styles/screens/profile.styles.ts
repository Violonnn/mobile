// styles/screens/profile.styles.ts — profile tab layout.
// Follows the reference design: title row ("My Profile" + gear), identity
// block (avatar, name, phone), then a rounded menu list card.
import { StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, radius, spacing } from '../theme';

export const profileStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    // Leave room for the floating bottom navigation bar.
    paddingBottom: 132,
  },

  // ---- Title row: centered "My Profile" with the gear pinned right ------
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  titleText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxl,
    color: colors.text,
    textAlign: 'center',
  },
  // Transparent gear — just the icon, no circle background. Positioned
  // absolutely so the title stays perfectly centered.
  gearButton: {
    position: 'absolute',
    right: 0,
    padding: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Identity row: big avatar on the left, name + phone on the right --
  // The whole block is centered horizontally on the screen.
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  avatarCircle: {
    width: 168,
    height: 168,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.bold,
    fontSize: 64,
    color: colors.primary,
  },
  identityTextWrap: {
    flex: 1,
    flexShrink: 1,
    gap: spacing.xs,
  },
  nameText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxl,
    color: colors.text,
  },
  phoneText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.lg,
    color: colors.textMuted,
  },
  // Same soft blue as the home screen header.
  editProfileButton: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.themeSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md - 4,
    marginTop: spacing.md,
  },
  editProfileText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.lg,
    color: colors.white,
  },

  // ---- Menu rows: plain, no containers, generous spacing -----------------
  menuList: {
    marginTop: spacing.lg,
    // Inset the rows from the screen edges.
    paddingHorizontal: spacing.lg,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  menuRowLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.xl,
    color: colors.text,
  },
  menuRowLabelDanger: {
    color: colors.danger,
  },
});
