import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeMapPreview from '../../components/home/HomeMapPreview';
import NearbyReportAnimation from '../../components/home/NearbyReportAnimation';
import QuickAccessModal, {
  type QuickAccessType,
} from '../../components/home/QuickAccessModal';
import HomeUpdateCard from '../../components/home/HomeUpdateCard';
import { NotificationsPlaceholder } from '../../components/navigation/AppHeader';
import { AnnouncementEngagementProvider } from '../../components/official/AnnouncementEngagementProvider';
import WelcomeModal from '../../components/ui/WelcomeModal';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { useEvacuationCenters } from '../../hooks/useEvacuationCenters';
import { useReports } from '../../hooks/useReports';
import { useResources } from '../../hooks/useResources';
import type { AnnouncementRecord } from '../../lib/announcements';
import { getActiveSession } from '../../lib/auth';
import { fetchBarangays } from '../../lib/barangays';
import { formatPublishedAt } from '../../lib/formatTime';
import { fetchMyProfile } from '../../lib/profile';
import {
  distanceInMeters,
  formatDistance,
  normalizeSearchText,
  type Coordinate,
} from '../../lib/reportProximity';
import type { MapReportMarker } from '../../lib/reports';
import { homeColors, homeStyles as styles } from '../../styles/screens/home.styles';
import { colors, spacing } from '../../styles/theme';

type BarangayCenter = Coordinate;

type HomeSearchResult =
  | { kind: 'announcement'; item: AnnouncementRecord }
  | { kind: 'report'; item: MapReportMarker };

