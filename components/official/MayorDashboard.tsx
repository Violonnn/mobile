// Mayor-only executive brief with live municipal summaries.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import InteractiveMap from '../map/InteractiveMap';
import MdrrmoHeader from './MdrrmoHeader';
import ReportStatusTimeline from '../report/ReportStatusTimeline';
import { useMayorAnalytics } from '../../hooks/useMayorAnalytics';
import { useReports } from '../../hooks/useReports';
import { formatIncidentType } from '../../lib/incidentTypes';
import { type MayorStatusFilter } from '../../lib/mayorAnalytics';
import type { EvacuationCenterRecord } from '../../lib/resources';
import { formatReportLocation, getReportStatusPresentation, type MapReportMarker } from '../../lib/reports';
import { officialNavMetrics } from '../../styles/components/officialBottomNav.styles';
import { mdrrmoCommandStyles as commandStyles } from '../../styles/screens/mdrrmoCommand.styles';
import { mayorBriefStyles as styles } from '../../styles/screens/mayorBrief.styles';
import { officialStyles } from '../../styles/screens/official.styles';
import { colors } from '../../styles/theme';

type MayorDashboardProps = {
  centers: EvacuationCenterRecord[];
  centersError: string | null;
  onRefreshCenters: () => Promise<void>;
};

type IoniconName = keyof typeof Ionicons.glyphMap;
type QuickViewTone = 'primary' | 'blue' | 'slate' | 'mint';

function formatBriefingTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Updated recently';

  return `Today, ${date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  })}`;
}

function formatElapsedLabel(value: string, referenceTime: number): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'NOW';

  const ageMinutes = Math.max(1, Math.floor((referenceTime - timestamp) / 60_000));
  if (ageMinutes < 60) return `${ageMinutes} MIN`;

  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 24) return `${ageHours} HR`;

  return `${Math.floor(ageHours / 24)} DAY`;
}

function formatTimelineTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return date
    .toLocaleTimeString('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(' ', '');
}

