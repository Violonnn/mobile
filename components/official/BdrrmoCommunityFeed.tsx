import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  type StyleProp,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnnouncementEngagementProvider } from './AnnouncementEngagementProvider';
import MdrrmoHeader from './MdrrmoHeader';
import OfficialAnnouncementPostCard from './OfficialAnnouncementPostCard';
import OfficialReportPostCard, { officialQueueItemToPost } from './OfficialReportPostCard';
import ProfileAvatar from '../profile/ProfileAvatar';
import { ReportEngagementProvider } from '../report/ReportEngagementProvider';
import { CommunityScreenSkeleton } from '../ui/OfficialScreenSkeletons';
import { formatAnnouncementOfficeLabel, type AnnouncementRecord } from '../../lib/announcements';
import {
  buildCommunityReportSections,
  type CommunityReportSort,
  type CommunityReportStatusFilter,
} from '../../lib/communityReportFeed';
import type { OfficialReportQueueItem } from '../../lib/officialReports';
import type { OfficialPublicProfile } from '../../lib/profile';
import { mdrrmoCommunityStyles as styles } from '../../styles/screens/mdrrmoCommunity.styles';
import { colors } from '../../styles/theme';

type FeedTab = 'official' | 'community';
type AnnouncementSort = 'newest' | 'oldest';
type BdrrmoReportStatusFilter = Exclude<CommunityReportStatusFilter, 'active' | 'escalated'>;

const REPORT_STATUS_OPTIONS: { value: BdrrmoReportStatusFilter; label: string }[] = [
  { value: 'all', label: 'All reports' },
  { value: 'unverified', label: 'Unverified' },
  { value: 'verified', label: 'Verified' },
  { value: 'resolved', label: 'Resolved' },
];

