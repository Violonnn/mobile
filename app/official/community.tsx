// app/official/community.tsx
// Scoped announcements, a shared official composer, and resident-style report posts.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { tabStyles } from '../../styles/screens/tab.styles';
import { colors } from '../../styles/theme';
import { useOfficialPortal } from '../../context/OfficialPortalContext';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { useOfficialReportQueue } from '../../hooks/useOfficialReports';
import MdrrmoHeader from '../../components/official/MdrrmoHeader';
import { createOfficialAnnouncement } from '../../lib/announcements';
import { ResourceManagementContent } from './resources';
import AnnouncementComposerModal from '../../components/official/AnnouncementComposerModal';
import {
  pickAnnouncementMedia,
  validateAnnouncementMedia,
  type AnnouncementDraftMedia,
} from '../../lib/announcementMedia';
import { fetchMyOfficialPublicProfile, type OfficialPublicProfile } from '../../lib/profile';
import OfficialAnnouncementPostCard from '../../components/official/OfficialAnnouncementPostCard';
import OfficialReportPostCard from '../../components/official/OfficialReportPostCard';
import MdrrmoCommunityFeed from '../../components/official/MdrrmoCommunityFeed';
import { AnnouncementEngagementProvider } from '../../components/official/AnnouncementEngagementProvider';
import { ReportEngagementProvider } from '../../components/report/ReportEngagementProvider';
import ProfileAvatar from '../../components/profile/ProfileAvatar';
import { OfficialShellSkeleton } from '../../components/ui/OfficialScreenSkeletons';

const PAGE_SIZE = 5;
// How close to the bottom (px) before we reveal the next batch of reports.
const LOAD_MORE_THRESHOLD = 80;

