// Home-map preview for nearby reports. It uses the same Leaflet component as
// the Map tab so the visible markers always come from the shared report query.
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeStyles as styles } from '../../styles/screens/home.styles';
import { colors } from '../../styles/theme';
import InteractiveMap from '../map/InteractiveMap';
import type { ResidentMapTheme } from '../../lib/mapPreferences';
import type { MapReportMarker } from '../../lib/reports';

function formatReportStatus(status: string, isPending = false): string {
  if (isPending) return 'PENDING UPLOAD';

  switch (status.toLocaleLowerCase()) {
    case 'verified':
      return 'VERIFIED';
    case 'resolved':
      return 'RESOLVED';
    case 'escalated':
      return 'ESCALATED';
    default:
      return 'UNDER REVIEW';
  }
}

function getReportStatusColor(
  status: string,
  tone: ResidentMapTheme,
  isPending = false,
): string {
  if (isPending) return tone === 'dark' ? colors.themeSoft : colors.text;

  if (tone === 'light') {
    switch (status.toLocaleLowerCase()) {
      case 'verified':
        return '#166B52';
      case 'resolved':
        return '#2F6B46';
      case 'escalated':
        return '#B9382F';
      default:
        return '#805900';
    }
  }

  switch (status.toLocaleLowerCase()) {
    case 'verified':
      return '#5FE0B7';
    case 'resolved':
      return '#8DDBAA';
    case 'escalated':
      return '#FF6B61';
    default:
      return '#FFD166';
  }
}

