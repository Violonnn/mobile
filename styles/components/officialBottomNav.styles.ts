import { StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';

export const officialNavMetrics = {
  barHeight: 78,
  barRadius: 24,
  barMarginHorizontal: 8,
  iconSize: 25,
  activeIconSize: 27,
  labelGap: 5,
  labelLineHeight: 14,
  hlWidth: 38,
  hlHeight: 32,
  itemMinWidth: 56,
  incidentSize: 64,
  incidentIconSize: 31,
  incidentLift: 25,
  incidentCarveGap: 7,
};

export const officialNavColors = {
  bar: '#FFFFFF',
  iconInactive: '#20252C',
  iconActive: colors.navigationActive,
  labelInactive: '#20252C',
  labelActive: colors.navigationActive,
  incident: '#F0524A',
  incidentIcon: '#FFFFFF',
  carve: '#EAF3FC',
};

const ITEM_CONTENT_HEIGHT =
  officialNavMetrics.hlHeight +
  officialNavMetrics.labelGap +
  officialNavMetrics.labelLineHeight;
const SIDE_LABEL_TOP =
  (officialNavMetrics.barHeight - ITEM_CONTENT_HEIGHT) / 2 +
  officialNavMetrics.hlHeight +
  officialNavMetrics.labelGap;
const INCIDENT_LABEL_TOP = officialNavMetrics.incidentLift + SIDE_LABEL_TOP;

export const officialBottomNavStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: officialNavMetrics.barMarginHorizontal,
    right: officialNavMetrics.barMarginHorizontal,
    alignItems: 'stretch',
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  bar: {
    width: '100%',
    borderRadius: officialNavMetrics.barRadius,
    overflow: 'visible',
    backgroundColor: officialNavColors.bar,
    borderWidth: 1,
    borderColor: 'rgba(32, 37, 44, 0.08)',
    shadowColor: '#20252C',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 7,
  },
  row: {
    height: officialNavMetrics.barHeight,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    overflow: 'visible',
  },
  centerSlot: {
    width: officialNavMetrics.incidentSize + 16,
    height: '100%',
  },
  item: {
    minWidth: officialNavMetrics.itemMinWidth,
    flex: 1,
    height: '100%',
    zIndex: 1,
  },
  itemContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHolder: {
    width: officialNavMetrics.hlWidth,
    height: officialNavMetrics.hlHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  executiveActiveIcon: {
    width: officialNavMetrics.hlWidth,
    height: officialNavMetrics.hlWidth,
    borderRadius: officialNavMetrics.hlWidth / 2,
    backgroundColor: officialNavColors.iconActive,
    shadowColor: officialNavColors.iconActive,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 7,
    elevation: 4,
  },
  activeCircle: {
    width: officialNavMetrics.hlWidth,
    height: officialNavMetrics.hlHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: officialNavMetrics.labelGap,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: officialNavMetrics.labelLineHeight,
    color: officialNavColors.labelInactive,
  },
  labelActive: {
    fontFamily: fonts.medium,
    color: officialNavColors.labelActive,
  },
  incidentButtonWrap: {
    position: 'absolute',
    top: -officialNavMetrics.incidentLift,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incidentButtonStage: {
    width: officialNavMetrics.incidentSize,
    height: officialNavMetrics.incidentSize,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  incidentCarve: {
    position: 'absolute',
    top: -officialNavMetrics.incidentCarveGap,
    left: -officialNavMetrics.incidentCarveGap,
    width: officialNavMetrics.incidentSize + officialNavMetrics.incidentCarveGap * 2,
    height: officialNavMetrics.incidentSize + officialNavMetrics.incidentCarveGap * 2,
    borderRadius: (officialNavMetrics.incidentSize + officialNavMetrics.incidentCarveGap * 2) / 2,
    backgroundColor: officialNavColors.carve,
  },
  incidentWave: {
    position: 'absolute',
    width: officialNavMetrics.incidentSize,
    height: officialNavMetrics.incidentSize,
    borderRadius: officialNavMetrics.incidentSize / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(240, 82, 74, 0.68)',
  },
  incidentButton: {
    width: officialNavMetrics.incidentSize,
    height: officialNavMetrics.incidentSize,
    borderRadius: officialNavMetrics.incidentSize / 2,
    backgroundColor: officialNavColors.incident,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: officialNavColors.incident,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 8,
  },
  incidentLabel: {
    position: 'absolute',
    top: INCIDENT_LABEL_TOP,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: officialNavMetrics.labelLineHeight,
    color: officialNavColors.labelActive,
  },
});
