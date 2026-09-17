// Mayor-only executive brief with live municipal summaries.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import InteractiveMap from '../map/InteractiveMap';
import MdrrmoHeader from './MdrrmoHeader';
import { useMayorAnalytics } from '../../hooks/useMayorAnalytics';
import { useReports } from '../../hooks/useReports';
import {
  reduceMayorActivityTotals,
  type MayorBarangayFilter,
  type MayorStatusFilter,
} from '../../lib/mayorAnalytics';
import type { EvacuationCenterRecord } from '../../lib/resources';
import { officialNavMetrics } from '../../styles/components/officialBottomNav.styles';
import { mayorBriefStyles as styles } from '../../styles/screens/mayorBrief.styles';
import { colors } from '../../styles/theme';

type MayorDashboardProps = {
  centers: EvacuationCenterRecord[];
  centersError: string | null;
  onRefreshCenters: () => Promise<void>;
};

type IoniconName = keyof typeof Ionicons.glyphMap;
type QuickViewTone = 'primary' | 'blue' | 'slate' | 'mint';

const STATUS_OPTIONS: { value: MayorStatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'unverified', label: 'Unverified' },
  { value: 'verified', label: 'Verified' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
];

function statusLabel(value: MayorStatusFilter): string {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label ?? 'All statuses';
}

function formatUpdatedTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Updated just now';

  return `Updated ${date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  })}`;
}

function formatBriefingTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Updated recently';

  return `Today, ${date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  })}`;
}

