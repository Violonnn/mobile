import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { homeStyles as styles, homeColors } from '../../styles/screens/home.styles';
import { colors } from '../../styles/theme';
import AppHeader from '../../components/navigation/AppHeader';
import WelcomeModal from '../../components/ui/WelcomeModal';
import HomeMapPreview from '../../components/home/HomeMapPreview';
import { ReportDetailContent } from '../../components/report/ReportDetailCard';
import { ReportEngagementProvider } from '../../components/report/ReportEngagementProvider';
import OfficialAnnouncementPostCard from '../../components/official/OfficialAnnouncementPostCard';
import { AnnouncementEngagementProvider } from '../../components/official/AnnouncementEngagementProvider';
import { getActiveSession } from '../../lib/auth';
import { fetchMyProfile } from '../../lib/profile';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { useReports } from '../../hooks/useReports';
import { useResources } from '../../hooks/useResources';
import {
  facilityTypeLabel,
  hotlineCategoryLabel,
  openHotlineDialer,
} from '../../lib/resources';
import type { MapReportMarker } from '../../lib/reports';

export default function HomeScreen() {
  const router = useRouter();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();

  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [barangay, setBarangay] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);

  const {
    announcements,
    loading: announcementsLoading,
    error: announcementsError,
  } = useAnnouncements({ limit: 5 });

  const {
    reports,
    loading: reportsLoading,
    error: reportsError,
  } = useReports({ realtime: false });

  const {
    hotlines,
    facilities,
    loading: resourcesLoading,
    error: resourcesError,
  } = useResources({ mode: 'resident' });

  const scrollViewRef = useRef<ScrollView>(null);
  const [bodySectionTop, setBodySectionTop] = useState(0);
  const [mapSectionTop, setMapSectionTop] = useState(0);
  const [mapFocusReport, setMapFocusReport] = useState<MapReportMarker | null>(
    null,
  );

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const session = await getActiveSession();
      if (!session) {
        setIsAuthenticated(false);
        setFirstName('');
        setBarangay('');
        return;
      }

      setIsAuthenticated(true);
      const { profile } = await fetchMyProfile();
      if (profile) {
        setFirstName(profile.first_name);
        setBarangay(profile.barangay);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (welcome === '1' && isAuthenticated && !loading) {
      setShowWelcome(true);
    }
  }, [welcome, isAuthenticated, loading]);

  if (loading || !isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.themeSoft} />
        </View>
      </SafeAreaView>
    );
  }

  const locationValue = barangay ? `${barangay}, Minglanilla` : 'Minglanilla, Cebu';
  const goToFeed = () => router.push('/(main)/feed');
  const goToMap = () => router.push('/(main)/map');

  const visibleHotlines = hotlines.slice(0, 5);
  const visibleFacilities = facilities.slice(0, 5);
  const visibleAnnouncements = announcements.slice(0, 5);
  const normalizedBarangay = barangay.trim().toLocaleLowerCase();
  // Profiles store a barangay label, so use it to prioritize local reports.
  const nearbyReport =
    reports.find((report) => {
      if (!normalizedBarangay) return false;
      return (report.addressText ?? '')
        .toLocaleLowerCase()
        .includes(normalizedBarangay);
    }) ?? reports[0] ?? null;

  const focusNearbyReportOnMap = () => {
    if (!nearbyReport) return;
    setMapFocusReport(nearbyReport);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, bodySectionTop + mapSectionTop - 16),
        animated: true,
      });
    });
  };

  const openReportInMap = (reportId: string) => {
    router.push({ pathname: '/(main)/map', params: { reportId } });
  };

  return (
    <View style={styles.container}>
      {/* Light status bar icons — matches the white text on the themed header. */}
      <StatusBar style="dark" />
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AppHeader
          greetingName={firstName}
          locationLabel={locationValue}
          searchPlaceholder="Search announcement and report"
          tone="light"
        >
          <View style={styles.headerSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.announcementTitleRow}>
                <Text style={styles.sectionTitle}>Announcement</Text>
              </View>
              <TouchableOpacity
                style={styles.seeAllButton}
                activeOpacity={0.8}
                onPress={goToFeed}
                accessibilityRole="button"
                accessibilityLabel="Show all announcements"
              >
                <Text style={styles.seeAllText}>Show All</Text>
              </TouchableOpacity>
            </View>

            {announcementsLoading ? (
              <View style={styles.emptyCard}>
                <ActivityIndicator color={homeColors.headerMuted} />
              </View>
            ) : null}

            {!announcementsLoading && announcementsError ? (
              <View style={styles.emptyCard}>
                <Ionicons name="warning-outline" size={18} color={homeColors.headerMuted} />
                <Text style={styles.emptyTitle}>Could not load announcements</Text>
              </View>
            ) : null}

            {!announcementsLoading &&
              !announcementsError &&
              visibleAnnouncements.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="megaphone-outline" size={18} color={homeColors.headerMuted} />
                <Text style={styles.emptyTitle}>No announcements yet</Text>
              </View>
            ) : null}

            {!announcementsLoading &&
              !announcementsError &&
              visibleAnnouncements.length > 0 ? (
              <AnnouncementEngagementProvider announcements={visibleAnnouncements}>
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.announcementList}
                >
                  {visibleAnnouncements.map((item) => (
                    <OfficialAnnouncementPostCard
                      key={item.id}
                    announcement={item}
                    cardStyle={styles.announcementPostCard}
                    variant="residentCompact"
                    />
                  ))}
                </ScrollView>
              </AnnouncementEngagementProvider>
            ) : null}
          </View>
        </AppHeader>

        <View
          style={styles.bodySection}
          onLayout={(event) => setBodySectionTop(event.nativeEvent.layout.y)}
        >
          <View style={styles.nearbySection}>
            <View style={[styles.sectionHeaderRow, styles.nearbySectionHeader]}>
              <Text style={styles.sectionTitleDark}>Happening near you</Text>
              <TouchableOpacity
                style={styles.seeAllButton}
                activeOpacity={0.8}
                onPress={goToFeed}
                accessibilityRole="button"
                accessibilityLabel="Show all nearby activity"
              >
                <Text style={styles.seeAllTextDark}>Show All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.nearbyCarousel}
            >
              <View style={styles.nearbyIntroCard}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.52)', 'rgba(255, 255, 255, 0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.nearbyIntroGlow}
                  pointerEvents="none"
                />
                <View style={styles.nearbyIntroContent}>
                  <View style={styles.nearbyReportBadge}>
                    <Text style={styles.nearbyReportBadgeText}>Report</Text>
                  </View>
                  <Text style={styles.nearbyIntroTitle}>What&apos;s happening near you?</Text>
                  <Text style={styles.nearbyIntroDescription}>
                    Reports that are happening near your barangay. New ones will
                    pop up for every nearby report. Slide right to see →
                  </Text>
                </View>
              </View>

              {reportsLoading ? (
                <View style={styles.nearbyStateCard}>
                  <ActivityIndicator color={colors.themeSoft} />
                </View>
              ) : null}

              {!reportsLoading && reportsError ? (
                <View style={styles.nearbyStateCard}>
                  <Ionicons name="warning-outline" size={20} color={colors.textMuted} />
                  <Text style={styles.emptyTitleDark}>Could not load nearby reports</Text>
                </View>
              ) : null}

              {!reportsLoading && !reportsError && !nearbyReport ? (
                <View style={styles.nearbyStateCard}>
                  <Ionicons name="pulse-outline" size={20} color={colors.textMuted} />
                  <Text style={styles.emptyTitleDark}>No nearby reports yet</Text>
                </View>
              ) : null}

              {!reportsLoading && !reportsError && nearbyReport ? (
                <ReportEngagementProvider reports={[nearbyReport]}>
                  <TouchableOpacity
                    style={styles.nearbyReportCard}
                    activeOpacity={0.88}
                    onPress={focusNearbyReportOnMap}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${nearbyReport.title || 'nearby report'} on the map`}
                  >
                    <ReportDetailContent report={nearbyReport} />
                  </TouchableOpacity>
                </ReportEngagementProvider>
              ) : null}
            </ScrollView>

            <View onLayout={(event) => setMapSectionTop(event.nativeEvent.layout.y)}>
              <HomeMapPreview
                report={nearbyReport}
                focusTarget={
                  mapFocusReport
                    ? {
                        reportId: mapFocusReport.id,
                        latitude: mapFocusReport.latitude,
                        longitude: mapFocusReport.longitude,
                      }
                    : null
                }
                onOpenReport={openReportInMap}
              />
            </View>
          </View>

          <View style={styles.happeningSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleDark}>Hotlines</Text>
              <TouchableOpacity
                style={styles.seeAllButton}
                activeOpacity={0.8}
                onPress={goToMap}
                accessibilityRole="button"
                accessibilityLabel="View hotlines in map"
              >
                <Text style={styles.seeAllTextDark}>View in map</Text>
              </TouchableOpacity>
            </View>

            {resourcesLoading ? (
              <View style={styles.emptyCardDark}>
                <ActivityIndicator color={colors.textMuted} />
              </View>
            ) : null}

            {!resourcesLoading && resourcesError ? (
              <View style={styles.emptyCardDark}>
                <Ionicons name="warning-outline" size={18} color={colors.textMuted} />
                <Text style={styles.emptyTitleDark}>Could not load hotlines</Text>
              </View>
            ) : null}

            {!resourcesLoading &&
              !resourcesError &&
              visibleHotlines.length === 0 ? (
              <View style={styles.emptyCardDark}>
                <Ionicons name="call-outline" size={18} color={colors.textMuted} />
                <Text style={styles.emptyTitleDark}>No hotlines added yet</Text>
              </View>
            ) : null}

            {!resourcesLoading &&
              !resourcesError &&
              visibleHotlines.map((hotline) => (
                <TouchableOpacity
                  key={hotline.id}
                  style={styles.emptyCardDark}
                  activeOpacity={0.85}
                  onPress={() => {
                    // Hotlines without a linked facility open the dialer, not a fake map pin.
                    if (!hotline.facilityId) {
                      void openHotlineDialer(hotline.number);
                      return;
                    }
                    goToMap();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${hotline.name}`}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.emptyTitleDark}>{hotline.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      {hotline.number} · {hotlineCategoryLabel(hotline.category)}
                    </Text>
                  </View>
                  <Ionicons name="call" size={18} color={colors.themeSoft} />
                </TouchableOpacity>
              ))}
          </View>

          <View style={styles.happeningSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleDark}>Facilities</Text>
              <TouchableOpacity
                style={styles.seeAllButton}
                activeOpacity={0.8}
                onPress={goToMap}
                accessibilityRole="button"
                accessibilityLabel="View facilities in map"
              >
                <Text style={styles.seeAllTextDark}>View in map</Text>
              </TouchableOpacity>
            </View>

            {resourcesLoading ? (
              <View style={styles.emptyCardDark}>
                <ActivityIndicator color={colors.textMuted} />
              </View>
            ) : null}

            {!resourcesLoading &&
              !resourcesError &&
              visibleFacilities.length === 0 ? (
              <View style={styles.emptyCardDark}>
                <Ionicons name="business-outline" size={18} color={colors.textMuted} />
                <Text style={styles.emptyTitleDark}>No facilities added yet</Text>
              </View>
            ) : null}

            {!resourcesLoading &&
              !resourcesError &&
              visibleFacilities.map((facility) => (
                <TouchableOpacity
                  key={facility.id}
                  style={styles.emptyCardDark}
                  activeOpacity={0.85}
                  onPress={goToMap}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${facility.name} on map`}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.emptyTitleDark}>{facility.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      {facilityTypeLabel(facility.type)}
                      {facility.address ? ` · ${facility.address}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="map-outline" size={18} color={colors.themeSoft} />
                </TouchableOpacity>
              ))}
          </View>
        </View>
      </ScrollView>

      <WelcomeModal
        visible={showWelcome}
        firstName={firstName}
        barangay={barangay}
        onDone={() => setShowWelcome(false)}
      />
    </View>
  );
}