const REPORT_SORT_OPTIONS: { value: CommunityReportSort; label: string }[] = [
  { value: 'activity', label: 'Latest Activity' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

const ANNOUNCEMENT_SORT_OPTIONS: { value: AnnouncementSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];

type Props = {
  announcements: AnnouncementRecord[];
  announcementError: string | null;
  announcementsLoading: boolean;
  announcementsLoadingMore: boolean;
  reports: OfficialReportQueueItem[];
  reportsError: string | null;
  reportsLoading: boolean;
  officialProfile: OfficialPublicProfile | null;
  visibleReportCount: number;
  assignedBarangayId: string | null;
  initialTab: FeedTab;
  refreshing: boolean;
  mediaSelectionType: 'photo' | 'video' | null;
  onCompose: () => void;
  onComposeWithMedia: (type: 'photo' | 'video') => void;
  onRetryAnnouncements: () => void;
  onRetryReports: () => void;
  onRefresh: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  contentContainerStyle: StyleProp<ViewStyle>;
};

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function matchesSearch(value: string, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return normalizeSearchText(value).includes(normalizedQuery);
}

export default function BdrrmoCommunityFeed({
  announcements,
  announcementError,
  announcementsLoading,
  announcementsLoadingMore,
  reports,
  reportsError,
  reportsLoading,
  officialProfile,
  visibleReportCount,
  assignedBarangayId,
  initialTab,
  refreshing,
  mediaSelectionType,
  onCompose,
  onComposeWithMedia,
  onRetryAnnouncements,
  onRetryReports,
  onRefresh,
  onScroll,
  contentContainerStyle,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<FeedTab>(initialTab);
  const [previousInitialTab, setPreviousInitialTab] = useState(initialTab);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [announcementSort, setAnnouncementSort] = useState<AnnouncementSort>('newest');
  const [reportSort, setReportSort] = useState<CommunityReportSort>('activity');
  const [reportStatusFilter, setReportStatusFilter] = useState<BdrrmoReportStatusFilter>('all');
  const [draftAnnouncementSort, setDraftAnnouncementSort] = useState<AnnouncementSort>('newest');
  const [draftReportSort, setDraftReportSort] = useState<CommunityReportSort>('activity');
  const [draftReportStatusFilter, setDraftReportStatusFilter] =
    useState<BdrrmoReportStatusFilter>('all');

  useFocusEffect(
    useCallback(() => {
      // Preserve the selected feed and filters, but dismiss temporary controls on return.
      setSearchVisible(false);
      setFiltersVisible(false);
      return undefined;
    }, []),
  );

  if (initialTab !== previousInitialTab) {
    setPreviousInitialTab(initialTab);
    setActiveTab(initialTab);
    setSearchQuery('');
  }

  const normalizedQuery = normalizeSearchText(searchQuery);
  const compactHeader = windowWidth < 360;
  const initials = [officialProfile?.first_name, officialProfile?.last_name]
    .filter((part) => part?.trim())
    .map((part) => part!.trim().charAt(0).toUpperCase())
    .join('') || 'BD';

  const filteredAnnouncements = useMemo(
    () =>
      announcements
        .filter((announcement) =>
          matchesSearch(
            `${announcement.title} ${announcement.body} ${announcement.author.firstName} ${announcement.author.lastName} ${announcement.author.roleLabel}`,
            normalizedQuery,
          ),
        )
        .sort((first, second) => {
          const difference =
            new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
          return announcementSort === 'newest' ? difference : -difference;
        }),
    [announcementSort, announcements, normalizedQuery],
  );

  const scopedReports = useMemo(() => {
    if (!assignedBarangayId) return [];

    // Keep this UI-level guard in addition to the scoped query so an escalated
    // or out-of-barangay report can never appear in the BDRRMO community feed.
    return reports.filter(
      (report) =>
        report.barangayId === assignedBarangayId && report.status !== 'escalated',
    );
  }, [assignedBarangayId, reports]);

  const scopedReportPosts = useMemo(
    () => scopedReports.map(officialQueueItemToPost),
    [scopedReports],
  );

  const filteredReports = useMemo(() => {
    const reportById = new Map(scopedReports.map((report) => [report.id, report]));
    const sections = buildCommunityReportSections(
      scopedReportPosts,
      {
        barangayCenter: null,
        barangayId: assignedBarangayId,
        searchQuery,
        scope: 'barangay',
        sort: reportSort,
        statusFilter: reportStatusFilter,
      },
    );

    return sections
      .flatMap((section) => section.data)
      .map((item) => reportById.get(item.report.id))
      .filter((report): report is OfficialReportQueueItem => report != null);
  }, [
    assignedBarangayId,
    reportSort,
    reportStatusFilter,
    scopedReportPosts,
    scopedReports,
    searchQuery,
  ]);

  const visibleReports = filteredReports.slice(0, visibleReportCount);

  function selectTab(tab: FeedTab) {
    setActiveTab(tab);
    setSearchQuery('');
  }

  function openFilters() {
    setDraftAnnouncementSort(announcementSort);
    setDraftReportSort(reportSort);
    setDraftReportStatusFilter(reportStatusFilter);
    setFiltersVisible(true);
  }

  function closeFilters() {
    setFiltersVisible(false);
  }

  function applyFilters() {
    setAnnouncementSort(draftAnnouncementSort);
    setReportSort(draftReportSort);
    setReportStatusFilter(draftReportStatusFilter);
    setFiltersVisible(false);
  }

  function openReport(reportId: string, focusComments = false) {
    const suffix = focusComments ? '?focus=comments' : '';
    router.push(`/official/${reportId}${suffix}` as Href);
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.fixedHeaderArea, styles.mdrrmoFixedHeaderArea]}>
        <MdrrmoHeader
          title="Community"
          right={
            <>
              <TouchableOpacity
                style={styles.headerAction}
                onPress={() => setSearchVisible((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={searchVisible ? 'Close search' : 'Search community feed'}
              >
                <Ionicons name={searchVisible ? 'close' : 'search'} size={25} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerAction}
                onPress={openFilters}
                accessibilityRole="button"
                accessibilityLabel={`Filter ${activeTab === 'community' ? 'community reports' : 'official updates'}`}
              >
                <Ionicons name="options-outline" size={25} color={colors.text} />
              </TouchableOpacity>
              {!compactHeader ? (
                <TouchableOpacity
                  onPress={() => router.push('/official/settings' as Href)}
                  accessibilityRole="button"
                  accessibilityLabel="Open settings"
                >
                  <ProfileAvatar
                    avatarPath={officialProfile?.avatar_path}
                    firstName={officialProfile?.first_name}
                    lastName={officialProfile?.last_name}
                    fallback={initials}
                    size={42}
                    style={styles.avatar}
                    textStyle={styles.avatarText}
                  />
                </TouchableOpacity>
              ) : null}
            </>
          }
        />

        {searchVisible ? (
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={
                activeTab === 'community'
                  ? 'Search local reports'
                  : 'Search official updates'
              }
              placeholderTextColor={colors.textMuted}
              autoFocus
              returnKeyType="search"
            />
            {searchQuery ? (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.tabs} accessibilityRole="tablist">
          {(['official', 'community'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={styles.tabButton}
              onPress={() => selectTab(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'official' ? 'Official updates' : 'Community reports'}
              </Text>
              {activeTab === tab ? <View style={styles.tabIndicator} /> : null}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.feedScroll}
        contentContainerStyle={contentContainerStyle}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {activeTab === 'community' ? (
          <View style={[styles.feedContent, styles.communityFeedContent]}>
            {reportsLoading && reports.length === 0 ? <CommunityScreenSkeleton /> : null}
            {reportsLoading && reports.length > 0 ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.stateBody}>Loading community reports…</Text>
              </View>
            ) : null}
            {!reportsLoading && reportsError ? (
              <View style={styles.stateBox} accessibilityRole="alert">
                <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />
                <Text style={styles.stateTitle}>Community reports unavailable</Text>
                <Text style={styles.stateBody}>{reportsError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={onRetryReports}>
                  <Text style={styles.retryText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {!reportsLoading && !reportsError && visibleReports.length === 0 ? (
              <View style={[styles.emptyState, styles.communityEmptyState]}>
                <Ionicons name="documents-outline" size={28} color={colors.navigationActive} />
                <Text style={styles.stateTitle}>No community reports found</Text>
                <Text style={styles.stateBody}>
                  Try another status or adjust the report filters.
                </Text>
              </View>
            ) : null}
            {!reportsLoading && !reportsError && visibleReports.length > 0 ? (
              <ReportEngagementProvider reports={scopedReportPosts}>
                {visibleReports.map((report, index) => (
                  <OfficialReportPostCard
                    key={report.id}
                    report={report}
                    variant="residentFeed"
                    isLast={index === visibleReports.length - 1}
                    onPress={() => openReport(report.id)}
                    onCommentPress={() => openReport(report.id, true)}
                  />
                ))}
              </ReportEngagementProvider>
            ) : null}
          </View>
        ) : (
          <View style={[styles.feedContent, styles.officialFeedContent]}>
            <View style={styles.composerRow}>
              <ProfileAvatar
                avatarPath={officialProfile?.avatar_path}
                firstName={officialProfile?.first_name}
                lastName={officialProfile?.last_name}
                fallback={initials}
                size={36}
                style={styles.avatar}
                textStyle={styles.avatarText}
              />
              <TouchableOpacity
                style={styles.composerPrompt}
                onPress={onCompose}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Create an official update"
              >
                <Text style={styles.composerPlaceholder} numberOfLines={1}>
                  Post an alert or advisory…
                </Text>
              </TouchableOpacity>
              <View style={styles.composerMediaActions}>
                <TouchableOpacity
                  style={styles.composerMediaButton}
                  onPress={() => onComposeWithMedia('photo')}
                  disabled={mediaSelectionType !== null}
                  accessibilityRole="button"
                  accessibilityLabel="Choose photos for a new announcement"
                >
                  {mediaSelectionType === 'photo' ? (
                    <ActivityIndicator size="small" color={colors.navigationActive} />
                  ) : (
                    <Ionicons name="images-outline" size={21} color={colors.navigationActive} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.composerMediaButton}
                  onPress={() => onComposeWithMedia('video')}
                  disabled={mediaSelectionType !== null}
                  accessibilityRole="button"
                  accessibilityLabel="Choose a video for a new announcement"
                >
                  {mediaSelectionType === 'video' ? (
                    <ActivityIndicator size="small" color={colors.navigationActive} />
                  ) : (
                    <Ionicons name="videocam-outline" size={22} color={colors.navigationActive} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {announcementsLoading && announcements.length === 0 ? <CommunityScreenSkeleton /> : null}
            {announcementsLoading && announcements.length > 0 ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.stateBody}>Loading official updates…</Text>
              </View>
            ) : null}
            {!announcementsLoading && announcementError ? (
              <View style={styles.stateBox} accessibilityRole="alert">
                <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />
                <Text style={styles.stateTitle}>Official updates unavailable</Text>
                <Text style={styles.stateBody}>{announcementError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={onRetryAnnouncements}>
                  <Text style={styles.retryText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {!announcementsLoading && !announcementError && filteredAnnouncements.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="megaphone-outline" size={28} color={colors.textMuted} />
                <Text style={styles.stateTitle}>No official updates found</Text>
                <Text style={styles.stateBody}>Adjust the filters or publish a new update.</Text>
              </View>
            ) : null}
            {!announcementsLoading && !announcementError ? (
              <AnnouncementEngagementProvider announcements={announcements}>
                {filteredAnnouncements.map((announcement, index) => (
                  <OfficialAnnouncementPostCard
                    key={announcement.id}
                    announcement={announcement}
                    moderationMode="scoped"
                    variant="residentFeedPost"
                    officeLabel={formatAnnouncementOfficeLabel(announcement)}
                    cardStyle={
                      index === filteredAnnouncements.length - 1
                        ? styles.feedPostLast
                        : undefined
                    }
                  />
                ))}
              </AnnouncementEngagementProvider>
            ) : null}
            {announcementsLoadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={filtersVisible}
        transparent
        animationType="fade"
        hardwareAccelerated
        onRequestClose={closeFilters}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeFilters} />
          <View style={[styles.filterSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Feed filters</Text>
              <TouchableOpacity
                style={styles.sheetCloseButton}
                onPress={closeFilters}
                accessibilityRole="button"
                accessibilityLabel="Close community filters"
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {activeTab === 'community' ? (
              <>
                <Text style={styles.filterLabel}>Report status</Text>
                <View style={styles.filterChoices}>
                  {REPORT_STATUS_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.filterChoice,
                        draftReportStatusFilter === option.value && styles.filterChoiceActive,
                      ]}
                      onPress={() => setDraftReportStatusFilter(option.value)}
                      accessibilityState={{ selected: draftReportStatusFilter === option.value }}
                    >
                      <Text
                        style={[
                          styles.filterChoiceText,
                          draftReportStatusFilter === option.value && styles.filterChoiceTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.filterLabel}>Order</Text>
                <View style={styles.filterChoices}>
                  {REPORT_SORT_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.filterChoice,
                        draftReportSort === option.value && styles.filterChoiceActive,
                      ]}
                      onPress={() => setDraftReportSort(option.value)}
                      accessibilityState={{ selected: draftReportSort === option.value }}
                    >
                      <Text
                        style={[
                          styles.filterChoiceText,
                          draftReportSort === option.value && styles.filterChoiceTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.filterLabel}>Order</Text>
                <View style={styles.filterChoices}>
                  {ANNOUNCEMENT_SORT_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.filterChoice,
                        draftAnnouncementSort === option.value && styles.filterChoiceActive,
                      ]}
                      onPress={() => setDraftAnnouncementSort(option.value)}
                      accessibilityState={{ selected: draftAnnouncementSort === option.value }}
                    >
                      <Text
                        style={[
                          styles.filterChoiceText,
                          draftAnnouncementSort === option.value && styles.filterChoiceTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={styles.filterFooter}>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={applyFilters}
                accessibilityRole="button"
              >
                <Text style={styles.applyButtonText}>Apply filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
