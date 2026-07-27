// styles/components/adminBottomNav.styles.ts
// Fixed white bottom bar for the admin portal — three equal destinations,
// soft-blue active circle matching the resident nav (no Report action).

import { StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';

export const adminNavMetrics = {
  barHeight: 74,
  barRadius: 24,
  iconSize: 24,
  activeIconSize: 26,
  labelGap: 3,
  labelLineHeight: 12,
  hlWidth: 38,
  hlHeight: 38,
  itemMinWidth: 72,
};

export const adminNavColors = {
  bar: '#FFFFFF',
  iconInactive: '#9CA3AF',
  iconActive: '#FFFFFF',
  labelInactive: '#9CA3AF',
  labelActive: colors.themeSoft,
  circleFill: colors.themeSoft,
};

export const adminBottomNavStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'stretch',
    backgroundColor: adminNavColors.bar,
    overflow: 'visible',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: adminNavMetrics.barRadius,
    borderTopRightRadius: adminNavMetrics.barRadius,
    backgroundColor: adminNavColors.bar,
    shadowColor: '#1C2B4B',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(28, 43, 75, 0.06)',
  },
  row: {
    height: adminNavMetrics.barHeight,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
  },
  item: {
    minWidth: adminNavMetrics.itemMinWidth,
    flex: 1,
    height: '100%',
  },
  itemContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHolder: {
    width: adminNavMetrics.hlWidth,
    height: adminNavMetrics.hlHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCircle: {
    width: adminNavMetrics.hlWidth,
    height: adminNavMetrics.hlHeight,
    borderRadius: adminNavMetrics.hlWidth / 2,
    backgroundColor: adminNavColors.circleFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: adminNavMetrics.labelGap,
    fontSize: 10,
    lineHeight: adminNavMetrics.labelLineHeight,
    fontFamily: fonts.medium,
    letterSpacing: 0.2,
    color: adminNavColors.labelInactive,
  },
  labelActive: {
    fontFamily: fonts.semibold,
    color: adminNavColors.labelActive,
  },
});
