import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useIncidentSupport } from '../../hooks/useIncidentSupport';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useShareSheetGuard } from '../../hooks/useShareSheetGuard';
import { formatOperationTimestamp } from '../../lib/formatTime';
import {
  fetchPublicIncident,
  mapPublicReportToIncident,
  publicIncidentLifecycle,
  publicIncidentLocationLabel,
  type IncidentEngagement,
  type PublicIncident,
  type PublicIncidentUpdate,
} from '../../lib/publicIncidents';
import { fetchPublicResidentReport, subscribeToReportPublicationChanges } from '../../lib/reportPublication';
import { RESIDENT_STAGE_TONES } from '../../lib/reportLifecycle';
import type { ReportMediaAttachment } from '../../lib/reports';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
import MapRelevantComments from '../map/MapRelevantComments';
import ResidentBottomSheet from '../ui/ResidentBottomSheet';
import { ReportDetailSheetSkeleton } from '../ui/ResidentScreenSkeletons';
import CommentsSection from './CommentsSection';
import {
  PublicIncidentCopy,
  PublicIncidentHeader,
  PublicIncidentTags,
  publicIncidentCaption,
  publicIncidentHasMapLocation,
  publicIncidentMedia,
  publicIncidentTitle,
} from './PublicIncidentPost';
import {
  EngagementActionsRow,
  ReportMediaPreviewModal,
  VerticalAttachmentList,
  reportDetailStyles,
} from './ReportDetailCard';
import ReportStatusTimeline from './ReportStatusTimeline';

/**
 * Where the sheet was opened. Community owns the discussion; Home and Map show
 * a read-only summary and hand residents over to Community to comment.
 */
export type PublicIncidentDetailContext = 'community' | 'map' | 'home';

type Props = {
  incidentCaseId: string;
  reportId?: string;
  onClose: () => void;
  context?: PublicIncidentDetailContext;
  /** Opens with the comment composer in view (Community only). */
  focusComments?: boolean;
  onViewOnMap?: (incidentCaseId: string, reportId?: string) => void;
  onOpenCommunity?: (incidentCaseId: string) => void;
  onEngagementChange?: (incidentCaseId: string, engagement: IncidentEngagement) => void;
};

const UPDATE_LABELS: Record<string, string> = {
  progress_update: 'Progress update',
  resolved: 'Resolved',
  summary_added: 'Outcome summary',
  withdrawn: 'Correction',
};
const MAP_HOME_ACTIVITY_LIMIT = 3;

function updateTone(entryType: string) {
  if (entryType === 'withdrawn') return RESIDENT_STAGE_TONES.correction;
  if (entryType === 'resolved' || entryType === 'summary_added') return RESIDENT_STAGE_TONES.resolved;
  return RESIDENT_STAGE_TONES.responding;
}

