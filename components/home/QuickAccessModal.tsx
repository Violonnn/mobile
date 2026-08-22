import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  if (!type) return null;

  const details = TYPE_DETAILS[type];
  const isEmpty =
    (type === 'hotlines' && hotlines.length === 0) ||
    (type === 'facilities' && facilities.length === 0) ||
    (type === 'evacuation' && centers.length === 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{details.title}</Text>
              <Text style={styles.subtitle}>{details.subtitle}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close quick access"
            >
              <Ionicons name="close" size={21} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.stateText}>Loading current information…</Text>
            </View>
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
                        <Ionicons name="call-outline" size={21} color={colors.text} />
                      </View>
                      <View style={styles.cardCopy}>
                        <Text style={styles.cardTitle}>{hotline.name}</Text>
                        <Text style={styles.cardMeta}>
                          {hotline.number} · {hotlineCategoryLabel(hotline.category)}
                        </Text>
                      </View>
                      {hotline.facilityId &&
                      facilities.some((facility) => facility.id === hotline.facilityId) ? (
                        <TouchableOpacity
                          style={styles.secondaryAction}
                          onPress={() => onOpenMap('facility', hotline.facilityId!)}
                          accessibilityRole="button"
                          accessibilityLabel={`View ${hotline.name} location`}
                        >
                          <Ionicons name="location-outline" size={20} color={colors.primary} />
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        style={styles.callAction}
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
                        <Ionicons name="business-outline" size={21} color={colors.text} />
                      </View>
                      <View style={styles.cardCopy}>
                        <Text style={styles.cardTitle}>{facility.name}</Text>
                        <Text style={styles.cardMeta}>
                          {facilityTypeLabel(facility.type)}
                          {facility.address ? ` · ${facility.address}` : ''}
                        </Text>
                      </View>
                      <View style={styles.mapAction}>
                        <Text style={styles.mapActionText}>Directions</Text>
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
                        <Ionicons name="exit-outline" size={21} color={colors.white} />
                      </View>
                      <View style={styles.cardCopy}>
                        <Text style={styles.cardTitle}>{center.name}</Text>
                        <Text style={styles.cardMeta}>
                          {evacuationStatusLabel(center.status)}
                          {center.capacity != null ? ` · Capacity ${center.capacity}` : ''}
                        </Text>
                      </View>
                      <View style={styles.mapAction}>
                        <Text style={styles.mapActionText}>Directions</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                : null}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