function QuickViewCard({
  icon,
  label,
  subtitle,
  tone,
  badge,
  onPress,
}: {
  icon: IoniconName;
  label: string;
  subtitle?: string;
  tone: QuickViewTone;
  badge?: number;
  onPress: () => void;
}) {
  const isPrimary = tone === 'primary';
  const cardToneStyle = tone === 'primary'
    ? styles.quickViewCardPrimary
    : tone === 'blue'
      ? styles.quickViewCardBlue
      : tone === 'mint'
        ? styles.quickViewCardMint
        : styles.quickViewCardSlate;
  const iconColor = isPrimary ? colors.white : tone === 'mint' ? '#237768' : '#284D74';

  return (
    <TouchableOpacity
      style={[styles.quickViewCard, cardToneStyle, isPrimary && styles.quickViewCardWide]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${label}${subtitle ? `. ${subtitle}` : ''}${badge ? `. ${badge} need attention` : ''}`}
    >
      <View style={styles.quickViewTopRow}>
        <View style={styles.quickViewIconWrap}>
          <Ionicons name={icon} size={24} color={iconColor} />
          {badge ? (
            <View style={styles.quickViewBadge}>
              <Text style={styles.quickViewBadgeText}>{badge > 99 ? '99+' : badge}</Text>
            </View>
          ) : null}
        </View>
        <Ionicons
          name="chevron-forward"
          size={15}
          color={isPrimary ? colors.white : '#49677D'}
          style={styles.quickViewChevron}
        />
      </View>
      <Text
        style={[styles.quickViewLabel, isPrimary && styles.quickViewTextLight]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {subtitle ? (
        <Text
          style={[styles.quickViewSubtitle, isPrimary && styles.quickViewSubtitleLight]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      ) : null}
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
  const { height, width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const mapUnlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [barangayId, setBarangayId] = useState<MayorBarangayFilter>('all');
  const [status, setStatus] = useState<MayorStatusFilter>('all');
  const [scopeVisible, setScopeVisible] = useState(false);
  const { reports: mapReports, error: mapError } = useReports({
    realtime: true,
    includePending: false,
  });

  // Keep the dashboard totals municipal-wide while the hero filters control its map and count.
  const {
    snapshot,
    barangays,
    error,
    barangayError,
    activityError,
    recentActivitySeries,
    loading,
    refreshing,
    reload,
    refresh,
  } = useMayorAnalytics({
    enabled: true,
    barangayId: 'all',
    status: 'all',
    activityRange: 'today',
  });

  const selectedBarangayName = barangayId === 'all'
    ? 'All barangays'
    : barangays.find((barangay) => barangay.id === barangayId)?.name ?? 'All barangays';
  const selectedBarangayTotal = barangayId === 'all'
    ? null
    : snapshot?.barangayTotals.find((barangay) => barangay.barangayId === barangayId) ?? null;
  const municipalReportTotal = !snapshot
    ? 0
    : selectedBarangayTotal
      ? status === 'all'
        ? selectedBarangayTotal.total
        : selectedBarangayTotal.statusCounts[status]
      : status === 'all'
        ? snapshot.matchingTotal
        : snapshot.statusCounts[status];
  const municipalBarangayCount = !snapshot
    ? 0
    : barangayId !== 'all'
      ? municipalReportTotal > 0 ? 1 : 0
      : snapshot.barangayTotals.filter((barangay) => {
          return status === 'all' ? barangay.total > 0 : barangay.statusCounts[status] > 0;
        }).length;
  // A barangay requires attention only when it has an unverified or escalated report.
  const affectedBarangayCount = snapshot?.barangayTotals.filter((barangay) => {
    return barangay.statusCounts.unverified > 0 || barangay.statusCounts.escalated > 0;
  }).length ?? 0;
  const activityTotal = reduceMayorActivityTotals(recentActivitySeries).reduce(
    (total, point) => total + point.count,
    0,
  );
  const openCenters = centers.filter((center) => center.status === 'open').length;
  const unverifiedCount = snapshot?.statusCounts.unverified ?? 0;
  const briefingCardWidth = Math.min(228, Math.max(188, width * 0.54));
  const mapHeroHeight = Math.min(420, Math.max(380, Math.min(width * 1.04, height * 0.49)));
  const mapFrameTop = insets.top + 146;

  const visibleMapReports = useMemo(() => {
    return mapReports.filter((report) => {
      if (barangayId !== 'all' && report.barangay_id !== barangayId) return false;
      if (status !== 'all' && report.status !== status) return false;
      return true;
    });
  }, [barangayId, mapReports, status]);

  useEffect(() => {
    return () => {
      if (mapUnlockTimer.current) clearTimeout(mapUnlockTimer.current);
    };
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

  function openSituations(
    nextStatus: MayorStatusFilter = status,
    nextBarangayId: MayorBarangayFilter = barangayId,
  ) {
    const params = new URLSearchParams();
    if (nextStatus !== 'all') params.set('status', nextStatus);
    if (nextBarangayId !== 'all') params.set('barangayId', nextBarangayId);
    const query = params.toString();
    router.push(`/official/incidents${query ? `?${query}` : ''}` as Href);
  }

  const activityTitle = activityError
    ? 'Recent activity is unavailable'
    : activityTotal === 0
      ? 'No new reports today'
      : `${activityTotal.toLocaleString()} new report${activityTotal === 1 ? '' : 's'} today`;
  const activitySubtitle = activityError
    ? 'Pull down to try again.'
    : activityTotal === 0
      ? 'All clear for now.'
      : 'Review today\'s latest activity.';

  return (
    <>
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
            tintColor={colors.white}
            progressViewOffset={insets.top}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.mapHero, { height: mapHeroHeight }]}>
          <View collapsable={false} style={styles.heroMapFill}>
            <InteractiveMap
              markers={visibleMapReports}
              showZoomControls={false}
              showMapDetails
              tone="dark"
              unblurredViewportFrame={{
                top: mapFrameTop,
                right: 16,
                bottom: 14,
                left: 16,
                borderRadius: 17,
              }}
              onGestureActiveChange={handleMapGestureActiveChange}
              layerVisibility={{ reports: true, facilities: false, evacuationCenters: false }}
            />
          </View>
          <LinearGradient
            colors={[
              'rgba(3, 20, 39, 0.58)',
              'rgba(4, 30, 54, 0.32)',
              'rgba(4, 34, 61, 0.12)',
              'rgba(4, 34, 61, 0)',
            ]}
            locations={[0, 0.38, 0.72, 1]}
            style={[styles.heroTopBlueFade, { height: mapFrameTop + 32 }]}
            pointerEvents="none"
          />
          <View
            style={[styles.heroContent, { paddingTop: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            <MdrrmoHeader title="Brief" variant="mayorHero" />

            <TouchableOpacity
              style={styles.heroScopeCard}
              onPress={() => setScopeVisible(true)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={`Filter municipal situation. ${selectedBarangayName}, ${statusLabel(status)}`}
            >
              <View style={styles.scopeSegment}>
                <Ionicons name="location-outline" size={20} color={colors.white} />
                <Text style={styles.scopeValue} numberOfLines={1}>{selectedBarangayName}</Text>
                <Ionicons name="chevron-down" size={17} color={colors.white} />
              </View>
              <View style={styles.scopeDivider} />
              <View style={styles.scopeSegment}>
                <Ionicons name="layers-outline" size={19} color={colors.white} />
                <Text style={styles.scopeValue} numberOfLines={1}>{statusLabel(status)}</Text>
                <Ionicons name="chevron-down" size={17} color={colors.white} />
              </View>
            </TouchableOpacity>

            <View style={styles.mapFrame} pointerEvents="box-none">
              <View style={styles.heroSituation} pointerEvents="box-none">
                {loading && !snapshot ? (
                  <View style={styles.heroLoadingRow}>
                    <ActivityIndicator color={colors.white} />
                    <Text style={styles.heroLoadingText}>Preparing the municipal brief...</Text>
                  </View>
                ) : null}

                {!loading && !snapshot && error ? (
                  <View style={styles.heroError}>
                    <Text style={styles.heroLoadingText}>Municipal figures are unavailable</Text>
                    <TouchableOpacity onPress={() => void reload()} accessibilityRole="button">
                      <Text style={styles.heroRetryText}>Try again</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {snapshot ? (
                  <>
                    <View style={styles.situationHeadingRow}>
                      <View style={styles.situationAccent} />
                      <Text style={styles.situationLabel}>Municipal situation</Text>
                    </View>
                    <Text style={styles.situationCount}>{municipalReportTotal.toLocaleString()}</Text>
                    <Text style={styles.situationCaption}>active reports</Text>
                    <View style={styles.barangayPill}>
                      <Ionicons name="location" size={14} color={colors.white} />
                      <Text style={styles.barangayPillText}>
                        {municipalBarangayCount.toLocaleString()} barangay{municipalBarangayCount === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <View style={styles.situationFooter}>
                      <View style={styles.updatedRow}>
                        <Ionicons name="time-outline" size={15} color="rgba(255,255,255,0.86)" />
                        <Text style={styles.situationUpdated}>{formatUpdatedTime(snapshot.fetchedAt)}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.situationButton}
                        onPress={() => openSituations()}
                        activeOpacity={0.84}
                        accessibilityRole="button"
                        accessibilityLabel="View municipal situation"
                      >
                        <Text style={styles.situationButtonText}>View situation</Text>
                        <Ionicons name="arrow-forward" size={18} color={colors.white} />
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.dashboardBody}>
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

              <View style={styles.verificationBanner}>
                <View style={styles.verificationCountCircle}>
                  <Text style={styles.verificationCount}>{unverifiedCount.toLocaleString()}</Text>
                </View>
                <View style={styles.verificationDivider} />
                <View style={styles.verificationCopy}>
                  <Text style={styles.verificationTitle}>Reports need verification</Text>
                  <Text style={styles.verificationSubtitle} numberOfLines={2}>
                    Resident submissions awaiting review
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.verificationButton}
                  onPress={() => openSituations('unverified', 'all')}
                  activeOpacity={0.84}
                  accessibilityRole="button"
                  accessibilityLabel={`Review ${unverifiedCount} unverified reports`}
                >
                  <Text style={styles.verificationButtonText}>Review</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.activityCard}
                onPress={() => openSituations('all', 'all')}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel={`${activityTitle}. View activity.`}
              >
                <View style={styles.activityIconWrap}>
                  <Ionicons
                    name={activityTotal === 0 ? 'checkmark' : 'stats-chart'}
                    size={19}
                    color={colors.white}
                  />
                </View>
                <View style={styles.activityCopy}>
                  <Text style={styles.activityTitle} numberOfLines={1}>{activityTitle}</Text>
                  {activityTotal > 0 || activityError ? (
                    <Text style={styles.activitySubtitle} numberOfLines={1}>{activitySubtitle}</Text>
                  ) : null}
                </View>
                <View style={styles.activityLinkRow}>
                  <Text style={styles.linkText}>View activity</Text>
                  <Ionicons name="arrow-forward" size={17} color={colors.primary} />
                </View>
              </TouchableOpacity>

              <View style={styles.dashboardSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Quick view</Text>
                </View>
                <View style={styles.quickViewRow}>
                  <QuickViewCard
                    icon="document-text-outline"
                    label="Reports"
                    subtitle="Manage submission"
                    tone="primary"
                    badge={unverifiedCount}
                    onPress={() => openSituations('all', 'all')}
                  />
                  <QuickViewCard
                    icon="location-outline"
                    label="Areas"
                    tone="blue"
                    onPress={() => router.push('/official/map' as Href)}
                  />
                  <QuickViewCard
                    icon="business-outline"
                    label="Centers"
                    tone="slate"
                    onPress={() => router.push('/official/map' as Href)}
                  />
                  <QuickViewCard
                    icon="calendar-outline"
                    label="Activity"
                    tone="mint"
                    onPress={() => openSituations('all', 'all')}
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
                    onPress={() => openSituations('all', 'all')}
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
                    onPress={() => openSituations('all', 'all')}
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

      <Modal
        visible={scopeVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setScopeVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setScopeVisible(false)} />
          <View style={[styles.scopeSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.sheetEyebrow}>MUNICIPAL SITUATION</Text>
                <Text style={styles.sheetTitle}>Choose what appears on the map</Text>
              </View>
              <TouchableOpacity
                style={styles.sheetClose}
                onPress={() => setScopeVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close filters"
              >
                <Ionicons name="close" size={25} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetLabel}>Report status</Text>
            <View style={styles.chipWrap}>
              {STATUS_OPTIONS.map((option) => {
                const active = status === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setStatus(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sheetLabel}>Barangay</Text>
            <ScrollView style={styles.barangayList} showsVerticalScrollIndicator={false}>
              {[{ id: 'all', name: 'All barangays' }, ...barangays].map((barangay) => {
                const active = barangayId === barangay.id;
                return (
                  <TouchableOpacity
                    key={barangay.id}
                    style={styles.sheetOption}
                    onPress={() => setBarangayId(barangay.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>
                      {barangay.name}
                    </Text>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setScopeVisible(false)}
              accessibilityRole="button"
            >
              <Text style={styles.applyButtonText}>Apply to municipal situation</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
