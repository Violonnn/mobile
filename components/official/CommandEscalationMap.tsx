import React, { useMemo, useState } from 'react';
import { Image, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import InteractiveMap from '../map/InteractiveMap';
import type { OfficialReportQueueItem } from '../../lib/officialReports';
import type { MapReportMarker } from '../../lib/reports';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';

function formatEscalationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function asMapMarker(report: OfficialReportQueueItem): MapReportMarker | null {
  if (report.latitude == null || report.longitude == null) return null;
  return {
    id: report.id,
    title: report.title,
    description: report.description,
    status: report.status,
    latitude: report.latitude,
    longitude: report.longitude,
    addressText: report.addressText,
    barangay_id: report.barangayId,
    created_at: report.createdAt,
    reporter: report.reporter,
    media: report.media,
    mediaError: report.mediaError,
    upvoteCount: report.upvoteCount,
    commentCount: report.commentCount,
  };
}

export default function CommandEscalationMap({
  reports,
  onGestureActiveChange,
}: {
  reports: OfficialReportQueueItem[];
  onGestureActiveChange?: (active: boolean) => void;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const escalations = useMemo(
    () => reports.filter((report) => report.status === 'escalated'),
    [reports],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const maximumActiveIndex = Math.max(0, escalations.length - 1);

  if (activeIndex > maximumActiveIndex) {
    setActiveIndex(maximumActiveIndex);
  }

  const activeReport = escalations[Math.min(activeIndex, maximumActiveIndex)] ?? null;
  const markers = useMemo(
    () => escalations.map(asMapMarker).filter((marker): marker is MapReportMarker => marker !== null),
    [escalations],
  );
  const heroHeight = Math.min(540, Math.max(410, width * 1.2));
  const focusTarget = (() => {
    if (activeReport == null || activeReport.latitude == null || activeReport.longitude == null) {
      return null;
    }
    return {
      reportId: activeReport.id,
      latitude: activeReport.latitude,
      longitude: activeReport.longitude,
    };
  })();

  function move(direction: -1 | 1) {
    if (escalations.length < 2) return;
    setActiveIndex((current) => (current + direction + escalations.length) % escalations.length);
  }

  return (
    <View style={[styles.mapHero, { height: heroHeight }]}>
      <View
        collapsable={false}
        style={[styles.mapFill, !activeReport && styles.emptyMap]}
      >
        <InteractiveMap
          markers={markers}
          facilities={[]}
          evacuationCenters={[]}
          showZoomControls={false}
          tone="dark"
          stickyFocus
          onGestureActiveChange={onGestureActiveChange}
          focusTarget={focusTarget}
          onReportSelection={(ids) => {
            const selectedIndex = escalations.findIndex((report) => ids.includes(report.id));
            if (selectedIndex >= 0) setActiveIndex(selectedIndex);
          }}
        />
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(4,17,31,0.88)', 'rgba(4,17,31,0.2)', 'rgba(4,17,31,0.82)']}
        locations={[0, 0.53, 1]}
        style={styles.mapScrim}
      />

      {!activeReport ? (
        <View style={styles.emptyMapContent} pointerEvents="none">
          <Text style={styles.escalationTitle}>No active escalations</Text>
          <Text style={styles.emptyHeroText}>
            Escalated reports will appear here with their verified map location.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.escalationTop} pointerEvents="none">
            <View style={styles.escalationMeta}>
              <View style={styles.escalationCountRow}>
                <View style={styles.alertDot} />
                <Text style={styles.escalationCount}>
                  {escalations.length} active escalation{escalations.length === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={styles.escalationStatus}>
                ESCALATED <Text style={styles.escalationBarangay}>· {activeReport.barangayName || 'Minglanilla'}</Text>
              </Text>
              <Text style={styles.escalationDate}>
                {formatEscalationDate(activeReport.escalatedAt || activeReport.createdAt)}
              </Text>
            </View>
            <Text style={styles.escalationTitle} numberOfLines={3}>{activeReport.title || 'Untitled incident'}</Text>
            <View>
              <View style={styles.mediaThumb}>
                {activeReport.firstPhotoUrl ? (
                  <Image source={{ uri: activeReport.firstPhotoUrl }} style={styles.mediaImage} resizeMode="cover" />
                ) : (
                  <View style={styles.mediaPlaceholder}>
                    <Ionicons name="image-outline" size={26} color="#B6C1D0" />
                  </View>
                )}
                {activeReport.mediaCount > 1 ? (
                  <View style={styles.mediaBadge}>
                    <Text style={styles.mediaBadgeText}>+{activeReport.mediaCount - 1}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.mediaCaption}>{activeReport.mediaCount} media</Text>
            </View>
          </View>

          <View style={styles.heroBottom} pointerEvents="box-none">
            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.incidentLink}
                onPress={() => router.push(`/official/${activeReport.id}` as Href)}
              >
                <Text style={styles.incidentLinkText}>Open incident</Text>
                <Ionicons name="arrow-forward" size={21} color="#4D91FF" />
              </TouchableOpacity>

              {escalations.length > 1 ? (
                <View style={styles.pager}>
                  <TouchableOpacity style={styles.pagerButton} onPress={() => move(-1)} accessibilityLabel="Previous escalation">
                    <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text style={styles.pagerText}>{activeIndex + 1} / {escalations.length}</Text>
                  <TouchableOpacity style={styles.pagerButton} onPress={() => move(1)} accessibilityLabel="Next escalation">
                    <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
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
