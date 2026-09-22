import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SectionList,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnnouncementEngagementProvider } from '../../components/official/AnnouncementEngagementProvider';
import OfficialAnnouncementPostCard from '../../components/official/OfficialAnnouncementPostCard';
import { ReportDetailCard } from '../../components/report/ReportDetailCard';
import { ReportEngagementProvider } from '../../components/report/ReportEngagementProvider';
import ResidentBottomSheet from '../../components/ui/ResidentBottomSheet';
import { FeedScreenSkeleton } from '../../components/ui/ResidentScreenSkeletons';
import { useResidentData } from '../../context/ResidentDataContext';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { useReports } from '../../hooks/useReports';
import {
  formatAnnouncementOfficeLabel,
  type AnnouncementRecord,
} from '../../lib/announcements';
import {
  buildCommunityReportSections,
  type CommunityReportScope,
  type CommunityReportSort,
  type CommunityReportStatusFilter,
} from '../../lib/communityReportFeed';
import {
  formatDistance,
  normalizeSearchText,
  type Coordinate,
} from '../../lib/reportProximity';
import { feedStyles as styles } from '../../styles/screens/feed.styles';
import { colors } from '../../styles/theme';

type FeedTab = 'official' | 'community';
type FeedOrder = 'latest' | 'oldest';
type OfficialFilter = 'all' | 'municipal' | 'barangay';

const COMMUNITY_PAGE_SIZE = 6;

function matchesAnnouncementSearch(
  announcement: AnnouncementRecord,
  searchQuery: string,
): boolean {
  if (!searchQuery) return true;
  return normalizeSearchText(
    `${announcement.title} ${announcement.body} ${announcement.author.roleLabel}`,
  ).includes(searchQuery);
}

