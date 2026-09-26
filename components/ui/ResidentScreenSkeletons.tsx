import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../../styles/theme';
import { SkeletonBlock, SkeletonGroup } from './Skeleton';

function TextRows() {
  return (
    <View style={styles.textRows}>
      <SkeletonBlock style={styles.lineWide} />
      <SkeletonBlock style={styles.lineMedium} />
    </View>
  );
}

export function HomeScreenSkeleton() {
  return (
    <SkeletonGroup style={styles.screen}>
      <View style={styles.headerRow}>
        <TextRows />
        <SkeletonBlock style={styles.avatar} />
      </View>
      <SkeletonBlock style={styles.mapCard} />
      <View style={styles.actionRow}>
        <SkeletonBlock style={styles.actionCard} />
        <SkeletonBlock style={styles.actionCard} />
        <SkeletonBlock style={styles.actionCard} />
      </View>
      <SkeletonBlock style={styles.sectionTitle} />
      <SkeletonBlock style={styles.contentCard} />
      <SkeletonBlock style={styles.sectionTitle} />
      <View style={styles.reminderRow}>
        <SkeletonBlock style={styles.reminderCard} />
        <SkeletonBlock style={styles.reminderCard} />
      </View>
    </SkeletonGroup>
  );
}

export function ProfileScreenSkeleton() {
  return (
    <SkeletonGroup style={styles.profileScreen}>
      <View style={styles.profileIdentity}>
        <SkeletonBlock style={styles.profileAvatar} />
        <TextRows />
      </View>
      {[0, 1, 2].map((section) => (
        <View key={section} style={styles.profileSection}>
          <SkeletonBlock style={styles.sectionLabel} />
          {[0, 1, 2].map((row) => (
            <View key={row} style={styles.settingsRow}>
              <TextRows />
              <SkeletonBlock style={styles.chevron} />
            </View>
          ))}
        </View>
      ))}
    </SkeletonGroup>
  );
}

export function FeedScreenSkeleton() {
  return (
    <SkeletonGroup style={styles.feedScreen}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.feedCard}>
          <View style={styles.feedAuthorRow}>
            <SkeletonBlock style={styles.smallAvatar} />
            <TextRows />
          </View>
          <SkeletonBlock style={styles.feedMedia} />
          <TextRows />
        </View>
      ))}
    </SkeletonGroup>
  );
}

export function ContributionSkeleton() {
  return (
    <SkeletonGroup style={styles.contributionSkeleton}>
      {[0, 1].map((item) => (
        <View key={item} style={styles.contributionCard}>
          <TextRows />
          <SkeletonBlock style={styles.contributionLine} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

export function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonGroup style={styles.listRows}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.listRow}>
          <SkeletonBlock style={styles.smallAvatar} />
          <TextRows />
        </View>
      ))}
    </SkeletonGroup>
  );
}

export function HomeUpdateSkeleton() {
  return (
    <SkeletonGroup style={styles.homeUpdateSkeleton}>
      <View style={styles.feedAuthorRow}>
        <SkeletonBlock style={styles.smallAvatar} />
        <TextRows />
      </View>
      <SkeletonBlock style={styles.homeUpdateMedia} />
    </SkeletonGroup>
  );
}

/**
 * Reserves the report-detail sheet layout while full media URLs are prepared.
 * Keeping these dimensions close to the final content prevents the sheet from
 * jumping as images and comments become available.
 */
export function ReportDetailSheetSkeleton() {
  return (
    <SkeletonGroup style={styles.reportDetailSheet}>
      <View style={styles.reportDetailAuthorRow}>
        <SkeletonBlock style={styles.smallAvatar} />
        <View style={styles.reportDetailAuthorCopy}>
          <SkeletonBlock style={styles.lineMedium} />
          <SkeletonBlock style={styles.reportDetailMetaLine} />
        </View>
      </View>
      <SkeletonBlock style={styles.reportDetailMedia} />
      <View style={styles.reportDetailActionRow}>
        <SkeletonBlock style={styles.reportDetailAction} />
        <SkeletonBlock style={styles.reportDetailAction} />
        <SkeletonBlock style={styles.reportDetailAction} />
      </View>
      <SkeletonBlock style={styles.reportDetailTitle} />
      <SkeletonBlock style={styles.reportDetailBodyLine} />
      <SkeletonBlock style={styles.reportDetailBodyLineShort} />
      <View style={styles.reportDetailComments}>
        <SkeletonBlock style={styles.sectionTitle} />
        {[0, 1].map((comment) => (
          <View key={comment} style={styles.reportDetailCommentRow}>
            <SkeletonBlock style={styles.reportDetailCommentAvatar} />
            <View style={styles.reportDetailCommentCopy}>
              <SkeletonBlock style={styles.reportDetailCommentName} />
              <SkeletonBlock style={styles.reportDetailCommentBody} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  profileScreen: {
    gap: spacing.xl,
    paddingTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textRows: { flex: 1, gap: spacing.sm },
  lineWide: { width: '72%', height: 16 },
  lineMedium: { width: '48%', height: 12 },
  avatar: { width: 48, height: 48, borderRadius: radius.full },
  mapCard: { width: '100%', height: 260, borderRadius: radius.xl },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionCard: { flex: 1, height: 88, borderRadius: radius.xl },
  sectionTitle: { width: 190, height: 20 },
  contentCard: { width: '100%', height: 190, borderRadius: radius.xl },
  reminderRow: { flexDirection: 'row', gap: spacing.md },
  reminderCard: { width: 220, height: 120, borderRadius: radius.xl },
  profileIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  profileAvatar: { width: 92, height: 92, borderRadius: radius.full },
  profileSection: { gap: spacing.md },
  sectionLabel: { width: 120, height: 12 },
  settingsRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chevron: { width: 18, height: 18, borderRadius: radius.full },
  feedScreen: { padding: spacing.lg, gap: spacing.lg },
  feedCard: { gap: spacing.md, paddingBottom: spacing.lg },
  feedAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  smallAvatar: { width: 42, height: 42, borderRadius: radius.full },
  feedMedia: { width: '100%', height: 210, borderRadius: radius.xl },
  contributionSkeleton: { padding: spacing.md, gap: spacing.md },
  contributionCard: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
  },
  contributionLine: { width: '100%', height: 54 },
  listRows: { padding: spacing.md, gap: spacing.sm },
  listRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  homeUpdateSkeleton: { gap: spacing.md, paddingVertical: spacing.md },
  homeUpdateMedia: { width: '100%', height: 160, borderRadius: radius.xl },
  reportDetailSheet: { gap: spacing.md, paddingVertical: spacing.xs },
  reportDetailAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reportDetailAuthorCopy: { flex: 1, gap: spacing.sm },
  reportDetailMetaLine: { width: '38%', height: 11 },
  reportDetailMedia: { width: '100%', height: 250, borderRadius: radius.lg },
  reportDetailActionRow: { flexDirection: 'row', gap: spacing.md },
  reportDetailAction: { width: 52, height: 26, borderRadius: radius.full },
  reportDetailTitle: { width: '64%', height: 20 },
  reportDetailBodyLine: { width: '100%', height: 14 },
  reportDetailBodyLineShort: { width: '76%', height: 14 },
  reportDetailComments: {
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  reportDetailCommentRow: { flexDirection: 'row', gap: spacing.sm },
  reportDetailCommentAvatar: { width: 34, height: 34, borderRadius: radius.full },
  reportDetailCommentCopy: { flex: 1, gap: spacing.sm },
  reportDetailCommentName: { width: '32%', height: 12 },
  reportDetailCommentBody: { width: '84%', height: 28 },
});
