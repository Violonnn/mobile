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
import { useMayorAnalytics } from '../../hooks/useMayorAnalytics';
import { useReports } from '../../hooks/useReports';
import { formatIncidentType } from '../../lib/incidentTypes';
import {
  fetchMayorWatchlist,
  type MayorWatchlistReport,
  type MayorWatchlistSnapshot,
} from '../../lib/mayorAnalytics';
import { mayorReportStatusLabel } from '../../lib/mayorStatusLabels';
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

type QuickViewTone = 'primary' | 'blue' | 'slate' | 'mint';
type IoniconName = keyof typeof Ionicons.glyphMap;
type MayorBriefView = 'overview' | 'activity' | 'watchlist';

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
  onPress?: () => void;
}) {
  const iconColor = tone === 'mint' ? '#237768' : tone === 'slate' ? '#526078' : colors.navigationActive;
  const content = (
    <>
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
    </>
  );

  if (!onPress) {
    return (
      <View
        style={[styles.quickViewCard, showDivider && styles.quickViewCardDivider]}
        accessibilityLabel={label}
      >
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.quickViewCard, showDivider && styles.quickViewCardDivider]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${label}${subtitle ? `. ${subtitle}` : ''}${badge ? `. ${badge} need attention` : ''}`}
    >
      {content}
    </TouchableOpacity>
  );
}

function BriefBackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.briefBackButton}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Back to Brief"
    >
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </TouchableOpacity>
  );
}

function BriefActivityRow({
  report,
  barangayName,
  referenceTime,
  onPress,
}: {
  report: MapReportMarker;
  barangayName: string | null;
  referenceTime: number;
  onPress: () => void;
}) {
  const activityTime = report.latestActivityAt ?? report.created_at;

  return (
    <TouchableOpacity
      style={styles.briefActivityRow}
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`Open report ${report.title || 'untitled report'}`}
    >
      <View style={styles.briefActivityIcon}>
        <Ionicons name="document-text-outline" size={20} color={colors.primary} />
      </View>
      <View style={styles.briefActivityCopy}>
        <Text style={styles.briefActivityTitle} numberOfLines={2}>
          {report.title.trim() || incidentLabel(report)}
        </Text>
        <Text style={styles.briefActivityMeta} numberOfLines={1}>
          {mayorReportStatusLabel({ status: report.status, barangayName })}
        </Text>
        <Text style={styles.briefActivityTime}>
          {formatElapsedLabel(activityTime, referenceTime)} AGO
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function BriefWatchlistReportRow({
  report,
  detail,
  onPress,
}: {
  report: MayorWatchlistReport;
  detail: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.briefWatchlistReportRow}
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`Open report ${report.title || 'untitled report'}`}
    >
      <View style={styles.briefActivityIcon}>
        <Ionicons name="flag-outline" size={20} color={colors.primary} />
      </View>
      <View style={styles.briefActivityCopy}>
        <Text style={styles.briefActivityTitle} numberOfLines={2}>
          {report.title.trim() || 'Untitled report'}
        </Text>
        <Text style={styles.briefActivityMeta} numberOfLines={2}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
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
  const [briefView, setBriefView] = useState<MayorBriefView>('overview');
  const [activityBarangayId, setActivityBarangayId] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<MayorWatchlistSnapshot | null>(null);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistRefreshing, setWatchlistRefreshing] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const { reports: mapReports, error: mapError } = useReports({
    realtime: true,
    includePending: false,
    includeLatestActivity: true,
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
  const activeMapReportBarangayName = activeMapReport
    ? snapshot?.barangayTotals.find(
        (barangay) => barangay.barangayId === activeMapReport.barangay_id,
      )?.barangayName ?? null
    : null;
  const activeMapReportColor = activeMapReport
    ? getReportStatusPresentation(activeMapReport.status).color
    : colors.escalated;
  const activeMapFocus = activeMapReport
    ? {
        reportId: activeMapReport.id,
        latitude: activeMapReport.latitude,
        longitude: activeMapReport.longitude,
      }
    : null;

  const activityReports = useMemo(
    () => [...mapReports].sort((left, right) => {
      const leftActivity = new Date(left.latestActivityAt ?? left.created_at).getTime();
      const rightActivity = new Date(right.latestActivityAt ?? right.created_at).getTime();
      return rightActivity - leftActivity;
    }),
    [mapReports],
  );
  const visibleActivityReports = activityBarangayId
    ? activityReports.filter((report) => report.barangay_id === activityBarangayId)
    : activityReports;
  const activityBarangayName = activityBarangayId
    ? snapshot?.barangayTotals.find((barangay) => barangay.barangayId === activityBarangayId)?.barangayName ?? 'Selected barangay'
    : null;

  const loadWatchlist = useCallback(async () => {
    setWatchlistLoading(true);
    const result = await fetchMayorWatchlist();
    setWatchlist(result.snapshot);
    setWatchlistError(result.error);
    setWatchlistLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      if (mapUnlockTimer.current) clearTimeout(mapUnlockTimer.current);
    };
  }, []);

  useEffect(() => {
    const elapsedTimer = setInterval(() => setReferenceTime(Date.now()), 60_000);
    return () => clearInterval(elapsedTimer);
  }, []);

  useEffect(() => {
    if (briefView !== 'watchlist') return;

    // Defer the fetch so entering the Watchlist does not synchronously update state in this effect.
    const watchlistLoadTimer = setTimeout(() => void loadWatchlist(), 0);
    return () => clearTimeout(watchlistLoadTimer);
  }, [briefView, loadWatchlist, mapReports]);

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

  async function handleWatchlistRefresh() {
    setWatchlistRefreshing(true);
    await loadWatchlist();
    setWatchlistRefreshing(false);
  }

  function openActivity() {
    setActivityBarangayId(null);
    setBriefView('activity');
  }

  function openBarangayActivity(barangayId: string) {
    setActivityBarangayId(barangayId);
    setBriefView('activity');
  }

  function moveActiveMapReport(direction: -1 | 1) {
    if (activeMapReports.length < 2) return;
    setActiveMapReportIndex((currentIndex) => (
      (currentIndex + direction + activeMapReports.length) % activeMapReports.length
    ));
  }

  return (
    <>
      {briefView !== 'watchlist' ? (
        <View style={styles.briefStickyHeader}>
          <MdrrmoHeader title="Brief" showDefaultControls />
        </View>
      ) : null}
      {briefView === 'overview' ? (
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
            onPress={openActivity}
            accessibilityRole="button"
            accessibilityLabel={`View ${activeMapReports.length} active reports`}
          >
            <View style={[styles.mapReportBadgeDot, { backgroundColor: activeMapReportColor }]} />
            <Text style={[styles.mapReportBadgeText, { color: activeMapReportColor }]}>
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
                <View style={[commandStyles.activeIncidentCard, styles.briefIncidentCard]}>
                  <View style={commandStyles.activeIncidentTopRow}>
                    <View style={commandStyles.activeIncidentCopy}>
                      <Text
                        style={[
                          commandStyles.activeIncidentEyebrow,
                          { color: getReportStatusPresentation(activeMapReport.status).color },
                        ]}
                      >
                        {mayorReportStatusLabel({
                          status: activeMapReport.status,
                          barangayName: activeMapReportBarangayName,
                        }).toLocaleUpperCase()} - {formatElapsedLabel(activeMapReport.created_at, referenceTime)}
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
                    </TouchableOpacity>
                  </View>

                  <View style={[commandStyles.activeIncidentQuote, styles.briefIncidentQuote]}>
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
                    onPress={openActivity}
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
                    showDivider
                    onPress={openActivity}
                  />
                  <QuickViewCard
                    icon="flag-outline"
                    label="Watchlist"
                    tone="primary"
                    onPress={() => setBriefView('watchlist')}
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
                    onPress={openActivity}
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
                    onPress={openActivity}
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
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.briefDetailContent,
            briefView === 'watchlist' && styles.briefWatchlistContent,
            { paddingBottom: officialNavMetrics.barHeight + insets.bottom + 28 },
          ]}
          refreshControl={(
            <RefreshControl
              refreshing={briefView === 'watchlist' ? watchlistRefreshing : refreshing}
              onRefresh={briefView === 'watchlist' ? handleWatchlistRefresh : handleRefresh}
              tintColor={colors.primary}
              progressViewOffset={insets.top}
            />
          )}
          showsVerticalScrollIndicator={false}
        >
          {briefView === 'activity' ? (
            <BriefBackButton onPress={() => setBriefView('overview')} />
          ) : null}

          {briefView === 'activity' ? (
            <View style={styles.briefDetailSection}>
              <Text style={styles.briefDetailTitle}>Activity</Text>
              <Text style={styles.briefDetailSubtitle}>
                {activityBarangayName
                  ? `Recent updates from ${activityBarangayName}.`
                  : 'Recent updates across municipal reports.'}
              </Text>

              {mapError ? (
                <View style={styles.warningCard} accessibilityRole="alert">
                  <Ionicons name="cloud-offline-outline" size={19} color={colors.unverified} />
                  <Text style={styles.warningText}>Activity could not fully refresh. Pull down to try again.</Text>
                </View>
              ) : null}

              {visibleActivityReports.length === 0 ? (
                <View style={styles.briefEmptyState}>
                  <Ionicons name="time-outline" size={30} color={colors.textMuted} />
                  <Text style={styles.briefEmptyTitle}>No report activity yet</Text>
                  <Text style={styles.briefEmptyText}>New report updates will appear here.</Text>
                </View>
              ) : visibleActivityReports.map((report) => {
                const barangayName = snapshot?.barangayTotals.find(
                  (barangay) => barangay.barangayId === report.barangay_id,
                )?.barangayName ?? null;
                return (
                  <BriefActivityRow
                    key={report.id}
                    report={report}
                    barangayName={barangayName}
                    referenceTime={referenceTime}
                    onPress={() => router.push(`/official/${report.id}` as Href)}
                  />
                );
              })}
            </View>
          ) : (
            <View style={styles.briefDetailSection}>
              <View style={officialStyles.resourceDirectoryHeader}>
                <TouchableOpacity
                  style={officialStyles.resourceDirectoryBack}
                  onPress={() => setBriefView('overview')}
                  accessibilityRole="button"
                  accessibilityLabel="Back to Brief"
                >
                  <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={officialStyles.headerTextGroup}>
                  <Text style={officialStyles.resourceDirectoryOverline}>BRIEF</Text>
                  <Text style={officialStyles.screenTitle}>Watchlist</Text>
                  <Text style={officialStyles.screenSubtitle}>
                    Reports and backlogs that need a closer look.
                  </Text>
                </View>
              </View>

              {watchlistLoading && !watchlist ? (
                <View style={styles.briefEmptyState}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.briefEmptyText}>Checking municipal attention items...</Text>
                </View>
              ) : null}

              {!watchlistLoading && watchlistError ? (
                <View style={styles.briefEmptyState}>
                  <Text style={styles.briefEmptyTitle}>Watchlist unavailable</Text>
                  <Text style={styles.briefEmptyText}>{watchlistError}</Text>
                  <TouchableOpacity style={officialStyles.retryButton} onPress={() => void loadWatchlist()}>
                    <Text style={officialStyles.retryButtonText}>Try again</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {!watchlistError && watchlist ? (
                <>
                  <Text style={styles.briefWatchlistSectionTitle}>LONGEST-WAITING REVIEWS</Text>
                  {watchlist.longestWaitingBdrrmoReport ? (
                    <BriefWatchlistReportRow
                      report={watchlist.longestWaitingBdrrmoReport}
                      detail={`Awaiting barangay review for ${formatElapsedLabel(watchlist.longestWaitingBdrrmoReport.createdAt, referenceTime)}`}
                      onPress={() => router.push(`/official/${watchlist.longestWaitingBdrrmoReport!.id}` as Href)}
                    />
                  ) : <Text style={styles.briefWatchlistEmpty}>No report is awaiting barangay review.</Text>}
                  {watchlist.longestWaitingMdrrmoEscalation ? (
                    <BriefWatchlistReportRow
                      report={watchlist.longestWaitingMdrrmoEscalation}
                      detail={`Awaiting municipal review for ${formatElapsedLabel(watchlist.longestWaitingMdrrmoEscalation.escalatedAt ?? watchlist.longestWaitingMdrrmoEscalation.createdAt, referenceTime)}`}
                      onPress={() => router.push(`/official/${watchlist.longestWaitingMdrrmoEscalation!.id}` as Href)}
                    />
                  ) : <Text style={styles.briefWatchlistEmpty}>No report is awaiting municipal review.</Text>}

                  <Text style={styles.briefWatchlistSectionTitle}>LARGEST ACTIVE BACKLOG</Text>
                  {watchlist.largestActiveBacklog ? (
                    <TouchableOpacity
                      style={styles.briefBacklogRow}
                      onPress={() => openBarangayActivity(watchlist.largestActiveBacklog!.barangayId)}
                      activeOpacity={0.78}
                      accessibilityRole="button"
                      accessibilityLabel={`Open activity for ${watchlist.largestActiveBacklog.barangayName}`}
                    >
                      <Text style={styles.briefBacklogCount}>{watchlist.largestActiveBacklog.activeCount}</Text>
                      <View style={styles.briefActivityCopy}>
                        <Text style={styles.briefActivityTitle}>{watchlist.largestActiveBacklog.barangayName}</Text>
                        <Text style={styles.briefActivityMeta}>active reports across barangay and municipal review</Text>
                      </View>
                      <Ionicons name="arrow-forward" size={22} color={colors.primary} />
                    </TouchableOpacity>
                  ) : <Text style={styles.briefWatchlistEmpty}>No active barangay backlog.</Text>}

                  <Text style={styles.briefWatchlistSectionTitle}>
                    MISSING BARANGAY OR LOCATION {watchlist.missingContextCount ? `(${watchlist.missingContextCount})` : ''}
                  </Text>
                  {watchlist.missingContextReports.length > 0 ? watchlist.missingContextReports.map((report) => (
                    <BriefWatchlistReportRow
                      key={report.id}
                      report={report}
                      detail={`${report.barangayName === 'Unassigned' ? 'Barangay not assigned' : 'Location details missing'} - ${formatElapsedLabel(report.createdAt, referenceTime)} ago`}
                      onPress={() => router.push(`/official/${report.id}` as Href)}
                    />
                  )) : <Text style={styles.briefWatchlistEmpty}>All active reports have barangay and location details.</Text>}

                  <Text style={styles.briefWatchlistSectionTitle}>
                    NO RECENT STATUS ACTIVITY {watchlist.inactiveStatusCount ? `(${watchlist.inactiveStatusCount})` : ''}
                  </Text>
                  <Text style={styles.briefWatchlistHint}>Active reports with no status change in the last 24 hours.</Text>
                  {watchlist.inactiveStatusReports.length > 0 ? watchlist.inactiveStatusReports.map((report) => (
                    <BriefWatchlistReportRow
                      key={report.id}
                      report={report}
                      detail={`Last status activity ${formatElapsedLabel(report.latestStatusActivityAt ?? report.createdAt, referenceTime)} ago`}
                      onPress={() => router.push(`/official/${report.id}` as Href)}
                    />
                  )) : <Text style={styles.briefWatchlistEmpty}>Every active report has recent status activity.</Text>}
                </>
              ) : null}
            </View>
          )}
        </ScrollView>
      )}
    </>
  );
}
