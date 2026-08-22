import { StyleSheet } from 'react-native';

import { fonts } from '../theme';

export const navMetrics = {
  barHeight: 78,
  barRadius: 24,
  barMarginHorizontal: 8,
  barBottomGap: 0,
  itemWidth: 62,
  iconSize: 25,
  activeIconSize: 27,
  labelGap: 5,
  labelLineHeight: 14,
  hlWidth: 38,
  hlHeight: 32,
  reportSize: 64,
  reportIconSize: 31,
  reportLift: 25,
  carveGap: 7,
};

export const navColors = {
  bar: '#FFFFFF',
  iconInactive: '#20252C',
  iconActive: '#378FE7',
  labelInactive: '#20252C',
  labelActive: '#378FE7',
  circleFill: '#378FE7',
  report: '#4A96E6',
  reportIcon: '#FFFFFF',
  carve: '#EAF3FC',
};

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
    height: navMetrics.barHeight,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
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
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: navMetrics.labelLineHeight,
    color: navColors.labelInactive,
  },
  labelActive: {
    fontFamily: fonts.medium,
    color: navColors.labelActive,
  },
  centerSlot: {
    width: navMetrics.reportSize + 16,
    height: '100%',
  },
  activeCircle: {
    width: navMetrics.hlWidth,
    height: navMetrics.hlHeight,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderColor: 'rgba(74, 150, 230, 0.72)',
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
  reportLabel: {
    position: 'absolute',
    top: REPORT_LABEL_TOP,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: navMetrics.labelLineHeight,
    color: navColors.labelActive,
  },
});
