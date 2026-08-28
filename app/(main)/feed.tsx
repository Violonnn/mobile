import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnnouncementEngagementProvider } from '../../components/official/AnnouncementEngagementProvider';
import OfficialAnnouncementPostCard from '../../components/official/OfficialAnnouncementPostCard';
import { ReportDetailCard } from '../../components/report/ReportDetailCard';
import { ReportEngagementProvider } from '../../components/report/ReportEngagementProvider';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { useReports } from '../../hooks/useReports';
import {
  loadReadAnnouncementIds,
  saveReadAnnouncementIds,
} from '../../lib/announcementReadState';
import type { AnnouncementRecord } from '../../lib/announcements';
import { fetchBarangays } from '../../lib/barangays';
import { fetchMyProfile } from '../../lib/profile';
import {
  distanceInMeters,
  formatDistance,
  normalizeSearchText,
  type Coordinate,
} from '../../lib/reportProximity';
import type { MapReportMarker } from '../../lib/reports';
import { feedStyles as styles } from '../../styles/screens/feed.styles';
import { colors } from '../../styles/theme';

type FeedTab = 'official' | 'community';
type CommunitySort = 'relevant' | 'latest' | 'distance';
type OfficialFilter = 'all' | 'municipal' | 'barangay';
type ReportStatusFilter = 'all' | 'active' | 'resolved';

const NEARBY_RADIUS_METERS = 5_000;

type NearbyReport = {
  report: MapReportMarker;
  distance: number | null;
};

function matchesReportSearch(report: MapReportMarker, searchQuery: string): boolean {
  if (!searchQuery) return true;
  return normalizeSearchText(
    `${report.title} ${report.description} ${report.addressText ?? ''}`,
  ).includes(searchQuery);
}

