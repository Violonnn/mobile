import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navMetrics } from '../../styles/components/bottomNav.styles';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
import {
  formatReportLocation,
  formatReporterName,
  type MapReportMarker,
} from '../../lib/reports';
import { formatPublishedAt } from '../../lib/formatTime';
import {
  CollageCellContent,
  EngagementActions,
  ReportDetailContent,
  reportDetailStyles,
  statusLabel,
  statusStyle,
} from '../report/ReportDetailCard';
import { ReporterAvatar } from '../report/ReporterAvatar';
import CommentsSection from '../report/CommentsSection';
import { useReportEngagement } from '../report/ReportEngagementProvider';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useReportDetail } from '../../hooks/useReportDetail';

type Props = {
  reports: MapReportMarker[];
  visible: boolean;
  onClose: () => void;
  /** Override when the screen uses a non-resident bottom navigation bar. */
  bottomNavClearance?: number;
};

const BOTTOM_NAV_CLEARANCE = navMetrics.barHeight + navMetrics.reportLift + spacing.sm;
const LIST_INITIAL_COUNT = 3;
const LIST_PAGE_SIZE = 5;
/** Approx. height of one shrunk card — viewport shows up to 5 at once. */
const LIST_CARD_ESTIMATE = 148;
const LIST_SCROLL_MAX_HEIGHT = LIST_CARD_ESTIMATE * 5;

