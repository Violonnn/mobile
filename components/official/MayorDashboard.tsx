// Mayor-only executive brief built from compact municipal aggregates.

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import InteractiveMap from '../map/InteractiveMap';
import MdrrmoHeader from './MdrrmoHeader';
import { useMayorAnalytics } from '../../hooks/useMayorAnalytics';
import { useReports } from '../../hooks/useReports';
import {
  MAYOR_STATUSES,
  mayorPercentage,
  reduceMayorActivityTotals,
  type MayorActivityRange,
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

const STATUS_OPTIONS: { value: MayorStatusFilter; label: string; color: string }[] = [
  { value: 'all', label: 'All statuses', color: colors.primary },
  { value: 'unverified', label: 'Unverified', color: colors.unverified },
  { value: 'verified', label: 'Verified', color: colors.success },
  { value: 'escalated', label: 'Escalated', color: colors.danger },
  { value: 'resolved', label: 'Resolved', color: colors.textMuted },
];

const RANGE_OPTIONS: { value: MayorActivityRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '3d', label: '3 days' },
  { value: '7d', label: '7 days' },
];

function statusLabel(value: MayorStatusFilter): string {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label ?? 'All statuses';
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Updated just now';
  return `Updated ${date.toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Manila',
  })} · ${date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  })}`;
}

