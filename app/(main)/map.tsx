// app/(main)/map.tsx — map tab. Shared header with a facilities/reports search,
// plus an interactive (but data-less) map.
import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppHeader from '../../components/navigation/AppHeader';
import InteractiveMap from '../../components/map/InteractiveMap';
import { tabStyles as styles } from '../../styles/screens/tab.styles';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <AppHeader title="Map" searchPlaceholder="Search facilities and reports" />
      <View style={styles.mapFill}>
        <InteractiveMap />
      </View>
    </View>
  );
}