function ShrunkReportCard({
  report,
  onPress,
  onCommentPress,
}: {
  report: MapReportMarker;
  onPress: () => void;
  onCommentPress: () => void;
}) {
  const firstMedia = report.media[0] ?? null;
  const extraCount = Math.max(0, report.media.length - 1);

  return (
    <TouchableOpacity style={styles.listCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.listTopRow}>
        <View style={styles.listLocationInline}>
          <Ionicons name="location-sharp" size={14} color={colors.themeSoft} />
          <Text style={styles.listLocation} numberOfLines={1}>
            {formatReportLocation(report)}
          </Text>
        </View>
        <View style={[reportDetailStyles.statusPillSmall, statusStyle(report.status)]}>
          <Text style={reportDetailStyles.statusTextSmall}>{statusLabel(report.status)}</Text>
        </View>
      </View>

      <View style={styles.listBodyRow}>
        <View style={styles.listLeftCol}>
          <View style={styles.listIdentityRow}>
            <ReporterAvatar reporter={report.reporter} size={36} />
            <View style={styles.listIdentityText}>
              <View style={styles.listNameTitleRow}>
                <Text style={styles.listReporter} numberOfLines={1}>
                  {formatReporterName(report.reporter)}
                </Text>
                <Text style={styles.listTitle} numberOfLines={1}>
                  {report.title || 'Untitled report'}
                </Text>
              </View>
              <Text style={styles.listDate}>{formatPublishedAt(report.created_at)}</Text>
              <Text style={styles.listDescription} numberOfLines={2} ellipsizeMode="tail">
                {report.description || 'No description provided.'}
              </Text>
            </View>
          </View>
          <EngagementActions
            report={report}
            compact
            hideShare
            onCommentPress={onCommentPress}
          />
        </View>

        {firstMedia ? (
          <View style={styles.listMediaPreview}>
            <View style={styles.listMediaThumb}>
              <CollageCellContent item={firstMedia} />
              {firstMedia.type === 'video' ? (
                <View style={reportDetailStyles.videoBadge}>
                  <Ionicons name="play" size={11} color={colors.white} />
                </View>
              ) : null}
            </View>
            {extraCount > 0 ? (
              <Text style={styles.listMediaExtra}>+{extraCount}</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.listMediaPreview} />
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ReportMapDetailSheet({
  reports,
  visible,
  onClose,
  bottomNavClearance = BOTTOM_NAV_CLEARANCE,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showingAllMedia, setShowingAllMedia] = useState(false);
  const [listVisibleCount, setListVisibleCount] = useState(LIST_INITIAL_COUNT);
  const [previousVisible, setPreviousVisible] = useState(visible);
  const [previousReports, setPreviousReports] = useState(reports);
  // Comment-button flow: scroll the opened detail down to the comments section
  // and focus the composer.
  const [focusComments, setFocusComments] = useState(false);
  const { notifyCommentAdded } = useReportEngagement();

  const detailScrollRef = useRef<ScrollView>(null);
  // While true, content-size changes (media/comments loading in) keep the view
  // pinned to the bottom; cleared when the user drags so live updates never
  // yank them back down.
  const pendingScrollToComments = useRef(false);

  // Manual keyboard handling (same approach as the feed post modal):
  // KeyboardAvoidingView is unreliable inside a statusBarTranslucent Modal
  // (Android never resizes, iOS lags), so the sheet lifts itself above the
  // keyboard and shrinks to the remaining space.
  const { height: windowHeight } = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight(visible);
  const keyboardOpen = keyboardHeight > 0;
  const sheetLift = keyboardOpen
    ? { marginBottom: keyboardHeight + spacing.sm, maxHeight: windowHeight - keyboardHeight - insets.top - spacing.xl }
    : null;

  // Once the keyboard is up the viewport shrinks — re-pin the composer so it
  // is never left hidden behind the keyboard.
  useEffect(() => {
    if (!visible || !keyboardOpen) return;
    const timer = setTimeout(
      () => detailScrollRef.current?.scrollToEnd({ animated: true }),
      Platform.OS === 'ios' ? 250 : 80,
    );
    return () => clearTimeout(timer);
  }, [visible, keyboardOpen]);

  const sorted = useMemo(
    () =>
      [...reports].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [reports],
  );

  const selected =
    sorted.find((report) => report.id === selectedId) ??
    (sorted.length === 1 ? sorted[0] : null);
  const {
    report: detailReport,
    refreshing: detailRefreshing,
    refreshError,
    refreshVersion,
    refresh: refreshDetail,
  } = useReportDetail(selected);

  const showList = sorted.length > 1 && !detailReport;
  const sheetBottom = insets.bottom + bottomNavClearance;
  const canGoBackToList = Boolean(detailReport && sorted.length > 1);
  const showBackButton = showingAllMedia || canGoBackToList;
  // 4+ attachments skip the 2x2 "+N" collage and list everything directly —
  // the tap-to-expand step is redundant inside the map detail sheet. This is
  // separate from showingAllMedia so the back button still only appears for a
  // manual expansion (3 or fewer attachments never reach this state anyway).
  const autoShowAllMedia = (detailReport?.media.length ?? 0) >= 4;
  const visibleListReports = sorted.slice(0, listVisibleCount);
  const hasMoreListReports = listVisibleCount < sorted.length;

  if (visible !== previousVisible) {
    setPreviousVisible(visible);
    if (!visible) {
      setSelectedId(null);
      setShowingAllMedia(false);
      setListVisibleCount(LIST_INITIAL_COUNT);
      setFocusComments(false);
    }
  }

  if (reports !== previousReports) {
    setPreviousReports(reports);
    setListVisibleCount(LIST_INITIAL_COUNT);
  }

  useEffect(() => {
    if (!visible) pendingScrollToComments.current = false;
  }, [visible]);

  const handleClose = () => {
    setSelectedId(null);
    setShowingAllMedia(false);
    setListVisibleCount(LIST_INITIAL_COUNT);
    setFocusComments(false);
    pendingScrollToComments.current = false;
    onClose();
  };

  const handleBack = () => {
    if (showingAllMedia) {
      setShowingAllMedia(false);
      return;
    }
    setSelectedId(null);
    setFocusComments(false);
    pendingScrollToComments.current = false;
  };

  /** Open a report's details (from the cluster list) and jump to comments. */
  const openReportComments = (reportId: string) => {
    pendingScrollToComments.current = true;
    setFocusComments(true);
    setShowingAllMedia(false);
    setSelectedId(reportId);
  };

  /** Already viewing details — just scroll down and focus the composer. */
  const jumpToComments = () => {
    pendingScrollToComments.current = true;
    setFocusComments(true);
    detailScrollRef.current?.scrollToEnd({ animated: true });
  };

  const handleSeeMore = () => {
    setListVisibleCount((current) =>
      Math.min(current + LIST_PAGE_SIZE, sorted.length),
    );
  };

  if (!visible || sorted.length === 0) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Close report details" />

        <View style={[styles.sheet, { marginBottom: sheetBottom }, sheetLift]}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            {showBackButton ? (
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleBack}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showingAllMedia ? 'Back to report details' : 'Back to report list'}
              >
                <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerButton} />
            )}

            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {showList
                  ? `${sorted.length} reports here`
                  : 'Report details'}
              </Text>
              {!showList && detailReport ? (
                <View style={[styles.statusPillHeader, statusStyle(detailReport.status)]}>
                  <Text style={styles.statusTextHeader}>
                    {statusLabel(detailReport.status)}
                  </Text>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {showList ? (
            <View style={styles.listSection}>
              <ScrollView
                style={[styles.listScroll, { maxHeight: LIST_SCROLL_MAX_HEIGHT }]}
                contentContainerStyle={styles.listScrollContent}
                showsVerticalScrollIndicator
                nestedScrollEnabled
                bounces={false}
              >
                {visibleListReports.map((report) => (
                  <ShrunkReportCard
                    key={report.id}
                    report={report}
                    onPress={() => {
                      setShowingAllMedia(false);
                      setSelectedId(report.id);
                    }}
                    onCommentPress={() => openReportComments(report.id)}
                  />
                ))}
              </ScrollView>

              {hasMoreListReports ? (
                <TouchableOpacity
                  style={styles.listFooterAction}
                  onPress={handleSeeMore}
                  accessibilityRole="button"
                  accessibilityLabel="See more reports"
                >
                  <Text style={styles.listFooterActionText}>See More</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.listFooterNote}>
                  That&apos;s all for the report within this area
                </Text>
              )}
            </View>
          ) : (
            <ScrollView
              ref={detailScrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
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
                  enabled={Boolean(detailReport && !detailReport.isPending && !keyboardOpen)}
                />
              }
              onContentSizeChange={() => {
                if (pendingScrollToComments.current) {
                  detailScrollRef.current?.scrollToEnd({ animated: true });
                }
              }}
              onScrollBeginDrag={() => {
                pendingScrollToComments.current = false;
              }}
            >
              {detailReport ? (
                <>
                  <ReportDetailContent
                    report={detailReport}
                    showingAllMedia={showingAllMedia || autoShowAllMedia}
                    onShowingAllMediaChange={setShowingAllMedia}
                    onRequestComments={jumpToComments}
                  />

                  {refreshError ? (
                    <Text style={styles.refreshError}>{refreshError}</Text>
                  ) : null}

                  {/* Inline thread — mounted (and live) only while details are open. */}
                  {!detailReport.isPending ? (
                    <CommentsSection
                      key={detailReport.id}
                      reportId={detailReport.id}
                      autoFocus={focusComments}
                      highlighted={focusComments}
                      refreshSignal={refreshVersion}
                      onCommentAdded={notifyCommentAdded}
                      onComposerFocus={() =>
                        detailScrollRef.current?.scrollToEnd({ animated: true })
                      }
                    />
                  ) : null}
                </>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(17, 24, 39, 0.48)',
  },
  sheet: {
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
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  headerTitle: {
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
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  listCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  listSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  listScroll: {
    flexGrow: 0,
  },
  listScrollContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  listFooterAction: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  listFooterActionText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.themeSoft,
  },
  listFooterNote: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  refreshError: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: 'center',
  },
  listTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  listBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listLeftCol: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
    paddingRight: spacing.xs,
  },
  listIdentityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    minWidth: 0,
  },
  listIdentityText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  listNameTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  listTitle: {
    flexShrink: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  listReporter: {
    flexShrink: 0,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  listLocationInline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  listLocation: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  listDate: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  listDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text,
    lineHeight: 18,
  },
  // Fixed slot on the right — centered, not flush to the edge.
  listMediaPreview: {
    width: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexShrink: 0,
    marginRight: spacing.sm,
  },
  listMediaThumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.border,
    position: 'relative',
  },
  listMediaExtra: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
});
