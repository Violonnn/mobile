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
type FeedOrder = 'latest' | 'oldest';
type OfficialFilter = 'all' | 'municipal' | 'barangay';
type ReportStatusFilter = 'all' | 'active' | 'verified' | 'resolved';

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

function getAnnouncementOfficeLabel(
  announcement: AnnouncementRecord,
  municipality: string,
  barangay: string,
): string {
  if (announcement.author.roleLabel === 'MDRRMO') return `MDRRMO ${municipality}`;
  if (announcement.author.roleLabel === 'BDRRMO') return `BDRRMO ${barangay}`;
  return announcement.author.roleLabel;
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
  const [communityOrder, setCommunityOrder] = useState<FeedOrder>('latest');
  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>('all');
  const [officialFilter, setOfficialFilter] = useState<OfficialFilter>('all');
  const [officialOrder, setOfficialOrder] = useState<FeedOrder>('latest');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      // Profile edits must immediately update the feed's location scope.
      void Promise.all([fetchMyProfile(), fetchBarangays()])
        .then(([profileResult, barangayResult]) => {
          if (cancelled) return;

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
      if (statusFilter === 'verified') return report.status === 'verified';
      if (statusFilter === 'resolved') return report.status === 'resolved';
      return true;
    });

    const withDistance = filteredReports.map((report) => ({
      report,
      distance: barangayCenter ? distanceInMeters(barangayCenter, report) : null,
    }));

    return withDistance.sort((first, second) => {
      const firstTime = new Date(first.report.created_at).getTime();
      const secondTime = new Date(second.report.created_at).getTime();
      return communityOrder === 'latest' ? secondTime - firstTime : firstTime - secondTime;
    });
  }, [barangay, barangayCenter, barangayId, communityOrder, normalizedQuery, reports, statusFilter]);

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
                    {nearbyReports.map(({ report, distance }, reportIndex) => (
                      <ReportDetailCard
                        key={report.id}
                        report={report}
                        isLast={reportIndex === nearbyReports.length - 1}
                        variant="residentFeed"
                        distanceLabel={distance == null ? undefined : formatDistance(distance)}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.contentInner, styles.officialContentInner]}>
                {filteredAnnouncements.length === 0 ? (
                  <View style={styles.stateBlockCompact}>
                    <Ionicons name="megaphone-outline" size={27} color={colors.textMuted} />
                    <Text style={styles.stateTitle}>No official updates found</Text>
                    <Text style={styles.stateText}>
                      Pull down to refresh or adjust the feed filters.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.officialPostList}>
                    {filteredAnnouncements.map((announcement, announcementIndex) => (
                      <OfficialAnnouncementPostCard
                        key={announcement.id}
                        announcement={announcement}
                        variant="residentFeedPost"
                        officeLabel={getAnnouncementOfficeLabel(
                          announcement,
                          municipality,
                          barangay,
                        )}
                        cardStyle={
                          announcementIndex === filteredAnnouncements.length - 1
                            ? styles.feedPostLast
                            : undefined
                        }
                      />
                    ))}
                  </View>
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
                      {(['latest', 'oldest'] as FeedOrder[]).map((option) => (
                        <TouchableOpacity
                          key={option}
                          style={[styles.optionChip, communityOrder === option && styles.optionChipActive]}
                          onPress={() => setCommunityOrder(option)}
                        >
                          <Text style={[styles.optionText, communityOrder === option && styles.optionTextActive]}>
                            {`${option[0].toUpperCase()}${option.slice(1)}`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.filterLabel}>Status</Text>
                    <View style={styles.optionRow}>
                      {(['all', 'active', 'verified', 'resolved'] as ReportStatusFilter[]).map((option) => (
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
              </View>
            </View>
          </Modal>

        </View>
      </AnnouncementEngagementProvider>
    </ReportEngagementProvider>
  );
}
