import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeMapPreview from '../../components/home/HomeMapPreview';
import ReminderBanner from '../../components/home/ReminderBanner';
import QuickAccessModal, {
  type QuickAccessType,
} from '../../components/home/QuickAccessModal';
import HomeUpdateCard from '../../components/home/HomeUpdateCard';
import { NotificationsPlaceholder } from '../../components/navigation/AppHeader';
import ReportModal from '../../components/ui/ReportModal';
import WelcomeModal from '../../components/ui/WelcomeModal';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { useEvacuationCenters } from '../../hooks/useEvacuationCenters';
import { useReports } from '../../hooks/useReports';
import { useResources } from '../../hooks/useResources';
import type { AnnouncementRecord } from '../../lib/announcements';
import { getActiveSession } from '../../lib/auth';
import { fetchBarangays } from '../../lib/barangays';
import { getResidentMapTheme, type ResidentMapTheme } from '../../lib/mapPreferences';
import { fetchMyProfile } from '../../lib/profile';
import {
  distanceInMeters,
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

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const searchInputRef = useRef<TextInput>(null);

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
  const [reportOpen, setReportOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [mapTheme, setMapTheme] = useState<ResidentMapTheme>('light');
  const shouldShowWelcome = welcome === '1' && isAuthenticated && !loading;
  const [previousWelcomeTrigger, setPreviousWelcomeTrigger] = useState(false);

  if (shouldShowWelcome !== previousWelcomeTrigger) {
    setPreviousWelcomeTrigger(shouldShowWelcome);
    if (shouldShowWelcome) setShowWelcome(true);
  }

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

  // Keep the Home preview synchronized with the resident's saved Map preference.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      void getResidentMapTheme().then((storedTheme) => {
        if (isActive) setMapTheme(storedTheme);
      });

      return () => {
        isActive = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/');
  }, [loading, isAuthenticated, router]);

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

  const nearbyReports = reportsInBarangay;
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
  const featuredAnnouncement = municipalAnnouncement ?? barangayAnnouncement;

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
  const areaStatusUnavailable = Boolean(reportsError);
  const areaHasReports = activeReportsInBarangay.length > 0;
  const areaStatusTitle = reportsLoading
    ? 'Checking your area'
    : areaStatusUnavailable
      ? 'Status unavailable'
      : areaHasReports
        ? `${activeReportsInBarangay.length} active ${
            activeReportsInBarangay.length === 1 ? 'alert' : 'alerts'
          }`
        : 'No active alerts';
  const areaStatusSupportingText = reportsLoading
    ? 'Loading nearby reports…'
    : areaStatusUnavailable
      ? 'Pull down to try again'
      : `${reportsInBarangay.length} ${
          reportsInBarangay.length === 1 ? 'report' : 'reports'
        } nearby`;
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

  const areaStatusContent = (
    <View style={styles.areaCardContent}>
      <Text style={styles.areaEyebrow}>YOUR AREA</Text>
      <Text style={styles.areaTitle} accessibilityLiveRegion="polite">
        {areaStatusTitle}
      </Text>
      <Text style={styles.areaSupportingText}>{areaStatusSupportingText}</Text>

      <View style={styles.areaActions}>
        <TouchableOpacity
          style={styles.reportIncidentButton}
          activeOpacity={0.84}
          onPress={() => setReportOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Report an incident"
        >
          <Ionicons name="location" size={20} color={colors.white} />
          <Text style={styles.reportIncidentText}>Report an incident</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.viewMapButton}
          activeOpacity={0.76}
          onPress={() => router.push('/(main)/map')}
          accessibilityRole="button"
          accessibilityLabel="View map"
        >
          <Text style={styles.viewMapText}>View map</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: spacing.xs }]}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          const shouldCollapseHeader = nativeEvent.contentOffset.y > 72;
          setIsHeaderCollapsed((currentValue) =>
            currentValue === shouldCollapseHeader ? currentValue : shouldCollapseHeader,
          );
        }}
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
            {isHeaderCollapsed ? (
              <View style={styles.compactHeaderRow}>
                <Text style={styles.compactHeaderTitle}>Home</Text>
                <View style={styles.compactHeaderActions}>
                  <TouchableOpacity
                    style={styles.compactHeaderButton}
                    activeOpacity={0.75}
                    onPress={() => searchInputRef.current?.focus()}
                    accessibilityRole="button"
                    accessibilityLabel="Focus search"
                  >
                    <Ionicons name="search-outline" size={27} color={homeColors.ink} />
                  </TouchableOpacity>
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
                </View>
              </View>
            ) : (
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
            )}
          </View>
        </View>

        <View style={styles.headerBody}>
          <View style={styles.heroSection}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={23} color={homeColors.ink} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search DisasterLink"
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
              ) : (
                <>
                  <View style={styles.searchDivider} />
                  <Ionicons name="options-outline" size={21} color={homeColors.ink} />
                </>
              )}
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

            <ImageBackground
              source={require('../../assets/images/noActiveBackground.png')}
              style={styles.areaCard}
              imageStyle={styles.areaCardImage}
              resizeMode="cover"
            >
              {areaStatusContent}
            </ImageBackground>
          </View>

          <View style={styles.quickAccessSpacer} />

          <View style={styles.quickAccessSection}>
            <View style={styles.quickAccessContent}>
              <View style={styles.quickAccessRow}>
                <TouchableOpacity
                  style={styles.quickAccessCard}
                  activeOpacity={0.82}
                  onPress={() => setQuickAccessType('hotlines')}
                  accessibilityRole="button"
                  accessibilityLabel="Go to hotlines"
                >
                  <View style={styles.quickAccessIcon}>
                    <Ionicons name="call-outline" size={31} color={homeColors.ink} />
                  </View>
                  <Text style={styles.quickAccessText}>Hotlines</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickAccessCard}
                  activeOpacity={0.82}
                  onPress={() => setQuickAccessType('facilities')}
                  accessibilityRole="button"
                  accessibilityLabel="Go to facilities"
                >
                  <View style={styles.quickAccessIcon}>
                    <Ionicons name="business-outline" size={31} color={homeColors.ink} />
                  </View>
                  <Text style={styles.quickAccessText}>Facilities</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickAccessCard}
                  activeOpacity={0.82}
                  onPress={() => setQuickAccessType('evacuation')}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${centers.length} evacuation centers`}
                >
                  <View style={styles.quickAccessIcon}>
                    <Ionicons name="exit-outline" size={31} color={homeColors.ink} />
                  </View>
                  <Text style={styles.quickAccessText}>Evacuation</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.reminderBannerSection}>
          <ReminderBanner />
        </View>

        <View style={styles.contentSection}>
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Latest official update</Text>
            </View>
            {announcementsLoading ? (
              <View style={styles.stateCard}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : announcementsError ? (
              <View style={styles.stateCard}>
                <Ionicons name="warning-outline" size={19} color={colors.textMuted} />
                <Text style={styles.stateText}>Could not load updates</Text>
              </View>
            ) : !featuredAnnouncement ? (
              <View style={styles.stateCard}>
                <Ionicons name="megaphone-outline" size={19} color={colors.textMuted} />
                <Text style={styles.stateText}>No recent updates yet</Text>
              </View>
            ) : (
              <View style={styles.officialUpdatesBlock}>
                <HomeUpdateCard
                  announcement={featuredAnnouncement}
                  label={
                    featuredAnnouncement.scope === 'municipal'
                      ? 'Municipal update'
                      : 'Barangay update'
                  }
                  variant="featured"
                  onPress={goToFeed}
                />
                {municipalAnnouncement && barangayAnnouncement ? (
                  <HomeUpdateCard
                    announcement={barangayAnnouncement}
                    label="Barangay update"
                    onPress={goToFeed}
                  />
                ) : null}
              </View>
            )}
          </View>

          <View style={styles.reportsSectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Reports near you</Text>
              <TouchableOpacity
                style={styles.sectionLinkButton}
                onPress={goToFeed}
                accessibilityRole="button"
                accessibilityLabel="View all nearby reports"
              >
                <Ionicons name="chevron-forward" size={22} color={homeColors.ink} />
              </TouchableOpacity>
            </View>

            <View style={styles.nearbyPanel}>
              <View style={styles.nearbyMapWrap}>
                <HomeMapPreview
                  reports={nearbyReports}
                  focusedReport={focusedNearbyReport}
                  tone={mapTheme}
                  loading={reportsLoading}
                  error={reportsError}
                  onFocusReport={setFocusedNearbyReportId}
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

      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmitted={openReportInMap}
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
