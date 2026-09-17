import React, { useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { GpsPosition, ReadableAddress } from '../../lib/location';
import {
  reportColors,
  reportStyles as styles,
} from '../../styles/screens/report.styles';
import ReportMapPreview from './ReportMapPreview';

type Props = {
  loading: boolean;
  error: string | null;
  position?: GpsPosition | null;
  address?: ReadableAddress | null;
  /** Low-confidence GPS gets a clear warning but can use the bounded picker. */
  needsConfirmation?: boolean;
  accuracyMeters?: number | null;
  movedDistanceMeters?: number;
  maximumDistanceMeters?: number;
  onRetry: () => void;
  onConfirmOnMap?: () => void;
  onContinue?: () => void;
  residentLayout?: boolean;
};

/** Radar-style pulse ring behind a pin while GPS resolves. */
function PulsePin({ active }: { active: boolean }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
  }, [active, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulse.value),
    transform: [{ scale: 0.6 + pulse.value * 0.8 }],
  }));

  return (
    <View style={styles.pulseStage}>
      <Animated.View style={[styles.pulseRing, ringStyle]} />
      <View style={styles.pinBadge}>
        <Ionicons name="location-sharp" size={30} color={reportColors.white} />
      </View>
    </View>
  );
}

function formatAccuracyLabel(accuracyMeters: number | null | undefined): string {
  if (typeof accuracyMeters === 'number' && Number.isFinite(accuracyMeters)) {
    return `GPS accuracy: about ±${Math.round(accuracyMeters)} m`;
  }
  return 'GPS accuracy could not be measured';
}

