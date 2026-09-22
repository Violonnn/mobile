import React, { type ComponentProps } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
    icon: 'call-outline' as const,
  },
  facilities: {
    title: 'Nearby facilities',
    subtitle: 'Open a facility to see its verified location on the map.',
    icon: 'business-outline' as const,
  },
  evacuation: {
    title: 'Evacuation centers',
    subtitle: 'Check center status and open its exact map location.',
    icon: 'exit-outline' as const,
  },
};

type ResourceIconName = ComponentProps<typeof Ionicons>['name'];

function WashedResourceIcon({
  name,
  color,
}: {
  name: ResourceIconName;
  color: string;
}) {
  return (
    <View style={styles.washedResourceIcon} pointerEvents="none">
      <Ionicons name={name} size={25} color={colors.text} />
      <Ionicons name={name} size={20} color={color} style={styles.washedResourceIconFill} />
    </View>
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
              <Ionicons name={details.icon} size={25} color={colors.textMuted} />
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
                        <WashedResourceIcon name="call" color="#C98585" />
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
                        <WashedResourceIcon name="business" color="#D5B66B" />
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
                          <Ionicons name="location" size={18} color={colors.text} />
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
                        <WashedResourceIcon name="home" color="#7BA682" />
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