function reporterName(report: MapReportMarker): string {
  const fullName = [report.reporter.firstName, report.reporter.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return fullName || 'Resident';
}

function incidentLabel(report: MapReportMarker): string {
  if (!report.incidentType) return 'Report';
  if (report.incidentType === 'other') {
    return report.incidentTypeOther?.trim() || 'Other incident';
  }

  return formatIncidentType(report.incidentType);
}

function QuickViewCard({
  icon,
  iconFamily = 'ionicons',
  label,
  subtitle,
  tone,
  badge,
  showDivider,
  onPress,
}: {
  icon: IoniconName | keyof typeof MaterialCommunityIcons.glyphMap;
  iconFamily?: 'ionicons' | 'material-community';
  label: string;
  subtitle?: string;
  tone: QuickViewTone;
  badge?: number;
  showDivider?: boolean;
  onPress: () => void;
}) {
  const iconColor = tone === 'mint' ? '#237768' : tone === 'slate' ? '#526078' : colors.navigationActive;

  return (
    <TouchableOpacity
      style={[styles.quickViewCard, showDivider && styles.quickViewCardDivider]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${label}${subtitle ? `. ${subtitle}` : ''}${badge ? `. ${badge} need attention` : ''}`}
    >
      <View style={styles.quickViewIconWrap}>
        {iconFamily === 'material-community' ? (
          <MaterialCommunityIcons
            name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={23}
            color={iconColor}
          />
        ) : (
          <Ionicons name={icon as IoniconName} size={23} color={iconColor} />
        )}
        {badge ? (
          <View style={styles.quickViewBadge}>
            <Text style={styles.quickViewBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.quickViewLabel} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function MayorDashboard({
  centers,
  centersError,
  onRefreshCenters,
}: MayorDashboardProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const mapUnlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeMapReportIndex, setActiveMapReportIndex] = useState(0);
  const [referenceTime, setReferenceTime] = useState(() => Date.now());
  const { reports: mapReports, error: mapError } = useReports({
    realtime: true,
    includePending: false,
  });

  // Keep the dashboard totals municipal-wide while the hero filters control its map and count.
  const {
    snapshot,
    error,
    barangayError,
    loading,
    reload,
    refreshing,
    refresh,
  } = useMayorAnalytics({
    enabled: true,
    barangayId: 'all',
    status: 'all',
    activityRange: 'today',
  });

  // A barangay requires attention only when it has an unverified or escalated report.
  const affectedBarangayCount = snapshot?.barangayTotals.filter((barangay) => {
    return barangay.statusCounts.unverified > 0 || barangay.statusCounts.escalated > 0;
  }).length ?? 0;
  const openCenters = centers.filter((center) => center.status === 'open').length;
  const unverifiedCount = snapshot?.statusCounts.unverified ?? 0;
  const briefingCardWidth = Math.min(228, Math.max(188, width * 0.54));
  // Keep resolved reports out of the command-style map while every active report remains visible.
  const activeMapReports = useMemo(
    () => mapReports.filter((report) => report.status !== 'resolved'),
    [mapReports],
  );
  const maximumActiveMapReportIndex = Math.max(0, activeMapReports.length - 1);
  const safeActiveMapReportIndex = Math.min(activeMapReportIndex, maximumActiveMapReportIndex);
  const activeMapReport = activeMapReports[safeActiveMapReportIndex] ?? null;
  const activeMapFocus = activeMapReport
    ? {
        reportId: activeMapReport.id,
        latitude: activeMapReport.latitude,
        longitude: activeMapReport.longitude,
      }
    : null;

  useEffect(() => {
    return () => {
      if (mapUnlockTimer.current) clearTimeout(mapUnlockTimer.current);
    };
  }, []);

  useEffect(() => {
    const elapsedTimer = setInterval(() => setReferenceTime(Date.now()), 60_000);
    return () => clearInterval(elapsedTimer);
  }, []);

  const handleMapGestureActiveChange = useCallback((active: boolean) => {
    if (mapUnlockTimer.current) {
      clearTimeout(mapUnlockTimer.current);
      mapUnlockTimer.current = null;
    }

    // Native updates keep the Leaflet WebView mounted while its gesture is active.
    if (active) {
      scrollRef.current?.setNativeProps({ scrollEnabled: false });
      return;
    }

    mapUnlockTimer.current = setTimeout(() => {
      scrollRef.current?.setNativeProps({ scrollEnabled: true });
      mapUnlockTimer.current = null;
    }, 80);
  }, []);

  async function handleRefresh() {
    await Promise.all([refresh(), onRefreshCenters()]);
  }

  function openSituations(nextStatus: MayorStatusFilter = 'all') {
    const params = new URLSearchParams();
    if (nextStatus !== 'all') params.set('status', nextStatus);
    const query = params.toString();
    router.push(`/official/incidents${query ? `?${query}` : ''}` as Href);
  }

  function moveActiveMapReport(direction: -1 | 1) {
    if (activeMapReports.length < 2) return;
    setActiveMapReportIndex((currentIndex) => (
      (currentIndex + direction + activeMapReports.length) % activeMapReports.length
    ));
  }

  return (
    <>
      <View style={styles.briefStickyHeader}>
        <MdrrmoHeader title="Brief" showDefaultControls />
      </View>
      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        overScrollMode="never"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: officialNavMetrics.barHeight + insets.bottom + 28 },
        ]}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            progressViewOffset={insets.top}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mapHero}>
          {/* The Brief uses a visual map preview; report paging below controls its highlighted report. */}
          <View collapsable={false} pointerEvents="none" style={styles.mapFill}>
            <InteractiveMap
              markers={activeMapReports}
              facilities={[]}
              evacuationCenters={[]}
              showZoomControls={false}
              focusZoomLevel={15}
              stickyFocus
              focusTarget={activeMapFocus}
              highlightedReportId={activeMapReport?.id ?? null}
              onGestureActiveChange={handleMapGestureActiveChange}
              onReportSelection={(reportIds) => {
                const selectedIndex = activeMapReports.findIndex((report) => reportIds.includes(report.id));
                if (selectedIndex >= 0) setActiveMapReportIndex(selectedIndex);
              }}
            />
          </View>
          <TouchableOpacity
            style={styles.mapReportBadge}
            onPress={() => openSituations()}
            accessibilityRole="button"
            accessibilityLabel={`View ${activeMapReports.length} active reports`}
          >
            <View style={styles.mapReportBadgeDot} />
            <Text style={styles.mapReportBadgeText}>
              {activeMapReports.length} ACTIVE
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.text} />
          </TouchableOpacity>

          {activeMapReports.length > 0 ? (
            <View style={styles.mapPager}>
              <TouchableOpacity
                style={styles.mapPagerButton}
                onPress={() => moveActiveMapReport(-1)}
                disabled={activeMapReports.length < 2}
                accessibilityRole="button"
                accessibilityLabel="Previous active report"
              >
                <Ionicons name="chevron-back" size={17} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.mapPagerText}>
                {safeActiveMapReportIndex + 1} of {activeMapReports.length}
              </Text>
              <TouchableOpacity
                style={styles.mapPagerButton}
                onPress={() => moveActiveMapReport(1)}
                disabled={activeMapReports.length < 2}
                accessibilityRole="button"
                accessibilityLabel="Next active report"
              >
                <Ionicons name="chevron-forward" size={17} color={colors.text} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.dashboardBody}>
          {loading && !snapshot ? (
            <View style={[officialStyles.stateBox, styles.stateBox]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={officialStyles.stateBody}>Preparing the municipal brief...</Text>
            </View>
          ) : null}

          {!loading && !snapshot && error ? (
            <View style={[officialStyles.stateBox, styles.stateBox]}>
              <Text style={officialStyles.stateTitle}>Municipal figures are unavailable</Text>
              <Text style={officialStyles.stateBody}>{error}</Text>
              <TouchableOpacity style={officialStyles.retryButton} onPress={() => void reload()}>
                <Text style={officialStyles.retryButtonText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {snapshot ? (
            <>
              {error || barangayError || mapError || centersError ? (
                <View style={styles.warningCard} accessibilityRole="alert">
                  <Ionicons name="cloud-offline-outline" size={19} color={colors.unverified} />
                  <Text style={styles.warningText}>
                    Showing the latest available figures. Pull down to refresh.
                  </Text>
                </View>
              ) : null}

              {activeMapReport ? (
                <View style={commandStyles.activeIncidentCard}>
                  <View style={commandStyles.activeIncidentTopRow}>
                    <View style={commandStyles.activeIncidentCopy}>
                      <Text
                        style={[
                          commandStyles.activeIncidentEyebrow,
                          { color: getReportStatusPresentation(activeMapReport.status).color },
                        ]}
                      >
                        {getReportStatusPresentation(activeMapReport.status).label.toLocaleUpperCase()} - {formatElapsedLabel(activeMapReport.created_at, referenceTime)}
                      </Text>
                      <Text style={commandStyles.activeIncidentTitle} numberOfLines={2}>
                        {activeMapReport.title.trim() || incidentLabel(activeMapReport)}
                      </Text>
                      <Text style={commandStyles.activeIncidentMeta} numberOfLines={1}>
                        {incidentLabel(activeMapReport)} - {formatReportLocation(activeMapReport)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={commandStyles.openIncidentAction}
                      onPress={() => router.push(`/official/${activeMapReport.id}` as Href)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open highlighted report: ${activeMapReport.title || 'Untitled report'}`}
                    >
                      <View style={commandStyles.openIncidentCircle}>
                        <Ionicons name="arrow-forward" size={19} color={colors.white} />
                      </View>
                      <Text style={commandStyles.openIncidentLabel}>Open report</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={commandStyles.activeIncidentQuote}>
                    <View
                      style={[
                        commandStyles.activeIncidentQuoteAccent,
                        { backgroundColor: getReportStatusPresentation(activeMapReport.status).color },
                      ]}
                    />
                    <Text
                      style={[
                        commandStyles.activeIncidentQuoteMark,
                        { color: getReportStatusPresentation(activeMapReport.status).color },
                      ]}
                    >
                      &quot;
                    </Text>
                    <View style={commandStyles.activeIncidentQuoteCopy}>
                      <Text style={commandStyles.activeIncidentQuoteText}>
                        {activeMapReport.description.trim() || 'No additional report details were provided.'}
                      </Text>
                      <Text style={commandStyles.activeIncidentQuoteSource} numberOfLines={1}>
                        {reporterName(activeMapReport)} - {formatTimelineTime(activeMapReport.created_at)}
                      </Text>
                    </View>
                  </View>

                  <ReportStatusTimeline
                    status={activeMapReport.status}
                    barangayLabel="Barangay review"
                  />
                </View>
              ) : null}

              <View style={styles.dashboardSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Quick view</Text>
                </View>
                <View style={styles.quickViewRow}>
                  <QuickViewCard
                    icon="location-outline"
                    label="Reports"
                    subtitle="Manage submission"
                    tone="primary"
                    badge={unverifiedCount}
                    showDivider
                    onPress={() => openSituations('all')}
                  />
                  <QuickViewCard
                    icon="call-outline"
                    label="Hotlines"
                    tone="mint"
                    showDivider
                    onPress={() => router.push('/official/resources?tab=hotlines' as Href)}
                  />
                  <QuickViewCard
                    icon="business-outline"
                    label="Facilities"
                    tone="blue"
                    showDivider
                    onPress={() => router.push('/official/resources?tab=facilities' as Href)}
                  />
                  <QuickViewCard
                    icon="warehouse"
                    iconFamily="material-community"
                    label="Centers"
                    tone="slate"
                    showDivider
                    onPress={() => router.push('/official/resources?tab=centers' as Href)}
                  />
                  <QuickViewCard
                    icon="calendar-outline"
                    label="Activity"
                    tone="mint"
                    onPress={() => openSituations('all')}
                  />
                </View>
              </View>

              <View style={styles.dashboardSection}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleGroup}>
                    <Text style={styles.sectionTitle}>Briefings</Text>
                    <Text style={styles.sectionEyebrow}>OFFICIAL UPDATES AND REPORTS</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sectionLink}
                    onPress={() => openSituations('all')}
                    accessibilityRole="button"
                    accessibilityLabel="See all briefings"
                  >
                    <Text style={styles.sectionLinkText}>See all</Text>
                    <Ionicons name="arrow-forward" size={17} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.briefingRow}
                >
                  <TouchableOpacity
                    style={[styles.briefingCard, { width: briefingCardWidth }]}
                    onPress={() => openSituations('all')}
                    activeOpacity={0.84}
                    accessibilityRole="button"
                    accessibilityLabel="Open situation summary"
                  >
                    <ImageBackground
                      source={require('../../assets/images/municipal.png')}
                      style={styles.briefingImage}
                      imageStyle={styles.briefingImageStyle}
                    >
                      <LinearGradient
                        colors={['rgba(8, 24, 38, 0.02)', 'rgba(8, 24, 38, 0.84)']}
                        style={styles.briefingShade}
                      />
                      <View style={styles.briefingContent}>
                        <View>
                          <Text style={styles.briefingTitle}>Situation summary</Text>
                          <Text style={styles.briefingSubtitle}>{formatBriefingTime(snapshot.fetchedAt)}</Text>
                        </View>
                        <View style={styles.briefingArrow}>
                          <Ionicons name="chevron-forward" size={16} color={colors.white} />
                        </View>
                      </View>
                    </ImageBackground>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.briefingCard, { width: briefingCardWidth }]}
                    onPress={() => router.push('/official/map' as Href)}
                    activeOpacity={0.84}
                    accessibilityRole="button"
                    accessibilityLabel={`${affectedBarangayCount} barangays have unverified or escalated reports. Open affected areas.`}
                  >
                    <ImageBackground
                      source={require('../../assets/images/noActiveBackground.png')}
                      style={styles.briefingImage}
                      imageStyle={styles.briefingImageStyle}
                    />
                    <LinearGradient
                      colors={['rgba(8, 24, 38, 0)', 'rgba(8, 24, 38, 0.78)']}
                      style={styles.briefingShade}
                      pointerEvents="none"
                    />
                    <View style={styles.affectedCountBadge}>
                      <Text style={styles.affectedCountText}>{affectedBarangayCount.toLocaleString()}</Text>
                    </View>
                    <View style={styles.briefingContent} pointerEvents="none">
                      <View>
                        <Text style={styles.briefingTitle}>Affected areas</Text>
                      </View>
                      <View style={styles.briefingArrow}>
                        <Ionicons name="chevron-forward" size={16} color={colors.white} />
                      </View>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.briefingCard, { width: briefingCardWidth }]}
                    onPress={() => router.push('/official/map' as Href)}
                    activeOpacity={0.84}
                    accessibilityRole="button"
                    accessibilityLabel={`Evacuation centers. ${openCenters} currently open.`}
                  >
                    <ImageBackground
                      source={require('../../assets/images/municipal.png')}
                      style={styles.briefingImage}
                      imageStyle={styles.briefingImageStyle}
                    >
                      <LinearGradient
                        colors={['rgba(8, 24, 38, 0.08)', 'rgba(8, 24, 38, 0.86)']}
                        style={styles.briefingShade}
                      />
                      <View style={styles.briefingContent}>
                        <View>
                          <Text style={styles.briefingTitle}>Evacuation centers</Text>
                        </View>
                        <View style={styles.briefingArrow}>
                          <Ionicons name="chevron-forward" size={16} color={colors.white} />
                        </View>
                      </View>
                    </ImageBackground>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

    </>
  );
}
