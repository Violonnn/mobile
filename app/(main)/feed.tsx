import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnnouncementEngagementProvider } from '../../components/official/AnnouncementEngagementProvider';
import OfficialAnnouncementPostCard from '../../components/official/OfficialAnnouncementPostCard';
import PublicIncidentFeed, { type PublicReportStatusFilter } from '../../components/report/PublicIncidentFeed';
import ResidentBottomSheet from '../../components/ui/ResidentBottomSheet';
import { FeedScreenSkeleton } from '../../components/ui/ResidentScreenSkeletons';
import { useResidentData } from '../../context/ResidentDataContext';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { usePublicIncidents } from '../../hooks/usePublicIncidents';
import {
  formatAnnouncementOfficeLabel,
  type AnnouncementRecord,
} from '../../lib/announcements';
import type { CommunityReportSort } from '../../lib/communityReportFeed';
import {
  buildOfficialUpdateFeed,
  type OfficialUpdateFeedScope,
} from '../../lib/officialAnnouncementFeed';
import { normalizeSearchText } from '../../lib/reportProximity';
import { feedStyles as styles } from '../../styles/screens/feed.styles';
import { getResidentBottomNavigationHeight } from '../../styles/components/bottomNav.styles';
import { colors } from '../../styles/theme';

type FeedTab = 'official' | 'community';
type CommunityReportScope = 'barangay' | 'municipality';
type FeedOrder = 'latest' | 'oldest';

const OFFICIAL_PAGE_SIZE = 6;

function matchesAnnouncementSearch(
  announcement: AnnouncementRecord,
  searchQuery: string,
): boolean {
  if (!searchQuery) return true;
  return normalizeSearchText(
    `${announcement.title} ${announcement.body} ${announcement.author.roleLabel}`,
  ).includes(searchQuery);
}

