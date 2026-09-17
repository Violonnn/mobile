import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { usePrioritizedReportComments } from '../../hooks/usePrioritizedReportComments';
import { formatPublishedAt } from '../../lib/formatTime';
import { formatReporterName } from '../../lib/reports';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
import { ReporterAvatar } from '../report/ReporterAvatar';

type Props = {
  reportId: string;
  refreshSignal?: number;
  onOpenCommunityReport: () => void;
};

/** Compact, read-only discussion summary for a report opened from the map. */
export default function MapRelevantComments({
  reportId,
  refreshSignal = 0,
  onOpenCommunityReport,
}: Props) {
  const { comments, loading, error, reload } = usePrioritizedReportComments(
    reportId,
    refreshSignal,
  );

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Relevant comments</Text>
          <Text style={styles.subtitle}>Official responses first, then the latest discussion</Text>
        </View>
        <View style={styles.readOnlyPill}>
          <Ionicons name="eye-outline" size={13} color={colors.navigationActive} />
          <Text style={styles.readOnlyText}>Read only</Text>
        </View>
      </View>

      {loading && comments.length === 0 ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator color={colors.navigationActive} />
        </View>
      ) : error ? (
        <View style={styles.stateBlock}>
          <Ionicons name="cloud-offline-outline" size={20} color={colors.textMuted} />
          <Text style={styles.stateText}>Could not load comment highlights.</Text>
          <TouchableOpacity onPress={() => void reload()} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.stateBlock}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
          <Text style={styles.stateText}>No comments have been posted yet.</Text>
        </View>
      ) : (
        <View style={styles.commentList}>
          {comments.map((comment) => {
            const isOfficial = comment.authorRole !== 'resident';
            return (
              <View key={comment.id} style={styles.commentRow}>
                <ReporterAvatar reporter={comment.author} size={34} />
                <View style={styles.commentBody}>
                  <View style={styles.commentMeta}>
                    <Text style={styles.commentAuthor} numberOfLines={1}>
                      {formatReporterName(comment.author)}
                    </Text>
                    {isOfficial ? (
                      <View style={styles.officialPill}>
                        <Ionicons name="shield-checkmark" size={11} color={colors.white} />
                        <Text style={styles.officialText}>Official</Text>
                      </View>
                    ) : null}
                    <Text style={styles.commentTime}>{formatPublishedAt(comment.createdAt)}</Text>
                  </View>
                  <Text style={styles.commentText}>{comment.body}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity
        style={styles.communityButton}
        onPress={onOpenCommunityReport}
        activeOpacity={0.84}
        accessibilityRole="button"
        accessibilityLabel="Open this report in the Community screen"
      >
        <Ionicons name="chatbubbles-outline" size={18} color={colors.white} />
        <Text style={styles.communityButtonText}>View full discussion in Community</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    lineHeight: 16,
    color: colors.textMuted,
  },
  readOnlyPill: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
  },
  readOnlyText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.navigationActive,
  },
  stateBlock: {
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  stateText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  retryText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.navigationActive,
  },
  commentList: {
    gap: spacing.sm,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  commentBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  commentAuthor: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  commentTime: {
    marginLeft: 'auto',
    flexShrink: 0,
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textMuted,
  },
  commentText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    lineHeight: 20,
    color: colors.text,
  },
  officialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.navigationActive,
  },
  officialText: {
    fontFamily: fonts.semibold,
    fontSize: 9,
    color: colors.white,
  },
  communityButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.navigationActive,
  },
  communityButtonText: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.white,
    textAlign: 'center',
  },
});
