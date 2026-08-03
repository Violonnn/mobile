// Resident-style announcement post for the official Community screen.
// Matches report feed cards: collage media, engagement row, and detail sheet.
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  EngagementActionsRow,
  MediaCollage,
  ReportMediaPreviewModal,
  VerticalAttachmentList,
  reportDetailStyles,
} from '../report/ReportDetailCard';
import { ReporterAvatar } from '../report/ReporterAvatar';
import CommentsSection from '../report/CommentsSection';
import { useAnnouncementEngagement } from './AnnouncementEngagementProvider';
import {
  formatAnnouncementAuthorName,
  type AnnouncementRecord,
  type AnnouncementMediaAttachment,
} from '../../lib/announcements';
import { formatPublishedAt } from '../../lib/formatTime';
import type { ReportMediaAttachment } from '../../lib/reports';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { colors, spacing } from '../../styles/theme';
import { officialNavMetrics } from '../../styles/components/officialBottomNav.styles';

const BOTTOM_NAV_CLEARANCE = officialNavMetrics.barHeight + spacing.sm;

function toReportMedia(item: AnnouncementMediaAttachment): ReportMediaAttachment {
  return {
    id: item.id,
    type: item.type,
    url: item.url,
    durationSeconds: item.durationSeconds,
  };
}