export default function HomeMapPreview({
  reports,
  focusedReport,
  tone,
  loading,
  error,
  onFocusReport,
  onOpenReport,
}: {
  reports: MapReportMarker[];
  focusedReport: MapReportMarker | null;
  tone: ResidentMapTheme;
  loading: boolean;
  error: string | null;
  onFocusReport: (reportId: string) => void;
  onOpenReport: (reportId: string) => void;
}) {
  const focusTarget = focusedReport
    ? {
        reportId: focusedReport.id,
        latitude: focusedReport.latitude,
        longitude: focusedReport.longitude,
      }
    : null;
  const focusedReportIndex = focusedReport
    ? reports.findIndex((report) => report.id === focusedReport.id)
    : -1;
  const firstPhoto = focusedReport?.media.find((attachment) => attachment.type === 'photo');
  const reportStatusColor = focusedReport
    ? getReportStatusColor(focusedReport.status, tone, focusedReport.isPending)
    : '#FFD166';
  const isDarkMap = tone === 'dark';
  const primaryTextColor = isDarkMap ? colors.primaryLight : colors.navigationActive;
  const secondaryTextColor = isDarkMap ? colors.themeSoft : colors.text;
  const actionColor = isDarkMap ? colors.themeSoft : colors.primary;
  const textShadowColor = isDarkMap
    ? 'rgba(7, 24, 42, 0.96)'
    : 'rgba(255, 255, 255, 0.98)';
  const contrastingTextStyle = {
    textShadowColor,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  };

  function move(direction: -1 | 1) {
    if (reports.length < 2) return;

    const currentIndex = focusedReportIndex >= 0 ? focusedReportIndex : 0;
    const nextIndex = (currentIndex + direction + reports.length) % reports.length;
    onFocusReport(reports[nextIndex].id);
  }

  return (
    <View style={styles.nearbyMap}>
      <View style={styles.nearbyMapCanvas} pointerEvents="none">
        <InteractiveMap
          markers={reports}
          focusTarget={focusTarget}
          focusZoomLevel={14}
          showReportDetailsPopup={false}
          showMapDetails={false}
          tone={tone}
          pulseReportClusters
          showZoomControls={false}
        />
      </View>

      {loading ? (
        <View style={styles.nearbyMapEmptyContent} pointerEvents="none">
          <Text
            style={[
              styles.nearbyMapEmptyTitle,
              contrastingTextStyle,
              { color: primaryTextColor },
            ]}
          >
            Finding reports near you
          </Text>
          <Text
            style={[
              styles.nearbyMapEmptyText,
              contrastingTextStyle,
              { color: secondaryTextColor },
            ]}
          >
            Loading reports in your barangay...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.nearbyMapEmptyContent} pointerEvents="none">
          <Text
            style={[
              styles.nearbyMapEmptyTitle,
              contrastingTextStyle,
              { color: primaryTextColor },
            ]}
          >
            Reports unavailable
          </Text>
          <Text
            style={[
              styles.nearbyMapEmptyText,
              contrastingTextStyle,
              { color: secondaryTextColor },
            ]}
          >
            {error}
          </Text>
        </View>
      ) : !focusedReport ? (
        <View style={styles.nearbyMapEmptyContent} pointerEvents="none">
          <Text
            style={[
              styles.nearbyMapEmptyTitle,
              contrastingTextStyle,
              { color: primaryTextColor },
            ]}
          >
            No nearby reports
          </Text>
          <Text
            style={[
              styles.nearbyMapEmptyText,
              contrastingTextStyle,
              { color: secondaryTextColor },
            ]}
          >
            Reports submitted in your barangay will appear here.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.nearbyMapReportContent} pointerEvents="none">
            <View style={styles.nearbyMapCountRow}>
              <View style={[styles.nearbyMapStatusDot, { backgroundColor: reportStatusColor }]} />
              <Text
                style={[
                  styles.nearbyMapCount,
                  contrastingTextStyle,
                  { color: reportStatusColor },
                ]}
              >
                {reports.length} nearby report{reports.length === 1 ? '' : 's'}
              </Text>
            </View>

            <View style={styles.nearbyMapReportMeta}>
              <Text
                style={[
                  styles.nearbyMapReportStatus,
                  contrastingTextStyle,
                  { color: reportStatusColor },
                ]}
              >
                {formatReportStatus(focusedReport.status, focusedReport.isPending)}
              </Text>
              <Text
                style={[
                  styles.nearbyMapReportAddress,
                  contrastingTextStyle,
                  { color: secondaryTextColor },
                ]}
                numberOfLines={2}
              >
                {focusedReport.addressText || 'Your barangay'}
              </Text>
            </View>

            <Text
              style={[
                styles.nearbyMapReportTitle,
                contrastingTextStyle,
                { color: primaryTextColor },
              ]}
              numberOfLines={3}
            >
              {focusedReport.title || 'Resident report'}
            </Text>

            <View>
              <View style={styles.nearbyMapMediaThumb}>
                {firstPhoto ? (
                  <Image
                    source={{ uri: firstPhoto.url }}
                    style={styles.nearbyMapMediaImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.nearbyMapMediaPlaceholder}>
                    <Ionicons name="document-text-outline" size={27} color={colors.themeSoft} />
                  </View>
                )}
                {focusedReport.media.length > 1 ? (
                  <View style={styles.nearbyMapMediaBadge}>
                    <Text
                      style={[styles.nearbyMapMediaBadgeText, { color: colors.primaryLight }]}
                    >
                      +{focusedReport.media.length - 1}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.nearbyMapMediaCaption,
                  contrastingTextStyle,
                  { color: secondaryTextColor },
                ]}
              >
                {focusedReport.media.length} media
              </Text>
            </View>
          </View>

          <View style={styles.nearbyMapBottom} pointerEvents="box-none">
            <View style={styles.nearbyMapActions}>
              <TouchableOpacity
                style={styles.nearbyMapOpenAction}
                activeOpacity={0.72}
                onPress={() => onOpenReport(focusedReport.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${focusedReport.title || 'nearby report'}`}
              >
                <Text
                  style={[
                    styles.nearbyMapOpenActionText,
                    contrastingTextStyle,
                    { color: actionColor },
                  ]}
                >
                  Open report
                </Text>
                <Ionicons name="arrow-forward" size={21} color={actionColor} />
              </TouchableOpacity>

              {reports.length > 1 ? (
                <View style={styles.nearbyMapPager}>
                  <TouchableOpacity
                    style={styles.nearbyMapPagerButton}
                    onPress={() => move(-1)}
                    accessibilityLabel="Previous nearby report"
                  >
                    <Ionicons name="chevron-back" size={18} color={primaryTextColor} />
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.nearbyMapPagerText,
                      contrastingTextStyle,
                      { color: primaryTextColor },
                    ]}
                  >
                    {focusedReportIndex + 1} / {reports.length}
                  </Text>
                  <TouchableOpacity
                    style={styles.nearbyMapPagerButton}
                    onPress={() => move(1)}
                    accessibilityLabel="Next nearby report"
                  >
                    <Ionicons name="chevron-forward" size={18} color={primaryTextColor} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>
        </>
      )}
    </View>
  );
}
