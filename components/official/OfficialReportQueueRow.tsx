import React, { useState } from 'react';
import { Image, Platform, Pressable, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { OfficialReportQueueItem } from '../../lib/officialReports';
import { formatPublishedAt } from '../../lib/formatTime';
import { formatIncidentType, incidentTypeTone } from '../../lib/incidentTypes';
import type { ScopedLifecycleAudience } from '../../lib/reportPresentation';
import { mdrrmoReportsStyles as styles } from '../../styles/screens/mdrrmoReports.styles';
import { colors } from '../../styles/theme';
import ReportStatusSummary from './ReportStatusSummary';

// React Native's native ViewStyle type excludes the CSS value used to remove
// only the browser's default focus ring; the custom ring below replaces it.
const webFocusResetStyle = Platform.OS === 'web'
  ? ({ outlineStyle: 'none' } as unknown as ViewStyle)
  : undefined;

type Props = {
  report: OfficialReportQueueItem;
  audience: Extract<ScopedLifecycleAudience, 'bdrrmo' | 'mitcom'>;
  locationFallback?: string | null;
  actionLabel: 'Review' | 'View';
  onPress: () => void;
  first?: boolean;
};

export default function OfficialReportQueueRow({
  report,
  audience,
  locationFallback,
  actionLabel,
  onPress,
  first = false,
}: Props) {
  const categoryTone = incidentTypeTone(report.incidentType);
  const title = report.title.trim() || 'Untitled report';
  const location = report.addressText || report.barangayName ||
    locationFallback || 'Location unavailable';
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.queueCard,
        first && styles.queueCardFirst,
        pressed && styles.queueCardPressed,
        webFocusResetStyle,
      ]}
      onPress={onPress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={`${actionLabel} report ${title}`}
    >
      <View style={styles.mediaFrame}>
        {report.firstPhotoUrl ? (
          <Image
            source={{ uri: report.firstPhotoUrl }}
            style={styles.media}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.mediaPlaceholder}>
            <Ionicons
              name="document-text-outline"
              size={24}
              color={colors.textMuted}
            />
            <Text style={styles.mediaPlaceholderText}>No photo</Text>
          </View>
        )}
      </View>

      <View style={styles.reportCopy}>
        <Text style={styles.reportTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.reportLocation} numberOfLines={1}>
          {location}
        </Text>
        <Text style={styles.timeText}>
          Received {formatPublishedAt(report.createdAt)}
        </Text>
        <ReportStatusSummary
          summary={report.lifecycle}
          context={{
            audience,
            barangayName: report.barangayName,
            leadOffice: report.lifecycleFacts.leadOffice,
            claimedByName: report.lifecycleFacts.reviewClaimedByName,
            claimedAt: report.lifecycleFacts.reviewClaimedAt,
          }}
          compact
        />
        <View style={styles.cardFooter}>
          <View style={styles.attachmentMeta}>
            <View style={styles.attachmentCount}>
              <Ionicons
                name="images-outline"
                size={16}
                color={colors.navigationActive}
              />
              <Text style={styles.attachmentCountText}>{report.mediaCount}</Text>
            </View>
            <View style={styles.attachmentDivider} />
            <View style={styles.categoryMeta}>
              <Ionicons
                name={categoryTone.icon}
                size={14}
                color={categoryTone.color}
              />
              <Text style={styles.incidentTypeText}>
                {formatIncidentType(report.incidentType, report.incidentTypeOther)}
              </Text>
            </View>
          </View>
          <View style={styles.reviewAction}>
            <Text style={styles.reviewActionText}>{actionLabel}</Text>
            <Ionicons
              name="chevron-forward"
              size={21}
              color={colors.navigationActive}
            />
          </View>
        </View>
      </View>
      {isFocused ? (
        <View pointerEvents="none" style={styles.queueCardFocusRing} />
      ) : null}
    </Pressable>
  );
}
