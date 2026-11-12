import React, { useCallback, useEffect, useRef } from 'react';
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
import type { OfficialReportQueueItem } from '../../lib/officialReports';
import { officialStyles } from '../../styles/screens/official.styles';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';
import { CommandScreenSkeleton } from '../ui/OfficialScreenSkeletons';

type MdrrmoCommandDashboardProps = {
  reports: OfficialReportQueueItem[];
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
  reportsError,
  reportsLoading,
  reportsRefreshing,
  hasMoreReports,
  reportsLoadingMore,
  loadMoreReports,
  reloadReports,
  refreshReports,
}: MdrrmoCommandDashboardProps) {
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
          <CommandEscalationMap
            reports={reports}
            onGestureActiveChange={handleMapGestureActiveChange}
          />
        )}

        {hasMoreReports && !reportsError && (
          <TouchableOpacity
            style={officialStyles.secondaryAction}
            onPress={() => void loadMoreReports()}
            disabled={reportsLoadingMore}
            accessibilityRole="button"
            accessibilityState={{ disabled: reportsLoadingMore }}
          >
            <Text style={officialStyles.secondaryActionText}>
              {reportsLoadingMore ? 'Loading more reports...' : 'Load more reports'}
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