function getCommunitySectionCopy(
  scope: CommunityReportScope,
  barangay: string,
  municipality: string,
): { title: string; subtitle: string } {
  if (scope === 'barangay') {
    return {
      title: barangay === 'your area' ? 'Your barangay' : barangay,
      subtitle: 'Reports routed to your barangay response team',
    };
  }

  return {
    title: `Across ${municipality}`,
    subtitle: `Reports from every barangay in ${municipality}`,
  };
}

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reportId, openRequest, tab } = useLocalSearchParams<{
    reportId?: string | string[];
    openRequest?: string | string[];
    tab?: string | string[];
  }>();
  const requestedReportId = Array.isArray(reportId) ? reportId[0] : reportId;
  const requestedOpenKey = Array.isArray(openRequest) ? openRequest[0] : openRequest;
  const requestedTab = Array.isArray(tab) ? tab[0] : tab;
  const handledRequestedScopeKey = useRef<string | undefined>(undefined);
  const { profile, barangays, profileInitialLoading, refreshProfile } = useResidentData();
  const {
    reports,
    error: reportsError,
    loading: reportsLoading,
    loadingMore: reportsLoadingMore,
    hasMore: hasMoreServerReports,
    reload,
    loadMore: loadMoreReports,
  } = useReports({
    realtime: false,
    limit: 15,
    includeMediaSummaries: true,
    includeLatestActivity: true,
  });
  const {
    announcements,
    error: announcementsError,
    loading: announcementsLoading,
    loadingMore: announcementsLoadingMore,
    hasMore: hasMoreAnnouncements,
    loadMore: loadMoreAnnouncements,
    refresh: refreshAnnouncements,
  } = useAnnouncements({ limit: 15, realtime: false });

  const [activeTab, setActiveTab] = useState<FeedTab>('community');
  const municipality = profile?.municipality || 'Minglanilla';
  const barangay = profile?.barangay || 'your area';
  const matchingBarangay = useMemo(() => {
    const normalizedBarangay = normalizeSearchText(profile?.barangay ?? '');
    return barangays.find((item) => normalizeSearchText(item.name) === normalizedBarangay) ?? null;
  }, [barangays, profile?.barangay]);
  const barangayId = matchingBarangay?.id ?? null;
  const barangayCenter = useMemo<Coordinate | null>(
    () =>
      matchingBarangay?.latitude != null && matchingBarangay.longitude != null
        ? { latitude: matchingBarangay.latitude, longitude: matchingBarangay.longitude }
        : null,
    [matchingBarangay],
  );
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [communityScope, setCommunityScope] = useState<CommunityReportScope>('barangay');
  const [communityOrder, setCommunityOrder] = useState<CommunityReportSort>('activity');
  const [statusFilter, setStatusFilter] = useState<CommunityReportStatusFilter>('all');
  const [visibleCommunityLimit, setVisibleCommunityLimit] = useState(COMMUNITY_PAGE_SIZE);
  const [officialFilter, setOfficialFilter] = useState<OfficialFilter>('all');
  const [officialOrder, setOfficialOrder] = useState<FeedOrder>('latest');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // A returning visitor should see the normal feed header, not a stale open search or sheet.
      setSearchVisible(false);
      setFilterVisible(false);
      void refreshProfile();
    }, [refreshProfile]),
  );

  useEffect(() => {
    if (requestedTab !== 'official') return;
    const frameId = requestAnimationFrame(() => setActiveTab('official'));
    return () => cancelAnimationFrame(frameId);
  }, [requestedTab]);

  useEffect(() => {
    if (!requestedReportId) return;

    // Wait for the tab route to finish focusing before opening its requested post.
    const frameId = requestAnimationFrame(() => setActiveTab('community'));
    return () => cancelAnimationFrame(frameId);
  }, [requestedReportId, requestedOpenKey]);

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

  useEffect(() => {
    if (!requestedReportId || !barangayId) return;
    const requestedScopeKey = requestedOpenKey ?? requestedReportId;
    if (handledRequestedScopeKey.current === requestedScopeKey) return;

    const requestedReport = reports.find((report) => report.id === requestedReportId);
    if (!requestedReport) return;
    if (requestedReport.barangay_id === barangayId) {
      handledRequestedScopeKey.current = requestedScopeKey;
      return;
    }

    // Reports opened from a map or notification must remain reachable even
    // when they belong to another barangay.
    const frameId = requestAnimationFrame(() => {
      handledRequestedScopeKey.current = requestedScopeKey;
      setCommunityScope('municipality');
      setVisibleCommunityLimit(COMMUNITY_PAGE_SIZE);
    });
    return () => cancelAnimationFrame(frameId);
  }, [barangayId, reports, requestedReportId, requestedOpenKey]);

  const communitySections = useMemo(
    () =>
      buildCommunityReportSections(reports, {
        barangayCenter,
        barangayId,
        requestedReportId,
        searchQuery: normalizedQuery,
        scope: communityScope,
        sort: communityOrder,
        statusFilter,
      }),
    [
      barangayCenter,
      barangayId,
      communityOrder,
      communityScope,
      normalizedQuery,
      reports,
      requestedReportId,
      statusFilter,
    ],
  );

  const communityReportCount = communitySections[0]?.data.length ?? 0;
  const displayedCommunitySections = useMemo(
    () =>
      communitySections.map((section) => ({
        ...section,
        data: section.data.slice(0, visibleCommunityLimit),
      })),
    [communitySections, visibleCommunityLimit],
  );
  const hasMoreCommunityReports =
    visibleCommunityLimit < communityReportCount || hasMoreServerReports;
  const communitySectionCopy = getCommunitySectionCopy(
    communityScope,
    barangay,
    municipality,
  );

  const filteredAnnouncements = useMemo(() => {
    return announcements
      .filter((announcement) => {
        if (!matchesAnnouncementSearch(announcement, normalizedQuery)) return false;
        if (officialFilter === 'municipal') return announcement.scope === 'municipal';
        if (officialFilter === 'barangay') return announcement.scope === 'barangay';
        return true;
      })
      .sort((first, second) => {
        const firstTime = new Date(first.createdAt).getTime();
        const secondTime = new Date(second.createdAt).getTime();
        return officialOrder === 'latest' ? secondTime - firstTime : firstTime - secondTime;
      });
  }, [announcements, normalizedQuery, officialFilter, officialOrder]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([reload(), refreshAnnouncements()]);
    setRefreshing(false);
  };

  const openReportOnMap = useCallback(
    (targetReportId: string) => {
      router.navigate({
        pathname: '/(main)/map',
        params: { reportId: targetReportId },
      });
    },
    [router],
  );

  const confirmCommunityScopeChange = () => {
    const switchingToMunicipality = communityScope === 'barangay';
    const destination = switchingToMunicipality
      ? `Across ${municipality}`
      : barangay === 'your area'
        ? 'your barangay'
        : barangay;

    Alert.alert(
      `Switch to ${destination}?`,
      switchingToMunicipality
        ? `Your feed will show community reports from all barangays in ${municipality}.`
        : `Your feed will show only reports from ${destination}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch feed',
          onPress: () => {
            setCommunityScope(
              switchingToMunicipality ? 'municipality' : 'barangay',
            );
            setVisibleCommunityLimit(COMMUNITY_PAGE_SIZE);
          },
        },
      ],
    );
  };

  const initialLoading =
    profileInitialLoading ||
    (activeTab === 'community'
      ? reportsLoading && reports.length === 0
      : announcementsLoading && announcements.length === 0);
  const activeError =
    activeTab === 'community'
      ? reports.length === 0
        ? reportsError
        : null
      : announcements.length === 0
        ? announcementsError
        : null;

  return (
    <ReportEngagementProvider reports={reports}>
      <AnnouncementEngagementProvider announcements={announcements}>
        <View style={styles.screen}>
          <StatusBar style="dark" />

          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <View style={styles.headerInner}>
              <View>
                <Text style={styles.title}>Community</Text>
                <View style={styles.communityLocationRow}>
                  <Ionicons name="location-sharp" size={14} color={colors.textMuted} />
                  <Text style={styles.communityEyebrow}>{municipality}</Text>
                </View>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => setSearchVisible((current) => !current)}
                  accessibilityRole="button"
                  accessibilityLabel="Search feed"
                >
                  <Ionicons name={searchVisible ? 'close' : 'search'} size={29} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => setFilterVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Filter feed"
                >
                  <Ionicons name="options-outline" size={29} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {searchVisible ? (
              <View style={styles.searchBox}>
                <Ionicons name="search" size={20} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={(value) => {
                    setSearchQuery(value);
                    setVisibleCommunityLimit(COMMUNITY_PAGE_SIZE);
                  }}
                  placeholder="Search updates and reports"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  returnKeyType="search"
                />
                {searchQuery ? (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery('');
                      setVisibleCommunityLimit(COMMUNITY_PAGE_SIZE);
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            <View style={styles.tabs}>
              <TouchableOpacity
                style={styles.tabButton}
                onPress={() => setActiveTab('official')}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'official' }}
              >
                <Text style={[styles.tabText, activeTab === 'official' && styles.tabTextActive]}>
                  Official updates
                </Text>
                {activeTab === 'official' ? <View style={styles.tabIndicator} /> : null}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tabButton}
                onPress={() => setActiveTab('community')}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'community' }}
              >
                <Text style={[styles.tabText, activeTab === 'community' && styles.tabTextActive]}>
                  Community reports
                </Text>
                {activeTab === 'community' ? <View style={styles.tabIndicator} /> : null}
              </TouchableOpacity>
            </View>
          </View>

          {activeTab === 'community' ? (
            <SectionList
              style={styles.scrollView}
              contentContainerStyle={[
                styles.communityListContent,
                { paddingBottom: insets.bottom + 118 },
              ]}
              sections={initialLoading || activeError ? [] : displayedCommunitySections}
              keyExtractor={(item) => item.report.id}
              stickySectionHeadersEnabled={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={7}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
              ListHeaderComponent={
                !initialLoading && !activeError ? (
                  <View style={styles.reportSectionHeader}>
                    <View style={styles.reportSectionTitleRow}>
                      <Text style={styles.reportSectionTitle}>
                        {communitySectionCopy.title}
                      </Text>
                      <TouchableOpacity
                        style={styles.feedScopeSwitch}
                        onPress={confirmCommunityScopeChange}
                        accessibilityRole="button"
                        accessibilityLabel={`Switch feed to ${
                          communityScope === 'barangay'
                            ? `Across ${municipality}`
                            : barangay
                        }`}
                      >
                        <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.reportSectionSubtitle}>
                      {communitySectionCopy.subtitle}
                    </Text>
                  </View>
                ) : null
              }
              ListFooterComponent={
                hasMoreCommunityReports ? (
                  <TouchableOpacity
                    style={styles.seeMoreButton}
                    onPress={() => {
                      const nextLimit = visibleCommunityLimit + COMMUNITY_PAGE_SIZE;
                      setVisibleCommunityLimit(nextLimit);
                      if (nextLimit >= communityReportCount && hasMoreServerReports) {
                        void loadMoreReports();
                      }
                    }}
                    disabled={reportsLoadingMore}
                    accessibilityRole="button"
                    accessibilityLabel="See more community reports"
                  >
                    {reportsLoadingMore ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Ionicons name="add" size={21} color={colors.text} />
                    )}
                  </TouchableOpacity>
                ) : null
              }
              ListEmptyComponent={
                initialLoading ? (
                  <FeedScreenSkeleton />
                ) : activeError ? (
                  <View style={styles.stateBlock}>
                    <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />
                    <Text style={styles.stateTitle}>Feed unavailable</Text>
                    <Text style={styles.stateText}>{activeError}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
                      <Text style={styles.retryText}>Try again</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.stateBlockCompact}>
                    <Ionicons name="documents-outline" size={27} color={colors.textMuted} />
                    <Text style={styles.stateTitle}>No community reports found</Text>
                    <Text style={styles.stateText}>
                      Pull down to refresh or adjust the feed filters.
                    </Text>
                  </View>
                )
              }
              renderItem={({ item, index, section }) => (
                <ReportDetailCard
                  report={item.report}
                  isLast={index === section.data.length - 1}
                  variant="residentFeed"
                  distanceLabel={
                    item.distance == null ? undefined : formatDistance(item.distance)
                  }
                  openRequestKey={
                    item.report.id === requestedReportId
                      ? requestedOpenKey ?? requestedReportId
                      : undefined
                  }
                  onViewOnMap={openReportOnMap}
                />
              )}
            />
          ) : (
            <FlatList
              style={styles.scrollView}
              contentContainerStyle={[
                styles.scrollContent,
                styles.contentInner,
                styles.officialContentInner,
                { paddingBottom: insets.bottom + 118 },
              ]}
              data={initialLoading || activeError ? [] : filteredAnnouncements}
              keyExtractor={(announcement) => announcement.id}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={7}
              onEndReached={() => {
                if (hasMoreAnnouncements) void loadMoreAnnouncements();
              }}
              onEndReachedThreshold={0.4}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
              renderItem={({ item: announcement, index }) => (
                <OfficialAnnouncementPostCard
                  announcement={announcement}
                  variant="residentFeedPost"
                  officeLabel={formatAnnouncementOfficeLabel(announcement, municipality)}
                  cardStyle={
                    index === filteredAnnouncements.length - 1
                      ? styles.feedPostLast
                      : undefined
                  }
                />
              )}
              ListEmptyComponent={
                initialLoading ? (
                  <FeedScreenSkeleton />
                ) : activeError ? (
                  <View style={styles.stateBlock}>
                    <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />
                    <Text style={styles.stateTitle}>Feed unavailable</Text>
                    <Text style={styles.stateText}>{activeError}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
                      <Text style={styles.retryText}>Try again</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.stateBlockCompact}>
                    <Ionicons name="megaphone-outline" size={27} color={colors.textMuted} />
                    <Text style={styles.stateTitle}>No official updates found</Text>
                    <Text style={styles.stateText}>
                      Pull down to refresh or adjust the feed filters.
                    </Text>
                  </View>
                )
              }
              ListFooterComponent={
                announcementsLoadingMore ? (
                  <ActivityIndicator color={colors.primary} />
                ) : null
              }
            />
          )}

          <ResidentBottomSheet
            visible={filterVisible}
            onClose={() => setFilterVisible(false)}
            initialHeightRatio={0.55}
            minimumHeight={420}
            sheetStyle={styles.filterSheet}
            handleAccessibilityLabel="Resize feed filters"
          >
                <View style={styles.sheetHeader}>
                  <View>
                    <Text style={styles.sheetTitle}>Feed filters</Text>
                    <Text style={styles.sheetSubtitle}>
                      {activeTab === 'community' ? 'Community reports' : 'Official updates'}
                    </Text>
                  </View>
                </View>

                {activeTab === 'community' ? (
                  <>
                    <Text style={styles.filterLabel}>Sort by</Text>
                    <View style={styles.optionRow}>
                      {(
                        [
                          ['activity', 'Latest Activity'],
                          ['newest', 'Newest'],
                          ['oldest', 'Oldest'],
                        ] as const
                      ).map(([option, label]) => (
                        <TouchableOpacity
                          key={option}
                          style={[styles.optionChip, communityOrder === option && styles.optionChipActive]}
                          onPress={() => {
                            setCommunityOrder(option);
                            setVisibleCommunityLimit(COMMUNITY_PAGE_SIZE);
                          }}
                        >
                          <Text style={[styles.optionText, communityOrder === option && styles.optionTextActive]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.filterLabel}>Status</Text>
                    <View style={styles.optionRow}>
                      {(
                        [
                          ['all', 'All'],
                          ['active', 'Active'],
                          ['unverified', 'Under review'],
                          ['verified', 'Verified'],
                          ['escalated', 'Escalated'],
                          ['resolved', 'Resolved'],
                        ] as const satisfies readonly (readonly [
                          CommunityReportStatusFilter,
                          string,
                        ])[]
                      ).map(([option, label]) => (
                        <TouchableOpacity
                          key={option}
                          style={[styles.optionChip, statusFilter === option && styles.optionChipActive]}
                          onPress={() => {
                            setStatusFilter(option);
                            setVisibleCommunityLimit(COMMUNITY_PAGE_SIZE);
                          }}
                        >
                          <Text style={[styles.optionText, statusFilter === option && styles.optionTextActive]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.filterLabel}>Sort by</Text>
                    <View style={styles.optionRow}>
                      {(['latest', 'oldest'] as FeedOrder[]).map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={[styles.optionChip, officialOrder === option && styles.optionChipActive]}
                          onPress={() => setOfficialOrder(option)}
                        >
                          <Text style={[styles.optionText, officialOrder === option && styles.optionTextActive]}>
                            {`${option[0].toUpperCase()}${option.slice(1)}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.filterLabel}>Update scope</Text>
                    <View style={styles.optionRow}>
                      {(['all', 'municipal', 'barangay'] as OfficialFilter[]).map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={[styles.optionChip, officialFilter === option && styles.optionChipActive]}
                          onPress={() => setOfficialFilter(option)}
                        >
                          <Text style={[styles.optionText, officialFilter === option && styles.optionTextActive]}>
                            {`${option[0].toUpperCase()}${option.slice(1)}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <TouchableOpacity style={styles.applyButton} onPress={() => setFilterVisible(false)}>
                  <Text style={styles.applyButtonText}>Show results</Text>
                </TouchableOpacity>
          </ResidentBottomSheet>

        </View>
      </AnnouncementEngagementProvider>
    </ReportEngagementProvider>
  );
}