export default function PublicIncidentDetail({
  incidentCaseId,
  reportId,
  onClose,
  context = 'community',
  focusComments = false,
  onViewOnMap,
  onOpenCommunity,
  onEngagementChange,
}: Props): React.JSX.Element {
  const { shareSafely } = useShareSheetGuard();
  const [incident, setIncident] = useState<PublicIncident | null>(null);
  const [updates, setUpdates] = useState<PublicIncidentUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [commentsHighlighted, setCommentsHighlighted] = useState(focusComments);
  const [previewIdentity, setPreviewIdentity] = useState<string | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const loadGeneration = useRef(0);
  const isMounted = useRef(false);
  const previewIdentityRef = useRef<string | null>(null);
  // Mirrors the report sheet: keep scrolling to the composer until the resident drags.
  const pendingScrollToComments = useRef(focusComments);
  const keyboardHeight = useKeyboardHeight(true);
  const keyboardOpen = keyboardHeight > 0;
  const preview = incident && previewIdentity
    ? publicIncidentMedia(incident).find((photo) => photo.id === previewIdentity) ?? null
    : null;

  const closePreview = useCallback(() => {
    previewIdentityRef.current = null;
    setPreviewIdentity(null);
  }, []);

  const openPreview = useCallback((photo: ReportMediaAttachment) => {
    previewIdentityRef.current = photo.id;
    setPreviewIdentity(photo.id);
  }, []);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    const isCurrent = () => isMounted.current && generation === loadGeneration.current;
    if (reportId) {
      const result = await fetchPublicResidentReport(reportId);
      if (!isCurrent()) return;
      const nextIncident = result.report ? mapPublicReportToIncident(result.report) : null;
      const remainsApproved = nextIncident && previewIdentityRef.current
        ? publicIncidentMedia(nextIncident).some((photo) => photo.id === previewIdentityRef.current)
        : false;
      if (!remainsApproved) closePreview();
      setIncident(nextIncident);
      setUpdates(result.updates);
      setError(result.error);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const result = await fetchPublicIncident(incidentCaseId);
    if (!isCurrent()) return;
    const remainsApproved = result.incident && previewIdentityRef.current
      ? publicIncidentMedia(result.incident).some((photo) => photo.id === previewIdentityRef.current)
      : false;
    if (!remainsApproved) closePreview();
    setIncident(result.incident);
    setUpdates(result.updates);
    setError(result.error);
    setLoading(false);
    setRefreshing(false);
  }, [closePreview, incidentCaseId, reportId]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      loadGeneration.current += 1;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) await load();
    };
    void run();
    // Recheck the limited projection so corrections and revoked photos replace
    // stale content while a resident keeps the sheet open.
    const timer = setInterval(() => void run(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => subscribeToReportPublicationChanges(() => {
    // Clear the open detail immediately so revoked public data cannot linger on screen.
    closePreview();
    setIncident(null);
    setUpdates([]);
    setLoading(true);
    void load();
  }), [closePreview, load]);

  useEffect(() => {
    if (!keyboardOpen) return;
    const timer = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      Platform.OS === 'ios' ? 250 : 80,
    );
    return () => clearTimeout(timer);
  }, [keyboardOpen]);

  const handleEngagementChange = useCallback((id: string, engagement: IncidentEngagement) => {
    setIncident((current) => (current && current.incidentCaseId === id ? { ...current, engagement } : current));
    onEngagementChange?.(id, engagement);
  }, [onEngagementChange]);
  const { toggleSupport, busyId } = useIncidentSupport(handleEngagementChange);

  const refresh = () => {
    setRefreshing(true);
    setRefreshVersion((value) => value + 1);
    void load();
  };

  const openDiscussion = () => {
    if (context !== 'community') {
      onOpenCommunity?.(incidentCaseId);
      return;
    }
    pendingScrollToComments.current = true;
    setCommentsHighlighted(true);
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  const isWithdrawn = incident?.publicStatus === 'withdrawn';
  const lifecycle = incident ? publicIncidentLifecycle(incident.publicStatus) : null;
  const photos = incident ? publicIncidentMedia(incident) : [];
  const newestFirstUpdates = [...updates].reverse();
  const visibleUpdates = context === 'community'
    ? newestFirstUpdates
    : newestFirstUpdates.slice(0, MAP_HOME_ACTIVITY_LIMIT);
  const hiddenUpdateCount = newestFirstUpdates.length - visibleUpdates.length;

  return (
    <ResidentBottomSheet
      visible
      onClose={onClose}
      initialHeightRatio={0.72}
      minimumHeight={360}
      bottomOffset={keyboardOpen ? keyboardHeight + spacing.sm : 0}
      sheetStyle={reportDetailStyles.postModalSheet}
      handleAccessibilityLabel="Resize report details"
      showCloseButton={false}
      animationType="slide"
    >
      <ScrollView
        ref={scrollRef}
        style={reportDetailStyles.postModalScroll}
        contentContainerStyle={reportDetailStyles.postModalScrollContent}
        showsVerticalScrollIndicator={false}
        bounces
        alwaysBounceVertical
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.themeSoft}
            colors={[colors.themeSoft]}
            enabled={!keyboardOpen}
          />
        }
        onContentSizeChange={() => {
          if (pendingScrollToComments.current) scrollRef.current?.scrollToEnd({ animated: true });
        }}
        onScrollBeginDrag={() => {
          pendingScrollToComments.current = false;
        }}
      >
        {loading ? <ReportDetailSheetSkeleton /> : null}

        {!loading && !incident ? (
          <View style={styles.stateBlock}>
            <Ionicons name="eye-off-outline" size={28} color={colors.textMuted} />
            <Text style={styles.stateTitle}>Report unavailable</Text>
            <Text accessibilityRole="alert" style={styles.stateText}>
              {error ?? 'This report is no longer publicly available.'}
            </Text>
            <TouchableOpacity style={styles.retryButton} accessibilityRole="button" onPress={refresh}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && incident ? (
          <>
            <View style={reportDetailStyles.detailBody}>
              <PublicIncidentHeader incident={incident} />

              {photos.length > 0 ? (
                <VerticalAttachmentList media={photos} onOpenPreview={openPreview} />
              ) : null}
              {incident.photoError ? <Text style={styles.meta}>{incident.photoError}</Text> : null}

              {context === 'community' ? (
                <EngagementActionsRow
                  upvoteCount={incident.engagement.upvoteCount}
                  commentCount={incident.engagement.commentCount}
                  hasUpvoted={incident.engagement.hasUpvoted}
                  disabled={isWithdrawn || busyId === incident.incidentCaseId}
                  onToggleUpvote={() => void toggleSupport(incident.incidentCaseId)}
                  onCommentPress={openDiscussion}
                  onShare={() => {
                    const title = publicIncidentTitle(incident);
                    void shareSafely({
                      title,
                      message: `${title}\n${publicIncidentCaption(incident)}\n${publicIncidentLocationLabel(incident)}`,
                    });
                  }}
                />
              ) : null}

              <View style={reportDetailStyles.detailCard}>
                <PublicIncidentTags incident={incident} />
                <PublicIncidentCopy incident={incident} />
              </View>

              <View style={styles.factRow}>
                <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                <Text style={styles.factText}>{publicIncidentLocationLabel(incident)}</Text>
              </View>
              {incident.linkedReportCount > 1 ? (
                <View style={styles.factRow}>
                  <Ionicons name="people-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.factText}>{incident.linkedReportCount} residents reported this incident</Text>
                </View>
              ) : null}
            </View>

            {lifecycle ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Progress</Text>
                <ReportStatusTimeline lifecycle={lifecycle} audience="public" useStatusProgressColors />
              </View>
            ) : null}

            {incident.publicCorrection ? (
              <View style={[styles.noticeCard, { backgroundColor: RESIDENT_STAGE_TONES.correction.softColor }]}>
                <Text style={[styles.noticeLabel, { color: RESIDENT_STAGE_TONES.correction.color }]}>Correction</Text>
                <Text style={styles.noticeText}>{incident.publicCorrection}</Text>
              </View>
            ) : null}
            {incident.publicSummary ? (
              <View style={[styles.noticeCard, { backgroundColor: RESIDENT_STAGE_TONES.resolved.softColor }]}>
                <Text style={[styles.noticeLabel, { color: RESIDENT_STAGE_TONES.resolved.color }]}>Outcome</Text>
                <Text style={styles.noticeText}>{incident.publicSummary}</Text>
              </View>
            ) : incident.publicStatus === 'resolved' ? (
              <Text style={styles.meta}>The office has not posted an outcome summary yet.</Text>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {context === 'community' ? 'Official updates' : 'Latest updates'}
              </Text>
              {visibleUpdates.length === 0 ? (
                <Text style={styles.meta}>No public updates have been posted yet.</Text>
              ) : (
                visibleUpdates.map((update, index) => {
                  const tone = updateTone(update.entryType);
                  const isLast = index === visibleUpdates.length - 1;
                  return (
                    <View key={`${update.occurredAt}-${index}`} style={styles.updateRow}>
                      <View style={styles.updateRail}>
                        <View style={[styles.updateDot, { backgroundColor: tone.color }]} />
                        {!isLast ? <View style={styles.updateLine} /> : null}
                      </View>
                      <View style={[styles.updateCard, { backgroundColor: tone.softColor }]}>
                        <Text style={[styles.updateLabel, { color: tone.color }]}>
                          {UPDATE_LABELS[update.entryType] ?? 'Official update'} · {formatOperationTimestamp(update.occurredAt)}
                        </Text>
                        <Text style={styles.noticeText}>{update.publicText}</Text>
                      </View>
                    </View>
                  );
                })
              )}
              {hiddenUpdateCount > 0 ? (
                <Text style={styles.meta}>
                  {hiddenUpdateCount} earlier update{hiddenUpdateCount === 1 ? '' : 's'} in Community.
                </Text>
              ) : null}
            </View>

            {context !== 'community' && context !== 'map' && onViewOnMap && publicIncidentHasMapLocation(incident) ? (
              <TouchableOpacity
                style={reportDetailStyles.mapActionButton}
                onPress={() => onViewOnMap(incident.incidentCaseId, incident.reportId)}
                activeOpacity={0.84}
                accessibilityRole="button"
                accessibilityLabel="Show this report on the map"
              >
                <Ionicons name="map-outline" size={18} color={colors.white} />
                <Text style={reportDetailStyles.mapActionButtonText}>View on map</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.white} />
              </TouchableOpacity>
            ) : null}

            {isWithdrawn ? (
              <Text style={styles.meta}>Discussion is closed because this confirmation was withdrawn.</Text>
            ) : context === 'community' ? (
              <CommentsSection
                incidentCaseId={incident.incidentCaseId}
                autoFocus={focusComments}
                highlighted={commentsHighlighted}
                refreshSignal={refreshVersion}
                showInitialLoader={false}
                onCommentAdded={() => handleEngagementChange(incident.incidentCaseId, {
                  ...incident.engagement,
                  commentCount: incident.engagement.commentCount + 1,
                })}
                onComposerFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
              />
            ) : (
              <MapRelevantComments
                incidentCaseId={incident.incidentCaseId}
                refreshSignal={refreshVersion}
                onOpenCommunityReport={() => onOpenCommunity?.(incident.incidentCaseId)}
              />
            )}
          </>
        ) : null}
      </ScrollView>
      <ReportMediaPreviewModal preview={preview} onClose={closePreview} />
    </ResidentBottomSheet>
  );
}

const styles = StyleSheet.create({
  stateBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  stateTitle: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  stateText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
  },
  retryText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.navigationActive,
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  factText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    lineHeight: 19,
    color: colors.textMuted,
  },
  section: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  noticeCard: {
    gap: 4,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  noticeLabel: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.3,
  },
  noticeText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    lineHeight: 21,
    color: colors.text,
  },
  updateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  updateRail: {
    width: 12,
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  updateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  updateLine: {
    flex: 1,
    width: 2,
    marginTop: 4,
    marginBottom: -spacing.sm,
    backgroundColor: colors.border,
  },
  updateCard: {
    flex: 1,
    gap: 4,
    padding: spacing.sm + 4,
    borderRadius: radius.md,
  },
  updateLabel: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
  },
});
