import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnnouncementEngagementProvider } from './AnnouncementEngagementProvider';
import MdrrmoHeader from './MdrrmoHeader';
import OfficialAnnouncementPostCard from './OfficialAnnouncementPostCard';
import OfficialReportPostCard, { officialQueueItemToPost } from './OfficialReportPostCard';
import ProfileAvatar from '../profile/ProfileAvatar';
import { ReportEngagementProvider } from '../report/ReportEngagementProvider';
import {
  formatAnnouncementOfficeLabel,
  type AnnouncementRecord,
  type AnnouncementScope,
} from '../../lib/announcements';
import { fetchBarangays, type BarangayOption } from '../../lib/barangays';
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
type AnnouncementScopeFilter = 'all' | AnnouncementScope;
type FeedSort = 'newest' | 'oldest';
type ReportStatusFilter = Exclude<CommunityReportStatusFilter, 'active'>;

const REPORT_STATUS_OPTIONS: { value: ReportStatusFilter; label: string }[] = [
  { value: 'all', label: 'All reports' },
  { value: 'unverified', label: 'Unverified' },
  { value: 'verified', label: 'Verified' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
];

const REPORT_SORT_OPTIONS: { value: CommunityReportSort; label: string }[] = [
  { value: 'activity', label: 'Latest Activity' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

const ANNOUNCEMENT_SORT_OPTIONS: { value: FeedSort; label: string }[] = [
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
  onCompose: () => void;
  onComposeWithMedia: (type: 'photo' | 'video') => void;
  mediaSelectionType: 'photo' | 'video' | null;
  onRetryAnnouncements: () => void;
  onRetryReports: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  contentContainerStyle: StyleProp<ViewStyle>;
  roleVariant?: 'mdrrmo' | 'mayor';
  showCommandBack?: boolean;
  initialTab?: FeedTab;
};

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function matchesSearch(value: string, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return normalizeSearchText(value).includes(normalizedQuery);
}

export default function MdrrmoCommunityFeed({
  announcements,
  announcementError,
  announcementsLoading,
  announcementsLoadingMore,
  reports,
  reportsError,
  reportsLoading,
  officialProfile,
  visibleReportCount,
  onCompose,
  onComposeWithMedia,
  mediaSelectionType,
  onRetryAnnouncements,
  onRetryReports,
  refreshing,
  onRefresh,
  onScroll,
  contentContainerStyle,
  roleVariant = 'mdrrmo',
  showCommandBack = false,
  initialTab = 'community',
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<FeedTab>(initialTab);
  const [previousInitialTab, setPreviousInitialTab] = useState(initialTab);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [barangayPickerVisible, setBarangayPickerVisible] = useState(false);
  const [announcementScopeFilter, setAnnouncementScopeFilter] =
    useState<AnnouncementScopeFilter>('all');
  const [feedSort, setFeedSort] = useState<FeedSort>('newest');
  const [reportSort, setReportSort] = useState<CommunityReportSort>('activity');
  const [reportStatusFilter, setReportStatusFilter] =
    useState<ReportStatusFilter>('all');
  const [selectedBarangayId, setSelectedBarangayId] = useState<string | 'all'>('all');
  const [draftAnnouncementScopeFilter, setDraftAnnouncementScopeFilter] =
    useState<AnnouncementScopeFilter>('all');
  const [draftFeedSort, setDraftFeedSort] = useState<FeedSort>('newest');
  const [draftReportSort, setDraftReportSort] =
    useState<CommunityReportSort>('activity');
  const [draftReportStatusFilter, setDraftReportStatusFilter] =
    useState<ReportStatusFilter>('all');
  const [draftBarangayId, setDraftBarangayId] = useState<string | 'all'>('all');
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [barangaysLoading, setBarangaysLoading] = useState(true);
  const [barangaysError, setBarangaysError] = useState<string | null>(null);

  const normalizedQuery = normalizeSearchText(searchQuery);
  const compactHeader = windowWidth < 360;
  const isMayor = roleVariant === 'mayor';
  const initials = [officialProfile?.first_name, officialProfile?.last_name]
    .filter((part) => part?.trim())
    .map((part) => part!.trim().charAt(0).toUpperCase())
    .join('') || (isMayor ? 'M' : 'DR');

  if (initialTab !== previousInitialTab) {
    setPreviousInitialTab(initialTab);
    setActiveTab(initialTab);
    setSearchQuery('');
  }

  const loadBarangays = async () => {
    setBarangaysLoading(true);
    const result = await fetchBarangays();
    setBarangays(result.barangays);
    setBarangaysError(result.error);
    setBarangaysLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    void fetchBarangays().then((result) => {
      if (cancelled) return;
      setBarangays(result.barangays);
      setBarangaysError(result.error);
      setBarangaysLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredAnnouncements = useMemo(() => {
    return announcements
      .filter((announcement) => {
        if (
          announcementScopeFilter !== 'all' &&
          announcement.scope !== announcementScopeFilter
        ) {
          return false;
        }
        return matchesSearch(
          `${announcement.title} ${announcement.body} ${announcement.author.firstName} ${announcement.author.lastName} ${announcement.author.roleLabel}`,
          normalizedQuery,
        );
      })
      .sort((first, second) => {
        const difference =
          new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
        return feedSort === 'newest' ? difference : -difference;
      });
  }, [announcementScopeFilter, announcements, feedSort, normalizedQuery]);

  const filteredReports = useMemo(() => {
    const reportById = new Map(reports.map((report) => [report.id, report]));
    const reportPosts = reports.map(officialQueueItemToPost);
    const sections = buildCommunityReportSections(reportPosts, {
      barangayCenter: null,
      barangayId: selectedBarangayId === 'all' ? null : selectedBarangayId,
      searchQuery,
      scope: selectedBarangayId === 'all' ? 'municipality' : 'barangay',
      sort: reportSort,
      statusFilter: reportStatusFilter,
    });

    return sections
      .flatMap((section) => section.data)
      .map((item) => reportById.get(item.report.id))
      .filter((report): report is OfficialReportQueueItem => Boolean(report));
  }, [reportSort, reportStatusFilter, reports, searchQuery, selectedBarangayId]);

  const visibleReports = filteredReports.slice(0, visibleReportCount);
  const selectedBarangayName =
    selectedBarangayId === 'all'
      ? 'All barangays'
      : barangays.find((barangay) => barangay.id === selectedBarangayId)?.name ??
        'Selected barangay';
  const draftBarangayName =
    draftBarangayId === 'all'
      ? 'All barangays'
      : barangays.find((barangay) => barangay.id === draftBarangayId)?.name ??
        'Select barangay';

  const openReport = (reportId: string, focusComments = false) => {
    const suffix = focusComments ? '?focus=comments' : '';
    router.push(`/official/${reportId}${suffix}` as Href);
  };

  const selectTab = (tab: FeedTab) => {
    setActiveTab(tab);
    setSearchQuery('');
  };

  function openFilters() {
    // Keep changes inside the filter panel until the user explicitly applies them.
    setDraftAnnouncementScopeFilter(announcementScopeFilter);
    setDraftFeedSort(feedSort);
    setDraftReportSort(reportSort);
    setDraftReportStatusFilter(reportStatusFilter);
    setDraftBarangayId(selectedBarangayId);
    setFiltersVisible(true);
  }

  function closeFilters() {
    setBarangayPickerVisible(false);
    setFiltersVisible(false);
  }

  function applyFilters() {
    setAnnouncementScopeFilter(draftAnnouncementScopeFilter);
    setFeedSort(draftFeedSort);
    setReportSort(draftReportSort);
    setReportStatusFilter(draftReportStatusFilter);
    setSelectedBarangayId(draftBarangayId);
    setBarangayPickerVisible(false);
    setFiltersVisible(false);
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.fixedHeaderArea, !isMayor && styles.mdrrmoFixedHeaderArea]}>
        <MdrrmoHeader
          title="Community"
          showCommandBack={showCommandBack}
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
                  ? 'Search community reports'
                  : 'Search official updates'
              }
              placeholderTextColor={colors.textMuted}
              autoFocus
              returnKeyType="search"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.tabs} accessibilityRole="tablist">
          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => selectTab('official')}
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
            onPress={() => selectTab('community')}
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
        <View style={[styles.feedContent, !isMayor && styles.communityFeedContent]}>
          {isMayor ? (
            <View style={styles.reportSectionHeader}>
              <View style={styles.sectionTitleGroup}>
                <Text style={styles.reportSectionTitle}>{selectedBarangayName}</Text>
                <Text style={styles.sectionSubtitle}>
                  {selectedBarangayId === 'all'
                    ? 'Reports from every barangay in Minglanilla'
                    : `Reports submitted from ${selectedBarangayName}`}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.scopeButton}
                onPress={openFilters}
                accessibilityRole="button"
                accessibilityLabel="Choose barangay"
              >
                <Ionicons name="location-outline" size={17} color={colors.primary} />
                <Text style={styles.scopeButtonText}>Barangay</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {reportsLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.stateBody}>Loading community reports…</Text>
            </View>
          ) : null}
          {!reportsLoading && reportsError ? (
            <View style={styles.stateBox}>
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
                Try another barangay or adjust the report filters.
              </Text>
            </View>
          ) : null}
          {!reportsLoading && !reportsError && visibleReports.length > 0 ? (
            <ReportEngagementProvider reports={reports.map(officialQueueItemToPost)}>
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
                {isMayor ? 'Post a municipal update…' : 'Post an alert or advisory…'}
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

          {announcementsLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.stateBody}>Loading official updates…</Text>
            </View>
          ) : null}
          {!announcementsLoading && announcementError ? (
            <View style={styles.stateBox}>
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
        visible={filtersVisible && !barangayPickerVisible}
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

          <View>
          {activeTab === 'community' ? (
            <>
              <Text style={styles.filterLabel}>Barangay</Text>
              {barangaysLoading ? <ActivityIndicator color={colors.primary} /> : null}
              {!barangaysLoading && barangaysError ? (
                <View style={styles.filterError}>
                  <Text style={styles.stateBody}>Could not load barangays.</Text>
                  <TouchableOpacity onPress={() => void loadBarangays()}>
                    <Text style={styles.retryText}>Try again</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {!barangaysLoading && !barangaysError ? (
                <TouchableOpacity
                  style={styles.barangaySelect}
                  onPress={() => setBarangayPickerVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Barangay, ${draftBarangayName}`}
                >
                  <Text style={styles.barangaySelectText} numberOfLines={1}>
                    {draftBarangayName}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={colors.navigationActive} />
                </TouchableOpacity>
              ) : null}

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
            </>
          ) : (
            <>
              <Text style={styles.filterLabel}>Update scope</Text>
              <View style={styles.filterChoices}>
                {([
                  ['all', 'All updates'],
                  ['municipal', isMayor ? 'Municipal' : 'MDRRMO'],
                  ['barangay', 'Barangays'],
                ] as const).map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.filterChoice,
                      draftAnnouncementScopeFilter === value && styles.filterChoiceActive,
                    ]}
                    onPress={() => setDraftAnnouncementScopeFilter(value)}
                  >
                    <Text
                      style={[
                        styles.filterChoiceText,
                        draftAnnouncementScopeFilter === value && styles.filterChoiceTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.filterLabel}>Sort by</Text>
          <View style={styles.filterChoices}>
            {activeTab === 'community'
              ? REPORT_SORT_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.filterChoice,
                      draftReportSort === option.value && styles.filterChoiceActive,
                    ]}
                    onPress={() => setDraftReportSort(option.value)}
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
                ))
              : ANNOUNCEMENT_SORT_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.filterChoice,
                      draftFeedSort === option.value && styles.filterChoiceActive,
                    ]}
                    onPress={() => setDraftFeedSort(option.value)}
                  >
                    <Text
                      style={[
                        styles.filterChoiceText,
                        draftFeedSort === option.value && styles.filterChoiceTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
          </View>

          </View>

          <View style={styles.filterFooter}>
            <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
              <Text style={styles.applyButtonText}>Apply filters</Text>
            </TouchableOpacity>
          </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={filtersVisible && barangayPickerVisible}
        transparent
        animationType="fade"
        hardwareAccelerated
        onRequestClose={() => setBarangayPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setBarangayPickerVisible(false)}
          />
          <View style={[styles.barangayPickerSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select barangay</Text>
              <TouchableOpacity
                style={styles.sheetCloseButton}
                onPress={() => setBarangayPickerVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close barangay selector"
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: 'all', name: 'All barangays' }, ...barangays]}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const selected = draftBarangayId === item.id;
                return (
                  <TouchableOpacity
                    style={styles.barangayPickerOption}
                    onPress={() => {
                      setDraftBarangayId(item.id);
                      setBarangayPickerVisible(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.barangayPickerOptionText,
                        selected && styles.barangayPickerOptionTextSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={20} color={colors.navigationActive} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
