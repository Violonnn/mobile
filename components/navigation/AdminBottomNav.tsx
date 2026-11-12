// components/navigation/AdminBottomNav.tsx
// Admin's three destinations use the official portal's floating bar geometry
// without importing role state or operational behavior.

import React, { useCallback, memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
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

const ADMIN_TABS: TabConfig[] = [
  {
    name: 'index',
    label: 'Dashboard',
    activeIcon: 'grid',
    inactiveIcon: 'grid-outline',
  },
  {
    name: 'invitations',
    label: 'Invites',
    activeIcon: 'mail',
    inactiveIcon: 'mail-outline',
  },
  {
    name: 'settings',
    label: 'Settings',
    activeIcon: 'settings',
    inactiveIcon: 'settings-outline',
  },
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

export default function AdminBottomNav({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const currentRouteName = state.routes[state.index]?.name;

  const navigateTo = useCallback(
    (routeName: string) => {
      triggerHaptic();
      const target = state.routes.find((route) => route.name === routeName);
      if (!target) return;

      const event = emitter.emit({
        type: 'tabPress',
        target: target.key,
        canPreventDefault: true,
      });

      if (currentRouteName !== routeName && !event.defaultPrevented) {
        navigateToTab(target.key);
      }
    },
    [emitter, navigateToTab, state.routes, currentRouteName],
  );

  // The legacy Accounts route immediately redirects to Settings and has no nav item.
  if (currentRouteName === 'accounts') return null;

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
          {ADMIN_TABS.map((tab) => (
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
