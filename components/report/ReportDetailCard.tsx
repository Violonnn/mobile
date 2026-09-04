// components/report/ReportDetailCard.tsx
// Shared "report details" rendering used by both the map detail sheet and the
// feed. Keeping every report primitive (avatar, media collage, engagement row,
// media preview) here means the map and the feed always look and behave the
// same — there is a single source of truth for a report's detail layout.
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useReportDetail } from '../../hooks/useReportDetail';
import { formatPublishedAt } from '../../lib/formatTime';
import {
    formatReporterName,
    formatReportLocation,
    type MapReportMarker,
    type ReportMediaAttachment,
} from '../../lib/reports';
import { navMetrics } from '../../styles/components/bottomNav.styles';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
import CommentsSection from './CommentsSection';
import { useReportEngagement } from './ReportEngagementProvider';
import { ReporterAvatar } from './ReporterAvatar';

const COLLAGE_GAP = 4;
const MAX_COLLAGE_CELLS = 4;
const BOTTOM_NAV_CLEARANCE = navMetrics.barHeight + navMetrics.reportLift + spacing.sm;

// Cache generated video thumbnails so collage cells do not re-extract frames.
const videoThumbCache = new Map<string, string>();

export function statusLabel(status: string): string {
  if (status === 'verified') return 'Verified';
  if (status === 'escalated') return 'Escalated';
  if (status === 'resolved') return 'Resolved';
  return 'Unverified';
}

function residentStatusLabel(status: string): string {
  if (status === 'verified') return 'Verified';
  if (status === 'escalated') return 'Escalated';
  if (status === 'resolved') return 'Resolved';
  return 'Under review';
}

export function statusStyle(status: string) {
  if (status === 'verified') return reportDetailStyles.statusVerified;
  if (status === 'escalated') return reportDetailStyles.statusEscalated;
  if (status === 'resolved') return reportDetailStyles.statusResolved;
  return reportDetailStyles.statusUnverified;
}

function RemoteVideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  return (
    <VideoView
      style={reportDetailStyles.previewVideo}
      player={player}
      nativeControls
      fullscreenOptions={{ enable: true }}
      contentFit="contain"
    />
  );
}

