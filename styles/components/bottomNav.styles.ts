import { StyleSheet } from 'react-native';

import { colors } from '../theme';

export const navMetrics = {
  barHeight: 68,
  barRadius: 24,
  barMarginHorizontal: 8,
  barBottomGap: 0,
  iconSize: 25,
  activeIconSize: 27,
  hlWidth: 38,
  hlHeight: 32,
  reportSize: 64,
  reportIconSize: 31,
  reportLift: 19,
  carveGap: 7,
};

/**
 * Resident screens use this value to keep content above the custom tab bar.
 * The font-scale parameter remains for compatibility with existing callers;
 * icon-only navigation has a fixed height.
 */
export function getResidentBottomNavigationHeight(_fontScale: number): number {
  return navMetrics.barHeight;
}

export const navColors = {
  bar: '#FFFFFF',
  iconInactive: '#20252C',
  iconActive: colors.navigationActive,
  report: colors.navigationActive,
  reportIcon: '#FFFFFF',
  carve: '#EAF3FC',
};

export const bottomNavStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: navMetrics.barMarginHorizontal,
    right: navMetrics.barMarginHorizontal,
    alignItems: 'stretch',
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  bar: {
    width: '100%',
    borderRadius: navMetrics.barRadius,
    overflow: 'visible',
    backgroundColor: navColors.bar,
    borderWidth: 1,
    borderColor: 'rgba(32, 37, 44, 0.08)',
    shadowColor: '#20252C',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    overflow: 'visible',
  },
  item: {
    flex: 1,
    minWidth: 0,
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
  centerSlot: {
    width: navMetrics.reportSize + 16,
    height: '100%',
  },
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
    borderColor: 'rgba(15, 32, 68, 0.72)',
  },
  reportButton: {
    width: navMetrics.reportSize,
    height: navMetrics.reportSize,
    borderRadius: navMetrics.reportSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: navColors.report,
    shadowColor: navColors.report,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 8,
  },
  reportButtonNotSent: {
    backgroundColor: '#D15A3A',
    shadowColor: '#D15A3A',
  },
});
