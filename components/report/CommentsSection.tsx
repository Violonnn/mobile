// components/report/CommentsSection.tsx
// Inline comment thread + composer shown at the bottom of an opened report's
// details (the feed post modal and the map detail sheet). Comments are fetched
// on demand and stay live (via useComments) only while this section is
// mounted, so the feed and map lists never carry a comments subscription.
// Threads are one level deep: top-level comments with their replies grouped
// underneath.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
import { formatReporterName } from '../../lib/reports';
import { formatPublishedAt } from '../../lib/formatTime';
import { type ReportComment } from '../../lib/comments';
import { useComments } from '../../hooks/useComments';
import { ReporterAvatar } from './ReporterAvatar';

type Props = {
  reportId: string;
  /** Pop the keyboard once the section is ready (comment-button flow). */
  autoFocus?: boolean;
  /** Briefly tint the section to draw the eye when opened via the comment button. */
  highlighted?: boolean;
  /** Called after a comment posts so the parent can bump the report's count. */
  onCommentAdded?: (reportId: string) => void;
  /** Called when the composer gains focus so the parent can scroll it into view. */
  onComposerFocus?: () => void;
  /** Incremented when the opened report is pull-refreshed. */
  refreshSignal?: number;
};

function CommentRow({
  comment,
  onReply,
  isReply = false,
}: {
  comment: ReportComment;
  onReply?: () => void;
  isReply?: boolean;
}) {
  return (
    <View style={[styles.commentRow, isReply && styles.commentReplyRow]}>
      <ReporterAvatar reporter={comment.author} size={isReply ? 28 : 34} />
      <View style={styles.commentBodyWrap}>
        <View style={styles.commentBubble}>
          <View style={styles.commentHeaderRow}>
            <Text style={styles.commentAuthor} numberOfLines={1}>
              {formatReporterName(comment.author)}
            </Text>
            <Text style={styles.commentTime}>
              {formatPublishedAt(comment.createdAt)}
            </Text>
          </View>
          <Text style={styles.commentText}>{comment.body}</Text>
        </View>
        {onReply ? (
          <TouchableOpacity
            style={styles.replyButton}
            onPress={onReply}
            accessibilityRole="button"
            accessibilityLabel="Reply to comment"
          >
            <Text style={styles.replyButtonText}>Reply</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export default function CommentsSection({
  reportId,
  autoFocus = false,
  highlighted = false,
  onCommentAdded,
  onComposerFocus,
  refreshSignal = 0,
}: Props) {
  const {
    comments,
    totalComments,
    replyPages,
    loading,
    loadingMore,
    error,
    submitting,
    addComment,
    loadMoreComments,
    showReplies,
    hideReplies,
    loadMoreReplies,
    reload,
  } = useComments(reportId);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ReportComment | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [highlightActive, setHighlightActive] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const previousRefreshSignal = useRef(refreshSignal);

  // Comment-button flow: focus the composer after the parent modal's open /
  // scroll-to-bottom animation has settled, so the keyboard doesn't fight it.
  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 450);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  // Show the highlight tint briefly, then let the section settle to normal.
  useEffect(() => {
    if (!highlighted) return;
    setHighlightActive(true);
    const timer = setTimeout(() => setHighlightActive(false), 2200);
    return () => clearTimeout(timer);
  }, [highlighted]);

  // A detail pull-to-refresh refreshes this report's currently visible comment
  // and reply pages too, without touching any other feed/map report.
  useEffect(() => {
    if (refreshSignal === previousRefreshSignal.current) return;
    previousRefreshSignal.current = refreshSignal;
    void reload();
  }, [refreshSignal, reload]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || submitting) return;

    const { error: submitError } = await addComment(body, replyTo?.id ?? null);
    if (submitError) {
      setSendError(submitError);
      return;
    }

    setDraft('');
    setReplyTo(null);
    setSendError(null);
    onCommentAdded?.(reportId);
  };

  return (
    <View style={[styles.section, highlightActive && styles.sectionHighlighted]}>
      <Text style={styles.sectionTitle}>Comments</Text>

      {loading && comments.length === 0 ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator color={colors.themeSoft} />
        </View>
      ) : error ? (
        <View style={styles.stateBlock}>
          <Ionicons name="cloud-offline-outline" size={20} color={colors.textMuted} />
          <Text style={styles.stateText}>Could not load comments</Text>
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.stateBlock}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
          <Text style={styles.stateText}>No comments yet. Start the conversation.</Text>
        </View>
      ) : (
        <View style={styles.threadList}>
          {comments.map((comment) => {
            const replyPage = replyPages.get(comment.id);
            const replyCount = replyPage?.total ?? comment.replyCount;
            const remainingReplies = Math.max(
              0,
              replyCount - (replyPage?.replies.length ?? 0),
            );

            return (
            <View key={comment.id} style={styles.threadBlock}>
              <CommentRow
                comment={comment}
                onReply={() => {
                  setReplyTo(comment);
                  inputRef.current?.focus();
                }}
              />

              {!replyPage && replyCount > 0 ? (
                <TouchableOpacity
                  style={styles.threadAction}
                  onPress={() => showReplies(comment.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${replyCount} ${
                    replyCount === 1 ? 'reply' : 'replies'
                  }`}
                >
                  <Ionicons name="return-down-forward" size={14} color={colors.themeSoft} />
                  <Text style={styles.threadActionText}>
                    Show {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {replyPage?.loading && replyPage.replies.length === 0 ? (
                <ActivityIndicator
                  style={styles.replyLoader}
                  size="small"
                  color={colors.themeSoft}
                />
              ) : null}

              {replyPage?.replies.map((reply) => (
                <CommentRow key={reply.id} comment={reply} isReply />
              ))}

              {replyPage?.error ? (
                <Text style={styles.replyError}>Could not load replies</Text>
              ) : null}

              {replyPage && !replyPage.loading ? (
                <View style={styles.replyActionsRow}>
                  {remainingReplies > 0 ? (
                    <TouchableOpacity
                      style={styles.threadAction}
                      onPress={() => loadMoreReplies(comment.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`See ${Math.min(5, remainingReplies)} more replies`}
                    >
                      <Text style={styles.threadActionText}>
                        See {Math.min(5, remainingReplies)} more{' '}
                        {Math.min(5, remainingReplies) === 1 ? 'reply' : 'replies'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={styles.threadAction}
                    onPress={() => hideReplies(comment.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Hide replies"
                  >
                    <Text style={styles.threadActionText}>Hide replies</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
            );
          })}

          {comments.length < totalComments ? (
            <TouchableOpacity
              style={styles.seeMoreCommentsButton}
              onPress={loadMoreComments}
              disabled={loadingMore}
              accessibilityRole="button"
              accessibilityLabel="See more comments"
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.themeSoft} />
              ) : (
                <Text style={styles.seeMoreCommentsText}>
                  See more comments
                </Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {replyTo ? (
        <View style={styles.replyingBar}>
          <Text style={styles.replyingText} numberOfLines={1}>
            Replying to {formatReporterName(replyTo.author)}
          </Text>
          <TouchableOpacity
            onPress={() => setReplyTo(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cancel reply"
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : null}

      {sendError ? <Text style={styles.sendErrorText}>{sendError}</Text> : null}

      <View style={styles.composerRow}>
        <TextInput
          ref={inputRef}
          style={styles.composerInput}
          value={draft}
          onChangeText={setDraft}
          onFocus={onComposerFocus}
          placeholder={replyTo ? 'Write a reply…' : 'Write a comment…'}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={1000}
          editable={!submitting}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!draft.trim() || submitting) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!draft.trim() || submitting}
          accessibilityRole="button"
          accessibilityLabel="Send comment"
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="send" size={18} color={colors.white} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.md,
    borderRadius: radius.lg,
  },
  // Comment-button flow: soft tint that draws the eye to the section.
  sectionHighlighted: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  stateBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  stateText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  threadList: {
    gap: spacing.md,
  },
  threadBlock: {
    gap: spacing.sm,
  },
  threadAction: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginLeft: spacing.xl + 34,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  threadActionText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: colors.themeSoft,
  },
  replyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  replyLoader: {
    alignSelf: 'flex-start',
    marginLeft: spacing.xl + 42,
  },
  replyError: {
    marginLeft: spacing.xl + 42,
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.danger,
  },
  seeMoreCommentsButton: {
    alignSelf: 'center',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  seeMoreCommentsText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.themeSoft,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  commentReplyRow: {
    marginLeft: spacing.xl,
  },
  commentBodyWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  commentBubble: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  commentAuthor: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  commentTime: {
    flexShrink: 0,
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  commentText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text,
    lineHeight: 20,
  },
  replyButton: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  replyButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: colors.themeSoft,
  },
  replyingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
  },
  replyingText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text,
  },
  sendErrorText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.danger,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  composerInput: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.themeSoft,
  },
});
