import React, { useCallback, useEffect, useRef } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import BdrrmoCommandIntakeMap from './BdrrmoCommandIntakeMap';
import BdrrmoCommandQuickResponse from './BdrrmoCommandQuickResponse';
import BdrrmoLocalUpdates from './BdrrmoLocalUpdates';
import MdrrmoHeader from './MdrrmoHeader';
import { CommandScreenSkeleton } from '../ui/OfficialScreenSkeletons';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import type { OfficialReportQueueItem } from '../../lib/officialReports';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';
import { officialStyles } from '../../styles/screens/official.styles';

type Props = {
  reports: OfficialReportQueueItem[];
  reportsError: string | null;
  reportsLoading: boolean;
  reportsRefreshing: boolean;
  assignedBarangayId: string | null;
  assignedBarangay: string | null;
  reloadReports: () => Promise<void>;
  refreshReports: () => Promise<void>;
};

export default function BdrrmoCommandDashboard({
  reports,
  reportsError,
  reportsLoading,
  reportsRefreshing,
  assignedBarangayId,
  assignedBarangay,
  reloadReports,
  refreshReports,
}: Props) {
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
  const scrollRef = useRef<ScrollView>(null);
  const mapUnlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Prevent the page from stealing a drag while the user operates the map.
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
    await Promise.all([refreshReports(), refreshAnnouncements()]);
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
            refreshing={reportsRefreshing || announcementsRefreshing}
            onRefresh={() => void refreshDashboard()}
          />
        }
      >
        {reportsLoading && reports.length === 0 ? (
          <CommandScreenSkeleton />
        ) : reportsError ? (
          <View style={[officialStyles.stateBox, styles.padded]}>
            <Text style={officialStyles.stateTitle}>Could not load command updates</Text>
            <Text style={officialStyles.stateBody}>{reportsError}</Text>
            <TouchableOpacity style={officialStyles.retryButton} onPress={() => void reloadReports()}>
              <Text style={officialStyles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <BdrrmoCommandIntakeMap
            reports={reports}
            assignedBarangay={assignedBarangay}
            onGestureActiveChange={handleMapGestureActiveChange}
          />
        )}

        <BdrrmoCommandQuickResponse />

        <BdrrmoLocalUpdates
          announcements={announcements}
          assignedBarangayId={assignedBarangayId}
          assignedBarangay={assignedBarangay}
          error={announcementsError}
          loading={announcementsLoading}
          loadingMore={announcementsLoadingMore}
          hasMore={hasMoreAnnouncements}
          onLoadMore={loadMoreAnnouncements}
          onReload={reloadAnnouncements}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
