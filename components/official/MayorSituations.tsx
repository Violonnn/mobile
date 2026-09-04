// Mayor-only municipal situation search and evacuation readiness oversight.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import InteractiveMap from '../map/InteractiveMap';
import MdrrmoHeader from './MdrrmoHeader';
import { fetchBarangays, type BarangayOption } from '../../lib/barangays';
import { formatPublishedAt } from '../../lib/formatTime';
import {
  fetchMayorSituationPage,
  fetchMayorSituationStatusCounts,
  MAYOR_SITUATION_INITIAL_PAGE_SIZE,
  MAYOR_SITUATION_PAGE_SIZE,
  normalizeMayorBarangayFilter,
  normalizeMayorStatusFilter,
  type MayorBarangayFilter,
  type MayorSituationItem,
  type MayorStatusCounts,
  type MayorStatusFilter,
} from '../../lib/mayorAnalytics';
import type { MapReportMarker } from '../../lib/reports';
import { supabase } from '../../lib/supabase';
import { useEvacuationCenters } from '../../hooks/useEvacuationCenters';
import { useReports } from '../../hooks/useReports';
import { useRealtimeChannelName } from '../../hooks/useRealtimeChannelName';
import { officialNavMetrics } from '../../styles/components/officialBottomNav.styles';
import { mayorSituationsStyles as styles } from '../../styles/screens/mayorSituations.styles';
import { colors } from '../../styles/theme';

const STATUS_OPTIONS: { value: MayorStatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'unverified', label: 'Unverified' },
  { value: 'verified', label: 'Verified' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
];

const EMPTY_STATUS_COUNTS: MayorStatusCounts = {
  unverified: 0,
  verified: 0,
  escalated: 0,
  resolved: 0,
};

type MayorSituationSection = 'situations' | 'priority';

function statusLabel(status: MayorStatusFilter): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'All statuses';
}

function statusColor(status: MayorSituationItem['status']): string {
  if (status === 'unverified') return colors.unverified;
  if (status === 'verified') return colors.success;
  if (status === 'escalated') return '#F59E0B';
  return colors.textMuted;
}

function matchesMarkerSearch(marker: MapReportMarker, search: string): boolean {
  const needle = search.trim().toLocaleLowerCase();
  if (!needle) return true;
  const reporterName = [
    marker.reporter.firstName,
    marker.reporter.middleName,
    marker.reporter.lastName,
  ].filter(Boolean).join(' ');
  return `${marker.title} ${marker.description} ${marker.addressText ?? ''} ${reporterName}`
    .toLocaleLowerCase()
    .includes(needle);
}

