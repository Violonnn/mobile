// Read-only, all-time submitted-report awareness for the Mayor Brief tab.

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useMayorAnalytics } from '../../hooks/useMayorAnalytics';
import {
  MAYOR_STATUSES,
  mayorPercentage,
  reduceMayorActivityTotals,
  type MayorActivityPoint,
  type MayorBarangayFilter,
  type MayorActivityRange,
  type MayorStatusActivitySeries,
  type MayorStatusFilter,
} from '../../lib/mayorAnalytics';
import type { EvacuationCenterRecord } from '../../lib/resources';
import { officialStyles } from '../../styles/screens/official.styles';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
import EvacuationSummarySection from './EvacuationSummarySection';
import MdrrmoHeader from './MdrrmoHeader';

type MayorDashboardProps = {
  centers: EvacuationCenterRecord[];
  centersError: string | null;
  onRefreshCenters: () => Promise<void>;
};

type StatusPresentation = {
  status: Exclude<MayorStatusFilter, 'all'>;
  label: string;
  color: string;
  barColor: string;
};

const STATUS_PRESENTATION: StatusPresentation[] = [
  { status: 'unverified', label: 'Unverified', color: colors.unverified, barColor: '#FCA5A5' },
  { status: 'verified', label: 'Verified', color: colors.success, barColor: '#86EFAC' },
  { status: 'escalated', label: 'Escalated', color: colors.danger, barColor: '#FDBA74' },
  { status: 'resolved', label: 'Resolved', color: colors.textMuted, barColor: '#CBD5E1' },
];

type BarangayBarSegment = {
  count: number;
  color: string;
};

type BarangayStatusGradient = {
  colors: [string, string, ...string[]];
  locations: [number, number, ...number[]];
};

function createBarangayStatusGradient(
  segments: BarangayBarSegment[],
): BarangayStatusGradient {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  if (total <= 0 || segments.length === 0) {
    return { colors: [colors.border, colors.border], locations: [0, 1] };
  }

  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const gradientColors = [firstSegment.color];
  const gradientLocations = [0];
  let cumulativeCount = 0;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const currentSegment = segments[index];
    const nextSegment = segments[index + 1];
    cumulativeCount += currentSegment.count;

    const boundary = cumulativeCount / total;
    // A short overlap softens each status boundary without hiding the count proportions.
    const transitionWidth = Math.min(
      0.08,
      (currentSegment.count / total) / 2,
      (nextSegment.count / total) / 2,
    );
    gradientColors.push(currentSegment.color, nextSegment.color);
    gradientLocations.push(boundary - transitionWidth, boundary + transitionWidth);
  }

  gradientColors.push(lastSegment.color);
  gradientLocations.push(1);
  return {
    colors: gradientColors as BarangayStatusGradient['colors'],
    locations: gradientLocations as BarangayStatusGradient['locations'],
  };
}

function statusLabel(status: MayorStatusFilter): string {
  if (status === 'all') return 'All statuses';
  return STATUS_PRESENTATION.find((item) => item.status === status)?.label ?? status;
}

function formatFetchedAt(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Updated just now';
  return `Updated ${date.toLocaleString()}`;
}