function matchesAnnouncementSearch(
  announcement: AnnouncementRecord,
  searchQuery: string,
): boolean {
  if (!searchQuery) return true;
  return normalizeSearchText(
    `${announcement.title} ${announcement.body} ${announcement.author.roleLabel}`,
  ).includes(searchQuery);
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { reports, error: reportsError, loading: reportsLoading, reload } = useReports({
    realtime: false,
  });
  const {
    announcements,
    error: announcementsError,
    loading: announcementsLoading,
    refresh: refreshAnnouncements,
  } = useAnnouncements({ limit: 50, realtime: false });

  const [activeTab, setActiveTab] = useState<FeedTab>('community');
  const [municipality, setMunicipality] = useState('Minglanilla');
  const [barangay, setBarangay] = useState('your area');
  const [barangayId, setBarangayId] = useState<string | null>(null);
  const [barangayCenter, setBarangayCenter] = useState<Coordinate | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [communitySort, setCommunitySort] = useState<CommunitySort>('relevant');
  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>('all');
  const [officialFilter, setOfficialFilter] = useState<OfficialFilter>('all');
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      // Profile edits must immediately update the feed's location scope.
      void Promise.all([fetchMyProfile(), fetchBarangays(), loadReadAnnouncementIds()])
        .then(([profileResult, barangayResult, storedReadIds]) => {
          if (cancelled) return;
          setReadAnnouncementIds(storedReadIds);

          const profile = profileResult.profile;
          if (!profile) {
            setProfileLoading(false);
            return;
          }

          setMunicipality(profile.municipality || 'Minglanilla');
          setBarangay(profile.barangay || 'your area');
          const normalizedBarangay = normalizeSearchText(profile.barangay);
          const matchingBarangay = barangayResult.barangays.find(
            (item) => normalizeSearchText(item.name) === normalizedBarangay,
          );
          setBarangayId(matchingBarangay?.id ?? null);
          if (matchingBarangay?.latitude != null && matchingBarangay.longitude != null) {
            setBarangayCenter({
              latitude: matchingBarangay.latitude,
              longitude: matchingBarangay.longitude,
            });
          } else {
            setBarangayCenter(null);
          }
          setProfileLoading(false);
        })
        .catch(() => {
          if (!cancelled) setProfileLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const normalizedQuery = normalizeSearchText(searchQuery);

  const nearbyReports = useMemo<NearbyReport[]>(() => {
    const normalizedBarangay = normalizeSearchText(barangay);
    const scopedReports = reports.filter((report) => {
      if (barangayCenter) {
        return distanceInMeters(barangayCenter, report) <= NEARBY_RADIUS_METERS;
      }
      if (barangayId) return report.barangay_id === barangayId;
      return Boolean(
        normalizedBarangay &&
          normalizeSearchText(report.addressText ?? '').includes(normalizedBarangay),
      );
    });

    const filteredReports = scopedReports.filter((report) => {
      if (!matchesReportSearch(report, normalizedQuery)) return false;
      if (statusFilter === 'active') return report.status !== 'resolved';
      if (statusFilter === 'resolved') return report.status === 'resolved';
      return true;
    });

    const withDistance = filteredReports.map((report) => ({
      report,
      distance: barangayCenter ? distanceInMeters(barangayCenter, report) : null,
    }));

    return withDistance.sort((first, second) => {
      if (communitySort === 'distance') {
        return (first.distance ?? Number.MAX_SAFE_INTEGER) -
          (second.distance ?? Number.MAX_SAFE_INTEGER);
      }
      if (communitySort === 'latest') {
        return new Date(second.report.created_at).getTime() -
          new Date(first.report.created_at).getTime();
      }

      const firstScore = first.report.upvoteCount + first.report.commentCount;
      const secondScore = second.report.upvoteCount + second.report.commentCount;
      if (firstScore !== secondScore) return secondScore - firstScore;
      return new Date(second.report.created_at).getTime() -
        new Date(first.report.created_at).getTime();
    });
  }, [barangay, barangayCenter, barangayId, communitySort, normalizedQuery, reports, statusFilter]);

  const filteredAnnouncements = useMemo(() => {
    return announcements
      .filter((announcement) => {
        if (!matchesAnnouncementSearch(announcement, normalizedQuery)) return false;
        if (officialFilter === 'municipal') return announcement.scope === 'municipal';
        if (officialFilter === 'barangay') return announcement.scope === 'barangay';
        return true;
      })
      .sort(
        (first, second) =>
          new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
      );
  }, [announcements, normalizedQuery, officialFilter]);

  const markAnnouncementRead = useCallback((announcementId: string) => {
    setReadAnnouncementIds((current) => {
      if (current.has(announcementId)) return current;
      const next = new Set(current);
      next.add(announcementId);
      void saveReadAnnouncementIds(next);
      return next;
    });
  }, []);

  const markAllAnnouncementsRead = () => {
    const next = new Set(readAnnouncementIds);
    announcements.forEach((announcement) => next.add(announcement.id));
    setReadAnnouncementIds(next);
    void saveReadAnnouncementIds(next);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([reload(), refreshAnnouncements()]);
    setRefreshing(false);
  };

  const initialLoading =
    profileLoading ||
    (activeTab === 'community'
      ? reportsLoading && reports.length === 0
      : announcementsLoading && announcements.length === 0);
  const activeError = activeTab === 'community' ? reportsError : announcementsError;

  return (
    <ReportEngagementProvider reports={reports}>
      <AnnouncementEngagementProvider announcements={announcements}>
        <View style={styles.screen}>
          <StatusBar style="dark" />

          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <View style={styles.headerInner}>
              <View>
                <Text style={styles.title}>Community</Text>
                <Text style={styles.municipality}>{municipality}</Text>
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
                  onChangeText={setSearchQuery}
                  placeholder="Search updates and reports"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  returnKeyType="search"
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
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

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 118 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            {initialLoading ? (
              <View style={styles.stateBlock}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.stateText}>Loading your feed…</Text>
              </View>
            ) : activeError ? (
              <View style={styles.stateBlock}>
                <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />
                <Text style={styles.stateTitle}>Feed unavailable</Text>
                <Text style={styles.stateText}>{activeError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
                  <Text style={styles.retryText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : activeTab === 'community' ? (
              <View style={styles.contentInner}>
                <View style={styles.sectionHeadingRow}>
                  <View style={styles.sectionHeadingCopy}>
                    <Text style={styles.sectionTitle}>Reports near you</Text>
                    <Text style={styles.sectionSubtitle}>Within 5 km of {barangay}</Text>
                  </View>
                </View>

                {nearbyReports.length === 0 ? (
                  <View style={styles.stateBlockCompact}>
                    <Ionicons name="location-outline" size={27} color={colors.textMuted} />
                    <Text style={styles.stateTitle}>No nearby reports found</Text>
                    <Text style={styles.stateText}>
                      Pull down to refresh or adjust the feed filters.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.reportList}>
                    {nearbyReports.map(({ report, distance }) => (
                      <ReportDetailCard
                        key={report.id}
                        report={report}
                        variant="residentFeed"
                        distanceLabel={distance == null ? undefined : formatDistance(distance)}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.contentInner, styles.officialContentInner]}>
                <View style={styles.latestRow}>
                  <Text style={styles.latestLabel}>LATEST</Text>
                  {filteredAnnouncements.length > 0 ? (
                    <TouchableOpacity onPress={markAllAnnouncementsRead}>
                      <Text style={styles.markAllText}>Mark all as read</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {filteredAnnouncements.length === 0 ? (
                  <View style={styles.stateBlockCompact}>
                    <Ionicons name="megaphone-outline" size={27} color={colors.textMuted} />
                    <Text style={styles.stateTitle}>No official updates found</Text>
                    <Text style={styles.stateText}>
                      Pull down to refresh or adjust the feed filters.
                    </Text>
                  </View>
                ) : (
                  <>
                    <OfficialAnnouncementPostCard
                      announcement={filteredAnnouncements[0]}
                      variant="residentFeedFeatured"
                      cardStyle={styles.featuredAnnouncementCard}
                      isUnread={!readAnnouncementIds.has(filteredAnnouncements[0].id)}
                      onOpened={markAnnouncementRead}
                    />

                    {filteredAnnouncements.length > 1 ? (
                      <View style={styles.earlierSection}>
                        <Text style={styles.latestLabel}>EARLIER</Text>
                        {filteredAnnouncements.slice(1).map((announcement) => (
                          <OfficialAnnouncementPostCard
                            key={announcement.id}
                            announcement={announcement}
                            variant="residentFeedCompact"
                            cardStyle={styles.compactAnnouncementCard}
                            isUnread={!readAnnouncementIds.has(announcement.id)}
                            onOpened={markAnnouncementRead}
                          />
                        ))}
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            )}
          </ScrollView>

          <Modal
            visible={filterVisible}
            transparent
            animationType="fade"
            presentationStyle="overFullScreen"
            statusBarTranslucent
            onRequestClose={() => setFilterVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <Pressable style={styles.modalBackdrop} onPress={() => setFilterVisible(false)} />
              <View style={[styles.filterSheet, { paddingBottom: insets.bottom + 20 }]}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <View>
                    <Text style={styles.sheetTitle}>Feed filters</Text>
                    <Text style={styles.sheetSubtitle}>
                      {activeTab === 'community' ? 'Community reports' : 'Official updates'}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.sheetClose} onPress={() => setFilterVisible(false)}>
                    <Ionicons name="close" size={22} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {activeTab === 'community' ? (
                  <>
                    <Text style={styles.filterLabel}>Sort by</Text>
                    <View style={styles.optionRow}>
                      {(['relevant', 'latest', 'distance'] as CommunitySort[]).map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={[styles.optionChip, communitySort === option && styles.optionChipActive]}
                          onPress={() => setCommunitySort(option)}
                        >
                          <Text style={[styles.optionText, communitySort === option && styles.optionTextActive]}>
                            {option === 'distance' ? 'Nearest' : `${option[0].toUpperCase()}${option.slice(1)}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.filterLabel}>Status</Text>
                    <View style={styles.optionRow}>
                      {(['all', 'active', 'resolved'] as ReportStatusFilter[]).map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={[styles.optionChip, statusFilter === option && styles.optionChipActive]}
                          onPress={() => setStatusFilter(option)}
                        >
                          <Text style={[styles.optionText, statusFilter === option && styles.optionTextActive]}>
                            {`${option[0].toUpperCase()}${option.slice(1)}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
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
              </View>
            </View>
          </Modal>
        </View>
      </AnnouncementEngagementProvider>
    </ReportEngagementProvider>
  );
}
