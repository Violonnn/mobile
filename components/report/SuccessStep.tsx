import React, { useEffect } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity } from 'react-native';
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
  canRetry: boolean;
  onRetry: () => void;
  onDone: () => void;
};

export default function SuccessStep({
  address,
  position,
  syncStatus,
  syncError,
  canRetry,
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
  const delayed = syncStatus === 'delayed';
  const statusTitle = synced
    ? 'Sent to responders'
    : failed
      ? 'Report not sent yet'
      : delayed
        ? 'Still sending report'
        : 'Sending report...';
  const statusMessage = synced
    ? 'Your complete report has been received.'
    : failed
      ? syncError ?? 'We could not send your report. Please try again.'
      : delayed
        ? 'This is taking longer than expected. You can continue using the app while we try again automatically.'
        : 'Please keep this screen open while we send your report.';

  return (
    <View style={styles.stepContent}>
      <View style={styles.successCenter}>
        {synced ? (
          <Animated.View style={[styles.checkCircle, checkStyle]}>
            <Ionicons name="checkmark" size={40} color={reportColors.white} />
          </Animated.View>
        ) : (
          <View
            style={[
              styles.checkCircle,
              styles.deliveryCircle,
              (failed || delayed) && styles.deliveryCircleNotSent,
            ]}
          >
            {failed || delayed ? (
              <Ionicons name="cloud-offline-outline" size={34} color={reportColors.white} />
            ) : (
              <ActivityIndicator size="large" color={reportColors.white} />
            )}
          </View>
        )}

        <Text style={styles.successTitle}>{statusTitle}</Text>
        <Text style={styles.successAddress}>{locationText}</Text>
        <Text style={styles.deliveryStatusMessage}>{statusMessage}</Text>
        {failed && canRetry ? (
          <TouchableOpacity
            style={[styles.primaryButton, styles.residentPrimaryButton]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry sending report"
          >
            <Text style={styles.primaryButtonText}>Try sending again</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {failed || delayed ? (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel="Continue using the app"
        >
          <Text style={styles.secondaryButtonText}>Continue in app</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
