// app/official/community.tsx
// Scoped announcements, a shared official composer, and resident-style report posts.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { useOfficialPortal } from '../../context/OfficialPortalContext';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { useOfficialReportQueue } from '../../hooks/useOfficialReports';
import { createOfficialAnnouncement } from '../../lib/announcements';
import AnnouncementComposerModal from '../../components/official/AnnouncementComposerModal';
import {
  pickAnnouncementMedia,
  validateAnnouncementMedia,
  type AnnouncementDraftMedia,
} from '../../lib/announcementMedia';
import { fetchMyOfficialPublicProfile, type OfficialPublicProfile } from '../../lib/profile';
import MdrrmoCommunityFeed from '../../components/official/MdrrmoCommunityFeed';
import BdrrmoCommunityFeed from '../../components/official/BdrrmoCommunityFeed';
import { OfficialShellSkeleton } from '../../components/ui/OfficialScreenSkeletons';

const PAGE_SIZE = 5;
// How close to the bottom (px) before we reveal the next batch of reports.
const LOAD_MORE_THRESHOLD = 80;

export default function OfficialCommunityScreen() {
  const router = useRouter();
  const { compose, feed, from } = useLocalSearchParams<{
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
  const hasMoreReports =
    visibleReportCount < sortedReports.length || hasMoreServerReports;
  const requestedCompose = Array.isArray(compose) ? compose[0] : compose;
  const requestedFeed = Array.isArray(feed) ? feed[0] : feed;
  const openedFromCommand = (Array.isArray(from) ? from[0] : from) === 'command';

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {officialKind === 'BDRRMO' ? (
            <BdrrmoCommunityFeed
              announcements={announcements}
              announcementError={error}
              announcementsLoading={loading}
              announcementsLoadingMore={announcementsLoadingMore}
              reports={reports}
              reportsError={reportsError}
              reportsLoading={reportsLoading}
              officialProfile={officialProfile}
              visibleReportCount={visibleReportCount}
              assignedBarangayId={scope.barangay_id}
              initialTab={requestedFeed === 'official' ? 'official' : 'community'}
              refreshing={refreshing}
              mediaSelectionType={announcementMediaSelecting}
              onCompose={() => setComposerVisible(true)}
              onComposeWithMedia={(type) => void handleComposeWithMedia(type)}
              onRetryAnnouncements={() => void reload()}
              onRetryReports={() => void reloadReports()}
              onRefresh={() => void handleRefresh()}
              onScroll={handleScroll}
              contentContainerStyle={styles.scrollContent}
            />
          ) : officialKind === 'MDRRMO' || officialKind === 'Mayor' ? (
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
          ) : null}
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
