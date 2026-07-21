// styles/components/bottomNav.styles.ts
// Design tokens + styles for the fixed white bottom navigation bar.
// Inactive tabs are vertically centered icon + label. The active tab is a blue
// circle (white icon) seated at its default position inside the bar (no lift),
// keeping its label below. The center Report control is a borderless soft-red
// action button (not a tab) seated in a carved notch so it never touches the bar.

import { StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';

export const navMetrics = {
  barHeight: 74,
  barRadius: 24,
  barMarginHorizontal: 0,
  barBottomGap: 0,
  itemWidth: 62,
  // Tab icons a bit larger, but still smaller than the report button.
  iconSize: 24,
  activeIconSize: 26,
  // Tight icon→label gap — still readable, not cramped.
  labelGap: 3,
  labelLineHeight: 12,
  // Active highlight: a plain circle that sits inside the bar (no lift).
  hlWidth: 38,
  hlHeight: 38,
  reportSize: 54,
  reportIconSize: 26,
  reportLift: 20,
  carveGap: 6,
};

export const navColors = {
  bar: '#FFFFFF',
  iconInactive: '#9CA3AF',
  iconActive: '#FFFFFF',
  labelInactive: '#9CA3AF',
  // Active-tab highlight + label match the in-app theme color.
  labelActive: colors.themeSoft,
  circleFill: colors.themeSoft,
  // Soft, minimal red — no gradient, no border.
  report: '#F26E6E',
  reportIcon: '#FFFFFF',
  // Carved notch = the app background showing through the bar.
  carve: colors.background,
};

// Side labels are centered as part of the icon + gap + label stack. Position
// the Report label at that exact row without adding height to its button wrapper.
const ITEM_CONTENT_HEIGHT =
  navMetrics.hlHeight + navMetrics.labelGap + navMetrics.labelLineHeight;
const SIDE_LABEL_TOP =
  (navMetrics.barHeight - ITEM_CONTENT_HEIGHT) / 2 +
  navMetrics.hlHeight +
  navMetrics.labelGap;
const REPORT_LABEL_TOP = navMetrics.reportLift + SIDE_LABEL_TOP;

export const bottomNavStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'stretch',
    backgroundColor: navColors.bar,
    overflow: 'visible',
  },
  bar: {
    height: navMetrics.barHeight,
    width: '100%',
    borderTopLeftRadius: navMetrics.barRadius,
    borderTopRightRadius: navMetrics.barRadius,
    backgroundColor: navColors.bar,
    overflow: 'visible',
    shadowColor: '#1C2B4B',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(28, 43, 75, 0.06)',
  },
  row: {
    height: navMetrics.barHeight,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    position: 'relative',
    overflow: 'visible',
  },
  item: {
    width: navMetrics.itemWidth,
    height: '100%',
    zIndex: 1,
  },
  itemContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHolder: {
    width: navMetrics.hlWidth,
    height: navMetrics.hlHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: navMetrics.labelGap,
    fontSize: 10,
    lineHeight: navMetrics.labelLineHeight,
    fontFamily: fonts.medium,
    letterSpacing: 0.2,
    color: navColors.labelInactive,
  },
  labelActive: {
    fontFamily: fonts.semibold,
    color: navColors.labelActive,
  },
  centerSlot: {
    width: navMetrics.reportSize + 18,
    height: '100%',
  },

  activeCircle: {
    width: navMetrics.hlWidth,
    height: navMetrics.hlHeight,
    borderRadius: navMetrics.hlWidth / 2,
    backgroundColor: navColors.circleFill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Carved center report action button ----
  reportButtonWrap: {
    position: 'absolute',
    top: -navMetrics.reportLift,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportButtonStage: {
    width: navMetrics.reportSize,
    height: navMetrics.reportSize,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  reportCarve: {
    position: 'absolute',
    top: -navMetrics.carveGap,
    left: -navMetrics.carveGap,
    width: navMetrics.reportSize + navMetrics.carveGap * 2,
    height: navMetrics.reportSize + navMetrics.carveGap * 2,
    borderRadius: (navMetrics.reportSize + navMetrics.carveGap * 2) / 2,
    backgroundColor: navColors.carve,
  },
  reportWave: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: navMetrics.reportSize,
    height: navMetrics.reportSize,
    borderRadius: navMetrics.reportSize / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(242, 110, 110, 0.8)',
  },
  reportButton: {
    width: navMetrics.reportSize,
    height: navMetrics.reportSize,
    borderRadius: navMetrics.reportSize / 2,
    backgroundColor: navColors.report,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F26E6E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  // Absolutely positioned to share the side labels' baseline without changing
  // the button wrapper's layout or affecting nearby navigation items.
  reportLabel: {
    position: 'absolute',
    top: REPORT_LABEL_TOP,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: navMetrics.labelLineHeight,
    fontFamily: fonts.medium,
    letterSpacing: 0.2,
    color: navColors.labelInactive,
  },
});