function DecisionRow({
  color,
  title,
  subtitle,
  onPress,
}: {
  color: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.decisionRow}
      onPress={onPress}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <View style={[styles.decisionDot, { backgroundColor: color }]} />
      <View style={styles.decisionCopy}>
        <Text style={styles.decisionTitle}>{title}</Text>
        <Text style={styles.decisionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="arrow-forward" size={24} color={colors.textMuted} />
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
  const [barangayId, setBarangayId] = useState<MayorBarangayFilter>('all');
  const [status, setStatus] = useState<MayorStatusFilter>('all');
  const [activityRange, setActivityRange] = useState<MayorActivityRange>('today');
  const [scopeVisible, setScopeVisible] = useState(false);
  const { reports: mapReports, error: mapError } = useReports({
    realtime: true,
    includePending: false,
  });
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
  } = useMayorAnalytics({ enabled: true, barangayId, status, activityRange });

  const selectedBarangayName = barangayId === 'all'
    ? 'All barangays'
    : barangays.find((barangay) => barangay.id === barangayId)?.name ?? 'All barangays';
  const activityTotal = reduceMayorActivityTotals(recentActivitySeries).reduce(
    (total, point) => total + point.count,
    0,
  );
  const currentTotal = MAYOR_STATUSES.reduce(
    (total, reportStatus) => total + (snapshot?.statusCounts[reportStatus] ?? 0),
    0,
  );
  const affectedBarangays = snapshot?.barangayTotals.filter((item) => {
    const matchingCount = status === 'all' ? item.total : item.statusCounts[status];
    return matchingCount > 0;
  }) ?? [];
  const unaffectedCount = Math.max(0, barangays.length - affectedBarangays.length);
  const rankingMaximum = Math.max(
    1,
    ...affectedBarangays.map((item) => status === 'all' ? item.total : item.statusCounts[status]),
  );
  const priorityCenters = centers.filter((center) => center.isPriority);
  const openCenters = centers.filter((center) => center.status === 'open').length;
  const fullCenters = centers.filter((center) => center.status === 'full').length;
  const declaredCapacity = centers.reduce((total, center) => total + (center.capacity ?? 0), 0);
  const missingCapacity = centers.filter((center) => center.capacity == null).length;

  const visibleMapReports = useMemo(() => {
    return mapReports.filter((report) => {
      if (barangayId !== 'all' && report.barangay_id !== barangayId) return false;
      if (status !== 'all' && report.status !== status) return false;
      return true;
    });
  }, [barangayId, mapReports, status]);

  async function handleRefresh() {
    await Promise.all([refresh(), onRefreshCenters()]);
  }

  function openSituations(nextStatus?: MayorStatusFilter, nextBarangayId?: MayorBarangayFilter) {
    const params = new URLSearchParams();
    const requestedStatus = nextStatus ?? status;
    const requestedBarangayId = nextBarangayId ?? barangayId;
    if (requestedStatus !== 'all') params.set('status', requestedStatus);
    if (requestedBarangayId !== 'all') params.set('barangayId', requestedBarangayId);
    const query = params.toString();
    router.push(`/official/incidents${query ? `?${query}` : ''}` as Href);
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: officialNavMetrics.barHeight + insets.bottom + 28 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <MdrrmoHeader title="Brief" showDefaultControls />

        <View style={styles.briefIntro}>
          <TouchableOpacity
            style={styles.scopeCard}
            onPress={() => setScopeVisible(true)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Municipal scope, ${selectedBarangayName}, ${statusLabel(status)}`}
          >
            <View style={styles.scopeCopy}>
              <Text style={styles.scopeEyebrow}>MUNICIPAL SCOPE</Text>
              <Text style={styles.scopeValue} numberOfLines={1}>
                {selectedBarangayName} · {statusLabel(status)}
              </Text>
            </View>
            <Ionicons name="options-outline" size={20} color={colors.textMuted} />
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          {snapshot ? (
            <View style={styles.mapBlock}>
              <View style={styles.mapCard}>
                <View style={styles.mapViewport} pointerEvents="none">
                  <InteractiveMap
                    markers={visibleMapReports}
                    showZoomControls={false}
                    layerVisibility={{ reports: true, facilities: false, evacuationCenters: false }}
                  />
                </View>
                <View style={styles.mapHeaderOverlay} pointerEvents="none">
                  <View>
                    <Text style={styles.mapTotal}>{snapshot.matchingTotal.toLocaleString()} current reports</Text>
                    <Text style={styles.mapSubtitle}>
                      Across {affectedBarangays.length.toLocaleString()} barangay{affectedBarangays.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Text style={styles.updatedText}>{formatUpdatedAt(snapshot.fetchedAt)}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.mapAction}
                onPress={() => openSituations()}
                accessibilityRole="button"
                accessibilityLabel="View matching situations"
              >
                <Text style={styles.mapActionText}>View situations</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.primary} />
              </TouchableOpacity>
              {mapError ? <Text style={styles.inlineNote}>Map pins could not fully refresh.</Text> : null}
            </View>
          ) : null}
        </View>

        {loading && !snapshot ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Preparing the municipal brief…</Text>
          </View>
        ) : null}

        {!loading && !snapshot && error ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Municipal figures are unavailable</Text>
            <Text style={styles.stateText}>{error}</Text>
            <TouchableOpacity onPress={() => void reload()} accessibilityRole="button">
              <Text style={styles.linkText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {snapshot ? (
          <>
            {error || barangayError ? (
              <View style={styles.warningCard} accessibilityRole="alert">
                <Ionicons name="cloud-offline-outline" size={20} color={colors.danger} />
                <Text style={styles.warningText}>
                  Showing the latest available figures. Pull down to refresh.
                </Text>
              </View>
            ) : null}

            <View style={[styles.section, styles.decisionSection]}>
              <Text style={styles.eyebrow}>NEEDS DECISION</Text>
              <DecisionRow
                color={colors.unverified}
                title={`${snapshot.statusCounts.unverified.toLocaleString()} reports await verification`}
                subtitle="Review the municipal queue"
                onPress={() => openSituations('unverified')}
              />
              <DecisionRow
                color={colors.danger}
                title={`${priorityCenters.length.toLocaleString()} priority evacuation center${priorityCenters.length === 1 ? '' : 's'}`}
                subtitle={priorityCenters[0]?.name ?? 'No priority center at present'}
                onPress={() => router.push('/official/incidents?section=priority' as Href)}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.eyebrow}>ACTIVITY</Text>
              <View style={styles.todayRow}>
                <View style={styles.calendarIcon}>
                  <Ionicons name="calendar-clear-outline" size={31} color={colors.textMuted} />
                </View>
                <View style={styles.todayCopy}>
                  <Text style={styles.todayTitle}>
                    {activityError
                      ? 'Recent activity is unavailable'
                      : activityTotal === 0
                        ? `No new reports submitted ${activityRange === 'today' ? 'today' : `in the last ${activityRange === '3d' ? '3 days' : '7 days'}`}`
                        : `${activityTotal.toLocaleString()} new report${activityTotal === 1 ? '' : 's'} in this period`}
                  </Text>
                  <TouchableOpacity onPress={() => openSituations()} accessibilityRole="button">
                    <Text style={styles.linkText}>View activity →</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.rangeTabs} accessibilityRole="tablist">
                {RANGE_OPTIONS.map((option) => {
                  const active = option.value === activityRange;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.rangeTab, active && styles.rangeTabActive]}
                      onPress={() => setActivityRange(option.value)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.eyebrow}>REPORT STATUS</Text>
              <Text style={styles.sectionHint}>{currentTotal.toLocaleString()} current reports</Text>
              <View style={styles.statusRow}>
                {STATUS_OPTIONS.slice(1).map((item, index) => {
                  const count = snapshot.statusCounts[item.value as keyof typeof snapshot.statusCounts];
                  return (
                    <TouchableOpacity
                      key={item.value}
                      style={[styles.statusMetric, index > 0 && styles.statusMetricBorder]}
                      onPress={() => openSituations(item.value)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.label}, ${count} reports`}
                    >
                      <View style={[styles.statusDot, { backgroundColor: item.color }]} />
                      <Text style={styles.statusCount}>{count.toLocaleString()}</Text>
                      <Text style={styles.statusLabel}>{item.label}</Text>
                      <Text style={styles.statusPercent}>{mayorPercentage(count, currentTotal)}%</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.flexCopy}>
                  <Text style={styles.eyebrow}>AFFECTED BARANGAYS</Text>
                  <Text style={styles.sectionHint}>Reports requiring municipal awareness</Text>
                </View>
                <Text style={styles.updatedText}>{formatUpdatedAt(snapshot.fetchedAt)}</Text>
              </View>
              {affectedBarangays.slice(0, 5).map((barangay) => {
                const matchingCount = status === 'all'
                  ? barangay.total
                  : barangay.statusCounts[status];
                const width = `${Math.max(4, mayorPercentage(matchingCount, rankingMaximum))}%` as const;
                const urgentShare = mayorPercentage(
                  barangay.statusCounts.unverified + barangay.statusCounts.escalated,
                  barangay.total,
                );
                return (
                  <TouchableOpacity
                    key={barangay.barangayId ?? barangay.barangayName}
                    style={styles.barangayRow}
                    onPress={() => openSituations('all', barangay.barangayId ?? 'all')}
                    accessibilityRole="button"
                    accessibilityLabel={`${barangay.barangayName}, ${matchingCount} matching reports`}
                  >
                    <View style={styles.barangayHeader}>
                      <Text style={styles.barangayName}>{barangay.barangayName}</Text>
                      <Text style={styles.barangayCount}>{matchingCount.toLocaleString()}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width }]}>
                        <View style={[styles.barUrgent, { width: `${urgentShare}%` }]} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.disclosureRow} onPress={() => openSituations()}>
                <Ionicons name="chevron-down" size={24} color={colors.textMuted} />
                <Text style={styles.disclosureText}>
                  {unaffectedCount.toLocaleString()} barangays with {status === 'all' ? 'no current reports' : `no ${statusLabel(status).toLowerCase()} reports`}
                </Text>
                <Text style={styles.linkText}>View all {barangays.length} →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.eyebrow}>EVACUATION READINESS</Text>
                  <Text style={styles.sectionHint}>Municipal shelter network</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/official/incidents?section=priority' as Href)}>
                  <Text style={styles.linkText}>View centers →</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.readinessMetrics}>
                {[
                  { label: 'Open', value: openCenters, color: colors.success },
                  { label: 'Full', value: fullCenters, color: colors.textMuted },
                  { label: 'Priority', value: priorityCenters.length, color: colors.danger },
                  { label: 'Total', value: centers.length, color: colors.textMuted },
                ].map((item, index) => (
                  <View key={item.label} style={[styles.readinessMetric, index > 0 && styles.statusMetricBorder]}>
                    <View style={[styles.statusDot, { backgroundColor: item.color }]} />
                    <Text style={styles.readinessCount}>{item.value}</Text>
                    <Text style={styles.statusLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.capacityCard}>
                <Text style={styles.capacityValue}>{declaredCapacity.toLocaleString()}</Text>
                <Text style={styles.capacityLabel}>Declared capacity</Text>
                <Text style={styles.capacityHint}>
                  {missingCapacity === 0
                    ? 'Capacity information is complete'
                    : `${missingCapacity} center${missingCapacity === 1 ? '' : 's'} without declared capacity`}
                </Text>
                <View style={styles.capacityTrack}>
                  <View
                    style={[
                      styles.capacityFill,
                      { width: `${centers.length === 0 ? 0 : mayorPercentage(centers.length - missingCapacity, centers.length)}%` },
                    ]}
                  />
                </View>
              </View>
              {centersError ? <Text style={styles.inlineNote}>{centersError}</Text> : null}
              {priorityCenters.slice(0, 2).map((center) => (
                <TouchableOpacity
                  key={center.id}
                  style={styles.centerRow}
                  onPress={() => router.push(`/official/map?resourceId=${center.id}` as Href)}
                >
                  <View style={styles.centerAccent} />
                  <View style={styles.centerIcon}>
                    <Ionicons name="business-outline" size={26} color={colors.danger} />
                  </View>
                  <View style={styles.flexCopy}>
                    <Text style={styles.centerName}>{center.name}</Text>
                    <Text style={styles.centerMeta}>
                      {center.status === 'open'
                        ? 'Open'
                        : center.status === 'full'
                          ? 'Full'
                          : 'Temporarily closed'} · Priority
                    </Text>
                    <Text style={styles.centerMeta}>
                      Declared capacity {center.capacity?.toLocaleString() ?? 'not set'}
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={22} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={scopeVisible} transparent animationType="slide" onRequestClose={() => setScopeVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setScopeVisible(false)} />
          <View style={[styles.scopeSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.eyebrow}>MUNICIPAL SCOPE</Text>
                <Text style={styles.sheetTitle}>Filter the executive brief</Text>
              </View>
              <TouchableOpacity onPress={() => setScopeVisible(false)} accessibilityLabel="Close filters">
                <Ionicons name="close" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetLabel}>Report status</Text>
            <View style={styles.chipWrap}>
              {STATUS_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.filterChip, status === option.value && styles.filterChipActive]}
                  onPress={() => setStatus(option.value)}
                >
                  <Text style={[styles.filterChipText, status === option.value && styles.filterChipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
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
                  >
                    <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>{barangay.name}</Text>
                    {active ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.applyButton} onPress={() => setScopeVisible(false)}>
              <Text style={styles.applyButtonText}>Apply scope</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
