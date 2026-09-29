// components/navigation/OfficialBottomNav.tsx
// Role-aware official portal bottom bar.
// BDRRMO/MDRRMO: Command, Community, Map, Settings
// Mayor: Brief, Community, Map, Settings

import React, { useCallback, memo, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useOfficialPortal } from '../../context/OfficialPortalContext';
import {
  officialBottomNavStyles as styles,
  officialNavColors,
  officialNavMetrics,
} from '../../styles/components/officialBottomNav.styles';

type IoniconName = keyof typeof Ionicons.glyphMap;

type TabConfig = {
  name: string;
  label: string;
  activeIcon: IoniconName;
  inactiveIcon: IoniconName;
};

function tabsForRole(isMayor: boolean): TabConfig[] {
  return [
    {
      name: 'index',
      label: isMayor ? 'Brief' : 'Command',
      activeIcon: 'grid',
      inactiveIcon: 'grid-outline',
    },
    // Situations remains accessible from the Mayor Brief, without taking up
    // a persistent navigation slot in the executive workspace.
    ...(!isMayor
      ? [{
          name: 'incidents',
          label: 'Incidents',
          activeIcon: 'alert-circle' as IoniconName,
          inactiveIcon: 'alert-circle-outline' as IoniconName,
        }]
      : []),
    {
      name: 'community',
      label: 'Community',
      activeIcon: 'people',
      inactiveIcon: 'people-outline',
    },
    {
      name: 'map',
      label: 'Map',
      activeIcon: 'map',
      inactiveIcon: 'map-outline',
    },
    {
      name: isMayor ? 'settings' : 'resources',
      label: isMayor ? 'Settings' : 'Resources',
      activeIcon: isMayor ? 'settings' : 'business',
      inactiveIcon: isMayor ? 'settings-outline' : 'business-outline',
    },
  ];
}

const OPERATIONAL_LEFT_TABS: TabConfig[] = [
  { name: 'index', label: 'Command', activeIcon: 'grid', inactiveIcon: 'grid-outline' },
  { name: 'community', label: 'Community', activeIcon: 'people', inactiveIcon: 'people-outline' },
];

const OPERATIONAL_RIGHT_TABS: TabConfig[] = [
  { name: 'map', label: 'Map', activeIcon: 'map', inactiveIcon: 'map-outline' },
  { name: 'settings', label: 'Settings', activeIcon: 'settings', inactiveIcon: 'settings-outline' },
];

const MDRRMO_TABS = [...OPERATIONAL_LEFT_TABS, ...OPERATIONAL_RIGHT_TABS];

function triggerHaptic() {
  Haptics.selectionAsync().catch(() => {});
}

const NavItem = memo(function NavItem({
  config,
  focused,
  onPress,
  executiveHighlight = false,
}: {
  config: TabConfig;
  focused: boolean;
  onPress: () => void;
  executiveHighlight?: boolean;
}) {
  return (
    <Pressable
      style={styles.item}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={config.label}
    >
      <View style={styles.itemContent}>
        <View style={[
          styles.iconHolder,
          executiveHighlight && focused && styles.executiveActiveIcon,
        ]}>
          <Ionicons
            name={focused ? config.activeIcon : config.inactiveIcon}
            size={focused ? officialNavMetrics.activeIconSize : officialNavMetrics.iconSize}
            color={
              executiveHighlight && focused
                ? officialNavColors.incidentIcon
                : focused
                  ? officialNavColors.iconActive
                  : officialNavColors.iconInactive
            }
          />
        </View>
        <Text
          style={[styles.label, focused && styles.labelActive]}
          numberOfLines={1}
        >
          {config.label}
        </Text>
      </View>
    </Pressable>
  );
});

export default function OfficialBottomNav({
  state,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { officialKind } = useOfficialPortal();
  const isMayor = officialKind === 'Mayor';
  const isBdrrmo = officialKind === 'BDRRMO';
  const usesOperationalNavigation = isBdrrmo || officialKind === 'MDRRMO';
  const tabs = useMemo(() => tabsForRole(isMayor), [isMayor]);
  const currentRouteName = state.routes[state.index]?.name;
  // Operational roles manage reports from Command, just like resource quick tools.
  const commandSectionActive =
    currentRouteName === 'index' ||
    currentRouteName === 'resources' ||
    (usesOperationalNavigation && currentRouteName === 'incidents');

  const navigateTo = useCallback(
    (routeName: string) => {
      triggerHaptic();
      const target = state.routes.find((route) => route.name === routeName);
      if (!target) return;

      const event = navigation.emit({
        type: 'tabPress',
        target: target.key,
        canPreventDefault: true,
      });

      if (currentRouteName !== routeName && !event.defaultPrevented) {
        navigation.navigate(routeName);
      }
    },
    [navigation, state.routes, currentRouteName],
  );

  // Hide the custom bar on nested detail / log-incident routes.
  if (
    currentRouteName === '[id]' ||
    currentRouteName === 'log-incident'
  ) {
    return null;
  }

  if (usesOperationalNavigation) {
    return (
      <View
        style={[
          styles.wrapper,
          {
            bottom: 0,
            height: officialNavMetrics.barHeight + insets.bottom,
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={[styles.bar, { height: officialNavMetrics.barHeight + insets.bottom }]}>
          <View style={styles.row}>
            {MDRRMO_TABS.map((tab) => (
              <NavItem
                key={tab.name}
                config={tab}
                focused={
                  currentRouteName === tab.name ||
                  (tab.name === 'index' && commandSectionActive)
                }
                onPress={() => navigateTo(tab.name)}
              />
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrapper,
        {
          bottom: 0,
          height: officialNavMetrics.barHeight + insets.bottom,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.bar,
          { height: officialNavMetrics.barHeight + insets.bottom },
        ]}
      >
        <View style={styles.row}>
          {tabs.map((tab) => (
            <NavItem
              key={tab.name}
              config={tab}
              focused={currentRouteName === tab.name}
              onPress={() => navigateTo(tab.name)}
              executiveHighlight={isMayor}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
