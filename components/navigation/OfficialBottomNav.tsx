// components/navigation/OfficialBottomNav.tsx
// Role-aware official portal bottom bar.
// BDRRMO/MDRRMO: Command, Community, centered Reports, Map, Settings
// Mayor: Brief, Situations, Community, Map, Settings

import React, { useCallback, memo, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
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
    {
      name: 'incidents',
      label: isMayor ? 'Situations' : 'Incidents',
      activeIcon: 'alert-circle',
      inactiveIcon: 'alert-circle-outline',
    },
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

const MDRRMO_LEFT_TABS: TabConfig[] = [
  { name: 'index', label: 'Command', activeIcon: 'grid', inactiveIcon: 'grid-outline' },
  { name: 'community', label: 'Community', activeIcon: 'people', inactiveIcon: 'people-outline' },
];

const MDRRMO_RIGHT_TABS: TabConfig[] = [
  { name: 'map', label: 'Map', activeIcon: 'map', inactiveIcon: 'map-outline' },
  { name: 'settings', label: 'Settings', activeIcon: 'settings', inactiveIcon: 'settings-outline' },
];

function triggerHaptic() {
  Haptics.selectionAsync().catch(() => {});
}

const NavItem = memo(function NavItem({
  config,
  focused,
  onPress,
}: {
  config: TabConfig;
  focused: boolean;
  onPress: () => void;
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
        <View style={styles.iconHolder}>
          {focused ? (
            <View style={styles.activeCircle}>
              <Ionicons
                name={config.activeIcon}
                size={officialNavMetrics.activeIconSize}
                color={officialNavColors.iconActive}
              />
            </View>
          ) : (
            <Ionicons
              name={config.inactiveIcon}
              size={officialNavMetrics.iconSize}
              color={officialNavColors.iconInactive}
            />
          )}
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

function IncidentCenterButton({ onPress, label = 'Incidents' }: { onPress: () => void; label?: string }) {
  return (
    <View style={styles.incidentButtonWrap} pointerEvents="box-none">
      <View style={styles.incidentButtonStage}>
        <View style={styles.incidentCarve} pointerEvents="none" />
        <Pressable
          style={styles.incidentButton}
          onPress={onPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Open ${label.toLowerCase()}`}
        >
          <Ionicons
            name="alert-circle"
            size={officialNavMetrics.incidentIconSize}
            color={officialNavColors.incidentIcon}
          />
        </Pressable>
      </View>
      <Text style={styles.incidentLabel} pointerEvents="none">{label}</Text>
    </View>
  );
}

export default function OfficialBottomNav({
  state,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { officialKind } = useOfficialPortal();
  const isMayor = officialKind === 'Mayor';
  const isMdrrmo = officialKind === 'MDRRMO';
  const isBdrrmo = officialKind === 'BDRRMO';
  const usesOperationalNavigation = isBdrrmo || isMdrrmo;
  const tabs = useMemo(() => tabsForRole(isMayor), [isMayor]);
  const currentRouteName = state.routes[state.index]?.name;

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
            bottom: -insets.bottom,
            height: officialNavMetrics.barHeight + insets.bottom,
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={[styles.bar, { height: officialNavMetrics.barHeight + insets.bottom }]}>
          <View style={styles.row}>
            {MDRRMO_LEFT_TABS.map((tab) => (
              <NavItem
                key={tab.name}
                config={tab}
                focused={currentRouteName === tab.name}
                onPress={() => navigateTo(tab.name)}
              />
            ))}
            <View style={styles.centerSlot} />
            {MDRRMO_RIGHT_TABS.map((tab) => (
              <NavItem
                key={tab.name}
                config={tab}
                focused={currentRouteName === tab.name}
                onPress={() => navigateTo(tab.name)}
              />
            ))}
          </View>
          <IncidentCenterButton onPress={() => navigateTo('incidents')} label="Report" />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrapper,
        {
          bottom: -insets.bottom,
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
            />
          ))}
        </View>
      </View>
    </View>
  );
}
