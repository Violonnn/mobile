import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import OfficialUpdatesCarousel from '../../components/home/OfficialUpdatesCarousel';
import NearbyReportsPanel from '../../components/home/NearbyReportsPanel';
import ReminderForYouCarousel from '../../components/home/ReminderForYouCarousel';
import QuickAccessModal, {
  type QuickAccessType,
} from '../../components/home/QuickAccessModal';
import ProfileAvatar from '../../components/profile/ProfileAvatar';
import {
  HomeScreenSkeleton,
  HomeUpdateSkeleton,
} from '../../components/ui/ResidentScreenSkeletons';
import WelcomeModal from '../../components/ui/WelcomeModal';
import { useNotifications } from '../../context/NotificationsContext';
import { useResidentData } from '../../context/ResidentDataContext';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { useReports } from '../../hooks/useReports';
import { getNearbyReportsGpsWithTimeout, type GpsPosition } from '../../lib/location';
import {
  distanceInMeters,
  NEARBY_REPORT_RADIUS_METERS,
} from '../../lib/reportProximity';
import { homeColors, homeStyles as styles } from '../../styles/screens/home.styles';
import { colors, spacing } from '../../styles/theme';

const RESIDENT_HEADER_HEIGHT = 74;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const homeScrollRef = useRef<ScrollView>(null);
  const locationRequestIdRef = useRef(0);
  const locationLoadedAtRef = useRef(0);
  const foregroundRefreshAtRef = useRef(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const {
    profile,
    profileInitialLoading,
    refreshProfile,
    residentBarangayId,
    barangayNamesById,
    hotlines,
    facilities,
    centers,
    hotlinesLoaded,
    facilitiesLoaded,
    centersLoaded,
    hotlinesLoading,
    facilitiesLoading,
    centersLoading,
    hotlinesError,
    facilitiesError,
    centersError,
    ensureHotlines,
    ensureFacilities,
    ensureCenters,
  } = useResidentData();
  const { unreadCount: notificationUnreadCount, openInbox } = useNotifications();
  const firstName = profile?.first_name ?? '';
  const lastName = profile?.last_name ?? '';
  const avatarPath = profile?.avatar_path ?? null;
  const barangay = profile?.barangay ?? '';
  const [currentLocation, setCurrentLocation] = useState<GpsPosition | null>(null);
  const [nearbyLocationLoading, setNearbyLocationLoading] = useState(true);
  const [nearbyLocationError, setNearbyLocationError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [quickAccessType, setQuickAccessType] = useState<QuickAccessType | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isNearbyMapGestureActive, setIsNearbyMapGestureActive] = useState(false);
  const [officialUpdatesPromptVisible, setOfficialUpdatesPromptVisible] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const shouldShowWelcome = welcome === '1' && Boolean(profile) && !profileInitialLoading;
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
  } = useAnnouncements({ limit: 6, realtime: false });
  const {
    reports,
    loading: reportsLoading,
    error: reportsError,
    reload: reloadReports,
  } = useReports({
    realtime: false,
    limit: 12,
    includeMediaSummaries: false,
  });

  const loadCurrentLocation = useCallback(async (force = false) => {
    const locationIsFresh = Date.now() - locationLoadedAtRef.current < 5 * 60_000;
    if (!force && currentLocation && locationIsFresh) return;

    const requestId = locationRequestIdRef.current + 1;
    locationRequestIdRef.current = requestId;
    if (!currentLocation) setNearbyLocationLoading(true);
    setNearbyLocationError(null);

    const { position, error } = await getNearbyReportsGpsWithTimeout();
    if (requestId !== locationRequestIdRef.current) return;

    setNearbyLocationLoading(false);
    if (!position) {
      setCurrentLocation(null);
      setNearbyLocationError(
        error === 'Location permission is required to submit a report.'
          ? 'Location permission is required to find reports near you.'
          : error ?? 'Could not get your current location.',
      );
      return;
    }

    setCurrentLocation(position);
    locationLoadedAtRef.current = Date.now();
    setNearbyLocationError(null);
  }, [currentLocation]);

  // Nearby reports always start with a fresh device position when Home opens.
  useFocusEffect(
    useCallback(() => {
      void Promise.all([refreshProfile(), loadCurrentLocation()]);
    }, [loadCurrentLocation, refreshProfile]),
  );

  useEffect(() => {
    if (quickAccessType === 'hotlines') void ensureHotlines();
    if (quickAccessType === 'facilities') void ensureFacilities();
    if (quickAccessType === 'evacuation') void ensureCenters();
  }, [ensureCenters, ensureFacilities, ensureHotlines, quickAccessType]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      const returnedToForeground =
        nextState === 'active' &&
        (previousState === 'background' || previousState === 'inactive');
      if (!returnedToForeground) return;
      if (Date.now() - foregroundRefreshAtRef.current < 60_000) return;
      foregroundRefreshAtRef.current = Date.now();

      // Reports and GPS must refresh together because proximity needs both.
      void Promise.all([reloadReports(), loadCurrentLocation()]);
    });

    return () => subscription.remove();
  }, [loadCurrentLocation, reloadReports]);

  const activeReports = useMemo(
    () => reports.filter((report) => report.status.trim().toLocaleLowerCase() !== 'resolved'),
    [reports],
  );
  const nearbyReports = useMemo(() => {
    if (!currentLocation) return [];

    return activeReports
      .map((report) => ({
        report,
        distance: distanceInMeters(currentLocation, report),
      }))
      .filter(({ distance }) => distance <= NEARBY_REPORT_RADIUS_METERS)
      .sort((first, second) => first.distance - second.distance)
      .map(({ report }) => report);
  }, [activeReports, currentLocation]);
  const officialUpdateAnnouncements = useMemo(
    () =>
      announcements
        .filter((announcement) => {
          if (announcement.scope === 'municipal') return true;
          if (!residentBarangayId) return false;
          return announcement.barangayId === residentBarangayId;
        })
        .sort((first, second) => {
          const firstTime = new Date(first.createdAt).getTime();
          const secondTime = new Date(second.createdAt).getTime();
          return secondTime - firstTime;
        })
        .slice(0, 4),
    [announcements, residentBarangayId],
  );
  // The carousel lives inside Home's 560px-wide content column, including its side padding.
  const officialUpdatesViewportWidth = Math.min(560, windowWidth) - spacing.lg * 2;
  // Let cards peek beyond Home's inner padding while retaining a centered active card.
  const officialUpdatesCarouselWidth = officialUpdatesViewportWidth + spacing.md * 2;
  const officialUpdateCardWidth = Math.min(
    500,
    Math.max(220, officialUpdatesViewportWidth - spacing.xl - spacing.xs),
  );
  // Equal side space centers each card and leaves a clear preview of its neighbors.
  const officialUpdateCarouselTrailingSpace = Math.max(
    0,
    (officialUpdatesCarouselWidth - officialUpdateCardWidth) / 2,
  );

  if (profileInitialLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <HomeScreenSkeleton />
      </View>
    );
  }

  const locationValue = barangay ? `${barangay}, Minglanilla` : 'Minglanilla, Cebu';
  const goToOfficialUpdates = () => router.push('/(main)/feed?tab=official');
  const openReportInMap = (reportId: string) => {
    router.push({ pathname: '/(main)/map', params: { reportId } });
  };
  const quickAccessLoading =
    quickAccessType === 'hotlines'
      ? hotlinesLoading || (!hotlinesLoaded && !hotlinesError)
      : quickAccessType === 'facilities'
        ? facilitiesLoading || (!facilitiesLoaded && !facilitiesError)
        : quickAccessType === 'evacuation'
          ? centersLoading || (!centersLoaded && !centersError)
          : false;
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
      void ensureCenters({ force: true });
      return;
    }
    if (quickAccessType === 'hotlines') void ensureHotlines({ force: true });
    if (quickAccessType === 'facilities') void ensureFacilities({ force: true });
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
    try {
      await Promise.all([
        refreshProfile({ force: true }),
        refreshAnnouncements(),
        reloadReports(),
        loadCurrentLocation(true),
      ]);
    } finally {
      setRefreshing(false);
    }
  };
  const retryNearbyReports = () => {
    // Location and reports are both needed before distance filtering can run.
    void Promise.all([reloadReports(), loadCurrentLocation(true)]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
        <View style={[styles.residentStickyHeader, { top: 0 }]}>
          <View
            style={[
              styles.residentHeaderContent,
              { paddingTop: insets.top + spacing.sm },
            ]}
          >
            {isHeaderCollapsed ? (
              <View style={styles.compactHeaderRow}>
                <Text style={styles.compactHeaderTitle}>Home</Text>
                <View style={styles.compactHeaderActions}>
                  <TouchableOpacity
                    style={styles.notificationButton}
                    activeOpacity={0.75}
                    onPress={() => openInbox()}
                    accessibilityRole="button"
                    accessibilityLabel="Notifications"
                  >
                    <Ionicons name="notifications-outline" size={28} color={homeColors.ink} />
                    {notificationUnreadCount > 0 ? (
                      <View style={styles.notificationDot} />
                    ) : null}
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
                    onPress={() => openInbox()}
                    accessibilityRole="button"
                    accessibilityLabel="Notifications"
                  >
                    <Ionicons name="notifications-outline" size={28} color={homeColors.ink} />
                    {notificationUnreadCount > 0 ? (
                      <View style={styles.notificationDot} />
                    ) : null}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.avatar}
                    activeOpacity={0.82}
                    onPress={() => router.push('/(main)/profile')}
                    accessibilityRole="button"
                    accessibilityLabel="Open profile"
                  >
                    <ProfileAvatar
                      avatarPath={avatarPath}
                      firstName={firstName}
                      lastName={lastName}
                      size={46}
                      style={styles.avatar}
                      textStyle={styles.avatarText}
                      accessibilityLabel="Your profile picture"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

      <ScrollView
        ref={homeScrollRef}
        style={styles.homeScrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + RESIDENT_HEADER_HEIGHT },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isNearbyMapGestureActive}
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

        <View style={styles.headerBody}>
          <NearbyReportsPanel
            reports={nearbyReports}
            loading={reportsLoading || nearbyLocationLoading}
            error={reportsError ?? nearbyLocationError}
            userLocation={currentLocation}
            barangayNamesById={barangayNamesById}
            onOpenReport={openReportInMap}
            onRetry={retryNearbyReports}
            onGestureActiveChange={setIsNearbyMapGestureActive}
          />

          <View style={styles.quickAccessSection}>
            <View style={styles.quickAccessContent}>
              <View style={styles.quickAccessHeader}>
                <Text style={styles.quickAccessTitle}>Help at hand</Text>
              </View>
              <View style={styles.quickAccessRow}>
                <TouchableOpacity
                  style={[styles.quickAccessCard, styles.quickAccessCardBorder]}
                  activeOpacity={0.82}
                  onPress={() => setQuickAccessType('hotlines')}
                  accessibilityRole="button"
                  accessibilityLabel="Go to hotlines"
                >
                  <Ionicons name="call-outline" size={28} color="#C98585" />
                  <Text style={styles.quickAccessText}>Hotlines</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickAccessCard, styles.quickAccessCardBorder]}
                  activeOpacity={0.82}
                  onPress={() => setQuickAccessType('facilities')}
                  accessibilityRole="button"
                  accessibilityLabel="Go to facilities"
                >
                  <Ionicons name="business-outline" size={28} color="#7897CC" />
                  <Text style={styles.quickAccessText}>Facilities</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickAccessCard}
                  activeOpacity={0.82}
                  onPress={() => setQuickAccessType('evacuation')}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${centers.length} evacuation centers`}
                >
                  <MaterialCommunityIcons name="warehouse" size={29} color={homeColors.evacuation} />
                  <Text style={styles.quickAccessText}>Evacuation</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Temporarily hide the rotating preparedness reminder on resident Home. */}

          <View style={styles.contentSection}>
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeadingCopy}>
                <Text style={styles.sectionTitle}>What you should know</Text>
                <Text style={styles.sectionSubtitle}>
                  Latest reports and announcements in Minglanilla
                </Text>
              </View>
            </View>
            {announcementsLoading ? (
              <HomeUpdateSkeleton />
            ) : announcementsError && announcements.length === 0 ? (
              <View style={styles.stateCard}>
                <Ionicons name="warning-outline" size={19} color={colors.textMuted} />
                <Text style={styles.stateText}>Could not load updates</Text>
              </View>
            ) : officialUpdateAnnouncements.length === 0 ? (
              <View style={styles.stateCard}>
                <Ionicons name="megaphone-outline" size={19} color={colors.textMuted} />
                <Text style={styles.stateText}>No recent updates yet</Text>
              </View>
            ) : (
              <OfficialUpdatesCarousel
                announcements={officialUpdateAnnouncements}
                cardWidth={officialUpdateCardWidth}
                carouselWidth={officialUpdatesCarouselWidth}
                trailingSpace={officialUpdateCarouselTrailingSpace}
                onOpenAnnouncement={goToOfficialUpdates}
                onRequestMore={() => setOfficialUpdatesPromptVisible(true)}
              />
            )}
          </View>

          <View style={[styles.sectionBlock, styles.reminderForYouSection]}>
            <View style={[styles.sectionHeaderRow, styles.reminderForYouHeader]}>
              <View style={styles.sectionHeadingCopy}>
                <Text style={styles.sectionTitle}>Reminder for you</Text>
              </View>
            </View>
            <ReminderForYouCarousel />
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

      <WelcomeModal
        visible={showWelcome}
        firstName={firstName}
        barangay={barangay}
        onDone={() => setShowWelcome(false)}
      />
      <Modal
        transparent
        visible={officialUpdatesPromptVisible}
        animationType="fade"
        onRequestClose={() => setOfficialUpdatesPromptVisible(false)}
      >
        <View style={styles.officialUpdatesPromptOverlay}>
          <View style={styles.officialUpdatesPromptCard} accessibilityViewIsModal>
            <View style={styles.officialUpdatesPromptIcon}>
              <Ionicons name="arrow-forward" size={27} color={homeColors.ink} />
            </View>
            <Text style={styles.officialUpdatesPromptTitle}>See all official updates</Text>
            <Text style={styles.officialUpdatesPromptText}>
              More announcements are available in Community.
            </Text>
            <TouchableOpacity
              style={styles.officialUpdatesPromptPrimaryAction}
              onPress={() => {
                setOfficialUpdatesPromptVisible(false);
                goToOfficialUpdates();
              }}
              accessibilityRole="button"
              accessibilityLabel="Open official updates in Community"
            >
              <Text style={styles.officialUpdatesPromptPrimaryText}>Open Community</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.officialUpdatesPromptDismissAction}
              onPress={() => setOfficialUpdatesPromptVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Stay on Home"
            >
              <Text style={styles.officialUpdatesPromptDismissText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
