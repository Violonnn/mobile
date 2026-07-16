// components/navigation/BottomNav.tsx
// Floating white bottom navigation bar with labels.
//
// Interaction design:
//  - Inactive tabs are vertically centered icon + label. The active tab is a
//    blue circle (white icon) seated at its default position inside the bar
//    (no lift) and keeps its label below.
//  - The center Report control is a borderless soft-red action button (not a
//    tab route) seated in a carved notch so it never touches the bar.
// No animations — static highlight for best performance on low-end devices.

import React, { useCallback, useRef, memo } from 'react';
import { Animated, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  bottomNavStyles as styles,
  navColors,
  navMetrics,
} from '../../styles/components/bottomNav.styles';

type IoniconName = keyof typeof Ionicons.glyphMap;

type TabConfig = {
  name: string;
  label: string;
  activeIcon: IoniconName;
  inactiveIcon: IoniconName;
};

// Bar layout, left → right. The center is the Report action button (not a tab).
const LEFT_TABS: TabConfig[] = [
  { name: 'home', label: 'Home', activeIcon: 'home', inactiveIcon: 'home-outline' },
  { name: 'feed', label: 'Feed', activeIcon: 'newspaper', inactiveIcon: 'newspaper-outline' },
];
const RIGHT_TABS: TabConfig[] = [
  { name: 'map', label: 'Map', activeIcon: 'map', inactiveIcon: 'map-outline' },
  { name: 'profile', label: 'Profile', activeIcon: 'person', inactiveIcon: 'person-outline' },
];

function triggerHaptic() {
  Haptics.selectionAsync().catch(() => {});
}

/** A side tab: icon + label, vertically centered. When focused the icon lives
 *  in a static blue highlight circle; the label stays put. */
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
                size={navMetrics.activeIconSize}
                color={navColors.iconActive}
              />
            </View>
          ) : (
            <Ionicons
              name={config.inactiveIcon}
              size={navMetrics.iconSize}
              color={navColors.iconInactive}
            />
          )}
        </View>
        <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
          {config.label}
        </Text>
      </View>
    </Pressable>
  );
});

/** Center Report action button — carved, borderless, soft red. Not a tab. */
const ReportButton = memo(function ReportButton({ onPress }: { onPress: () => void }) {
  const buttonScale = useRef(new Animated.Value(1)).current;
  const waveScale = useRef(new Animated.Value(0.85)).current;
  const waveOpacity = useRef(new Animated.Value(0)).current;

  const handlePress = useCallback(() => {
    buttonScale.stopAnimation();
    waveScale.stopAnimation();
    waveOpacity.stopAnimation();

    buttonScale.setValue(1);
    waveScale.setValue(0.85);
    waveOpacity.setValue(0.32);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(buttonScale, {
          toValue: 1.08,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(buttonScale, {
          toValue: 1,
          damping: 12,
          stiffness: 220,
          mass: 0.6,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(waveScale, {
        toValue: 1.45,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.timing(waveOpacity, {
        toValue: 0,
        duration: 380,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  }, [buttonScale, onPress, waveOpacity, waveScale]);

  return (
    <View style={styles.reportButtonWrap} pointerEvents="box-none">
      <View style={styles.reportButtonStage}>
        <View style={styles.reportCarve} pointerEvents="none" />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.reportWave,
            {
              opacity: waveOpacity,
              transform: [{ scale: waveScale }],
            },
          ]}
        />
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <Pressable
            style={styles.reportButton}
            onPress={handlePress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Report an emergency"
          >
            <Ionicons
              name="megaphone"
              size={navMetrics.reportIconSize}
              color={navColors.reportIcon}
            />
          </Pressable>
        </Animated.View>
      </View>
      <Text
        style={styles.reportLabel}
        numberOfLines={1}
        pointerEvents="none"
      >
        Report
      </Text>
    </View>
  );
});

export default function BottomNav({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const currentRouteName = state.routes[state.index]?.name;

  const navigateTo = useCallback(
    (routeName: string) => {
      triggerHaptic();
      const target = state.routes.find((r) => r.name === routeName);
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

  const handleReportPress = useCallback(() => {
    triggerHaptic();
    // Action button only — no tab / screen navigation.
  }, []);

  return (
    <View
      style={[
        styles.wrapper,
        {
          bottom: -insets.bottom,
          height: navMetrics.barHeight + insets.bottom + navMetrics.barBottomGap,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.bar,
          { height: navMetrics.barHeight + insets.bottom + navMetrics.barBottomGap },
        ]}
      >
        <View style={styles.row}>
          {LEFT_TABS.map((tab) => (
            <NavItem
              key={tab.name}
              config={tab}
              focused={currentRouteName === tab.name}
              onPress={() => navigateTo(tab.name)}
            />
          ))}

          <View style={styles.centerSlot} />

          {RIGHT_TABS.map((tab) => (
            <NavItem
              key={tab.name}
              config={tab}
              focused={currentRouteName === tab.name}
              onPress={() => navigateTo(tab.name)}
            />
          ))}
        </View>

        <ReportButton onPress={handleReportPress} />
      </View>
    </View>
  );
}