function getOfficialSectionCopy(
  scope: OfficialUpdateFeedScope,
  barangay: string,
  municipality: string,
): { title: string; subtitle: string } {
  if (scope === 'all') {
    return {
      title: `Across ${municipality}`,
      subtitle: `Official updates from the Mayor, MDRRMO, and every barangay in ${municipality}`,
    };
  }

  const localOffice = barangay === 'your area' ? 'your barangay' : `Brgy. ${barangay}`;
  return {
    title: 'Priority updates',
    subtitle: `Mayor, MDRRMO, then ${localOffice}. Newest updates appear first within each office.`,
  };
}

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const bottomNavigationPadding =
    getResidentBottomNavigationHeight(fontScale) + insets.bottom + 16;
  const { reportId, incidentId, openRequest, tab, focus } = useLocalSearchParams<{
    reportId?: string | string[];
    incidentId?: string | string[];
    openRequest?: string | string[];
    tab?: string | string[];
    focus?: string | string[];
  }>();
  const requestedFocusComments = (Array.isArray(focus) ? focus[0] : focus) === 'comments';
  const requestedReportId = Array.isArray(reportId) ? reportId[0] : reportId;
  const requestedIncidentId = Array.isArray(incidentId) ? incidentId[0] : incidentId;
  const requestedOpenKey = Array.isArray(openRequest) ? openRequest[0] : openRequest;
  const requestedTab = Array.isArray(tab) ? tab[0] : tab;
  const [activeTab, setActiveTab] = useState<FeedTab>(
    requestedTab === 'official' ? 'official' : 'community',
  );
  const { profile, barangays, profileInitialLoading, refreshProfile } = useResidentData();
  const {
    announcements,
    error: announcementsError,
    loading: announcementsLoading,
    loadingMore: announcementsLoadingMore,
    hasMore: hasMoreAnnouncements,
    loadMore: loadMoreAnnouncements,
    refresh: refreshAnnouncements,
  } = useAnnouncements({
    enabled: activeTab === 'official',
    limit: 15,
    realtime: false,
  });
  const municipality = profile?.municipality || 'Minglanilla';
  const barangay = profile?.barangay || 'your area';
  const matchingBarangay = useMemo(() => {
    const normalizedBarangay = normalizeSearchText(profile?.barangay ?? '');
    return barangays.find((item) => normalizeSearchText(item.name) === normalizedBarangay) ?? null;
  }, [barangays, profile?.barangay]);
  const barangayId = matchingBarangay?.id ?? null;
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [communityScope, setCommunityScope] = useState<CommunityReportScope>('barangay');
  const [communityOrder, setCommunityOrder] = useState<CommunityReportSort>('activity');
  const [statusFilter, setStatusFilter] = useState<PublicReportStatusFilter>('all');
  const [draftCommunityOrder, setDraftCommunityOrder] = useState<CommunityReportSort>('activity');
  const [draftStatusFilter, setDraftStatusFilter] = useState<PublicReportStatusFilter>('all');
  const [officialScope, setOfficialScope] = useState<OfficialUpdateFeedScope>('priority');
  const [officialOrder, setOfficialOrder] = useState<FeedOrder>('latest');
  const [draftOfficialOrder, setDraftOfficialOrder] = useState<FeedOrder>('latest');
  const [visibleOfficialLimit, setVisibleOfficialLimit] = useState(OFFICIAL_PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const publicFeed = usePublicIncidents({ barangayId: communityScope === 'barangay' ? barangayId : null, enabled: activeTab === 'community' });

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
    // Private submissions live in Your contributions, including notification links.
    router.replace({ pathname: '/(main)/map', params: { reportId: requestedReportId, fromNotification: '1' } });
  }, [requestedReportId, requestedOpenKey, router]);

  useEffect(() => {
    if (!requestedIncidentId) return;
    const frame = requestAnimationFrame(() => setActiveTab('community'));
    return () => cancelAnimationFrame(frame);
  }, [requestedIncidentId]);

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

  const filteredAnnouncements = useMemo(() => {
    const searchMatches = announcements.filter((announcement) =>
      matchesAnnouncementSearch(announcement, normalizedQuery),
    );

    return buildOfficialUpdateFeed(searchMatches, {
      residentBarangayId: barangayId,
      scope: officialScope,
      sort: officialOrder,
    });
  }, [announcements, barangayId, normalizedQuery, officialOrder, officialScope]);
  const officialSectionCopy = getOfficialSectionCopy(
    officialScope,
    barangay,
    municipality,
  );
  const displayedOfficialAnnouncements = useMemo(
    () => filteredAnnouncements.slice(0, visibleOfficialLimit),
    [filteredAnnouncements, visibleOfficialLimit],
  );
  const hasMoreOfficialAnnouncements =
    visibleOfficialLimit < filteredAnnouncements.length || hasMoreAnnouncements;

  useEffect(() => {
    if (
      activeTab !== 'official' ||
      filteredAnnouncements.length > 0 ||
      !hasMoreAnnouncements ||
      announcementsLoadingMore
    ) {
      return;
    }

    // Ranked server pages can contain only other barangays before the
    // resident's priority updates. Continue until a visible update is found.
    void loadMoreAnnouncements();
  }, [
    activeTab,
    announcementsLoadingMore,
    filteredAnnouncements.length,
    hasMoreAnnouncements,
    loadMoreAnnouncements,
  ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (activeTab === 'community') {
        await publicFeed.reload();
      } else {
        await refreshAnnouncements();
      }
    } finally {
      setRefreshing(false);
    }
  };

  const openFeedFilters = () => {
    // Keep selections temporary until the visitor chooses Show results.
    setDraftCommunityOrder(communityOrder);
    setDraftStatusFilter(statusFilter);
    setDraftOfficialOrder(officialOrder);
    setFilterVisible(true);
  };

  const applyFeedFilters = () => {
    if (activeTab === 'community') {
      setCommunityOrder(draftCommunityOrder);
      setStatusFilter(draftStatusFilter);
    } else {
      setOfficialOrder(draftOfficialOrder);
      setVisibleOfficialLimit(OFFICIAL_PAGE_SIZE);
    }

    setFilterVisible(false);
  };

  const confirmOfficialScopeChange = () => {
    const switchingToAllUpdates = officialScope === 'priority';
    const destination = switchingToAllUpdates
      ? `all barangays in ${municipality}`
      : 'your priority updates';

    Alert.alert(
      `Switch to ${destination}?`,
      switchingToAllUpdates
        ? `Your feed will show official updates from every barangay in ${municipality}.`
        : 'Your feed will prioritize Mayor, MDRRMO, then updates from your barangay.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch feed',
          onPress: () => {
            setOfficialScope(switchingToAllUpdates ? 'all' : 'priority');
            setVisibleOfficialLimit(OFFICIAL_PAGE_SIZE);
          },
        },
      ],
    );
  };

  const initialLoading = profileInitialLoading || (announcementsLoading && announcements.length === 0);
  const activeError = announcements.length === 0 ? announcementsError : null;

  return (
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
                  onPress={openFeedFilters}
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
                    setVisibleOfficialLimit(OFFICIAL_PAGE_SIZE);
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
                      setVisibleOfficialLimit(OFFICIAL_PAGE_SIZE);
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
            <PublicIncidentFeed
              incidents={publicFeed.incidents}
              loading={profileInitialLoading || publicFeed.loading}
              error={publicFeed.error}
              loadingMore={publicFeed.loadingMore}
              hasMore={publicFeed.hasMore}
              onLoadMore={() => void publicFeed.loadMore()}
              onRefresh={() => void handleRefresh()}
              refreshing={refreshing}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              sort={communityOrder}
              title={communityScope === 'barangay' ? barangay : 'Across ' + municipality}
              subtitle={communityScope === 'barangay' ? 'Confirmed reports and official updates in your barangay' : 'Confirmed community reports from every barangay'}
              onChangeScope={() => setCommunityScope((scope) => scope === 'barangay' ? 'municipality' : 'barangay')}
              bottomPadding={bottomNavigationPadding}
              requestedIncidentId={requestedIncidentId}
              requestedOpenKey={requestedOpenKey}
              requestedFocusComments={requestedFocusComments}
              onEngagementChange={publicFeed.patchEngagement}
              onViewOnMap={(targetIncidentId, targetReportId) =>
                router.navigate({
                  pathname: '/(main)/map',
                  params: {
                    incidentId: targetIncidentId,
                    publicReportId: targetReportId,
                    openRequest: `${targetIncidentId}-${Date.now()}`,
                  },
                })
              }
            />
          ) : (
            <FlatList
              style={styles.scrollView}
              contentContainerStyle={[
                styles.scrollContent,
                styles.contentInner,
                styles.officialContentInner,
                { paddingBottom: bottomNavigationPadding },
              ]}
              data={initialLoading || activeError ? [] : displayedOfficialAnnouncements}
              keyExtractor={(announcement) => announcement.id}
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
                        {officialSectionCopy.title}
                      </Text>
                      <TouchableOpacity
                        style={styles.feedScopeSwitch}
                        onPress={confirmOfficialScopeChange}
                        accessibilityRole="button"
                        accessibilityLabel={`Switch official updates to ${
                          officialScope === 'priority'
                            ? `all barangays in ${municipality}`
                            : 'your priority updates'
                        }`}
                      >
                        <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.reportSectionSubtitle}>
                      {officialSectionCopy.subtitle}
                    </Text>
                  </View>
                ) : undefined
              }
              renderItem={({ item: announcement, index }) => (
                <OfficialAnnouncementPostCard
                  announcement={announcement}
                  variant="residentFeedPost"
                  officeLabel={formatAnnouncementOfficeLabel(announcement, municipality)}
                  detailCacheScope={profile?.id}
                  cardStyle={
                    index === displayedOfficialAnnouncements.length - 1
                      ? styles.feedPostLast
                      : undefined
                  }
                />
              )}
              ListEmptyComponent={
                initialLoading || (announcementsLoadingMore && filteredAnnouncements.length === 0) ? (
                  <FeedScreenSkeleton variant="official" />
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
                hasMoreOfficialAnnouncements ? (
                  <TouchableOpacity
                    style={styles.seeMoreButton}
                    onPress={() => {
                      const nextLimit = visibleOfficialLimit + OFFICIAL_PAGE_SIZE;
                      setVisibleOfficialLimit(nextLimit);
                      if (nextLimit >= filteredAnnouncements.length && hasMoreAnnouncements) {
                        void loadMoreAnnouncements();
                      }
                    }}
                    disabled={announcementsLoadingMore}
                    accessibilityRole="button"
                    accessibilityLabel="See more official updates"
                  >
                    {announcementsLoadingMore ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Ionicons name="add" size={21} color={colors.text} />
                    )}
                  </TouchableOpacity>
                ) : undefined
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
            showCloseButton={false}
            animationType="slide"
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
                          style={[
                            styles.optionChip,
                            draftCommunityOrder === option && styles.optionChipActive,
                          ]}
                          onPress={() => setDraftCommunityOrder(option)}
                        >
                          <Text style={[
                            styles.optionText,
                            draftCommunityOrder === option && styles.optionTextActive,
                          ]}>
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
                          ['confirmed', 'Confirmed'],
                          ['response_ongoing', 'Response ongoing'],
                          ['withdrawn', 'Corrections'],
                          ['resolved', 'Resolved'],
                        ] as const satisfies readonly (readonly [
                          PublicReportStatusFilter,
                          string,
                        ])[]
                      ).map(([option, label]) => (
                        <TouchableOpacity
                          key={option}
                          style={[
                            styles.optionChip,
                            draftStatusFilter === option && styles.optionChipActive,
                          ]}
                          onPress={() => setDraftStatusFilter(option)}
                        >
                          <Text style={[
                            styles.optionText,
                            draftStatusFilter === option && styles.optionTextActive,
                          ]}>
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
                          style={[
                            styles.optionChip,
                            draftOfficialOrder === option && styles.optionChipActive,
                          ]}
                          onPress={() => setDraftOfficialOrder(option)}
                        >
                          <Text style={[
                            styles.optionText,
                            draftOfficialOrder === option && styles.optionTextActive,
                          ]}>
                            {`${option[0].toUpperCase()}${option.slice(1)}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <TouchableOpacity style={styles.applyButton} onPress={applyFeedFilters}>
                  <Text style={styles.applyButtonText}>Show results</Text>
                </TouchableOpacity>
          </ResidentBottomSheet>

        </View>
      </AnnouncementEngagementProvider>
  );
}
