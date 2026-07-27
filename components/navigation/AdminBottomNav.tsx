// components/navigation/AdminBottomNav.tsx
// Dedicated admin portal bottom bar: Overview | Invites | Accounts.
// Styled like the resident BottomNav (soft-blue active circle) but without
// resident-only behavior (Report action, profile fetch, notifications).

import React, { useCallback, memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  adminBottomNavStyles as styles,
  adminNavColors,
  adminNavMetrics,
} from '../../styles/components/adminBottomNav.styles';

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
    label: 'Overview',
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
    name: 'accounts',
    label: 'Accounts',
    activeIcon: 'people',
    inactiveIcon: 'people-outline',
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
          {focused ? (
            <View style={styles.activeCircle}>
              <Ionicons
                name={config.activeIcon}
                size={adminNavMetrics.activeIconSize}
                color={adminNavColors.iconActive}
              />
            </View>
          ) : (
            <Ionicons
              name={config.inactiveIcon}
              size={adminNavMetrics.iconSize}
              color={adminNavColors.iconInactive}
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

export default function AdminBottomNav({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
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

  return (
    <View
      style={[
        styles.wrapper,
        {
          // Extend under the home indicator so the white bar fills the safe area.
          bottom: -insets.bottom,
          height: adminNavMetrics.barHeight + insets.bottom,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.bar,
          { height: adminNavMetrics.barHeight + insets.bottom },
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
