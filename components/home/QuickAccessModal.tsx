import React from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import {
  evacuationStatusLabel,
  facilityTypeLabel,
  hotlineCategoryLabel,
  openHotlineDialer,
  type EvacuationCenterRecord,
  type FacilityRecord,
  type HotlineRecord,
} from '../../lib/resources';
import { quickAccessModalStyles as styles } from '../../styles/components/quickAccessModal.styles';
import { colors } from '../../styles/theme';
import ResidentBottomSheet from '../ui/ResidentBottomSheet';
import { ListRowsSkeleton } from '../ui/ResidentScreenSkeletons';

export type QuickAccessType = 'hotlines' | 'facilities' | 'evacuation';

type QuickAccessModalProps = {
  visible: boolean;
  type: QuickAccessType | null;
  hotlines: HotlineRecord[];
  facilities: FacilityRecord[];
  centers: EvacuationCenterRecord[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  onOpenMap: (kind: 'facility' | 'evacuation', resourceId: string) => void;
};

const TYPE_DETAILS = {
  hotlines: {
    title: 'Emergency hotlines',
    subtitle: 'Tap a number to call the correct response team.',
  },
  facilities: {
    title: 'Nearby facilities',
    subtitle: 'Open a facility to see its verified location on the map.',
  },
  evacuation: {
    title: 'Evacuation centers',
    subtitle: 'Check center status and open its exact map location.',
  },
};

const QUICK_ACCESS_ICON_COLORS = {
  hotlines: '#C98585',
  facilities: '#7897CC',
  evacuation: '#7BA682',
};

// Match each modal row to the icon shown on its Help at hand shortcut.
function QuickAccessResourceIcon({
  type,
  color,
  size = 25,
}: {
  type: QuickAccessType;
  color: string;
  size?: number;
}) {
  if (type === 'evacuation') {
    return <MaterialCommunityIcons name="warehouse" size={size} color={color} />;
  }

  return (
    <Ionicons
      name={type === 'hotlines' ? 'call-outline' : 'business-outline'}
      size={size}
      color={color}
    />
  );
}

export default function QuickAccessModal({
  visible,
  type,
  hotlines,
  facilities,
  centers,
  loading,
  error,
  onClose,
  onRetry,
  onOpenMap,
}: QuickAccessModalProps) {
  if (!type) return null;

  const details = TYPE_DETAILS[type];
  const isEmpty =
    (type === 'hotlines' && hotlines.length === 0) ||
    (type === 'facilities' && facilities.length === 0) ||
    (type === 'evacuation' && centers.length === 0);

  return (
    <ResidentBottomSheet
      visible={visible}
      onClose={onClose}
      initialHeightRatio={0.78}
      minimumHeight={300}
      sheetStyle={styles.sheet}
      handleAccessibilityLabel={`Resize ${details.title.toLocaleLowerCase()} panel`}
      showCloseButton={false}
      animationType="slide"
    >
      <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{details.title}</Text>
              <Text style={styles.subtitle}>{details.subtitle}</Text>
            </View>
          </View>

          {loading ? (
            <ListRowsSkeleton rows={4} />
          ) : error ? (
            <View style={styles.stateBlock}>
              <Ionicons name="cloud-offline-outline" size={25} color={colors.textMuted} />
              <Text style={styles.stateText}>This information could not be loaded.</Text>
              <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : isEmpty ? (
            <View style={styles.stateBlock}>
              <QuickAccessResourceIcon type={type} size={25} color={colors.textMuted} />
              <Text style={styles.stateText}>No active entries are available yet.</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {type === 'hotlines'
                ? hotlines.map((hotline) => (
                    <View key={hotline.id} style={styles.resourceCard}>
                      <View style={[styles.cardIcon, styles.hotlineCardIcon]}>
                        <QuickAccessResourceIcon type="hotlines" color={QUICK_ACCESS_ICON_COLORS.hotlines} />
                      </View>
                      <View style={styles.cardCopy}>
                        <Text style={styles.cardTitle}>{hotline.name}</Text>
                        <Text style={styles.cardMeta}>
                          {hotline.number} · {hotlineCategoryLabel(hotline.category)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.cardAction}
                        onPress={() => void openHotlineDialer(hotline.number)}
                        accessibilityRole="button"
                        accessibilityLabel={`Call ${hotline.name}`}
                      >
                        <View style={styles.callActionIcon}>
                          <Ionicons name="call" size={18} color={colors.white} />
                        </View>
                        <Text style={styles.callActionText}>Call</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                : null}

              {type === 'facilities'
                ? facilities.map((facility) => (
                    <TouchableOpacity
                      key={facility.id}
                      style={styles.resourceCard}
                      activeOpacity={0.82}
                      onPress={() => onOpenMap('facility', facility.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${facility.name} on the map`}
                    >
                      <View style={[styles.cardIcon, styles.facilityCardIcon]}>
                        <QuickAccessResourceIcon type="facilities" color={QUICK_ACCESS_ICON_COLORS.facilities} />
                      </View>
                      <View style={styles.cardCopy}>
                        <Text style={styles.cardTitle}>{facility.name}</Text>
                        <Text style={styles.cardMeta}>
                          {facilityTypeLabel(facility.type)}
                          {facility.address ? ` · ${facility.address}` : ''}
                        </Text>
                      </View>
                      <View style={styles.cardAction}>
                        <View style={[styles.viewActionIcon, styles.facilityViewActionIcon]}>
                          <Ionicons name="location" size={18} color="#7897CC" />
                        </View>
                        <Text style={[styles.viewActionText, styles.facilityViewActionText]}>
                          View
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                : null}

              {type === 'evacuation'
                ? centers.map((center) => (
                    <TouchableOpacity
                      key={center.id}
                      style={styles.resourceCard}
                      activeOpacity={0.82}
                      onPress={() => onOpenMap('evacuation', center.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${center.name} on the map`}
                    >
                      <View style={[styles.cardIcon, styles.evacuationCardIcon]}>
                        <QuickAccessResourceIcon type="evacuation" color={QUICK_ACCESS_ICON_COLORS.evacuation} />
                      </View>
                      <View style={styles.cardCopy}>
                        <Text style={styles.cardTitle}>{center.name}</Text>
                        <Text style={styles.cardMeta}>
                          {evacuationStatusLabel(center.status)}
                          {center.capacity != null ? ` · Capacity ${center.capacity}` : ''}
                        </Text>
                      </View>
                      <View style={styles.cardAction}>
                        <View style={[styles.viewActionIcon, styles.evacuationViewActionIcon]}>
                          <Ionicons name="location" size={18} color={colors.white} />
                        </View>
                        <Text style={[styles.viewActionText, styles.evacuationViewActionText]}>
                          View
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                : null}
            </ScrollView>
          )}
      </View>
    </ResidentBottomSheet>
  );
}