function AnnouncementMetaHeader({
  announcement,
}: {
  announcement: AnnouncementRecord;
}) {
  const displayName = formatAnnouncementAuthorName(announcement.author);

  return (
    <View style={reportDetailStyles.metaBlock}>
      <View style={reportDetailStyles.reporterRow}>
        <ReporterAvatar
          reporter={{
            id: announcement.author.id,
            firstName: announcement.author.firstName,
            lastName: announcement.author.lastName,
            middleName: announcement.author.middleName,
          }}
          size={40}
        />
        <View style={reportDetailStyles.reporterTextWrap}>
          <View style={reportDetailStyles.nameDateRow}>
            <Text style={reportDetailStyles.reporterName} numberOfLines={1}>
              {displayName}
              <Text style={reportDetailStyles.publishedDate}>
                {' '}· {announcement.author.roleLabel}
              </Text>
            </Text>
            {announcement.createdAt ? (
              <Text style={reportDetailStyles.publishedDate}>
                {formatPublishedAt(announcement.createdAt)}
              </Text>
            ) : null}
            {announcement.isPinned ? (
              <View
                style={[
                  reportDetailStyles.statusPillSmall,
                  reportDetailStyles.statusVerified,
                ]}
              >
                <Text style={reportDetailStyles.statusTextSmall}>Pinned</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function AnnouncementDetailContent({
  announcement,
  showingAllMedia = false,
  onRequestExpand,
  onRequestComments,
}: {
  announcement: AnnouncementRecord;
  showingAllMedia?: boolean;
  onRequestExpand?: () => void;
  onRequestComments?: () => void;
}) {
  const [preview, setPreview] = useState<ReportMediaAttachment | null>(null);
  const { getState, toggleUpvote } = useAnnouncementEngagement();
  const { upvoteCount, commentCount, hasUpvoted } = getState(announcement);
  const media = announcement.media.map(toReportMedia);

  return (
    <View style={reportDetailStyles.detailBody}>
      <AnnouncementMetaHeader announcement={announcement} />

      {media.length > 0 ? (
        showingAllMedia ? (
          <VerticalAttachmentList media={media} onOpenPreview={setPreview} />
        ) : (
          <MediaCollage
            media={media}
            // With 5+ attachments, any cell opens the full gallery (not just +N).
            onOpenPreview={(item) => {
              if (media.length > 4 && onRequestExpand) {
                onRequestExpand();
                return;
              }
              setPreview(item);
            }}
            onOpenGallery={onRequestExpand ?? (() => undefined)}
          />
        )
      ) : null}

      <EngagementActionsRow
        upvoteCount={upvoteCount}
        commentCount={commentCount}
        hasUpvoted={hasUpvoted}
        onToggleUpvote={() => toggleUpvote(announcement)}
        onCommentPress={onRequestComments}
      />

      <View style={reportDetailStyles.detailCard}>
        <Text style={reportDetailStyles.detailDescription}>
          {announcement.body || 'No description provided.'}
        </Text>
      </View>

      <ReportMediaPreviewModal preview={preview} onClose={() => setPreview(null)} />
    </View>
  );
}

export default function OfficialAnnouncementPostCard({
  announcement,
  moderationMode = 'none',
}: {
  announcement: AnnouncementRecord;
  moderationMode?: 'none' | 'scoped';
}) {
  const [expanded, setExpanded] = useState(false);
  const [focusComments, setFocusComments] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetBottom = insets.bottom + BOTTOM_NAV_CLEARANCE;
  const { notifyCommentAdded } = useAnnouncementEngagement();
  const modalScrollRef = useRef<ScrollView>(null);
  const pendingScrollToComments = useRef(false);

  const keyboardHeight = useKeyboardHeight(expanded);
  const keyboardOpen = keyboardHeight > 0;
  const sheetLift = keyboardOpen
    ? {
        marginBottom: keyboardHeight + spacing.sm,
        maxHeight: windowHeight - keyboardHeight - insets.top - spacing.xl,
      }
    : { marginBottom: sheetBottom };

  useEffect(() => {
    if (!expanded || !keyboardOpen) return;
    const timer = setTimeout(
      () => modalScrollRef.current?.scrollToEnd({ animated: true }),
      Platform.OS === 'ios' ? 250 : 80,
    );
    return () => clearTimeout(timer);
  }, [expanded, keyboardOpen]);

  const openExpanded = (withComments: boolean) => {
    pendingScrollToComments.current = withComments;
    setFocusComments(withComments);
    setExpanded(true);
  };

  const closeExpanded = () => {
    pendingScrollToComments.current = false;
    setFocusComments(false);
    setExpanded(false);
  };

  const jumpToComments = () => {
    pendingScrollToComments.current = true;
    setFocusComments(true);
    modalScrollRef.current?.scrollToEnd({ animated: true });
  };

  return (
    <>
      <Pressable
        style={reportDetailStyles.feedCard}
        onPress={() => openExpanded(false)}
      >
        <AnnouncementDetailContent
          announcement={announcement}
          onRequestExpand={() => openExpanded(false)}
          onRequestComments={() => openExpanded(true)}
        />
      </Pressable>

      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={closeExpanded}
      >
        <View style={reportDetailStyles.postModalOverlay}>
          <Pressable
            style={reportDetailStyles.postModalBackdrop}
            onPress={closeExpanded}
            accessibilityLabel="Close announcement"
          />

          <View style={[reportDetailStyles.postModalSheet, sheetLift]}>
            <View style={reportDetailStyles.postModalHandle} />

            <View style={reportDetailStyles.postModalHeader}>
              <View style={reportDetailStyles.postModalHeaderButton} />
              <View style={reportDetailStyles.postModalTitleWrap}>
                <Text style={reportDetailStyles.postModalTitle} numberOfLines={1}>
                  Announcement
                </Text>
              </View>
              <TouchableOpacity
                style={reportDetailStyles.postModalHeaderButton}
                onPress={closeExpanded}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={modalScrollRef}
              style={reportDetailStyles.postModalScroll}
              contentContainerStyle={reportDetailStyles.postModalScrollContent}
              showsVerticalScrollIndicator={false}
              bounces
              alwaysBounceVertical
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    setRefreshSignal((current) => current + 1);
                    setRefreshing(false);
                  }}
                  tintColor={colors.themeSoft}
                  colors={[colors.themeSoft]}
                  enabled={!keyboardOpen}
                />
              }
              onContentSizeChange={() => {
                if (pendingScrollToComments.current) {
                  modalScrollRef.current?.scrollToEnd({ animated: true });
                }
              }}
              onScrollBeginDrag={() => {
                pendingScrollToComments.current = false;
              }}
            >
              <AnnouncementDetailContent
                announcement={announcement}
                showingAllMedia
                onRequestComments={jumpToComments}
              />

              <CommentsSection
                announcementId={announcement.id}
                autoFocus={focusComments}
                highlighted={focusComments}
                refreshSignal={refreshSignal}
                moderationMode={moderationMode}
                onCommentAdded={notifyCommentAdded}
                onComposerFocus={() =>
                  modalScrollRef.current?.scrollToEnd({ animated: true })
                }
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
