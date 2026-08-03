import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { reportStyles as styles, reportColors } from '../../styles/screens/report.styles';
import type { GpsPosition, ReadableAddress } from '../../lib/location';
import type { SyncStatus } from '../../hooks/useReportFlow';

type Props = {
  address: ReadableAddress | null;
  position: GpsPosition | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  onRetry: () => void;
  onDone: () => void;
};

export default function SuccessStep({
  address,
  position,
  syncStatus,
  syncError,
  onRetry,
  onDone,
}: Props) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 420 });
  }, [scale]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  const locationText = address?.label
    ? address.label
    : position
      ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`
      : 'Location captured';

  const synced = syncStatus === 'synced';
  const failed = syncStatus === 'failed';

  return (
    <View style={styles.stepContent}>
      <View style={styles.successCenter}>
        <Animated.View style={[styles.checkCircle, checkStyle]}>
          <Ionicons name="checkmark" size={40} color={reportColors.white} />
        </Animated.View>

        <Text style={styles.successTitle}>Report Submitted</Text>
        <Text style={styles.successAddress}>{locationText}</Text>

        <View style={[styles.syncChip, synced && styles.syncChipSynced]}>
          <Ionicons
            name={synced ? 'cloud-done-outline' : failed ? 'cloud-offline-outline' : 'sync-outline'}
            size={14}
            color={synced ? reportColors.success : reportColors.primary}
          />
          <Text style={[styles.syncChipText, synced && styles.syncChipTextSynced]}>
            {synced ? 'Sent to responders' : 'Saved on device · uploading…'}
          </Text>
        </View>
        {failed && syncError ? <Text style={styles.errorText}>{syncError}</Text> : null}
        {failed ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry report upload"
          >
            <Text style={styles.primaryButtonText}>Retry upload</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel="Done"
      >
        <Text style={styles.primaryButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}
