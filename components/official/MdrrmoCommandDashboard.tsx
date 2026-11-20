import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import MdrrmoHeader from './MdrrmoHeader';
import CommandEscalationMap from './CommandEscalationMap';
import CommandQuickResponse from './CommandQuickResponse';
import MdrrmoBarangayFieldUpdates from './MdrrmoBarangayFieldUpdates';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { useOfficialReportQueue } from '../../hooks/useOfficialReports';
import { useOfficialPortal } from '../../context/OfficialPortalContext';
import type { OfficialReportQueueItem } from '../../lib/officialReports';
import { officialStyles } from '../../styles/screens/official.styles';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';
import { CommandScreenSkeleton } from '../ui/OfficialScreenSkeletons';

type MdrrmoCommandDashboardProps = {
  reports: OfficialReportQueueItem[];
  reportsCount: number;
  reportsError: string | null;
  reportsLoading: boolean;
  reportsRefreshing: boolean;
  hasMoreReports: boolean;
  reportsLoadingMore: boolean;
  loadMoreReports: () => Promise<void>;
  reloadReports: () => Promise<void>;
  refreshReports: () => Promise<void>;
};

export default function MdrrmoCommandDashboard({
  reports,
  reportsCount,
  reportsError,
  reportsLoading,
  reportsRefreshing,
  hasMoreReports,
  reportsLoadingMore,
  loadMoreReports,
  reloadReports,
  refreshReports,
}: MdrrmoCommandDashboardProps) {
  const { scope, officialKind } = useOfficialPortal();
  const activeQueue = useOfficialReportQueue(officialKind === 'MDRRMO' ? scope : null, 'municipal_active');
  const [selectedLane, setSelectedLane] = useState<'requests' | 'active'>('requests');
  const {
    announcements,
    error: announcementsError,
    loading: announcementsLoading,
    refreshing: announcementsRefreshing,
    loadingMore: announcementsLoadingMore,
    hasMore: hasMoreAnnouncements,
    reload: reloadAnnouncements,
    loadMore: loadMoreAnnouncements,
    refresh: refreshAnnouncements,
  } = useAnnouncements({ limit: 20 });
  const scrollRef = useRef<ScrollViewInstance>(null);
  const mapUnlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousRequestsCount = useRef<number | null>(null);
  const laneReports = selectedLane === 'requests' ? reports : activeQueue.reports;
  const laneError = selectedLane === 'requests' ? reportsError : activeQueue.error;
  const laneLoading = selectedLane === 'requests' ? reportsLoading : activeQueue.loading;
  const laneHasMore = selectedLane === 'requests' ? hasMoreReports : activeQueue.hasMore;
  const laneLoadingMore = selectedLane === 'requests' ? reportsLoadingMore : activeQueue.loadingMore;
  const laneReload = selectedLane === 'requests' ? reloadReports : activeQueue.reload;
  const laneLoadMore = selectedLane === 'requests' ? loadMoreReports : activeQueue.loadMore;

  useEffect(() => {
    if (
      reportsLoading
      || activeQueue.loading
      || reportsError
      || activeQueue.error
    ) return;

    const isInitialEmptyRequestLane = previousRequestsCount.current === null;
    const requestsJustEmptied = previousRequestsCount.current !== null
      && previousRequestsCount.current > 0
      && reportsCount === 0;
    previousRequestsCount.current = reportsCount;

    // Automatically surface active cases only on first load or when requests drain.
    if (
      selectedLane !== 'requests'
      || reports.length > 0
      || activeQueue.counts.total === 0
    ) return;
    if (!isInitialEmptyRequestLane && !requestsJustEmptied) return;

    const animationFrame = requestAnimationFrame(() => setSelectedLane('active'));
    return () => cancelAnimationFrame(animationFrame);
  }, [
    selectedLane,
    reportsLoading,
    activeQueue.loading,
    reportsError,
    activeQueue.error,
    reports.length,
    reportsCount,
    activeQueue.counts.total,
  ]);

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

    // Toggle native scroll only — do not re-render, or the map remounts and
    // the selected escalation resets to the first report.
    if (active) {
      scrollRef.current?.setNativeProps({ scrollEnabled: false });
      return;
    }

    mapUnlockTimer.current = setTimeout(() => {
      scrollRef.current?.setNativeProps({ scrollEnabled: true });
      mapUnlockTimer.current = null;
    }, 80);
  }, []);

  async function refreshDashboard() {
    await Promise.all([refreshReports(), activeQueue.refresh(), refreshAnnouncements()]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.commandStickyHeader}>
        <MdrrmoHeader title="Command" showDefaultControls />
      </View>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, styles.commandScrollContent]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        overScrollMode="never"
        refreshControl={
          <RefreshControl
            refreshing={reportsRefreshing || activeQueue.refreshing || announcementsRefreshing}
            onRefresh={() => void refreshDashboard()}
          />
        }
      >
        {laneLoading
          && laneReports.length === 0
          && reportsLoading
          && activeQueue.loading ? (
          <CommandScreenSkeleton />
        ) : (
          <CommandEscalationMap
            reports={laneReports}
            selectedLane={selectedLane}
            onLaneChange={setSelectedLane}
            requestCount={reportsCount}
            activeCount={activeQueue.counts.total}
            laneLoading={laneLoading}
            laneError={laneError}
            onRetry={laneReload}
            onGestureActiveChange={handleMapGestureActiveChange}
          />
        )}

        {laneHasMore && !laneError && (
          <TouchableOpacity
            style={officialStyles.secondaryAction}
            onPress={() => void laneLoadMore()}
            disabled={laneLoadingMore}
            accessibilityRole="button"
            accessibilityState={{ disabled: laneLoadingMore }}
          >
            <Text style={officialStyles.secondaryActionText}>
              {laneLoadingMore ? 'Loading more reports...' : 'Load more reports'}
            </Text>
          </TouchableOpacity>
        )}

        <CommandQuickResponse />

        <MdrrmoBarangayFieldUpdates
          announcements={announcements}
          announcementsError={announcementsError}
          announcementsLoading={announcementsLoading}
          announcementsLoadingMore={announcementsLoadingMore}
          hasMoreAnnouncements={hasMoreAnnouncements}
          loadMoreAnnouncements={loadMoreAnnouncements}
          reloadAnnouncements={reloadAnnouncements}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