function MayorSituationSectionSwitch({ activeSection }: { activeSection: MayorSituationSection }) {
  const router = useRouter();

  function selectSection(nextSection: MayorSituationSection) {
    if (nextSection === activeSection) return;
    router.replace(
      (nextSection === 'priority'
        ? '/official/incidents?section=priority'
        : '/official/incidents') as Href,
    );
  }

  return (
    <View style={styles.sectionSwitch} accessibilityRole="tablist">
      {([
        ['situations', 'SITUATIONS'],
        ['priority', 'PRIORITY'],
      ] as const).map(([value, label]) => {
        const active = value === activeSection;
        return (
          <TouchableOpacity
            key={value}
            style={[styles.sectionSwitchButton, active && styles.sectionSwitchButtonActive]}
            onPress={() => selectSection(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.sectionSwitchText, active && styles.sectionSwitchTextActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MayorPrioritySection() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { centers, error, loading, refreshing, refresh } = useEvacuationCenters({ barangayId: null });
  const priorityCenters = centers.filter((center) => center.isPriority);
  const missingCapacity = centers.filter((center) => center.capacity == null).length;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.priorityContent,
          { paddingBottom: officialNavMetrics.barHeight + insets.bottom + 24 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
      >
        <MdrrmoHeader title="Situations" showDefaultControls />
        <MayorSituationSectionSwitch activeSection="priority" />

        <View style={styles.readinessSummary}>
          <Text style={styles.eyebrow}>MUNICIPAL EVACUATION NETWORK</Text>
          <Text style={styles.summaryValue}>{centers.length}</Text>
          <Text style={styles.summaryLabel}>evacuation centers</Text>
          <Text style={styles.summaryMeta}>
            {priorityCenters.length} priority · {missingCapacity} missing capacity details
          </Text>
        </View>

        {loading ? <View style={styles.stateCard}><ActivityIndicator color={colors.primary} /></View> : null}
        {!loading && error ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Could not load evacuation centers</Text>
            <Text style={styles.stateText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => void refresh()}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {!loading && !error ? <Text style={styles.resultsTitle}>NEEDS ATTENTION</Text> : null}
        {!loading && !error && priorityCenters.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons name="checkmark-circle-outline" size={34} color={colors.success} />
            <Text style={styles.stateTitle}>No priority centers</Text>
            <Text style={styles.stateText}>No municipal shelter is currently marked for priority review.</Text>
          </View>
        ) : null}
        {!loading && !error && priorityCenters.map((center) => (
          <TouchableOpacity
            key={center.id}
            style={styles.priorityCard}
            onPress={() => router.push(`/official/map?resourceId=${center.id}` as Href)}
            accessibilityRole="button"
            accessibilityLabel={`Locate ${center.name} on the municipal map`}
          >
            <View style={styles.priorityAccent} />
            <View style={styles.priorityIcon}>
              <Ionicons name="business-outline" size={28} color={colors.danger} />
            </View>
            <View style={styles.flexCopy}>
              <Text style={styles.priorityName}>{center.name}</Text>
              <Text style={styles.priorityMeta}>
                {center.status === 'open'
                  ? 'Open'
                  : center.status === 'full'
                    ? 'Full'
                    : 'Temporarily closed'} · Priority
              </Text>
              <Text style={styles.priorityMeta}>Capacity {center.capacity?.toLocaleString() ?? 'not declared'}</Text>
            </View>
            <Ionicons name="arrow-forward" size={23} color={colors.primary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function MayorSituations() {
  const { section } = useLocalSearchParams<{ section?: string | string[] }>();
  const requestedSection = Array.isArray(section) ? section[0] : section;
  if (requestedSection === 'priority') return <MayorPrioritySection />;
  return <MayorSituationsList />;
}

function MayorSituationsList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { barangayId: routeBarangayId, status: routeStatus } = useLocalSearchParams<{
    barangayId?: string | string[];
    status?: string | string[];
  }>();
  const { reports: mapReports, error: mapError } = useReports({
    realtime: true,
    includePending: false,
  });
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [barangayId, setBarangayId] = useState<MayorBarangayFilter>('all');
  const [status, setStatus] = useState<MayorStatusFilter>('all');
  const [draftBarangayId, setDraftBarangayId] = useState<MayorBarangayFilter>('all');
  const [draftStatus, setDraftStatus] = useState<MayorStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [reports, setReports] = useState<MayorSituationItem[]>([]);
  const [statusCounts, setStatusCounts] = useState<MayorStatusCounts>(EMPTY_STATUS_COUNTS);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countsError, setCountsError] = useState<string | null>(null);
  const [barangayError, setBarangayError] = useState<string | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [compactHeader, setCompactHeader] = useState(false);
  const [compactSearchVisible, setCompactSearchVisible] = useState(false);
  const [appliedRouteKey, setAppliedRouteKey] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);
  const compactHeaderRef = useRef(false);
  const channelName = useRealtimeChannelName('mayor-situations');

  useEffect(() => {
    // Delay database searches until typing pauses to avoid a request per key press.
    const timeout = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timeout);
  }, [search]);

  const loadBarangays = useCallback(async () => {
    const result = await fetchBarangays();
    if (result.error) {
      setBarangayError(result.error);
      return;
    }
    setBarangays(result.barangays);
    setBarangayError(null);
  }, []);

  const routeBarangay = Array.isArray(routeBarangayId) ? routeBarangayId[0] : routeBarangayId;
  const routeStatusValue = Array.isArray(routeStatus) ? routeStatus[0] : routeStatus;
  const routeKey = `${routeBarangay ?? ''}:${routeStatusValue ?? ''}`;
  const routeBarangayReady =
    !routeBarangay ||
    routeBarangay === 'all' ||
    barangays.length > 0 ||
    Boolean(barangayError);

  if (routeBarangayReady && appliedRouteKey !== routeKey) {
    setAppliedRouteKey(routeKey);
    setStatus(normalizeMayorStatusFilter(routeStatus));
    setBarangayId(normalizeMayorBarangayFilter(routeBarangayId, barangays));
  }

  const loadPage = useCallback(async (offset: number, append: boolean) => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    if (append) setLoadingMore(true);
    else setLoading(true);

    const pageLimit = offset === 0
      ? MAYOR_SITUATION_INITIAL_PAGE_SIZE
      : MAYOR_SITUATION_PAGE_SIZE;
    const pagePromise = fetchMayorSituationPage({
      barangayId,
      status,
      search: debouncedSearch,
      offset,
      limit: pageLimit,
    });
    const countsPromise = offset === 0
      ? fetchMayorSituationStatusCounts({ barangayId, search: debouncedSearch })
      : Promise.resolve(null);
    const [pageResult, countsResult] = await Promise.all([pagePromise, countsPromise]);

    // A newer filter or search request owns the screen state.
    if (requestSequence !== requestSequenceRef.current) return;
    if (pageResult.error) {
      setError(pageResult.error);
      if (!append) setReports([]);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    setReports((current) => append ? [...current, ...pageResult.reports] : pageResult.reports);
    setTotalCount(pageResult.totalCount);
    setError(null);
    if (countsResult) {
      setStatusCounts(countsResult.counts);
      setCountsError(countsResult.error);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [barangayId, debouncedSearch, status]);

  useFocusEffect(useCallback(() => {
    void Promise.all([loadBarangays(), loadPage(0, false)]);
  }, [loadBarangays, loadPage]));

  useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        void loadPage(0, false);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [channelName, loadPage]);

  const selectedBarangayName = barangayId === 'all'
    ? 'All barangays'
    : barangays.find((barangay) => barangay.id === barangayId)?.name ?? 'All barangays';
  const activeFilterCount = Number(barangayId !== 'all') + Number(status !== 'all');
  const remainingCount = Math.max(0, totalCount - reports.length);
  const nextPageCount = Math.min(MAYOR_SITUATION_PAGE_SIZE, remainingCount);
  const markerById = useMemo(
    () => new Map(mapReports.map((marker) => [marker.id, marker])),
    [mapReports],
  );
  const visibleMapReports = useMemo(() => mapReports.filter((marker) => {
    if (barangayId !== 'all' && marker.barangay_id !== barangayId) return false;
    if (status !== 'all' && marker.status !== status) return false;
    return matchesMarkerSearch(marker, debouncedSearch);
  }), [barangayId, debouncedSearch, mapReports, status]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadBarangays(), loadPage(0, false)]);
    setRefreshing(false);
  }

  function openFilters() {
    setDraftBarangayId(barangayId);
    setDraftStatus(status);
    setFiltersVisible(true);
  }

  function applyFilters() {
    setBarangayId(draftBarangayId);
    setStatus(draftStatus);
    setFiltersVisible(false);
  }

  function handleScroll(offsetY: number) {
    const nextCompact = offsetY > 500;
    if (nextCompact === compactHeaderRef.current) return;
    compactHeaderRef.current = nextCompact;
    setCompactHeader(nextCompact);
    if (!nextCompact) setCompactSearchVisible(false);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: officialNavMetrics.barHeight + insets.bottom + 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[3]}
        onScroll={(event) => handleScroll(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={32}
      >
        <View style={styles.horizontalContent}>
          <MdrrmoHeader title="Situations" showDefaultControls />
        </View>
        <View style={styles.horizontalContent}>
          <MayorSituationSectionSwitch activeSection="situations" />
        </View>

        <View style={styles.mapCard}>
          <View style={styles.mapViewport} pointerEvents="none">
            <InteractiveMap
              markers={visibleMapReports}
              layerVisibility={{ reports: true, facilities: false, evacuationCenters: false }}
              showZoomControls={false}
            />
          </View>
          <View style={styles.mapSummary} pointerEvents="none">
            <Text style={styles.eyebrow}>MUNICIPAL SITUATION ROOM</Text>
            <Text style={styles.mapTotal}>{totalCount.toLocaleString()} current reports</Text>
            <Text style={styles.mapSummaryText}>
              Read-only overview across {selectedBarangayName.toLowerCase()}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.openMapButton}
            onPress={() => router.push('/official/map' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Open municipal map"
          >
            <Text style={styles.openMapText}>OPEN MAP ↗</Text>
          </TouchableOpacity>
          {mapError ? <Text style={styles.mapError}>Map pins could not fully refresh.</Text> : null}
        </View>

        <View style={styles.stickyToolbar}>
          {compactHeader && !compactSearchVisible ? (
            <View style={styles.compactToolbarRow}>
              <View style={styles.flexCopy}>
                <Text style={styles.compactTitle}>Situations</Text>
                <Text style={styles.compactSubtitle}>{selectedBarangayName} · {statusLabel(status)}</Text>
              </View>
              <TouchableOpacity style={styles.compactIcon} onPress={() => setCompactSearchVisible(true)} accessibilityLabel="Search situations">
                <Ionicons name="search" size={27} color={colors.text} />
              </TouchableOpacity>
              <FilterButton count={activeFilterCount} onPress={openFilters} />
            </View>
          ) : (
            <>
              <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={24} color={colors.text} />
                  <TextInput
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search reports, places, or residents"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus={compactSearchVisible}
                    accessibilityLabel="Search situations"
                  />
                  {search ? (
                    <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Clear search">
                      <Ionicons name="close-circle" size={21} color={colors.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <FilterButton count={activeFilterCount} onPress={openFilters} />
              </View>
              <TouchableOpacity style={styles.filterSummaryRow} onPress={openFilters} accessibilityRole="button">
                <Ionicons name="options-outline" size={22} color={colors.text} />
                <Text style={styles.filterSummaryText}>{selectedBarangayName} · {statusLabel(status)}</Text>
                <Text style={styles.changeText}>CHANGE</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.resultsSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>{totalCount.toLocaleString()} MATCHING REPORT{totalCount === 1 ? '' : 'S'}</Text>
            <View style={styles.newestLabel}>
              <Ionicons name="time-outline" size={17} color={colors.textMuted} />
              <Text style={styles.newestText}>Newest</Text>
            </View>
          </View>
          <StatusSummary counts={statusCounts} selectedStatus={status} />
          {countsError ? <Text style={styles.inlineWarning}>Status totals could not refresh.</Text> : null}
          {barangayError ? <Text style={styles.inlineWarning}>Barangay labels are temporarily unavailable.</Text> : null}
          {search !== debouncedSearch ? (
            <View style={styles.searchingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.stateText}>Updating search results…</Text>
            </View>
          ) : null}
          {loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.stateText}>Loading matching reports…</Text>
            </View>
          ) : null}
          {!loading && error ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Could not load situations</Text>
              <Text style={styles.stateText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => void loadPage(0, false)}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {!loading && !error && reports.length === 0 ? (
            <View style={styles.stateCard}>
              <Ionicons name="search-outline" size={32} color={colors.textMuted} />
              <Text style={styles.stateTitle}>No matching reports</Text>
              <Text style={styles.stateText}>Try another barangay, status, or search term.</Text>
            </View>
          ) : null}
          {!loading && !error && reports.map((report, index) => (
            <MayorSituationRow
              key={report.id}
              report={report}
              marker={markerById.get(report.id) ?? null}
              highlighted={index === 0}
              onPress={() => router.push(`/official/${report.id}` as Href)}
            />
          ))}
          {!loading && !error && remainingCount > 0 ? (
            <View style={styles.moreSection}>
              <Text style={styles.moreTitle}>{remainingCount.toLocaleString()} MORE REPORT{remainingCount === 1 ? '' : 'S'}</Text>
              <Text style={styles.moreSubtitle}>Continue through the municipal queue</Text>
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={() => void loadPage(reports.length, true)}
                disabled={loadingMore}
                accessibilityRole="button"
                accessibilityLabel={`Load next ${nextPageCount} reports`}
              >
                {loadingMore ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Text style={styles.loadMoreText}>Load next {nextPageCount}</Text>
                    <Ionicons name="arrow-down" size={22} color={colors.primary} />
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.showingText}>Showing {reports.length} of {totalCount}</Text>
            </View>
          ) : null}
          {!loading && !error && totalCount > 0 && remainingCount === 0 ? (
            <Text style={styles.showingText}>Showing all {totalCount} reports</Text>
          ) : null}
        </View>
      </ScrollView>

      <FilterSheet
        visible={filtersVisible}
        bottomInset={insets.bottom}
        barangays={barangays}
        barangayId={draftBarangayId}
        status={draftStatus}
        onBarangayChange={setDraftBarangayId}
        onStatusChange={setDraftStatus}
        onApply={applyFilters}
        onReset={() => {
          setDraftBarangayId('all');
          setDraftStatus('all');
        }}
        onClose={() => setFiltersVisible(false)}
      />
    </SafeAreaView>
  );
}

function FilterButton({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.filterButton} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Filters, ${count} active`}>
      <Ionicons name="options-outline" size={25} color={colors.text} />
      {count > 0 ? <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{count}</Text></View> : null}
    </TouchableOpacity>
  );
}

function StatusSummary({ counts, selectedStatus }: { counts: MayorStatusCounts; selectedStatus: MayorStatusFilter }) {
  const visibleStatuses = STATUS_OPTIONS.slice(1).filter((option) => {
    if (selectedStatus !== 'all') return option.value === selectedStatus;
    return counts[option.value as keyof MayorStatusCounts] > 0;
  });
  if (visibleStatuses.length === 0) return null;
  return (
    <View style={styles.statusSummary} accessibilityLabel="Matching report status totals">
      {visibleStatuses.map((option, index) => (
        <React.Fragment key={option.value}>
          {index > 0 ? <Text style={styles.statusSeparator}>·</Text> : null}
          <View style={styles.statusSummaryItem}>
            <View style={[styles.statusDot, { backgroundColor: statusColor(option.value as MayorSituationItem['status']) }]} />
            <Text style={styles.statusSummaryText}>
              {counts[option.value as keyof MayorStatusCounts].toLocaleString()} {option.label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

function ReportLocationThumbnail({ report, marker }: { report: MayorSituationItem; marker: MapReportMarker | null }) {
  return (
    <View style={styles.thumbnail} accessibilityLabel={`Map location: ${report.barangayName}`}>
      <View style={styles.mapLineOne} />
      <View style={styles.mapLineTwo} />
      <View style={styles.mapLineThree} />
      <Ionicons
        name={marker ? 'location' : 'location-outline'}
        size={34}
        color={marker ? colors.unverified : colors.textMuted}
      />
      <Text style={styles.thumbnailLabel} numberOfLines={2}>{report.barangayName}</Text>
    </View>
  );
}

function MayorSituationRow({
  report,
  marker,
  highlighted,
  onPress,
}: {
  report: MayorSituationItem;
  marker: MapReportMarker | null;
  highlighted: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.reportRow, highlighted && styles.reportRowHighlighted]}
      onPress={onPress}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel={`Open read-only ${statusLabel(report.status)} report ${report.title || 'untitled'}`}
    >
      <ReportLocationThumbnail report={report} marker={marker} />
      <View style={styles.reportCopy}>
        <View style={styles.reportTitleRow}>
          <Text style={styles.reportTitle} numberOfLines={1}>{report.title.trim() || 'Untitled report'}</Text>
          <View style={[styles.statusPill, { borderColor: statusColor(report.status) }]}>
            <Text style={[styles.statusPillText, { color: statusColor(report.status) }]}>{statusLabel(report.status).toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.reportDescription} numberOfLines={1}>{report.description.trim() || 'No description provided.'}</Text>
        <Text style={styles.reportMeta} numberOfLines={1}>{report.barangayName} · {report.reporterName}</Text>
        <Text style={styles.reportMeta}>{report.createdAt ? formatPublishedAt(report.createdAt) : 'Date unavailable'}</Text>
        {report.addressText ? <Text style={styles.reportMeta} numberOfLines={1}>{report.addressText}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={25} color={colors.text} />
    </TouchableOpacity>
  );
}

function FilterSheet({
  visible,
  bottomInset,
  barangays,
  barangayId,
  status,
  onBarangayChange,
  onStatusChange,
  onApply,
  onReset,
  onClose,
}: {
  visible: boolean;
  bottomInset: number;
  barangays: BarangayOption[];
  barangayId: MayorBarangayFilter;
  status: MayorStatusFilter;
  onBarangayChange: (value: MayorBarangayFilter) => void;
  onStatusChange: (value: MayorStatusFilter) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.filterSheet, { paddingBottom: Math.max(bottomInset, 20) }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.filterSheetHeader}>
            <View>
              <Text style={styles.eyebrow}>MUNICIPAL FILTERS</Text>
              <Text style={styles.filterSheetTitle}>Change situation scope</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close filters">
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.filterLabel}>Status</Text>
          <View style={styles.choiceWrap}>
            {STATUS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.choice, status === option.value && styles.choiceActive]}
                onPress={() => onStatusChange(option.value)}
              >
                <Text style={[styles.choiceText, status === option.value && styles.choiceTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.filterLabel}>Barangay</Text>
          <ScrollView style={styles.barangayList} showsVerticalScrollIndicator={false}>
            {[{ id: 'all', name: 'All barangays' }, ...barangays].map((barangay) => {
              const active = barangayId === barangay.id;
              return (
                <TouchableOpacity key={barangay.id} style={styles.barangayOption} onPress={() => onBarangayChange(barangay.id)}>
                  <Text style={[styles.barangayOptionText, active && styles.barangayOptionTextActive]}>{barangay.name}</Text>
                  {active ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.resetButton} onPress={onReset}><Text style={styles.resetText}>Reset</Text></TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={onApply}><Text style={styles.applyText}>Apply filters</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
