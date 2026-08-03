// app/(main)/feed.tsx — feed tab (no header). Shows the Announcement feed
// (placeholder for now) and a dynamic Report feed that reuses the same
// report-post layout as the map. Reports are sorted (Latest by default,
// toggleable to Relevant or Date/Time) and paginated 5 at a time — scrolling
// past the "+" circle at the end loads the next batch.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { ReportDetailCard } from '../../components/report/ReportDetailCard';
import { ReportEngagementProvider } from '../../components/report/ReportEngagementProvider';
import { useReports } from '../../hooks/useReports';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { type MapReportMarker } from '../../lib/reports';
import { formatPublishedAt } from '../../lib/formatTime';
import { tabStyles as styles } from '../../styles/screens/tab.styles';
import { colors, spacing } from '../../styles/theme';

type SortMode = 'latest' | 'relevant' | 'datetime';

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'latest', label: 'Latest' },
  { key: 'relevant', label: 'Relevant' },
  { key: 'datetime', label: 'Date/Time' },
];

const PAGE_SIZE = 5;
// How close to the bottom (px) before we reveal the next batch of reports.
const LOAD_MORE_THRESHOLD = 80;

function sortReports(reports: MapReportMarker[], mode: SortMode): MapReportMarker[] {
  const copy = [...reports];
  // "Relevant" ranks by engagement (upvotes + comments), then newest first.
  if (mode === 'relevant') {
    return copy.sort((a, b) => {
      const scoreB = b.upvoteCount + b.commentCount;
      const scoreA = a.upvoteCount + a.commentCount;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }
  // "Date/Time" shows oldest first (chronological); "Latest" shows newest first.
  const direction = mode === 'datetime' ? 1 : -1;
  return copy.sort(
    (a, b) =>
      direction *
      (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  );
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  // No live subscription here — the feed refreshes via pull-to-refresh.
  const { reports, error, loading, reload } = useReports({ realtime: false });
  const {
    announcements,
    error: announcementsError,
    loading: announcementsLoading,
    refresh: refreshAnnouncements,
  } = useAnnouncements({ limit: 10 });
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);

  // Prevents a single fast scroll from firing several "load more" bumps before
  // the list re-renders; unlocks once the visible count actually changes.
  const loadLockRef = useRef(false);

  const sortedReports = useMemo(
    () => sortReports(reports, sortMode),
    [reports, sortMode],
  );

  const visibleReports = sortedReports.slice(0, visibleCount);
  const hasMore = visibleCount < sortedReports.length;

  // Restart pagination when the sort order changes so the user starts at the top.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sortMode]);

  useEffect(() => {
    loadLockRef.current = false;
  }, [visibleCount]);

  const loadMore = () => {
    if (loadLockRef.current || !hasMore) return;
    loadLockRef.current = true;
    setVisibleCount((current) =>
      Math.min(current + PAGE_SIZE, sortedReports.length),
    );
  };

  // Pull down from the top: the spinner stretches in, and releasing it
  // triggers a full feed refresh; pagination restarts from the first page.
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([reload(), refreshAnnouncements()]);
    setVisibleCount(PAGE_SIZE);
    setRefreshing(false);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!hasMore) return;
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceFromBottom < LOAD_MORE_THRESHOLD) {
      loadMore();
    }
  };

  const isInitialLoading = loading && reports.length === 0;

  return (
    <ReportEngagementProvider reports={reports}>
      <View style={styles.container}>
      {/* No header on the feed — dark status bar over the white background. */}
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.feedContent, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.themeSoft}
            colors={[colors.themeSoft]}
            progressViewOffset={insets.top}
          />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Announcement</Text>
          {announcementsLoading && announcements.length === 0 ? (
            <View style={styles.emptyBlockPlain}>
              <ActivityIndicator color={colors.themeSoft} />
            </View>
          ) : null}
          {!announcementsLoading && announcementsError ? (
            <View style={styles.emptyBlockPlain}>
              <Ionicons name="warning-outline" size={18} color={colors.text} />
              <Text style={styles.emptyLinePlain}>Could not load announcements</Text>
            </View>
          ) : null}
          {!announcementsLoading &&
            !announcementsError &&
            announcements.length === 0 ? (
            <View style={styles.emptyBlockPlain}>
              <Ionicons name="megaphone-outline" size={18} color={colors.text} />
              <Text style={styles.emptyLinePlain}>No announcements yet</Text>
            </View>
          ) : null}
          {!announcementsError &&
            announcements.map((item) => (
              <View key={item.id} style={styles.emptyBlockPlain}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.emptyLinePlain} numberOfLines={2}>
                    {item.isPinned ? '[Pinned] ' : ''}
                    {item.title}
                  </Text>
                  <Text
                    style={[styles.emptyLinePlain, { opacity: 0.75 }]}
                    numberOfLines={3}
                  >
                    {item.body}
                  </Text>
                  {item.createdAt ? (
                    <Text style={[styles.emptyLinePlain, { opacity: 0.6 }]}>
                      {formatPublishedAt(item.createdAt)}
                    </Text>
                  ) : null}
                  {item.media.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }}>
                      {item.media.map((media) => media.type === 'photo' ? (
                        <Image key={media.id} source={{ uri: media.url }} style={{ width: 120, height: 84, borderRadius: 12 }} />
                      ) : (
                        <View key={media.id} style={{ width: 120, height: 84, borderRadius: 12, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="play" size={22} color={colors.white} />
                        </View>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
              </View>
            ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Report</Text>
            <View style={styles.sortRow}>
              {SORT_OPTIONS.map((option) => {
                const active = sortMode === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.sortChip, active && styles.sortChipActive]}
                    onPress={() => setSortMode(option.key)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Sort by ${option.label}`}
                  >
                    <Text
                      style={[styles.sortChipText, active && styles.sortChipTextActive]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {isInitialLoading ? (
            <View style={styles.reportStateBlock}>
              <ActivityIndicator color={colors.themeSoft} />
            </View>
          ) : error ? (
            <View style={styles.reportStateBlock}>
              <Ionicons name="cloud-offline-outline" size={20} color={colors.textMuted} />
              <Text style={styles.emptyLine}>Could not load reports right now</Text>
            </View>
          ) : sortedReports.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Ionicons name="newspaper-outline" size={18} color={colors.textMuted} />
              <Text style={styles.emptyLine}>No reports yet</Text>
            </View>
          ) : (
            <>
              <View style={styles.reportList}>
                {visibleReports.map((report, index) => (
                  <ReportDetailCard
                    key={report.id}
                    report={report}
                    isLast={index === visibleReports.length - 1 && !hasMore}
                  />
                ))}
              </View>

              {hasMore ? (
                <View style={styles.loadMoreWrap}>
                  <TouchableOpacity
                    style={styles.loadMoreCircle}
                    onPress={loadMore}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Show more reports"
                  >
                    <Ionicons name="add" size={26} color={colors.white} />
                  </TouchableOpacity>
                  <Text style={styles.loadMoreHint}>Scroll for more</Text>
                </View>
              ) : (
                <Text style={styles.feedEndNote}>You&apos;re all caught up</Text>
              )}
            </>
          )}
        </View>
      </ScrollView>
      </View>
    </ReportEngagementProvider>
  );
}