function BdrrmoCommunitySectionSwitch({ showingResources, onSelect }: {
  showingResources: boolean;
  onSelect: (resources: boolean) => void;
}) {
  return (
    <View style={styles.communitySectionSwitch}>
      <TouchableOpacity style={styles.communitySectionIconButton} onPress={() => onSelect(false)} accessibilityRole="button" accessibilityState={{ selected: !showingResources }} accessibilityLabel="Community">
        <Ionicons name={showingResources ? 'people-outline' : 'people'} size={24} color={showingResources ? colors.textMuted : colors.themeSoft} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.communitySectionIconButton} onPress={() => onSelect(true)} accessibilityRole="button" accessibilityState={{ selected: showingResources }} accessibilityLabel="Resources">
        <Ionicons name={showingResources ? 'business' : 'business-outline'} size={24} color={showingResources ? colors.themeSoft : colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

export default function OfficialCommunityScreen() {
  const router = useRouter();
  const { section, compose, feed, from } = useLocalSearchParams<{
    section?: string | string[];
    compose?: string | string[];
    feed?: string | string[];
    from?: string | string[];
  }>();
  const { scope, officialKind, loading: scopeLoading, error: scopeError } =
    useOfficialPortal();
  const {
    announcements,
    error,
    loading,
    loadingMore: announcementsLoadingMore,
    hasMore: hasMoreAnnouncements,
    refreshing,
    refresh,
    reload,
    loadMore: loadMoreAnnouncements,
  } = useAnnouncements({ limit: 20 });
  const {
    reports,
    error: reportsError,
    loading: reportsLoading,
    hasMore: hasMoreServerReports,
    refresh: refreshReports,
    reload: reloadReports,
    loadMore: loadMoreServerReports,
  } = useOfficialReportQueue(scope);

  const [composerVisible, setComposerVisible] = useState(false);
  const [announcementDescription, setAnnouncementDescription] = useState('');
  const [announcementMedia, setAnnouncementMedia] = useState<AnnouncementDraftMedia[]>([]);
  const [announcementSubmitting, setAnnouncementSubmitting] = useState(false);
  const [announcementMediaSelecting, setAnnouncementMediaSelecting] =
    useState<'photo' | 'video' | null>(null);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [officialProfile, setOfficialProfile] = useState<OfficialPublicProfile | null>(null);
  const composeRequestHandledRef = useRef(false);

  const canPublish = officialKind === 'BDRRMO' || officialKind === 'MDRRMO' ||
    officialKind === 'Mayor';
  const [visibleReportCount, setVisibleReportCount] = useState(PAGE_SIZE);
  // Prevents a single fast scroll from firing several "load more" bumps before
  // the list re-renders; unlocks once the visible count actually changes.
  const loadLockRef = useRef(false);

  // Newest-first list; filters were removed from the Community UI.
  const sortedReports = useMemo(
    () =>
      [...reports].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [reports],
  );
  const communityReports = sortedReports.slice(0, visibleReportCount);
  const hasMoreReports =
    visibleReportCount < sortedReports.length || hasMoreServerReports;
  const requestedCompose = Array.isArray(compose) ? compose[0] : compose;
  const requestedSection = Array.isArray(section) ? section[0] : section;
  const requestedFeed = Array.isArray(feed) ? feed[0] : feed;
  const openedFromCommand = (Array.isArray(from) ? from[0] : from) === 'command';
  const showingBdrrmoResources = officialKind === 'BDRRMO' && requestedSection === 'resources';

  useEffect(() => {
    if (!canPublish) return;
    void fetchMyOfficialPublicProfile().then((result) => setOfficialProfile(result.profile));
  }, [canPublish]);

  useEffect(() => {
    // Dashboard compose links open the shared composer for publishing officials.
    // The ref prevents a close action
    // from immediately reopening the composer while the route stays focused.
    if (
      composeRequestHandledRef.current ||
      requestedCompose !== '1' ||
      !canPublish
    ) {
      return;
    }
    composeRequestHandledRef.current = true;
    setComposerVisible(true);
  }, [canPublish, requestedCompose]);

  useEffect(() => {
    loadLockRef.current = false;
  }, [visibleReportCount]);

  function loadMoreReports() {
    if (loadLockRef.current || !hasMoreReports) return;
    loadLockRef.current = true;
    const nextCount = visibleReportCount + PAGE_SIZE;
    setVisibleReportCount(nextCount);
    if (nextCount >= sortedReports.length && hasMoreServerReports) {
      void loadMoreServerReports();
    }
  }

  function selectBdrrmoSection(resources: boolean) {
    router.replace((resources ? '/official/community?section=resources' : '/official/community') as Href);
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!hasMoreReports && !hasMoreAnnouncements) return;
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceFromBottom < LOAD_MORE_THRESHOLD) {
      if (hasMoreReports) loadMoreReports();
      if (hasMoreAnnouncements) void loadMoreAnnouncements();
    }
  }

  async function handleRefresh() {
    await Promise.all([refresh(), refreshReports()]);
    setVisibleReportCount(PAGE_SIZE);
  }

  function closeAnnouncementComposer() {
    setAnnouncementDescription('');
    setAnnouncementMedia([]);
    setAnnouncementError(null);
    setComposerVisible(false);
    composeRequestHandledRef.current = false;
    router.setParams({ compose: '' });
  }

  async function handleOfficialAnnouncement() {
    if (announcementSubmitting) return;
    setAnnouncementSubmitting(true);
    setAnnouncementError(null);
    const result = await createOfficialAnnouncement({
      description: announcementDescription,
      media: announcementMedia,
    });
    setAnnouncementSubmitting(false);
    if (result.error) {
      setAnnouncementError(result.error);
      return;
    }
    closeAnnouncementComposer();
    Alert.alert('Published', 'Announcement is now visible to residents.');
    void reload();
  }

  async function handleComposeWithMedia(type: 'photo' | 'video') {
    if (announcementMediaSelecting || announcementSubmitting) return;

    setAnnouncementMediaSelecting(type);
    try {
      const result = await pickAnnouncementMedia(type);
      if (result.error) {
        Alert.alert('Attachment unavailable', result.error);
        return;
      }
      if (result.media.length === 0) return;

      const nextMedia = [...announcementMedia, ...result.media];
      const validationError = validateAnnouncementMedia(nextMedia);
      if (validationError) {
        Alert.alert('Attachment limit', validationError);
        return;
      }

      setAnnouncementMedia(nextMedia);
      setComposerVisible(true);
    } catch {
      Alert.alert('Attachment unavailable', 'Could not prepare this attachment.');
    } finally {
      setAnnouncementMediaSelecting(null);
    }
  }

  if (scopeLoading || (!scope && !scopeError)) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <OfficialShellSkeleton />
      </SafeAreaView>
    );
  }

  if (scopeError || !scope) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={[styles.scrollContent, { flex: 1, justifyContent: 'center' }]}>
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>Official access unavailable</Text>
            <Text style={styles.stateBody}>{scopeError}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (showingBdrrmoResources) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <ResourceManagementContent
          header={
            <>
              <MdrrmoHeader title="Community" />
              <BdrrmoCommunitySectionSwitch showingResources onSelect={selectBdrrmoSection} />
            </>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {officialKind === 'MDRRMO' || officialKind === 'Mayor' ? (
            <MdrrmoCommunityFeed
              announcements={announcements}
              announcementError={error}
              announcementsLoading={loading}
              announcementsLoadingMore={announcementsLoadingMore}
              reports={reports}
              reportsError={reportsError}
              reportsLoading={reportsLoading}
              officialProfile={officialProfile}
              visibleReportCount={visibleReportCount}
              onCompose={() => setComposerVisible(true)}
              onComposeWithMedia={(type) => void handleComposeWithMedia(type)}
              mediaSelectionType={announcementMediaSelecting}
              onRetryAnnouncements={() => void reload()}
              onRetryReports={() => void reloadReports()}
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              onScroll={handleScroll}
              contentContainerStyle={styles.scrollContent}
              roleVariant={officialKind === 'Mayor' ? 'mayor' : 'mdrrmo'}
              showCommandBack={openedFromCommand && officialKind === 'MDRRMO'}
              initialTab={requestedFeed === 'official' ? 'official' : 'community'}
            />
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
            <>
              <MdrrmoHeader
                title="Community"
              />

          {officialKind === 'BDRRMO' ? (
            <BdrrmoCommunitySectionSwitch showingResources={false} onSelect={selectBdrrmoSection} />
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Announcements</Text>

            {canPublish ? (
              <TouchableOpacity
                onPress={() => setComposerVisible(true)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Create announcement"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <ProfileAvatar
                    avatarPath={officialProfile?.avatar_path}
                    firstName={officialProfile?.first_name}
                    lastName={officialProfile?.last_name}
                    fallback={`${officialProfile?.first_name?.slice(0, 1).toUpperCase() || officialKind.charAt(0)}${officialProfile?.last_name?.slice(0, 1).toUpperCase() || ''}`}
                    size={52}
                    style={styles.initialAvatar}
                    textStyle={styles.initialAvatarText}
                  />
                  <Text style={[styles.formInput, { flex: 1, paddingVertical: 12 }]}>
                    What would be your announcement?
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {loading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color={colors.themeSoft} />
              </View>
            ) : null}

            {!loading && error ? (
              <View style={styles.stateBox}>
                <Text style={styles.stateTitle}>Could not load announcements</Text>
                <Text style={styles.stateBody}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => void reload()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.retryButtonText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {!loading && !error && announcements.length === 0 ? (
              <View style={styles.stateBoxBorderless}>
                <Text style={styles.stateTitle}>No announcements yet</Text>
                <Text style={styles.stateBody}>
                  Published notices will appear here in pin order.
                </Text>
              </View>
            ) : null}

            {!loading && !error && announcements.length > 0 ? (
              <AnnouncementEngagementProvider announcements={announcements}>
                {announcements.map((item) => (
                  <OfficialAnnouncementPostCard
                    key={item.id}
                    announcement={item}
                    moderationMode="scoped"
                  />
                ))}
              </AnnouncementEngagementProvider>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent reports</Text>
            {reportsLoading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color={colors.themeSoft} />
              </View>
            ) : null}
            {!reportsLoading && reportsError ? (
              <View style={styles.stateBox}>
                <Text style={styles.stateTitle}>Could not load reports</Text>
                <Text style={styles.stateBody}>{reportsError}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => void reloadReports()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.retryButtonText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {!reportsLoading && !reportsError && communityReports.length === 0 ? (
              <View style={styles.stateBox}>
                <Text style={styles.stateTitle}>No reports in your scope</Text>
              </View>
            ) : null}
            {!reportsLoading && !reportsError && sortedReports.length > 0 ? (
              <>
                <ReportEngagementProvider
                  reports={reports.map((report) => ({
                    id: report.id,
                    title: report.title,
                    description: report.description,
                    incidentType: report.incidentType,
                    incidentTypeOther: report.incidentTypeOther,
                    status: report.status,
                    latitude: report.latitude ?? 0,
                    longitude: report.longitude ?? 0,
                    addressText: report.addressText,
                    barangay_id: report.barangayId,
                    created_at: report.createdAt,
                    reporter: report.reporter,
                    media: report.media,
                    upvoteCount: report.upvoteCount,
                    commentCount: report.commentCount,
                  }))}
                >
                  {communityReports.map((report) => (
                    <OfficialReportPostCard
                      key={report.id}
                      report={report}
                      onPress={() => router.push(`/official/${report.id}` as Href)}
                      onCommentPress={() =>
                        router.push(`/official/${report.id}?focus=comments` as Href)
                      }
                    />
                  ))}
                </ReportEngagementProvider>

                {hasMoreReports ? (
                  <View style={tabStyles.loadMoreWrap}>
                    <TouchableOpacity
                      style={tabStyles.loadMoreCircle}
                      onPress={loadMoreReports}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Show more reports"
                    >
                      <Ionicons name="add" size={26} color={colors.white} />
                    </TouchableOpacity>
                    <Text style={tabStyles.loadMoreHint}>Scroll for more</Text>
                  </View>
                ) : (
                  <Text style={tabStyles.feedEndNote}>You&apos;re all caught up</Text>
                )}
              </>
            ) : null}
            </View>
            </>
            </ScrollView>
          )}
      </KeyboardAvoidingView>
      {canPublish ? (
        <AnnouncementComposerModal
          visible={composerVisible}
          displayName={
            officialProfile
              ? [officialProfile.first_name, officialProfile.middle_name, officialProfile.last_name]
                  .filter((part) => part?.trim())
                  .join(' ')
                  .trim() || officialKind
              : officialKind
          }
          initials={
            (
              [officialProfile?.first_name, officialProfile?.middle_name, officialProfile?.last_name]
                .filter((part) => part?.trim())
                .join(' ')
                .trim()
                .charAt(0) || officialKind.charAt(0)
            ).toUpperCase()
          }
          avatarPath={officialProfile?.avatar_path}
          description={announcementDescription}
          media={announcementMedia}
          audienceLabel={
            officialKind === 'Mayor'
              ? 'Municipality-wide — visible to residents and authorized officials.'
              : null
          }
          submitting={announcementSubmitting}
          error={announcementError}
          onChangeDescription={setAnnouncementDescription}
          onChangeMedia={setAnnouncementMedia}
          onSubmit={() => void handleOfficialAnnouncement()}
          onClose={closeAnnouncementComposer}
        />
      ) : null}
    </SafeAreaView>
  );
}