export default function LocationStep({
  loading,
  error,
  position = null,
  address = null,
  needsConfirmation = false,
  accuracyMeters = null,
  movedDistanceMeters = 0,
  maximumDistanceMeters = 150,
  onRetry,
  onConfirmOnMap,
  onContinue,
  residentLayout = false,
}: Props) {
  const showError = !loading && !position && Boolean(error);
  const locationReady = !loading && Boolean(position);

  if (residentLayout) {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.residentStepTitle}>Confirm where{`\n`}it happened</Text>
        <Text style={styles.residentStepSubtitle}>
          Location helps the nearest team respond.
        </Text>

        {loading ? (
          <View style={styles.residentLocationLoading}>
            <PulsePin active />
            <Text style={styles.locationLabel}>Getting location…</Text>
            <Text style={styles.locationHint}>
              Pinpointing your device location securely.
            </Text>
          </View>
        ) : showError ? (
          <View style={styles.residentLocationLoading}>
            <PulsePin active={false} />
            <Text style={styles.locationErrorText}>{error}</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="Retry getting location"
            >
              <Text style={styles.secondaryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : locationReady && position ? (
          <>
            <View style={styles.residentMapCard}>
              <ReportMapPreview position={position} />
              <View style={styles.residentAccuracyPill}>
                <Ionicons name="locate" size={15} color={reportColors.primary} />
                <Text style={styles.residentAccuracyPillText}>
                  {typeof accuracyMeters === 'number'
                    ? `GPS ${needsConfirmation ? 'check' : 'accurate'} · ${Math.round(accuracyMeters)} m`
                    : 'GPS needs review'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.residentAddressCard}
                onPress={onConfirmOnMap}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Review incident address"
              >
                <View style={styles.residentAddressIcon}>
                  <Ionicons name="location" size={29} color={reportColors.white} />
                </View>
                <View style={styles.residentAddressCopy}>
                  <Text style={styles.residentAddressPrimary} numberOfLines={1}>
                    {address?.barangay ?? 'Incident location'}
                  </Text>
                  <Text style={styles.residentAddressSecondary} numberOfLines={1}>
                    {address ? `${address.municipality}, Cebu` : 'Location captured'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={reportColors.primary} />
              </TouchableOpacity>
            </View>

            {needsConfirmation ? (
              <View style={styles.residentInlineWarning}>
                <Ionicons name="warning" size={16} color={reportColors.accent} />
                <Text style={styles.residentInlineWarningText}>
                  GPS confidence is low. Check the pin before continuing.
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.residentAdjustButton}
              onPress={onConfirmOnMap}
              accessibilityRole="button"
              accessibilityLabel="Adjust incident pin"
            >
              <Ionicons name="locate-outline" size={23} color={reportColors.primary} />
              <Text style={styles.residentAdjustButtonText}>Adjust pin</Text>
            </TouchableOpacity>

            <Text style={styles.residentAdjustmentText}>
              {Math.round(movedDistanceMeters)} m adjusted · {Math.round(maximumDistanceMeters)} m limit
            </Text>
            {error ? <Text style={styles.locationErrorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, styles.residentPrimaryButton]}
              onPress={onContinue}
              accessibilityRole="button"
              accessibilityLabel="Confirm incident location"
            >
              <Text style={styles.primaryButtonText}>Confirm location</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.residentLocationLoading}>
            <PulsePin active={false} />
            <Text style={styles.locationHint}>Location is not available yet.</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.stepContent}>
      <View style={styles.locationIntro}>
        <Text style={styles.stepTitle}>Confirm where it happened</Text>
        <Text style={styles.stepSubtitle}>
          Location helps the nearest team respond.
        </Text>
      </View>

      {loading ? (
        <View style={styles.locationCenter}>
          <PulsePin active />
          <Text style={styles.locationLabel}>Getting location…</Text>
          <Text style={styles.locationHint}>
            Pinpointing your device location securely.
          </Text>
        </View>
      ) : showError ? (
        <View style={styles.locationCenter}>
          <PulsePin active={false} />
          <Text style={styles.locationErrorText}>{error}</Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry getting location"
          >
            <Text style={styles.secondaryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : locationReady ? (
        <View style={styles.locationReadyContent}>
          <View style={styles.locationSummaryCard}>
            <View style={styles.locationIconCircle}>
              <Ionicons name="location" size={23} color={reportColors.white} />
            </View>
            <View style={styles.locationSummaryCopy}>
              <Text style={styles.locationSummaryLabel}>Incident location</Text>
              <Text style={styles.locationSummaryValue} numberOfLines={2}>
                {address?.label ?? 'Location captured near Minglanilla'}
              </Text>
            </View>
            <Ionicons
              name="shield-checkmark"
              size={20}
              color={reportColors.primary}
            />
          </View>

          <View style={styles.accuracyRow}>
            <Ionicons name="locate-outline" size={18} color={reportColors.primary} />
            <Text style={styles.accuracyText}>
              {formatAccuracyLabel(accuracyMeters)}
            </Text>
          </View>

          {needsConfirmation ? (
            <View style={styles.locationWarning}>
              <Ionicons name="warning-outline" size={18} color={reportColors.accent} />
              <Text style={styles.locationWarningText}>
                GPS confidence is low. Check the incident pin before continuing.
              </Text>
            </View>
          ) : null}

          <Text style={styles.locationLimitText}>
            The incident pin may be moved up to {Math.round(maximumDistanceMeters)} m
            from the verified device location. Current adjustment:{' '}
            {Math.round(movedDistanceMeters)} m.
          </Text>

          <TouchableOpacity
            style={styles.adjustPinButton}
            onPress={onConfirmOnMap}
            accessibilityRole="button"
            accessibilityLabel="Adjust incident pin on map"
          >
            <Ionicons
              name="navigate-circle-outline"
              size={20}
              color={reportColors.primary}
            />
            <Text style={styles.adjustPinButtonText}>Adjust incident pin</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.locationErrorText}>{error}</Text> : null}

          {onContinue ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onContinue}
              accessibilityRole="button"
              accessibilityLabel="Confirm incident location"
            >
              <Text style={styles.primaryButtonText}>Confirm location</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View style={styles.locationCenter}>
          <PulsePin active={false} />
          <Text style={styles.locationHint}>Location is not available yet.</Text>
        </View>
      )}
    </View>
  );
}
