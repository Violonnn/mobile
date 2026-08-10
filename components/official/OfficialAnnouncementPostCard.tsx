// Resident-style announcement post for the official Community screen.
// Matches report feed cards: collage media, engagement row, and detail sheet.
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CollageCellContent,
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
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
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

/**
 * Smaller resident-home card. The expanded sheet remains the shared official
 * announcement detail view, while this layout keeps Home compact and media-led.
 */
function ResidentAnnouncementCompactContent({
  announcement,
  onRequestExpand,
  onRequestComments,
}: {
  announcement: AnnouncementRecord;
  onRequestExpand: () => void;
  onRequestComments: () => void;
}) {
  const { getState, toggleUpvote } = useAnnouncementEngagement();
  const { upvoteCount, commentCount, hasUpvoted } = getState(announcement);
  const media = announcement.media.map(toReportMedia);
  const firstMedia = media[0] ?? null;
  const displayName = formatAnnouncementAuthorName(announcement.author);
  const message = [announcement.title.trim(), announcement.body.trim()]
    .filter(Boolean)
    .join('\n');

  return (
    <View style={residentStyles.content}>
      <View style={residentStyles.mediaFrame}>
        <View style={residentStyles.mediaClip}>
          {firstMedia ? (
            <CollageCellContent item={firstMedia} />
          ) : (
            <View style={residentStyles.mediaPlaceholder}>
              <Ionicons name="megaphone-outline" size={26} color={colors.textMuted} />
            </View>
          )}
        </View>

        {media.length > 0 ? (
          <View style={residentStyles.mediaCount}>
            <Ionicons name="images-outline" size={13} color={colors.white} />
            <Text style={residentStyles.mediaCountText}>{media.length}</Text>
          </View>
        ) : null}

        <View style={residentStyles.avatarOverlay} pointerEvents="none">
          <ReporterAvatar
            reporter={{
              id: announcement.author.id,
              firstName: announcement.author.firstName,
              lastName: announcement.author.lastName,
              middleName: announcement.author.middleName,
            }}
            size={44}
          />
        </View>
      </View>

      <View style={residentStyles.detailsSection}>
        <View style={residentStyles.authorActionRow}>
          <View style={residentStyles.authorBlock}>
            <Text style={residentStyles.authorName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={residentStyles.authorRole} numberOfLines={1}>
              {announcement.author.roleLabel}
              {announcement.createdAt ? ` · ${formatPublishedAt(announcement.createdAt)}` : ''}
            </Text>
          </View>

          <EngagementActionsRow
            upvoteCount={upvoteCount}
            commentCount={commentCount}
            hasUpvoted={hasUpvoted}
            compact
            onToggleUpvote={() => toggleUpvote(announcement)}
            onCommentPress={onRequestComments}
          />
        </View>

        <View style={residentStyles.messageBlock}>
          <Text style={residentStyles.message} numberOfLines={3} ellipsizeMode="tail">
            {message || 'No description provided.'}
          </Text>
        </View>

        <TouchableOpacity
          style={residentStyles.moreAction}
          onPress={(event) => {
            event.stopPropagation?.();
            onRequestExpand();
          }}
          accessibilityRole="button"
          accessibilityLabel="Read the full announcement"
        >
          <Text style={residentStyles.moreText}>Read more</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OfficialAnnouncementPostCard({
  announcement,
  moderationMode = 'none',
  cardStyle,
  variant = 'default',
}: {
  announcement: AnnouncementRecord;
  moderationMode?: 'none' | 'scoped';
  /** Lets horizontally scrolling resident cards keep the shared post layout. */
  cardStyle?: StyleProp<ViewStyle>;
  variant?: 'default' | 'residentCompact';
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
        style={[reportDetailStyles.feedCard, cardStyle]}
        onPress={() => openExpanded(false)}
      >
        {variant === 'residentCompact' ? (
          <ResidentAnnouncementCompactContent
            announcement={announcement}
            onRequestExpand={() => openExpanded(false)}
            onRequestComments={() => openExpanded(true)}
          />
        ) : (
          <AnnouncementDetailContent
            announcement={announcement}
            onRequestExpand={() => openExpanded(false)}
            onRequestComments={() => openExpanded(true)}
          />
        )}
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

const residentStyles = StyleSheet.create({
  content: {
    flex: 1,
  },
  mediaFrame: {
    flex: 3,
    minHeight: 0,
    position: 'relative',
  },
  mediaClip: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  mediaPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCount: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
  },
  mediaCountText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: colors.white,
  },
  avatarOverlay: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.sm,
  },
  detailsSection: {
    flex: 2.25,
    justifyContent: 'space-between',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  authorActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  authorBlock: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  authorName: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  authorRole: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  messageBlock: {
    gap: 1,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    lineHeight: 18,
    color: colors.text,
  },
  moreText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  moreAction: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 2,
  },
});
