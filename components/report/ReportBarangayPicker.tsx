import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { BarangayOption } from '../../lib/barangays';
import {
  reportColors,
  reportStyles as styles,
} from '../../styles/screens/report.styles';

type Props = {
  visible: boolean;
  barangays: BarangayOption[];
  selectedBarangayId: string | null;
  loading: boolean;
  error: string | null;
  onSelect: (barangayId: string) => void;
  onRetry: () => void;
  onClose: () => void;
};

export default function ReportBarangayPicker({
  visible,
  barangays,
  selectedBarangayId,
  loading,
  error,
  onSelect,
  onRetry,
  onClose,
}: Props) {
  if (!visible) return null;

  return (
    <View style={styles.residentBarangayPickerOverlay}>
      <Pressable
        style={styles.residentBarangayPickerBackdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close barangay picker"
      />

      <View style={styles.residentBarangayPickerCard}>
        <View style={styles.residentBarangayPickerHeader}>
          <View style={styles.residentBarangayPickerHeading}>
            <Text style={styles.residentBarangayPickerTitle}>Change barangay</Text>
            <Text style={styles.residentBarangayPickerSubtitle}>
              Select the response area for this incident.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.residentBarangayPickerClose}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close barangay picker"
          >
            <Ionicons name="close" size={23} color={reportColors.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
            <View style={styles.residentBarangayPickerState}>
              <ActivityIndicator color={reportColors.primary} />
              <Text style={styles.residentBarangayPickerStateText}>
                Loading barangays…
              </Text>
            </View>
          ) : error ? (
            <View style={styles.residentBarangayPickerState}>
              <Ionicons name="alert-circle-outline" size={24} color={reportColors.accent} />
              <Text style={styles.residentBarangayPickerStateText}>{error}</Text>
              <TouchableOpacity
                style={styles.residentBarangayPickerRetry}
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel="Retry loading barangays"
              >
                <Text style={styles.residentBarangayPickerRetryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={barangays}
              keyExtractor={(barangay) => barangay.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.residentBarangayPickerList}
              ListEmptyComponent={
                <View style={styles.residentBarangayPickerState}>
                  <Text style={styles.residentBarangayPickerStateText}>
                    No barangays are available right now.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const selected = selectedBarangayId === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.residentBarangayPickerOption,
                      selected && styles.residentBarangayPickerOptionSelected,
                    ]}
                    onPress={() => {
                      onSelect(item.id);
                      onClose();
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Select ${item.name}`}
                  >
                    <View style={styles.residentBarangayPickerOptionIcon}>
                      <Ionicons
                        name="location-outline"
                        size={18}
                        color={reportColors.primary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.residentBarangayPickerOptionText,
                        selected && styles.residentBarangayPickerOptionTextSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {selected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={21}
                        color={reportColors.primary}
                      />
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={19}
                        color={reportColors.textLight}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
        )}
      </View>
    </View>
  );
}