function formatHomeTime(iso: string): string {
  const label = formatPublishedAt(iso);
  if (/^\d+(s|m|hr)$/.test(label)) return `${label} ago`;
  return label;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();

  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [barangay, setBarangay] = useState('');
  const [residentBarangayId, setResidentBarangayId] = useState<string | null>(null);
  const [barangayCenter, setBarangayCenter] = useState<BarangayCenter | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [quickAccessType, setQuickAccessType] = useState<QuickAccessType | null>(null);
  const [focusedNearbyReportId, setFocusedNearbyReportId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const {
    announcements,
    loading: announcementsLoading,
    error: announcementsError,
    refresh: refreshAnnouncements,
  } = useAnnouncements({ limit: 20, realtime: false });
  const {
    reports,
    loading: reportsLoading,
    error: reportsError,
    reload: reloadReports,
  } = useReports({ realtime: true });
  const {
    hotlines,
    facilities,
    loading: resourcesLoading,
    hotlinesError,
    facilitiesError,
    refresh: refreshResources,
  } = useResources({ mode: 'resident' });
  const {
    centers,
    loading: centersLoading,
    error: centersError,
    refresh: refreshCenters,
  } = useEvacuationCenters();

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const session = await getActiveSession();
      if (!session) {
        setIsAuthenticated(false);
        setFirstName('');
        setBarangay('');
        setResidentBarangayId(null);
        setBarangayCenter(null);
        return;
      }

      setIsAuthenticated(true);
      const [profileResult, barangayResult] = await Promise.all([
        fetchMyProfile(),
        fetchBarangays(),
      ]);
      const profile = profileResult.profile;
      if (!profile) return;

      setFirstName(profile.first_name);
      setBarangay(profile.barangay);

      const normalizedProfileBarangay = normalizeSearchText(profile.barangay);
      const matchingBarangay = barangayResult.barangays.find(
        (option) => normalizeSearchText(option.name) === normalizedProfileBarangay,
      );
      setResidentBarangayId(matchingBarangay?.id ?? null);
      if (matchingBarangay?.latitude != null && matchingBarangay.longitude != null) {
        setBarangayCenter({
          latitude: matchingBarangay.latitude,
          longitude: matchingBarangay.longitude,
        });
      } else {
        setBarangayCenter(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload identity and barangay whenever Settings sends the resident back here.
  useFocusEffect(
    useCallback(() => {
      void loadSession();
    }, [loadSession]),
  );

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/');
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (welcome === '1' && isAuthenticated && !loading) setShowWelcome(true);
  }, [welcome, isAuthenticated, loading]);

  const normalizedBarangay = normalizeSearchText(barangay);
  const reportsInBarangay = useMemo(() => {
    const scopedReports = reports.filter((report) => {
      if (residentBarangayId) return report.barangay_id === residentBarangayId;
      if (!normalizedBarangay) return false;
      return normalizeSearchText(report.addressText ?? '').includes(normalizedBarangay);
    });

    if (!barangayCenter) return scopedReports;
    return [...scopedReports].sort(
      (first, second) =>
        distanceInMeters(barangayCenter, first) -
        distanceInMeters(barangayCenter, second),
    );
  }, [barangayCenter, normalizedBarangay, reports, residentBarangayId]);

  const nearbyReports = useMemo(
    () => reportsInBarangay.slice(0, 2),
    [reportsInBarangay],
  );
  const focusedNearbyReport =
    nearbyReports.find((report) => report.id === focusedNearbyReportId) ??
    nearbyReports[0] ??
    null;
  const activeReportsInBarangay = reportsInBarangay.filter(
    (report) => report.status !== 'resolved',
  );
  const municipalAnnouncement = announcements.find(
    (announcement) => announcement.scope === 'municipal',
  );
  const barangayAnnouncement = residentBarangayId
    ? announcements.find(
        (announcement) =>
          announcement.scope === 'barangay' &&
          announcement.barangayId === residentBarangayId,
      )
    : undefined;

  const searchResults = useMemo<HomeSearchResult[]>(() => {
    const query = normalizeSearchText(searchQuery);
    if (!query) return [];

    const announcementMatches: HomeSearchResult[] = announcements
      .filter((announcement) =>
        normalizeSearchText(`${announcement.title} ${announcement.body}`).includes(query),
      )
      .map((item) => ({ kind: 'announcement' as const, item }));
    const reportMatches: HomeSearchResult[] = reports
      .filter((report) =>
        normalizeSearchText(
          `${report.title} ${report.description} ${report.addressText ?? ''}`,
        ).includes(query),
      )
      .map((item) => ({ kind: 'report' as const, item }));

    return [...announcementMatches, ...reportMatches].slice(0, 6);
  }, [announcements, reports, searchQuery]);

  useEffect(() => {
    setFocusedNearbyReportId((currentId) => {
      if (nearbyReports.some((report) => report.id === currentId)) return currentId;
      return nearbyReports[0]?.id ?? null;
    });
  }, [nearbyReports]);

  if (loading || !isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const locationValue = barangay ? `${barangay}, Minglanilla` : 'Minglanilla, Cebu';
  const isCompactLayout = windowWidth < 370;
  // Fit three centered cards safely on narrow phones without stretching them on tablets.
  const quickAccessContentWidth = Math.min(windowWidth, 420) -
    (spacing.sm + spacing.xs) * 2;
  const quickAccessCardWidth = Math.min(
    96,
    Math.floor((quickAccessContentWidth - spacing.sm * 2) / 3),
  );
  const quickAccessCardWidthStyle = { width: quickAccessCardWidth };
  const areaStatusUnavailable = Boolean(reportsError);
  const areaHasReports = activeReportsInBarangay.length > 0;
  const areaStatusText = reportsLoading
    ? 'Checking your area status…'
    : areaStatusUnavailable
      ? 'Area status is temporarily unavailable'
      : areaHasReports
        ? `${activeReportsInBarangay.length} active ${
            activeReportsInBarangay.length === 1 ? 'report' : 'reports'
          } in your area`
        : 'Your area is currently clear';

  const goToFeed = () => router.push('/(main)/feed');
  const openReportInMap = (reportId: string) => {
    router.push({ pathname: '/(main)/map', params: { reportId } });
  };
  const quickAccessLoading =
    quickAccessType === 'evacuation' ? centersLoading : resourcesLoading;
  const quickAccessError =
    quickAccessType === 'hotlines'
      ? hotlinesError
      : quickAccessType === 'facilities'
        ? facilitiesError
        : quickAccessType === 'evacuation'
          ? centersError
          : null;
  const retryQuickAccess = () => {
    if (quickAccessType === 'evacuation') {
      void refreshCenters();
      return;
    }
    void refreshResources();
  };
  const openResourceInMap = (
    kind: 'facility' | 'evacuation',
    resourceId: string,
  ) => {
    setQuickAccessType(null);
    router.push({
      pathname: '/(main)/map',
      params: { resourceId, resourceKind: kind },
    });
  };
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refreshAnnouncements(),
      reloadReports(),
      refreshResources(),
      refreshCenters(),
    ]);
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: spacing.xs }]}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        keyboardDismissMode="on-drag"
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
        <View style={styles.residentStickyHeader}>
          <View style={styles.residentHeaderContent}>
            <View style={styles.greetingRow}>
              <View style={styles.greetingCopy}>
                <Text style={styles.greetingTitle} numberOfLines={1}>
                  Hi, {firstName || 'there'}
                </Text>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={21} color={homeColors.ink} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {locationValue}
                  </Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.notificationButton}
                  activeOpacity={0.75}
                  onPress={() => setNotificationsOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Notifications"
                >
                  <Ionicons name="notifications-outline" size={28} color={homeColors.ink} />
                  <View style={styles.notificationDot} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.avatar}
                  activeOpacity={0.82}
                  onPress={() => router.push('/(main)/profile')}
                  accessibilityRole="button"
                  accessibilityLabel="Open profile"
                >
                  <Text style={styles.avatarText}>
                    {firstName.trim().charAt(0).toLocaleUpperCase() || 'R'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.headerBody}>
          <View style={styles.heroSection}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={23} color={homeColors.ink} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search announcements and reports"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                autoCapitalize="none"
                accessibilityLabel="Search announcements and reports"
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

            {searchQuery.trim() ? (
              <View style={styles.searchResultsCard}>
                {searchResults.length === 0 ? (
                  <Text style={styles.stateText}>No matching updates or reports</Text>
                ) : (
                  searchResults.map((result, index) => (
                    <TouchableOpacity
                      key={`${result.kind}-${result.item.id}`}
                      style={[
                        styles.searchResultRow,
                        index < searchResults.length - 1 && styles.searchResultDivider,
                      ]}
                      onPress={() => {
                        setSearchQuery('');
                        if (result.kind === 'report') {
                          openReportInMap(result.item.id);
                          return;
                        }
                        goToFeed();
                      }}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={result.kind === 'report' ? 'location-outline' : 'megaphone-outline'}
                        size={18}
                        color={colors.primary}
                      />
                      <View style={styles.searchResultCopy}>
                        <Text style={styles.searchResultTitle} numberOfLines={1}>
                          {result.item.title || 'Untitled update'}
                        </Text>
                        <Text style={styles.searchResultType}>
                          {result.kind === 'report' ? 'Report' : 'Official announcement'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            ) : null}

            <View style={styles.nearbyReportBlock}>
              <NearbyReportAnimation />
              <Text
                style={styles.areaStatusText}
                accessibilityLiveRegion="polite"
              >
                {areaStatusText}
              </Text>
            </View>
          </View>

          <View style={styles.quickAccessSpacer} />

          <View style={styles.quickAccessSection}>
            <View style={styles.quickAccessContent}>
              <View style={styles.quickAccessRow}>
                <TouchableOpacity
                  style={[styles.quickAccessCard, quickAccessCardWidthStyle]}
                  activeOpacity={0.82}
                  onPress={() => setQuickAccessType('hotlines')}
                  accessibilityRole="button"
                  accessibilityLabel="Go to hotlines"
                >
                  <View style={styles.quickAccessIcon}>
                    <Ionicons name="call-outline" size={22} color={homeColors.accentBlue} />
                  </View>
                  <Text style={styles.quickAccessText}>Hotlines</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickAccessCard, quickAccessCardWidthStyle]}
                  activeOpacity={0.82}
                  onPress={() => setQuickAccessType('facilities')}
                  accessibilityRole="button"
                  accessibilityLabel="Go to facilities"
                >
                  <View style={styles.quickAccessIcon}>
                    <Ionicons name="business-outline" size={22} color={homeColors.accentBlue} />
                  </View>
                  <Text style={styles.quickAccessText}>Facilities</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickAccessCard, quickAccessCardWidthStyle]}
                  activeOpacity={0.82}
                  onPress={() => setQuickAccessType('evacuation')}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${centers.length} evacuation centers`}
                >
                  <View style={styles.quickAccessIcon}>
                    <Ionicons name="exit-outline" size={22} color={homeColors.accentBlue} />
                  </View>
                  <Text style={styles.quickAccessText}>Evacuation{`\n`}Centers</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.sectionBlock}>
            <View style={[styles.sectionHeaderRow, styles.municipalHeaderRow]}>
              <Text style={styles.sectionTitle}>Municipal update</Text>
              <TouchableOpacity onPress={goToFeed} accessibilityRole="button">
                <Text style={styles.sectionLink}>See all</Text>
              </TouchableOpacity>
            </View>
            {announcementsLoading ? (
              <View style={styles.stateCard}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : announcementsError ? (
              <View style={styles.stateCard}>
                <Ionicons name="warning-outline" size={19} color={colors.textMuted} />
                <Text style={styles.stateText}>Could not load municipal updates</Text>
              </View>
            ) : municipalAnnouncement ? (
              <AnnouncementEngagementProvider announcements={[municipalAnnouncement]}>
                <HomeUpdateCard
                  announcement={municipalAnnouncement}
                  label="Municipal update"
                  variant="featured"
                  onPress={goToFeed}
                />
              </AnnouncementEngagementProvider>
            ) : (
              <View style={styles.stateCard}>
                <Ionicons name="megaphone-outline" size={19} color={colors.textMuted} />
                <Text style={styles.stateText}>No municipal updates yet</Text>
              </View>
            )}
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Barangay update</Text>
              <TouchableOpacity onPress={goToFeed} accessibilityRole="button">
                <Text style={styles.sectionLink}>See all</Text>
              </TouchableOpacity>
            </View>
            {announcementsLoading ? (
              <View style={styles.stateCard}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : announcementsError ? (
              <View style={styles.stateCard}>
                <Ionicons name="warning-outline" size={19} color={colors.textMuted} />
                <Text style={styles.stateText}>Could not load barangay updates</Text>
              </View>
            ) : barangayAnnouncement ? (
              <HomeUpdateCard
                announcement={barangayAnnouncement}
                label="Barangay update"
                onPress={goToFeed}
              />
            ) : (
              <View style={styles.stateCard}>
                <Ionicons name="megaphone-outline" size={19} color={colors.textMuted} />
                <Text style={styles.stateText}>No updates for {barangay || 'your barangay'} yet</Text>
              </View>
            )}
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Reports near you</Text>
              <TouchableOpacity onPress={goToFeed} accessibilityRole="button">
                <Text style={styles.sectionLink}>See all</Text>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.nearbyPanel,
                isCompactLayout && styles.nearbyPanelCompact,
              ]}
            >
              <View
                style={[
                  styles.nearbyReportList,
                  isCompactLayout && styles.nearbyReportListCompact,
                ]}
              >
                {reportsLoading ? (
                  <View style={styles.nearbyState}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : reportsError ? (
                  <View style={styles.nearbyState}>
                    <Ionicons name="warning-outline" size={19} color={colors.textMuted} />
                    <Text style={styles.stateText}>Could not load nearby reports</Text>
                  </View>
                ) : nearbyReports.length === 0 ? (
                  <View style={styles.nearbyState}>
                    <Ionicons name="shield-checkmark-outline" size={21} color={homeColors.clear} />
                    <Text style={styles.stateText}>No reports in {barangay || 'your area'}</Text>
                  </View>
                ) : (
                  nearbyReports.map((report, index) => {
                    const reportPhoto = report.media.find((media) => media.type === 'photo');
                    const distance = barangayCenter
                      ? formatDistance(distanceInMeters(barangayCenter, report))
                      : null;
                    return (
                      <TouchableOpacity
                        key={report.id}
                        style={[
                          styles.nearbyReportRow,
                          report.id === focusedNearbyReport?.id &&
                            styles.nearbyReportRowFocused,
                          index < nearbyReports.length - 1 && styles.nearbyReportDivider,
                        ]}
                        activeOpacity={0.84}
                        onPress={() => setFocusedNearbyReportId(report.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: report.id === focusedNearbyReport?.id }}
                        accessibilityLabel={`Focus ${report.title || 'nearby report'} on the map preview`}
                      >
                        <View style={styles.reportThumbnail}>
                          {reportPhoto ? (
                            <Image
                              source={{ uri: reportPhoto.url }}
                              style={styles.reportThumbnailImage}
                              contentFit="cover"
                              transition={150}
                            />
                          ) : (
                            <Ionicons name="image-outline" size={24} color={colors.textMuted} />
                          )}
                        </View>
                        <View style={styles.reportSummary}>
                          <Text
                            style={styles.reportTitle}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.65}
                          >
                            {report.title || 'Resident report'}
                          </Text>
                          {distance ? (
                            <Text style={styles.reportDistance} numberOfLines={1}>
                              {distance}
                            </Text>
                          ) : null}
                          <View style={styles.reportLocationRow}>
                            <Ionicons
                              name="location-outline"
                              size={16}
                              color={colors.primary}
                              style={styles.reportLocationIcon}
                            />
                            <Text
                              style={styles.reportAddress}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.65}
                            >
                              {report.addressText || barangay || 'Minglanilla'}
                            </Text>
                          </View>
                          <Text style={styles.reportTime} numberOfLines={1}>
                            {formatHomeTime(report.created_at)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              <View
                style={[
                  styles.nearbyMapWrap,
                  isCompactLayout && styles.nearbyMapWrapCompact,
                ]}
              >
                <HomeMapPreview
                  reports={nearbyReports}
                  focusedReport={focusedNearbyReport}
                  onOpenReport={openReportInMap}
                />
              </View>
            </View>
          </View>

        </View>
      </ScrollView>

      <QuickAccessModal
        visible={quickAccessType != null}
        type={quickAccessType}
        hotlines={hotlines}
        facilities={facilities}
        centers={centers}
        loading={quickAccessLoading}
        error={quickAccessError}
        onClose={() => setQuickAccessType(null)}
        onRetry={retryQuickAccess}
        onOpenMap={openResourceInMap}
      />

      <NotificationsPlaceholder
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
      <WelcomeModal
        visible={showWelcome}
        firstName={firstName}
        barangay={barangay}
        onDone={() => setShowWelcome(false)}
      />
    </View>
  );
}
