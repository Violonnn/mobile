import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import InteractiveMap, { type MapResourceMarker } from '../map/InteractiveMap';
import type { EvacuationCenterRecord, FacilityRecord, HotlineRecord } from '../../lib/resources';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';
import { colors } from '../../styles/theme';
import ResourceTypePickerSheet, { type ResourceCreateType } from './ResourceTypePickerSheet';

type CommandResourceDirectoryProps = {
  hotlines: HotlineRecord[];
  facilities: FacilityRecord[];
  centers: EvacuationCenterRecord[];
};

export default function CommandResourceDirectory({ hotlines, facilities, centers }: CommandResourceDirectoryProps) {
  const router = useRouter();
  const [pickerVisible, setPickerVisible] = useState(false);
  const facilityMarkers = useMemo<MapResourceMarker[]>(
    () => facilities.map((facility) => ({ id: facility.id, kind: 'facility', name: facility.name, latitude: facility.latitude, longitude: facility.longitude, subtitle: facility.address })),
    [facilities],
  );
  const centerMarkers = useMemo<MapResourceMarker[]>(
    () => centers.map((center) => ({ id: center.id, kind: 'evacuation', name: center.name, latitude: center.latitude, longitude: center.longitude, subtitle: center.status, isPriority: center.isPriority })),
    [centers],
  );

  function openDirectory(tab?: 'hotlines' | 'facilities' | 'centers') {
    router.push((tab ? `/official/resources?tab=${tab}` : '/official/resources') as Href);
  }

  function createResource(type: ResourceCreateType) {
    setPickerVisible(false);
    const tab = type === 'hotline' ? 'hotlines' : type === 'facility' ? 'facilities' : 'centers';
    router.push(`/official/resources?tab=${tab}&create=${type}` as Href);
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>RESOURCE DIRECTORY</Text>
        <TouchableOpacity style={styles.link} onPress={() => openDirectory()}>
          <Text style={styles.linkText}>Manage</Text>
          <Ionicons name="arrow-forward" size={19} color="#1A56DB" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.directoryCard} activeOpacity={0.96} onPress={() => openDirectory()}>
        <View style={styles.directoryMap} pointerEvents="none">
          <InteractiveMap
            markers={[]}
            facilities={facilityMarkers}
            evacuationCenters={centerMarkers}
            showZoomControls={false}
          />
        </View>
        <View style={styles.directoryMapOverlay} pointerEvents="box-none">
          <TouchableOpacity style={styles.addCircle} onPress={(event) => { event.stopPropagation(); setPickerVisible(true); }} accessibilityLabel="Add public resource">
            <Ionicons name="add" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.directoryCounts}>
          {[
            { label: 'Hotlines', value: hotlines.length, tab: 'hotlines' as const, icon: 'call-outline' as const, color: '#F04438' },
            { label: 'Facilities', value: facilities.length, tab: 'facilities' as const, icon: 'business-outline' as const, color: '#146EF5' },
            { label: 'Centers', value: centers.length, tab: 'centers' as const, icon: 'home-outline' as const, color: '#169B55' },
          ].map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.directoryMetric, index === 2 && styles.directoryMetricLast]}
              onPress={(event) => { event.stopPropagation(); openDirectory(item.tab); }}
            >
              <Ionicons name={item.icon} size={18} color={item.color} />
              <Text style={styles.directoryCount}>{String(item.value).padStart(2, '0')}</Text>
              <Text style={styles.directoryMetricLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.directoryFooter}>
          <Text style={styles.directoryFooterText}>Create · Edit · Status · Location</Text>
        </View>
      </TouchableOpacity>

      <ResourceTypePickerSheet visible={pickerVisible} onClose={() => setPickerVisible(false)} onSelect={createResource} />
    </View>
  );
}