export default function MayorDashboard({
  centers,
  centersError,
  onRefreshCenters,
}: MayorDashboardProps) {
  const router = useRouter();
  const [barangayId, setBarangayId] = useState<MayorBarangayFilter>('all');
  const [status, setStatus] = useState<MayorStatusFilter>('all');
  const [activityRange, setActivityRange] = useState<MayorActivityRange>('today');
  const [barangayPickerOpen, setBarangayPickerOpen] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
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

  const selectedBarangayName = useMemo(() => {
    if (barangayId === 'all') return 'All Barangays';
    return barangays.find((barangay) => barangay.id === barangayId)?.name ?? 'All Barangays';
  }, [barangayId, barangays]);

  const distributionTotal = MAYOR_STATUSES.reduce(
    (total, item) => total + (snapshot?.statusCounts[item] ?? 0),
    0,
  );
  const rankingMaximum = Math.max(
    1,
    ...(snapshot?.barangayTotals.map((total) =>
      status === 'all' ? total.total : total.statusCounts[status],
    ) ?? [0]),
  );

  async function handleRefresh() {
    await Promise.all([refresh(), onRefreshCenters()]);
  }

  function chooseBarangay(nextBarangayId: MayorBarangayFilter) {
    setBarangayId(nextBarangayId);
    setBarangayPickerOpen(false);
  }

  function chooseStatus(nextStatus: MayorStatusFilter) {
    setStatus(nextStatus);
    setStatusPickerOpen(false);
  }

  function openMatchingReports() {
    const params = new URLSearchParams();
    if (barangayId !== 'all') params.set('barangayId', barangayId);
    if (status !== 'all') params.set('status', status);
    const suffix = params.toString();
    router.push(`/official/incidents${suffix ? `?${suffix}` : ''}` as Href);
  }

  return (
    <ScrollView
      contentContainerStyle={[officialStyles.scrollContent, localStyles.content]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <MdrrmoHeader title="Brief" showDefaultControls />

      <View style={localStyles.filterGroup}>
        <Text style={localStyles.filterLabel}>Barangay</Text>
        <TouchableOpacity
          style={localStyles.selector}
          onPress={() => {
            setBarangayPickerOpen((open) => !open);
            setStatusPickerOpen(false);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Barangay filter: ${selectedBarangayName}`}
          accessibilityState={{ expanded: barangayPickerOpen }}
        >
          <Text style={localStyles.selectorText} numberOfLines={1}>{selectedBarangayName}</Text>
          <Ionicons name={barangayPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </TouchableOpacity>
        {barangayPickerOpen ? (
          <View style={localStyles.options}>
            <FilterOption active={barangayId === 'all'} label="All Barangays" onPress={() => chooseBarangay('all')} />
            {barangays.map((barangay) => (
              <FilterOption
                key={barangay.id}
                active={barangay.id === barangayId}
                label={barangay.name}
                onPress={() => chooseBarangay(barangay.id)}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={localStyles.filterGroup}>
        <Text style={localStyles.filterLabel}>Current report status</Text>
        <TouchableOpacity
          style={localStyles.selector}
          onPress={() => {
            setStatusPickerOpen((open) => !open);
            setBarangayPickerOpen(false);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Status filter: ${statusLabel(status)}`}
          accessibilityState={{ expanded: statusPickerOpen }}
        >
          <Text style={localStyles.selectorText}>{statusLabel(status)}</Text>
          <Ionicons name={statusPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </TouchableOpacity>
        {statusPickerOpen ? (
          <View style={localStyles.options}>
            <FilterOption active={status === 'all'} label="All statuses" onPress={() => chooseStatus('all')} />
            {STATUS_PRESENTATION.map((item) => (
              <FilterOption
                key={item.status}
                active={status === item.status}
                label={item.label}
                onPress={() => chooseStatus(item.status)}
              />
            ))}
          </View>
        ) : null}
      </View>

      {loading && !snapshot ? (
        <View style={localStyles.stateCard} accessibilityLabel="Loading report analytics">
          <ActivityIndicator color={colors.themeSoft} />
          <Text style={localStyles.stateText}>Loading submitted report figures…</Text>
        </View>
      ) : null}

      {!snapshot && !loading && error ? (
        <View style={localStyles.stateCard}>
          <Text style={localStyles.stateTitle}>Could not load report figures</Text>
          <Text style={localStyles.stateText}>{error}</Text>
          <TouchableOpacity style={localStyles.retryButton} onPress={() => void reload()} accessibilityRole="button">
            <Text style={localStyles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {snapshot ? (
        <>
          {error ? (
            <View style={localStyles.warningCard}>
              <Text style={localStyles.warningTitle}>Showing last available figures</Text>
              <Text style={localStyles.warningText}>{error}</Text>
              <TouchableOpacity onPress={() => void reload()} accessibilityRole="button">
                <Text style={localStyles.warningLink}>Retry now</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {barangayError ? (
            <View style={localStyles.warningCard}>
              <Text style={localStyles.warningTitle}>Barangay labels are temporarily unavailable</Text>
              <Text style={localStyles.warningText}>Aggregate counts are still current. Pull to refresh to retry labels.</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={localStyles.metricCard}
            onPress={openMatchingReports}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`View ${snapshot.matchingTotal} matching reports`}
          >
            <Text style={localStyles.metricLabel}>Matching reports</Text>
            <Text style={localStyles.metricValue}>{snapshot.matchingTotal.toLocaleString()}</Text>
            <Text style={localStyles.metricHint}>{selectedBarangayName} • {statusLabel(status)}</Text>
            <Ionicons name="arrow-forward" size={22} color={colors.white} style={localStyles.metricArrow} />
          </TouchableOpacity>

          {activityError ? (
            <Text style={localStyles.activityUnavailable}>Recent activity is temporarily unavailable.</Text>
          ) : (
            <MayorStatusLineChart
              series={recentActivitySeries}
              range={activityRange}
              onChangeRange={setActivityRange}
            />
          )}

          <View style={localStyles.section}>
            <Text style={localStyles.sectionTitle}>Status distribution</Text>
            <Text style={localStyles.sectionHint}>All current report statuses for {selectedBarangayName.toLowerCase()}.</Text>
            <View style={localStyles.statusGrid}>
              {STATUS_PRESENTATION.map((item) => {
                const count = snapshot.statusCounts[item.status];
                const percentage = mayorPercentage(count, distributionTotal);
                const selected = status === item.status;
                return (
                  <View
                    key={item.status}
                    style={[localStyles.statusCard, selected && localStyles.statusCardSelected]}
                    accessibilityLabel={`${item.label}: ${count} reports, ${percentage} percent of selected barangay reports${selected ? ', selected filter' : ''}`}
                  >
                    <View style={[localStyles.statusDot, { backgroundColor: item.color }]} />
                    <Text style={localStyles.statusLabel}>{item.label}{selected ? ' (selected)' : ''}</Text>
                    <Text style={localStyles.statusCount}>{count.toLocaleString()}</Text>
                    <Text style={localStyles.statusPercent}>{percentage}% of reports</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {snapshot.unassignedCount > 0 ? (
            <View style={localStyles.unassignedCard} accessibilityRole="alert">
              <Ionicons name="warning-outline" size={21} color={colors.danger} />
              <View style={{ flex: 1 }}>
                <Text style={localStyles.unassignedTitle}>{snapshot.unassignedCount.toLocaleString()} unassigned report{snapshot.unassignedCount === 1 ? '' : 's'}</Text>
                <Text style={localStyles.warningText}>These submitted reports have no barangay label and are included in the municipality total.</Text>
              </View>
            </View>
          ) : null}

          <View style={localStyles.section}>
            <View style={localStyles.sectionHeader}>
              <Text style={localStyles.sectionTitle}>Barangay breakdown</Text>
              <Text style={localStyles.timestamp}>{formatFetchedAt(snapshot.fetchedAt)}</Text>
            </View>
            <Text style={localStyles.sectionHint}>
              {status === 'all'
                ? 'Total submitted reports by barangay. Colors show current report statuses.'
                : `${statusLabel(status)} reports by barangay.`}
            </Text>
            {snapshot.barangayTotals.length === 0 ? (
              <Text style={localStyles.stateText}>No barangays match this filter.</Text>
            ) : snapshot.barangayTotals.map((total) => {
              const count = status === 'all' ? total.total : total.statusCounts[status];
              const percentage = mayorPercentage(count, rankingMaximum);
              const visibleStatusItems = STATUS_PRESENTATION.filter(
                (item) => status === 'all' || item.status === status,
              );
              const statusSummary = visibleStatusItems
                .filter((item) => total.statusCounts[item.status] > 0)
                .map((item) => `${total.statusCounts[item.status]} ${item.label.toLowerCase()}`)
                .join(', ');
              const statusSegments = visibleStatusItems.flatMap((item) => {
                const statusCount = total.statusCounts[item.status];
                return statusCount > 0 ? [{ count: statusCount, color: item.barColor }] : [];
              });
              const statusGradient = createBarangayStatusGradient(statusSegments);
              return (
                <View key={total.barangayId} style={localStyles.rankingRow}>
                  <View style={localStyles.rankingHeader}>
                    <Text style={localStyles.rankingName} numberOfLines={2}>{total.barangayName}</Text>
                    <Text style={localStyles.rankingCount}>{count.toLocaleString()}</Text>
                  </View>
                  <View
                    style={localStyles.rankingTrack}
                    accessibilityLabel={`${total.barangayName}: ${count} reports (${statusSummary || 'no reports'}), ${percentage} percent of highest barangay count`}
                  >
                    {count > 0 ? (
                      <View style={[localStyles.rankingFill, { width: `${percentage}%` }]}>
                        <LinearGradient
                          colors={statusGradient.colors}
                          locations={statusGradient.locations}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={localStyles.rankingGradient}
                        />
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          {snapshot.matchingTotal === 0 ? (
            <View style={localStyles.emptyCard}>
              <Text style={localStyles.stateTitle}>No matching reports</Text>
              <Text style={localStyles.stateText}>This valid filter combination currently has no submitted reports.</Text>
            </View>
          ) : null}

        </>
      ) : null}

      <EvacuationSummarySection centers={centers} error={centersError} officialKind="Mayor" />
    </ScrollView>
  );
}

function FilterOption({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[localStyles.option, active && localStyles.optionActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text style={[localStyles.optionText, active && localStyles.optionTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Uses hourly lines for today and grouped status bars for multi-day ranges. */
function MayorStatusLineChart({
  series,
  range,
  onChangeRange,
}: {
  series: MayorStatusActivitySeries[];
  range: MayorActivityRange;
  onChangeRange: (range: MayorActivityRange) => void;
}) {
  const [selectedStatus, setSelectedStatus] = useState<MayorStatusFilter>('all');
  const [chartWidth, setChartWidth] = useState(0);
  const visibleSeries = selectedStatus === 'all'
    ? series
    : series.filter((line) => line.status === selectedStatus);
  const labels = series[0]?.points ?? [];
  const totalPoints = reduceMayorActivityTotals(series);
  const linePoints = selectedStatus === 'all'
    ? totalPoints
    : visibleSeries[0]?.points ?? [];
  const highestCount = range === 'today'
    ? Math.max(0, ...linePoints.map((point) => point.count))
    : Math.max(
      0,
      ...visibleSeries.flatMap((statusSeries) =>
        statusSeries.points.map((point) => point.count),
      ),
    );
  const chartMaximum = Math.max(1, highestCount);
  const selectedColor = selectedStatus === 'all'
    ? colors.primary
    : STATUS_PRESENTATION.find((item) => item.status === selectedStatus)?.color ?? colors.primary;
  const chartType = range === 'today' ? 'Hourly trend' : 'Daily status comparison';
  const summary = linePoints.map((point) => `${point.label} ${point.count}`).join(', ');

  function handleChartLayout(event: LayoutChangeEvent) {
    setChartWidth(event.nativeEvent.layout.width);
  }

  return (
    <View style={localStyles.activityCard} accessibilityLabel={`${chartType}. ${statusLabel(selectedStatus)}: ${summary || 'No report data available.'}`}>
      <View style={localStyles.activityHeader}>
        <View>
          <Text style={localStyles.activityTitle}>Report activity</Text>
          <Text style={localStyles.activityHint}>{range === 'today' ? 'Hourly submitted-report trend' : 'Daily submitted-report status comparison'}</Text>
        </View>
        <Text style={localStyles.activityPeak}>{chartType}</Text>
      </View>
      <View style={localStyles.rangeFilters}>
        <RangeFilter label="Today" active={range === 'today'} onPress={() => onChangeRange('today')} />
        <RangeFilter label="3 days" active={range === '3d'} onPress={() => onChangeRange('3d')} />
        <RangeFilter label="7 days" active={range === '7d'} onPress={() => onChangeRange('7d')} />
      </View>
      <View style={localStyles.chartFilters}>
        <StatusChartFilter label="All" active={selectedStatus === 'all'} onPress={() => setSelectedStatus('all')} />
        {STATUS_PRESENTATION.map((item) => (
          <StatusChartFilter
            key={item.status}
            label={item.label}
            color={item.color}
            active={selectedStatus === item.status}
            onPress={() => setSelectedStatus(item.status)}
          />
        ))}
      </View>
      <View style={localStyles.chartCanvas} onLayout={handleChartLayout}>
        <ChartAxes
          maximum={chartMaximum}
          width={chartWidth}
          range={range}
          labels={labels.map((point) => point.label)}
        />
        {range === 'today' ? (
          <ChartLine points={linePoints} color={selectedColor} maximum={chartMaximum} width={chartWidth} />
        ) : (
          <GroupedActivityBars series={visibleSeries} maximum={chartMaximum} width={chartWidth} />
        )}
        {visibleSeries.length === 0 ? <Text style={localStyles.chartEmpty}>No report data is available for this filter.</Text> : null}
      </View>
    </View>
  );
}

function RangeFilter({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[localStyles.rangeFilter, active && localStyles.rangeFilterActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Show ${label} of report activity`}
    >
      <Text style={[localStyles.rangeFilterText, active && localStyles.rangeFilterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusChartFilter({ label, color, active, onPress }: { label: string; color?: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[localStyles.chartFilter, active && localStyles.chartFilterActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Show ${label} report activity`}
    >
      {color ? <View style={[localStyles.chartFilterDot, { backgroundColor: color }]} /> : null}
      <Text style={[localStyles.chartFilterText, active && localStyles.chartFilterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const CHART_HEIGHT = 142;
const CHART_LEFT = 30;
const CHART_RIGHT = 6;
const CHART_TOP = 8;
const CHART_BOTTOM = 32;

function ChartAxes({
  maximum,
  labels,
  width,
  range,
}: {
  maximum: number;
  labels: string[];
  width: number;
  range: MayorActivityRange;
}) {
  const plotWidth = Math.max(0, width - CHART_LEFT - CHART_RIGHT);
  const plotHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;
  const axisTicks = maximum === 1
    ? [{ value: 1, position: 0 }, { value: 0, position: 1 }]
    : [
      { value: maximum, position: 0 },
      { value: maximum / 2, position: 0.5 },
      { value: 0, position: 1 },
    ];

  return (
    <>
      {axisTicks.map((tick) => {
        const y = CHART_TOP + tick.position * plotHeight;
        return (
          <React.Fragment key={tick.position}>
            <View style={[localStyles.chartGridLine, { top: y }]} />
            <Text style={[localStyles.chartYAxisLabel, { top: y - 6 }]}>
              {Number.isInteger(tick.value) ? tick.value : tick.value.toFixed(1)}
            </Text>
          </React.Fragment>
        );
      })}
      <View style={localStyles.chartYAxis} />
      <View style={localStyles.chartXAxis} />
      {labels.map((label, index) => {
        const showLabel = range !== 'today' || index % 6 === 0 || index === labels.length - 1;
        if (!showLabel) return null;
        return (
          <Text
            key={`${label}-${index}`}
            style={[
              localStyles.chartXAxisLabel,
              {
                left: range === 'today'
                  ? CHART_LEFT + (plotWidth * index) / Math.max(1, labels.length - 1) - 12
                  : CHART_LEFT + (plotWidth * (index + 0.5)) / labels.length - 12,
              },
            ]}
          >{label}</Text>
        );
      })}
    </>
  );
}

function ChartLine({ points, color, maximum, width }: {
  points: MayorActivityPoint[];
  color: string;
  maximum: number;
  width: number;
}) {
  if (width <= 0 || points.length < 2) return null;
  const plotHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;
  const plotWidth = Math.max(0, width - CHART_LEFT - CHART_RIGHT);
  const chartEdgePadding = Math.min(6, plotWidth * 0.02);
  const coordinate = (index: number, count: number) => ({
    x: CHART_LEFT + chartEdgePadding + (plotWidth - chartEdgePadding * 2) * index / (points.length - 1),
    y: CHART_TOP + (1 - count / maximum) * plotHeight,
  });

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {points.map((point, index) => {
        const current = coordinate(index, point.count);
        const previous = index > 0 ? coordinate(index - 1, points[index - 1]?.count ?? 0) : null;
        const horizontalDistance = previous ? current.x - previous.x : 0;
        const verticalDistance = previous ? current.y - previous.y : 0;
        const length = previous ? Math.sqrt(horizontalDistance ** 2 + verticalDistance ** 2) : 0;
        const angle = previous ? Math.atan2(verticalDistance, horizontalDistance) * (180 / Math.PI) : 0;
        if (!previous) return null;

        return <View key={point.date} style={[localStyles.chartLine, { backgroundColor: color, width: length, left: previous.x + horizontalDistance / 2 - length / 2, top: previous.y + verticalDistance / 2 - 0.75, transform: [{ rotate: `${angle}deg` }] }]} />;
      })}
    </View>
  );
}

function GroupedActivityBars({ series, maximum, width }: {
  series: MayorStatusActivitySeries[];
  maximum: number;
  width: number;
}) {
  const points = series[0]?.points ?? [];
  if (width <= 0 || points.length === 0) return null;

  const plotHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;
  const plotWidth = Math.max(0, width - CHART_LEFT - CHART_RIGHT);
  const barSlotWidth = plotWidth / points.length;
  const groupWidth = Math.min(40, Math.max(26, barSlotWidth * 0.82));
  const barGap = 2;
  const barWidth = Math.max(3, (groupWidth - barGap * (series.length - 1)) / series.length);
  const baseline = CHART_HEIGHT - CHART_BOTTOM;

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {points.map((point, pointIndex) => {
        const groupStart = CHART_LEFT + barSlotWidth * (pointIndex + 0.5) - groupWidth / 2;

        return series.map((statusSeries, statusIndex) => {
          const count = statusSeries.points[pointIndex]?.count ?? 0;
          if (count <= 0) return null;

          const height = (count / maximum) * plotHeight;
          const statusPresentation = STATUS_PRESENTATION.find(
            (item) => item.status === statusSeries.status,
          );
          const style = {
            left: groupStart + statusIndex * (barWidth + barGap),
            top: baseline - height,
            width: barWidth,
            height,
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
          };

          return (
            <View key={`${point.date}-${statusSeries.status}`} style={[localStyles.chartBarSegment, style]}>
              <LinearGradient
                colors={[
                  statusPresentation?.barColor ?? colors.primaryLight,
                  statusPresentation?.color ?? colors.primary,
                ]}
                start={{ x: 0, y: 1 }}
                end={{ x: 0, y: 0 }}
                style={localStyles.chartBarGradient}
              />
            </View>
          );
        });
      })}
    </View>
  );
}

const localStyles = StyleSheet.create({
  content: { gap: spacing.md },
  filterGroup: { gap: spacing.xs },
  filterLabel: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.text },
  selector: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  selectorText: { flex: 1, fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingTop: spacing.xs },
  option: { minHeight: 34, maxWidth: '100%', justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  optionActive: { borderColor: colors.text, backgroundColor: colors.text },
  optionText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.text },
  optionTextActive: { color: colors.white },
  stateCard: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  emptyCard: { alignItems: 'center', gap: spacing.xs, padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.white },
  stateTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text, textAlign: 'center' },
  stateText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
  retryButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.themeSoft },
  retryText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.white },
  warningCard: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.lg, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' },
  warningTitle: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  warningText: { fontFamily: fonts.regular, fontSize: fontSizes.xs, lineHeight: 18, color: colors.textMuted },
  warningLink: { fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: colors.primary },
  metricCard: { position: 'relative', gap: spacing.xs, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.text },
  metricLabel: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.primaryLight, textTransform: 'uppercase', letterSpacing: 0.4 },
  metricValue: { fontFamily: fonts.extrabold, fontSize: fontSizes.xxxl, color: colors.white },
  metricHint: { paddingRight: spacing.xxl, fontFamily: fonts.regular, fontSize: fontSizes.xs, color: '#D1D5DB' },
  metricArrow: { position: 'absolute', right: spacing.lg, bottom: spacing.lg },
  activityCard: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  activityHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  activityTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  activityHint: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  activityPeak: { fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: colors.primary, paddingVertical: 3, paddingHorizontal: spacing.sm, borderRadius: radius.full, backgroundColor: colors.primaryLight },
  rangeFilters: { flexDirection: 'row', gap: spacing.xs },
  rangeFilter: { minHeight: 30, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  rangeFilterActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  rangeFilterText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  rangeFilterTextActive: { color: colors.white },
  chartFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chartFilter: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chartFilterActive: { borderColor: colors.text, backgroundColor: colors.primaryLight },
  chartFilterDot: { width: 8, height: 8, borderRadius: 4 },
  chartFilterText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  chartFilterTextActive: { color: colors.text },
  chartCanvas: { height: 142, position: 'relative', marginTop: spacing.xs },
  chartGridLine: { position: 'absolute', left: CHART_LEFT, right: CHART_RIGHT, height: 1, backgroundColor: colors.border },
  chartYAxis: { position: 'absolute', left: CHART_LEFT, top: CHART_TOP, bottom: CHART_BOTTOM, width: 1, backgroundColor: colors.textMuted },
  chartXAxis: { position: 'absolute', left: CHART_LEFT, right: CHART_RIGHT, top: CHART_HEIGHT - CHART_BOTTOM, height: 1, backgroundColor: colors.textMuted },
  chartYAxisLabel: { position: 'absolute', left: 0, width: 24, fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'right' },
  chartXAxisLabel: { position: 'absolute', top: CHART_HEIGHT - CHART_BOTTOM + 8, width: 24, fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center' },
  chartLine: { position: 'absolute', height: 1.5, borderRadius: radius.full },
  chartBarSegment: { position: 'absolute', overflow: 'hidden', borderColor: colors.white, borderWidth: 0.5 },
  chartBarGradient: { width: '100%', height: '100%' },
  chartEmpty: { position: 'absolute', top: 54, left: 38, right: 8, fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center' },
  activityUnavailable: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: '#FFF7ED', fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'center' },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.text },
  sectionHint: { fontFamily: fonts.regular, fontSize: fontSizes.xs, lineHeight: 18, color: colors.textMuted },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusCard: { flexGrow: 1, flexBasis: '43%', minWidth: 140, gap: 2, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  statusCardSelected: { borderColor: colors.text, borderWidth: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 2 },
  statusLabel: { fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: colors.text },
  statusCount: { fontFamily: fonts.extrabold, fontSize: fontSizes.xl, color: colors.text },
  statusPercent: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  unassignedCard: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: '#FED7AA', backgroundColor: '#FFF7ED' },
  unassignedTitle: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text, marginBottom: 2 },
  rankingRow: { gap: spacing.xs },
  rankingHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  rankingName: { flex: 1, fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text },
  rankingCount: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  rankingTrack: { height: 10, flexDirection: 'row', overflow: 'hidden', borderRadius: radius.full, backgroundColor: colors.border },
  rankingFill: { height: '100%', overflow: 'hidden' },
  rankingGradient: { width: '100%', height: '100%' },
  timestamp: { flexShrink: 1, fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'right' },
});