function VideoThumbnail({ uri }: { uri: string }) {
  const [thumbUri, setThumbUri] = useState<string | null>(
    () => videoThumbCache.get(uri) ?? null,
  );
  const [failed, setFailed] = useState(false);
  const [previousUri, setPreviousUri] = useState(uri);

  if (uri !== previousUri) {
    setPreviousUri(uri);
    setThumbUri(videoThumbCache.get(uri) ?? null);
    setFailed(false);
  }

  useEffect(() => {
    let cancelled = false;
    const cached = videoThumbCache.get(uri);
    if (cached) return;

    void (async () => {
      try {
        const result = await VideoThumbnails.getThumbnailAsync(uri, {
          time: 500,
          quality: 0.6,
        });
        if (cancelled) return;
        videoThumbCache.set(uri, result.uri);
        setThumbUri(result.uri);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (thumbUri) {
    return <Image source={{ uri: thumbUri }} style={reportDetailStyles.collageImage} resizeMode="cover" />;
  }

  return (
    <View style={reportDetailStyles.collageVideoPlaceholder}>
      {failed ? (
        <Ionicons name="videocam" size={22} color={colors.white} />
      ) : (
        <ActivityIndicator color={colors.white} />
      )}
    </View>
  );
}

/** Photo image or generated video frame for collage / list cells. */
export function CollageCellContent({ item }: { item: ReportMediaAttachment }) {
  if (item.type === 'photo') {
    return <Image source={{ uri: item.url }} style={reportDetailStyles.collageImage} resizeMode="cover" />;
  }
  return <VideoThumbnail uri={item.url} />;
}

/**
 * Attachment collage with a count-specific layout:
 *  - 1: single full-width cell
 *  - 2: two cells side by side
 *  - 3: one tall cell on the left, two stacked on the right
 *  - 4: 2x2 grid
 *  - 5+: 2x2 grid with a "+N" overlay on the last cell (same as the map
 *    marker cluster count) — tapping it opens the full gallery.
 */
export function MediaCollage({
  media,
  onOpenPreview,
  onOpenGallery,
}: {
  media: ReportMediaAttachment[];
  onOpenPreview: (item: ReportMediaAttachment) => void;
  onOpenGallery: () => void;
}) {
  const [gridWidth, setGridWidth] = useState(0);
  const count = media.length;
  const hasOverflow = count > MAX_COLLAGE_CELLS;
  const visible = media.slice(0, MAX_COLLAGE_CELLS);
  const extraCount = count - MAX_COLLAGE_CELLS;
  const cellSize = gridWidth > 0 ? (gridWidth - COLLAGE_GAP) / 2 : 0;
  const tallHeight = cellSize * 2 + COLLAGE_GAP;

  const renderCell = (
    item: ReportMediaAttachment,
    index: number,
    size: { width: number; height: number },
  ) => {
    const isLastWithOverflow = hasOverflow && index === MAX_COLLAGE_CELLS - 1;

    return (
      <TouchableOpacity
        key={item.id}
        style={[reportDetailStyles.collageCell, size]}
        onPress={() => (isLastWithOverflow ? onOpenGallery() : onOpenPreview(item))}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={
          isLastWithOverflow
            ? `${extraCount} more attachments`
            : item.type === 'video'
              ? 'View video'
              : 'View photo'
        }
      >
        <CollageCellContent item={item} />
        {item.type === 'video' && !isLastWithOverflow ? (
          <View style={reportDetailStyles.videoBadge}>
            <Ionicons name="play" size={12} color={colors.white} />
          </View>
        ) : null}
        {isLastWithOverflow ? (
          <View style={reportDetailStyles.overflowOverlay}>
            <Text style={reportDetailStyles.overflowText}>+{extraCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={reportDetailStyles.collageGrid}
      onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
    >
      {cellSize <= 0 ? null : count === 1 ? (
        renderCell(visible[0], 0, { width: gridWidth, height: gridWidth * 0.75 })
      ) : count === 2 ? (
        <View style={reportDetailStyles.collageRow}>
          {renderCell(visible[0], 0, { width: cellSize, height: cellSize })}
          {renderCell(visible[1], 1, { width: cellSize, height: cellSize })}
        </View>
      ) : count === 3 ? (
        <View style={reportDetailStyles.collageRow}>
          {renderCell(visible[0], 0, { width: cellSize, height: tallHeight })}
          <View style={reportDetailStyles.collageColumn}>
            {renderCell(visible[1], 1, { width: cellSize, height: cellSize })}
            {renderCell(visible[2], 2, { width: cellSize, height: cellSize })}
          </View>
        </View>
      ) : (
        // Explicit 2x2 rows (no flexWrap): rounding on some devices made
        // wrapped rows overflow and clipped cells, hiding attachments.
        <View style={reportDetailStyles.collageColumn}>
          <View style={reportDetailStyles.collageRow}>
            {renderCell(visible[0], 0, { width: cellSize, height: cellSize })}
            {renderCell(visible[1], 1, { width: cellSize, height: cellSize })}
          </View>
          <View style={reportDetailStyles.collageRow}>
            {renderCell(visible[2], 2, { width: cellSize, height: cellSize })}
            {renderCell(visible[3], 3, { width: cellSize, height: cellSize })}
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Shared share / upvote / comment row used by report and announcement posts.
 * Parents supply counts + handlers so report and announcement engagement can
 * reuse the same presentation without sharing a data provider.
 */
export function EngagementActionsRow({
  upvoteCount,
  commentCount,
  hasUpvoted,
  disabled = false,
  compact = false,
  hideShare = false,
  onToggleUpvote,
  onCommentPress,
}: {
  upvoteCount: number;
  commentCount: number;
  hasUpvoted: boolean;
  disabled?: boolean;
  compact?: boolean;
  hideShare?: boolean;
  onToggleUpvote?: () => void;
  onCommentPress?: () => void;
}) {
  return (
    <View
      style={[
        reportDetailStyles.engagementRow,
        !hideShare && reportDetailStyles.engagementRowThreeActions,
        compact && reportDetailStyles.engagementRowCompact,
      ]}
    >
      <TouchableOpacity
        style={reportDetailStyles.engagementItem}
        activeOpacity={0.7}
        onPress={(event) => {
          // Keep parent Pressable/TouchableOpacity (feed card / map list) from firing.
          event.stopPropagation?.();
          if (disabled) return;
          onToggleUpvote?.();
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={hasUpvoted ? 'Remove upvote' : 'Upvote'}
        accessibilityState={{ selected: hasUpvoted, disabled }}
      >
        <Ionicons
          name={hasUpvoted ? 'arrow-up-circle' : 'arrow-up-outline'}
          size={compact ? 18 : 22}
          color={hasUpvoted ? colors.primary : colors.text}
        />
        {upvoteCount > 0 ? (
          <Text
            style={[
              reportDetailStyles.engagementCount,
              hasUpvoted && reportDetailStyles.engagementCountActive,
            ]}
          >
            {upvoteCount}
          </Text>
        ) : null}
      </TouchableOpacity>
      <TouchableOpacity
        style={reportDetailStyles.engagementItem}
        activeOpacity={0.7}
        onPress={(event) => {
          event.stopPropagation?.();
          if (disabled) return;
          onCommentPress?.();
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Comment"
        accessibilityState={{ disabled }}
      >
        <Ionicons
          name="chatbubble-outline"
          size={compact ? 17 : 20}
          color={colors.text}
        />
        {commentCount > 0 ? (
          <Text style={reportDetailStyles.engagementCount}>{commentCount}</Text>
        ) : null}
      </TouchableOpacity>
      {!hideShare ? (
        <TouchableOpacity
          style={reportDetailStyles.engagementButton}
          activeOpacity={0.7}
          onPress={(event) => event.stopPropagation?.()}
          accessibilityRole="button"
          accessibilityLabel="Share"
        >
          <Ionicons
            name="paper-plane-outline"
            size={compact ? 18 : 21}
            color={colors.text}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * Upvote + comment actions with live counts. Upvotes toggle optimistically via
 * the nearest ReportEngagementProvider (falls back to read-only counts without
 * one). The comment button calls onCommentPress so the parent can open the
 * report's details and jump straight to the inline comments section.
 */
export function EngagementActions({
  report,
  compact = false,
  hideShare = false,
  onCommentPress,
}: {
  report: MapReportMarker;
  compact?: boolean;
  hideShare?: boolean;
  onCommentPress?: () => void;
}) {
  const { getState, toggleUpvote } = useReportEngagement();
  const { upvoteCount, commentCount, hasUpvoted } = getState(report);

  return (
    <EngagementActionsRow
      upvoteCount={upvoteCount}
      commentCount={commentCount}
      hasUpvoted={hasUpvoted}
      disabled={Boolean(report.isPending)}
      compact={compact}
      hideShare={hideShare}
      onToggleUpvote={() => toggleUpvote(report)}
      onCommentPress={onCommentPress}
    />
  );
}

export function VerticalAttachmentList({
  media,
  onOpenPreview,
}: {
  media: ReportMediaAttachment[];
  onOpenPreview: (item: ReportMediaAttachment) => void;
}) {
  return (
    <View style={reportDetailStyles.verticalMediaList}>
      {media.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={reportDetailStyles.verticalMediaThumb}
          onPress={() => onOpenPreview(item)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={item.type === 'video' ? 'View video' : 'View photo'}
        >
          <CollageCellContent item={item} />
          {item.type === 'video' ? (
            <View style={reportDetailStyles.videoBadge}>
              <Ionicons name="play" size={14} color={colors.white} />
            </View>
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Three-dot overflow control — tapping reveals a flag icon (UI-only for now). */
function PostOverflowMenu() {
  const [open, setOpen] = useState(false);

  return (
    <View style={reportDetailStyles.overflowMenuWrap}>
      {open ? (
        <TouchableOpacity
          style={reportDetailStyles.overflowTrigger}
          onPress={(event) => {
            event.stopPropagation?.();
            setOpen(false);
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Report post"
        >
          <Ionicons name="flag-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        style={reportDetailStyles.overflowTrigger}
        onPress={(event) => {
          event.stopPropagation?.();
          setOpen((current) => !current);
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="More options"
        accessibilityState={{ expanded: open }}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

/**
 * Post header: avatar + reporter name (published time right next to it) with
 * the full location under them, and a three-dot overflow menu on the right.
 * Official community cards can also show the report status beside the date.
 */
function ReportMetaHeader({
  report,
  showStatus = false,
}: {
  report: MapReportMarker;
  showStatus?: boolean;
}) {
  return (
    <View style={reportDetailStyles.metaBlock}>
      <View style={reportDetailStyles.reporterRow}>
        <ReporterAvatar reporter={report.reporter} size={40} />
        <View style={reportDetailStyles.reporterTextWrap}>
          <View style={reportDetailStyles.nameDateRow}>
            <Text style={reportDetailStyles.reporterName} numberOfLines={1}>
              {formatReporterName(report.reporter)}
            </Text>
            <Text style={reportDetailStyles.publishedDate}>
              {formatPublishedAt(report.created_at)}
            </Text>
            {showStatus ? (
              <View
                style={[
                  reportDetailStyles.statusPillSmall,
                  statusStyle(report.status),
                ]}
              >
                <Text style={reportDetailStyles.statusTextSmall}>
                  {statusLabel(report.status)}
                </Text>
              </View>
            ) : null}
          </View>
          {/* Full location — wraps to more lines instead of truncating. */}
          <Text style={reportDetailStyles.reporterLocation}>
            {formatReportLocation(report)}
          </Text>
        </View>
        <PostOverflowMenu />
      </View>
    </View>
  );
}

/** Full-screen photo/video viewer shared by feed cards and official report ops. */
export function ReportMediaPreviewModal({
  preview,
  onClose,
}: {
  preview: ReportMediaAttachment | null;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={preview != null}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={reportDetailStyles.previewOverlay}>
        <Pressable style={reportDetailStyles.previewBackdropTap} onPress={onClose} />

        <View style={reportDetailStyles.previewContent}>
          <TouchableOpacity
            style={reportDetailStyles.previewClose}
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close preview"
          >
            <Ionicons name="close" size={22} color={colors.white} />
          </TouchableOpacity>

          {preview?.type === 'photo' ? (
            <Image
              source={{ uri: preview.url }}
              style={reportDetailStyles.previewImage}
              resizeMode="contain"
            />
          ) : preview ? (
            <RemoteVideoPreview uri={preview.url} />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

type ReportDetailContentProps = {
  report: MapReportMarker;
  /**
   * Controlled "show every attachment" toggle. Provide both props to let a
   * parent (e.g. the map sheet header) drive it; omit them to let the card
   * manage the toggle on its own.
   */
  showingAllMedia?: boolean;
  onShowingAllMediaChange?: (value: boolean) => void;
  /**
   * When set, tapping the "+N" collage cell calls this instead of expanding
   * the attachment list inline (the feed uses it to open the post modal).
   */
  onRequestExpand?: () => void;
  /**
   * Called when the comment button is pressed. Parents open the full report
   * details (if not already open) and scroll down to the comments section.
   */
  onRequestComments?: () => void;
  /** Show the report status pill beside the published date (official community). */
  showStatus?: boolean;
};

/**
 * The full report post layout (shared by the map sheet and the feed):
 *  - top: reporter avatar + name + location, overflow menu on the right
 *  - middle: 2x2 media collage (tap the +N cell to view every attachment)
 *  - engagement row below attachments
 *  - bottom: title + description
 */
export function ReportDetailContent({
  report,
  showingAllMedia: controlledShowingAllMedia,
  onShowingAllMediaChange,
  onRequestExpand,
  onRequestComments,
  showStatus = false,
}: ReportDetailContentProps) {
  const [internalShowingAllMedia, setInternalShowingAllMedia] = useState(false);
  const showingAllMedia = controlledShowingAllMedia ?? internalShowingAllMedia;
  const setShowingAllMedia = onShowingAllMediaChange ?? setInternalShowingAllMedia;
  const [preview, setPreview] = useState<ReportMediaAttachment | null>(null);

  const handleOpenGallery = onRequestExpand ?? (() => setShowingAllMedia(true));

  return (
    <View style={reportDetailStyles.detailBody}>
      <ReportMetaHeader report={report} showStatus={showStatus} />

      {report.media.length > 0 ? (
        showingAllMedia ? (
          <VerticalAttachmentList media={report.media} onOpenPreview={setPreview} />
        ) : (
          <MediaCollage
            media={report.media}
            onOpenPreview={setPreview}
            onOpenGallery={handleOpenGallery}
          />
        )
      ) : null}

      {report.mediaError ? (
        <Text style={reportDetailStyles.detailRefreshError}>
          {report.mediaError}
        </Text>
      ) : null}

      <EngagementActions report={report} onCommentPress={onRequestComments} />

      <View style={reportDetailStyles.detailCard}>
        <Text style={reportDetailStyles.detailTitle}>
          {report.title || 'Untitled report'}
        </Text>
        <Text style={reportDetailStyles.detailDescription}>
          {report.description || 'No description provided.'}
        </Text>
      </View>

      <ReportMediaPreviewModal preview={preview} onClose={() => setPreview(null)} />
    </View>
  );
}

function ResidentFeedReportContent({
  report,
  distanceLabel,
  onRequestExpand,
  onRequestComments,
}: {
  report: MapReportMarker;
  distanceLabel?: string;
  onRequestExpand: () => void;
  onRequestComments: () => void;
}) {
  const { getState, toggleUpvote } = useReportEngagement();
  const { upvoteCount, commentCount, hasUpvoted } = getState(report);
  const firstMedia = report.media[0] ?? null;
  const statusColor =
    report.status === 'resolved'
      ? '#15805F'
      : report.status === 'verified'
        ? colors.primary
        : report.status === 'escalated'
          ? '#B45309'
          : '#A16207';

  const shareReport = async () => {
    try {
      await Share.share({
        message: `${report.title}\n${report.description}\n${formatReportLocation(report)}`,
        title: report.title,
      });
    } catch {
      // Closing or unavailable native share sheets should not interrupt the feed.
    }
  };

  return (
    <View style={residentFeedStyles.reportContent}>
      <View style={residentFeedStyles.reporterRow}>
        <ReporterAvatar reporter={report.reporter} size={40} />
        <View style={residentFeedStyles.reporterDetails}>
          <Text style={residentFeedStyles.reporterName} numberOfLines={1}>
            {formatReporterName(report.reporter)}
          </Text>
          <View style={residentFeedStyles.reportMetaRow}>
            <Ionicons name="location-sharp" size={12} color={colors.textMuted} />
            <Text style={residentFeedStyles.metaText} numberOfLines={1}>
              {formatReportLocation(report)}
              {distanceLabel ? `  ·  ${distanceLabel}` : ''}
              {report.created_at ? `  ·  ${formatPublishedAt(report.created_at)}` : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={residentFeedStyles.moreButton}
          onPress={onRequestExpand}
          accessibilityRole="button"
          accessibilityLabel="Open report details"
        >
          <Ionicons name="ellipsis-horizontal" size={21} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={residentFeedStyles.statusRow}>
        <View style={[residentFeedStyles.statusPill, { borderColor: statusColor }]}>
          <Text style={[residentFeedStyles.statusText, { color: statusColor }]}>
            {residentStatusLabel(report.status)}
          </Text>
        </View>
        <Text style={residentFeedStyles.typeText}>Community report</Text>
      </View>

      {firstMedia ? (
        <View style={residentFeedStyles.heroMedia}>
          <CollageCellContent item={firstMedia} />
          {report.media.length > 1 ? (
            <View style={residentFeedStyles.mediaCountBadge}>
              <Text style={residentFeedStyles.mediaCountText}>1 / {report.media.length}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={residentFeedStyles.mediaPlaceholder}>
          <Ionicons name="image-outline" size={30} color={colors.textMuted} />
          <Text style={residentFeedStyles.mediaPlaceholderText}>No media attached</Text>
        </View>
      )}

      <View style={residentFeedStyles.copyBlock}>
        <Text style={residentFeedStyles.reportCategory}>INCIDENT REPORT</Text>
        <Text style={residentFeedStyles.reportTitle}>{report.title || 'Untitled report'}</Text>
        <Text style={residentFeedStyles.reportDescription} numberOfLines={3}>
          {report.description || 'No description provided.'}
        </Text>
      </View>

      <View style={residentFeedStyles.actionRow}>
        <View style={residentFeedStyles.engagementActions}>
          <TouchableOpacity
            style={residentFeedStyles.confirmationAction}
            onPress={(event) => {
              event.stopPropagation?.();
              toggleUpvote(report);
            }}
            disabled={Boolean(report.isPending)}
          >
            <Ionicons
              name={hasUpvoted ? 'arrow-up-circle' : 'arrow-up-outline'}
              size={21}
              color={hasUpvoted ? colors.primary : colors.text}
            />
            <Text
              style={[
                residentFeedStyles.actionText,
                hasUpvoted && residentFeedStyles.actionTextActive,
              ]}
            >
              {upvoteCount} confirmation{upvoteCount === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={residentFeedStyles.iconAction}
            onPress={(event) => {
              event.stopPropagation?.();
              onRequestComments();
            }}
            accessibilityLabel="View report comments"
          >
            <Ionicons name="chatbubble-outline" size={21} color={colors.text} />
            <Text style={residentFeedStyles.actionText}>{commentCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={residentFeedStyles.iconAction}
            onPress={(event) => {
              event.stopPropagation?.();
              void shareReport();
            }}
            accessibilityLabel="Share report"
          >
            <Ionicons name="arrow-redo-outline" size={23} color={colors.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={residentFeedStyles.viewReportButton}
          onPress={(event) => {
            event.stopPropagation?.();
            onRequestExpand();
          }}
          accessibilityRole="button"
          accessibilityLabel="View report details"
        >
          <Text style={residentFeedStyles.viewReportText}>View report</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * A single report shown as a self-contained, uniform box (used in the feed).
 * Tapping the post (or the "+N" media cell) opens a centered pop-up modal
 * with the full report and every attachment — the card itself never grows.
 * Tapping the comment button opens the same modal, then auto-scrolls past the
 * attachments to the highlighted comments section and focuses the composer.
 */
export function ReportDetailCard({
  report,
  isLast = false,
  variant = 'default',
  distanceLabel,
}: {
  report: MapReportMarker;
  isLast?: boolean;
  variant?: 'default' | 'residentFeed';
  distanceLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [focusComments, setFocusComments] = useState(false);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetBottom = insets.bottom + BOTTOM_NAV_CLEARANCE;
  const { notifyCommentAdded } = useReportEngagement();
  const {
    report: detailReport,
    refreshing: detailRefreshing,
    refreshError,
    refreshVersion,
    refresh: refreshDetail,
  } = useReportDetail(expanded ? report : null);

  const modalScrollRef = useRef<ScrollView>(null);
  // While true, every content-size change (media, then comments loading in)
  // re-scrolls to the bottom so the comments section stays in view. Cleared as
  // soon as the user drags, so live updates never yank them back down.
  const pendingScrollToComments = useRef(false);

  // Manual keyboard handling: KeyboardAvoidingView is unreliable inside a
  // statusBarTranslucent Modal (Android never resizes, iOS lags), so the sheet
  // lifts itself above the keyboard and shrinks to the remaining space.
  const keyboardHeight = useKeyboardHeight(expanded);
  const keyboardOpen = keyboardHeight > 0;
  const sheetLift = keyboardOpen
    ? { marginBottom: keyboardHeight + spacing.sm, maxHeight: windowHeight - keyboardHeight - insets.top - spacing.xl }
    : { marginBottom: sheetBottom };

  // Once the keyboard is up the viewport shrinks — re-pin the composer so it
  // is never left hidden behind the keyboard.
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
        style={[reportDetailStyles.feedCard, isLast && reportDetailStyles.feedCardLast]}
        onPress={() => openExpanded(false)}
      >
        {variant === 'residentFeed' ? (
          <ResidentFeedReportContent
            report={report}
            distanceLabel={distanceLabel}
            onRequestExpand={() => openExpanded(false)}
            onRequestComments={() => openExpanded(true)}
          />
        ) : (
          <ReportDetailContent
            report={report}
            onRequestExpand={() => openExpanded(false)}
            onRequestComments={() => openExpanded(true)}
          />
        )}
      </Pressable>

      {/* Full-post sheet: matches the map screen's report-details sheet format. */}
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
            accessibilityLabel="Close report"
          />

          <View style={[reportDetailStyles.postModalSheet, sheetLift]}>
            <View style={reportDetailStyles.postModalHandle} />

            <View style={reportDetailStyles.postModalHeader}>
              <View style={reportDetailStyles.postModalHeaderButton} />

              <View style={reportDetailStyles.postModalTitleWrap}>
                <Text style={reportDetailStyles.postModalTitle} numberOfLines={1}>
                  Report details
                </Text>
                <View
                  style={[
                    reportDetailStyles.statusPillHeader,
                    statusStyle(detailReport?.status ?? report.status),
                  ]}
                >
                  <Text style={reportDetailStyles.statusTextHeader}>
                    {statusLabel(detailReport?.status ?? report.status)}
                  </Text>
                </View>
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
                  refreshing={detailRefreshing}
                  onRefresh={refreshDetail}
                  tintColor={colors.themeSoft}
                  colors={[colors.themeSoft]}
                  enabled={!report.isPending && !keyboardOpen}
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
              {/* showingAllMedia is pinned on so the sheet lists every attachment. */}
              {detailReport ? (
                <>
                  <ReportDetailContent
                    report={detailReport}
                    showingAllMedia
                    onShowingAllMediaChange={() => {}}
                    onRequestComments={jumpToComments}
                  />

                  {refreshError ? (
                    <Text style={reportDetailStyles.detailRefreshError}>
                      {refreshError}
                    </Text>
                  ) : null}

                  {/* Inline thread — mounted (and live) only while this modal is open. */}
                  {!detailReport.isPending ? (
                    <CommentsSection
                      reportId={detailReport.id}
                      autoFocus={focusComments}
                      highlighted={focusComments}
                      refreshSignal={refreshVersion}
                      onCommentAdded={notifyCommentAdded}
                      onComposerFocus={() =>
                        modalScrollRef.current?.scrollToEnd({ animated: true })
                      }
                    />
                  ) : null}
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const residentFeedStyles = StyleSheet.create({
  reportContent: {
    gap: spacing.sm,
  },
  reporterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reporterDetails: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  moreButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reporterName: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  reportMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 6,
  },
  statusText: {
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  typeText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  heroMedia: {
    position: 'relative',
    width: '100%',
    aspectRatio: 2.1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  mediaCountBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
  },
  mediaCountText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.white,
  },
  mediaPlaceholder: {
    width: '100%',
    aspectRatio: 2.1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  mediaPlaceholderText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  copyBlock: {
    gap: 3,
  },
  reportCategory: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    letterSpacing: 0.55,
    color: colors.textMuted,
  },
  reportTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    lineHeight: 22,
    color: colors.text,
  },
  reportDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    lineHeight: 22,
    color: colors.text,
  },
  viewReportButton: {
    minHeight: 40,
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  viewReportText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  actionRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  engagementActions: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  confirmationAction: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconAction: {
    minWidth: 38,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  actionTextActive: {
    color: colors.primary,
  },
});

export const reportDetailStyles = StyleSheet.create({
  feedCard: {
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  feedCardLast: {
    borderBottomWidth: 0,
  },
  detailBody: {
    gap: spacing.md,
  },
  detailCard: {
    gap: spacing.xs,
  },
  detailTitle: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  detailDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text,
    lineHeight: 22,
  },
  detailRefreshError: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: 'center',
  },
  // ---- Full-post sheet (feed) --------------------------------------------
  postModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  postModalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17, 24, 39, 0.48)',
  },
  // Anchored to the bottom — same max height as the map detail sheet.
  postModalSheet: {
    width: '100%',
    maxHeight: '72%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.9)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#111827',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  postModalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  postModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  postModalHeaderButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postModalTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  postModalTitle: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.lg,
    color: colors.text,
    flexShrink: 1,
  },
  statusPillHeader: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    flexShrink: 0,
  },
  statusTextHeader: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: colors.text,
  },
  postModalScroll: {
    flexGrow: 0,
  },
  postModalScrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  overflowMenuWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  overflowTrigger: {
    padding: spacing.xs,
  },
  metaBlock: {
    marginBottom: 0,
  },
  reporterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reporterTextWrap: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  nameDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    minWidth: 0,
  },
  reporterName: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  reporterLocation: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
  publishedDate: {
    flexShrink: 0,
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  statusPillSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusTextSmall: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: colors.text,
  },
  statusUnverified: {
    backgroundColor: '#FEE2E2',
  },
  statusVerified: {
    backgroundColor: '#DCFCE7',
  },
  statusEscalated: {
    backgroundColor: '#FFEDD5',
  },
  statusResolved: {
    backgroundColor: '#E5E7EB',
  },
  collageGrid: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: radius.lg,
  },
  collageRow: {
    flexDirection: 'row',
    gap: COLLAGE_GAP,
  },
  collageColumn: {
    gap: COLLAGE_GAP,
  },
  collageCell: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.background,
    position: 'relative',
  },
  collageImage: {
    width: '100%',
    height: '100%',
  },
  collageVideoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(17, 24, 39, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: colors.white,
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xs,
  },
  engagementRowThreeActions: {
    gap: spacing.md,
  },
  engagementRowCompact: {
    gap: spacing.md,
    paddingVertical: 0,
    flexShrink: 0,
  },
  engagementButton: {
    padding: spacing.xs,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  engagementCount: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  engagementCountActive: {
    color: colors.primary,
  },
  verticalMediaList: {
    gap: spacing.sm,
  },
  verticalMediaThumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.background,
    position: 'relative',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  previewBackdropTap: {
    ...StyleSheet.absoluteFill,
  },
  previewContent: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#111827',
    maxHeight: '80%',
    zIndex: 1,
  },
  previewImage: {
    width: '100%',
    height: 360,
  },
  previewVideo: {
    width: '100%',
    height: 360,
  },
  previewClose: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
