import React from 'react';
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatIncidentType, type IncidentType } from '../../lib/incidentTypes';
import type { GpsPosition, ReadableAddress } from '../../lib/location';
import type { CapturedMedia } from '../../lib/reportMedia';
import {
  reportColors,
  reportStyles as styles,
} from '../../styles/screens/report.styles';
import { useAccessibilityLayout } from '../../hooks/useAccessibilityLayout';
import ReportMapPreview from './ReportMapPreview';

type Props = {
  address: ReadableAddress | null;
  position: GpsPosition | null;
  movedDistanceMeters: number;
  media: CapturedMedia[];
  incidentType: IncidentType | null;
  incidentTypeOther: string;
  title: string;
  description: string;
  locationNote: string;
  error: string | null;
  submitting: boolean;
  onEditLocation: () => void;
  onEditEvidence: () => void;
  onEditDetails: () => void;
  onSubmit: () => void;
};

function ReviewSection({
  icon,
  title,
  onEdit,
  children,
}: {
  icon: 'location' | 'images' | 'document-text';
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const { isLargeText } = useAccessibilityLayout();

  return (
    <View style={styles.reviewSection}>
      <View style={styles.reviewTimelineIcon}>
        <Ionicons name={icon} size={18} color={reportColors.white} />
      </View>
      <View style={styles.reviewSectionBody}>
        <View
          style={[
            styles.reviewSectionHeader,
            isLargeText && styles.reviewSectionHeaderLargeText,
          ]}
        >
          <Text style={styles.reviewSectionTitle}>{title}</Text>
          <TouchableOpacity
            style={styles.reviewEditButton}
            onPress={onEdit}
            accessibilityRole="button"
          >
            <Text style={styles.reviewEditText}>Edit</Text>
          </TouchableOpacity>
        </View>
        {children}
      </View>
    </View>
  );
}

export default function ReviewStep({
  address,
  position,
  movedDistanceMeters,
  media,
  incidentType,
  incidentTypeOther,
  title,
  description,
  locationNote,
  error,
  submitting,
  onEditLocation,
  onEditEvidence,
  onEditDetails,
  onSubmit,
}: Props) {
  const { isLargeText } = useAccessibilityLayout();

  return (
    <View style={styles.stepContent}>
      <Text style={styles.residentStepTitle}>Check it once,{`\n`}then send</Text>
      <Text style={styles.residentStepSubtitle}>
        You can still edit any section.
      </Text>

      <View style={styles.reviewTimeline}>
        <View style={styles.reviewTimelineLine} />
        <ReviewSection icon="location" title="Location" onEdit={onEditLocation}>
          <View
            style={[
              styles.reviewLocationRow,
              isLargeText && styles.reviewLocationRowLargeText,
            ]}
          >
            <View style={styles.reviewLocationCopy}>
              <Text style={styles.reviewPrimaryText}>
                {address?.barangay ?? 'Incident location'}
              </Text>
              <Text style={styles.reviewSecondaryText}>
                {address ? `${address.municipality}, Cebu` : 'Location captured'}
              </Text>
              <Text style={styles.reviewAdjustmentText}>
                Pin adjusted {Math.round(movedDistanceMeters)} m
              </Text>
            </View>
            {position ? (
              <ReportMapPreview position={position} compact />
            ) : (
              <View style={[styles.mapPreviewFallback, styles.mapPreviewCompact]}>
                <Ionicons name="map-outline" size={22} color={reportColors.primary} />
              </View>
            )}
          </View>
        </ReviewSection>

        <ReviewSection
          icon="images"
          title={`${media.length} evidence ${media.length === 1 ? 'file' : 'files'}`}
          onEdit={onEditEvidence}
        >
          <View style={styles.reviewMediaRow}>
            {media.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.reviewMediaThumb}>
                {item.type === 'photo' ? (
                  <Image source={{ uri: item.localUri }} style={styles.reviewMediaImage} />
                ) : (
                  <View style={styles.reviewVideoThumb}>
                    <Ionicons name="play-circle" size={34} color={reportColors.white} />
                    <Text style={styles.reviewVideoDuration}>
                      {(item.durationSeconds ?? 0).toFixed(0)}s
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </ReviewSection>

        <ReviewSection
          icon="document-text"
          title="Incident details"
          onEdit={onEditDetails}
        >
          <Text style={styles.reviewTypeText}>
            {formatIncidentType(incidentType, incidentTypeOther)}
          </Text>
          <Text style={styles.reviewPrimaryText}>{title}</Text>
          <Text style={styles.reviewSecondaryText}>{description}</Text>
          {locationNote.trim() ? (
            <Text style={styles.reviewSecondaryText}>{locationNote.trim()}</Text>
          ) : null}
        </ReviewSection>
      </View>

      <View style={styles.reviewAccuracyNotice}>
        <Ionicons name="hand-left" size={19} color={reportColors.primary} />
        <Text style={styles.reviewAccuracyText}>
          Details are accurate to the best of my knowledge.
        </Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[
          styles.primaryButton,
          styles.residentPrimaryButton,
          submitting && styles.primaryButtonDisabled,
        ]}
        onPress={onSubmit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel="Send report"
      >
        {submitting ? (
          <ActivityIndicator color={reportColors.white} />
        ) : (
          <Text style={styles.primaryButtonText}>Send report</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
