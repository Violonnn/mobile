import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type BrandIconProps = {
  size?: number;
};

/** Facebook brand mark — vector via Ionicons */
export function FacebookIcon({ size = 22 }: BrandIconProps) {
  return (
    <View style={[styles.badge, styles.facebookBadge, { width: size + 14, height: size + 14 }]}>
      <Ionicons name="logo-facebook" size={size} color="#FFFFFF" />
    </View>
  );
}

/** TikTok brand mark — vector via Ionicons */
export function TikTokIcon({ size = 20 }: BrandIconProps) {
  return (
    <View style={[styles.badge, styles.tiktokBadge, { width: size + 14, height: size + 14 }]}>
      <Ionicons name="logo-tiktok" size={size} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facebookBadge: {
    backgroundColor: '#1877F2',
  },
  tiktokBadge: {
    backgroundColor: '#010101',
  },
});
