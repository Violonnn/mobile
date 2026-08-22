// components/navigation/OfficialBottomNav.tsx
// Role-aware official portal bottom bar.
// BDRRMO/MDRRMO: Command, Community, centered Reports, Map, Settings
// Mayor: Brief, Situations, Community, Map, Settings

import React, { useCallback, memo, useMemo, useRef } from 'react';
import { Animated, View, Text, Pressable } from 'react-native';
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
          <Ionicons
            name={focused ? config.activeIcon : config.inactiveIcon}
            size={focused ? officialNavMetrics.activeIconSize : officialNavMetrics.iconSize}
            color={focused ? officialNavColors.iconActive : officialNavColors.iconInactive}
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

function IncidentCenterButton({ onPress, label = 'Incidents' }: { onPress: () => void; label?: string }) {
  const buttonScale = useRef(new Animated.Value(1)).current;
  const waveScale = useRef(new Animated.Value(0.85)).current;
  const waveOpacity = useRef(new Animated.Value(0)).current;

  const handlePress = useCallback(() => {
    waveOpacity.setValue(0.3);
    waveScale.setValue(0.85);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(buttonScale, { toValue: 1.08, duration: 100, useNativeDriver: true }),
        Animated.spring(buttonScale, { toValue: 1, damping: 12, stiffness: 220, mass: 0.6, useNativeDriver: true }),
      ]),
      Animated.timing(waveScale, { toValue: 1.45, duration: 380, useNativeDriver: true }),
      Animated.timing(waveOpacity, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
    onPress();
  }, [buttonScale, onPress, waveOpacity, waveScale]);

  return (
    <View style={styles.incidentButtonWrap} pointerEvents="box-none">
      <View style={styles.incidentButtonStage}>
        <View style={styles.incidentCarve} pointerEvents="none" />
        <Animated.View pointerEvents="none" style={[styles.incidentWave, { opacity: waveOpacity, transform: [{ scale: waveScale }] }]} />
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <Pressable
            style={styles.incidentButton}
            onPress={handlePress}
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
        </Animated.View>
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
            bottom: 0,
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
                focused={
                  currentRouteName === tab.name ||
                  (tab.name === 'index' && currentRouteName === 'resources')
                }
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
            />
          ))}
        </View>
      </View>
    </View>
  );
}
