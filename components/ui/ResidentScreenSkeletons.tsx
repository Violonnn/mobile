import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../../styles/theme';
import { SkeletonBlock, SkeletonGroup } from './Skeleton';

type FeedSkeletonVariant = 'community' | 'official';

function TextLine({ style }: { style?: object }) {
  return <SkeletonBlock style={[styles.textLine, style]} />;
}

function FeedSectionHeading() {
  return (
    <View style={styles.feedSectionHeading}>
      <View style={styles.feedTitleRow}>
        <TextLine style={styles.feedSectionTitle} />
        <SkeletonBlock style={styles.feedScopeButton} />
      </View>
      <TextLine style={styles.feedSectionSubtitle} />
    </View>
  );
}

function FeedPostSkeleton({ variant }: { variant: FeedSkeletonVariant }) {
  return (
    <View style={styles.feedPost}>
      <View style={styles.feedAuthorRow}>
        <SkeletonBlock style={styles.feedAvatar} />
        <View style={styles.feedAuthorCopy}>
          <TextLine style={styles.feedAuthorName} />
          <TextLine style={styles.feedAuthorMeta} />
        </View>
        <SkeletonBlock style={styles.feedMoreButton} />
      </View>
      <View style={styles.feedCopy}>
        {variant === 'official' ? <TextLine style={styles.feedUpdateLabel} /> : null}
        <TextLine style={styles.feedPostTitle} />
        <TextLine style={styles.feedPostBody} />
        <TextLine style={styles.feedPostBodyShort} />
      </View>
      <SkeletonBlock
        style={[
          styles.feedMedia,
          variant === 'official' ? styles.officialFeedMedia : styles.communityFeedMedia,
        ]}
      />
      {variant === 'community' ? (
        <View style={styles.feedTags}>
          <SkeletonBlock style={styles.feedTag} />
          <SkeletonBlock style={styles.feedTagWide} />
        </View>
      ) : null}
      <View style={styles.feedActions}>
        {variant === 'official' ? <TextLine style={styles.readAdvisory} /> : null}
        <View style={styles.feedActionButtons}>
          <SkeletonBlock style={styles.feedAction} />
          <SkeletonBlock style={styles.feedAction} />
          <SkeletonBlock style={styles.feedAction} />
        </View>
      </View>
    </View>
  );
}

/** Matches Home's greeting, nearby-report map, quick access, and first update card. */
export function HomeScreenSkeleton() {
  return (
    <SkeletonGroup style={styles.homeScreen}>
      <ScrollView
        contentContainerStyle={styles.homeSkeletonContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.homeHeader}>
          <View style={styles.homeGreetingCopy}>
            <TextLine style={styles.homeGreeting} />
            <TextLine style={styles.homeLocation} />
          </View>
          <SkeletonBlock style={styles.homeNotification} />
          <SkeletonBlock style={styles.homeAvatar} />
        </View>
        <SkeletonBlock style={styles.homeMap} />
        <View style={styles.homeNearbySummary}>
          <TextLine style={styles.nearbyTitle} />
          <TextLine style={styles.nearbyBody} />
          <TextLine style={styles.nearbyBodyShort} />
        </View>
        <View style={styles.homePaddedSection}>
          <TextLine style={styles.quickAccessTitle} />
          <View style={styles.quickAccessRow}>
            <SkeletonBlock style={styles.quickAccessItem} />
            <SkeletonBlock style={styles.quickAccessItem} />
            <SkeletonBlock style={styles.quickAccessItem} />
          </View>
          <View style={styles.homeSectionHeading}>
            <TextLine style={styles.homeSectionTitle} />
            <TextLine style={styles.homeSectionSubtitle} />
          </View>
          <View style={styles.homeUpdateCard}>
            <SkeletonBlock style={styles.homeUpdateMedia} />
            <View style={styles.homeUpdateCopy}>
              <TextLine style={styles.homeUpdateTitle} />
              <TextLine style={styles.homeUpdateBody} />
              <TextLine style={styles.homeUpdateAction} />
            </View>
          </View>
          <View style={styles.homeSectionHeading}>
            <TextLine style={styles.homeSectionTitle} />
          </View>
          <View style={styles.reminderRow}>
            <SkeletonBlock style={styles.reminderCard} />
            <SkeletonBlock style={styles.reminderCard} />
          </View>
        </View>
      </ScrollView>
    </SkeletonGroup>
  );
}

/** Mirrors the Settings identity block, preference rows, dividers, and logout action. */
export function ProfileScreenSkeleton() {
  return (
    <SkeletonGroup style={styles.profileScreen}>
      <View style={styles.profileIdentity}>
        <SkeletonBlock style={styles.profileAvatar} />
        <View style={styles.profileIdentityCopy}>
          <TextLine style={styles.profileName} />
          <TextLine style={styles.profilePhone} />
          <TextLine style={styles.profilePhotoAction} />
        </View>
      </View>
      <View style={styles.profileDivider} />
      <ProfileSectionSkeleton rows={3} controlIndexes={[0, 1]} />
      <View style={styles.profileDivider} />
      <ProfileSectionSkeleton rows={4} controlIndexes={[0, 1, 2]} switchIndex={1} />
      <View style={styles.profileDivider} />
      <ProfileSectionSkeleton rows={3} controlIndexes={[0, 2]} />
      <View style={styles.profileDivider} />
      <View style={styles.logoutSkeletonRow}>
        <View style={styles.profileRowCopy}>
          <TextLine style={styles.logoutTitle} />
          <TextLine style={styles.logoutSubtitle} />
        </View>
        <SkeletonBlock style={styles.profileControl} />
      </View>
    </SkeletonGroup>
  );
}

function ProfileSectionSkeleton({
  rows,
  controlIndexes,
  switchIndex,
}: {
  rows: number;
  controlIndexes: number[];
  switchIndex?: number;
}) {
  return (
    <View style={styles.profileSection}>
      <TextLine style={styles.profileSectionLabel} />
      {Array.from({ length: rows }, (_, index) => {
        const hasControl = controlIndexes.includes(index);
        return (
          <View key={index} style={styles.profileRow}>
            <View style={styles.profileRowCopy}>
              <TextLine style={styles.profileRowTitle} />
              <TextLine
                style={index % 2 === 0 ? styles.profileRowSubtitle : styles.profileRowSubtitleShort}
              />
            </View>
            {hasControl ? (
              <SkeletonBlock
                style={index === switchIndex ? styles.profileSwitchControl : styles.profileControl}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Keeps the active tab's section header and post type in place while its data loads. */
export function FeedScreenSkeleton({ variant = 'community' }: { variant?: FeedSkeletonVariant }) {
  return (
    <SkeletonGroup style={styles.feedScreen}>
      <FeedSectionHeading />
      <FeedPostSkeleton variant={variant} />
      <FeedPostSkeleton variant={variant} />
    </SkeletonGroup>
  );
}

/** Mirrors a contribution list row inside the resident Map's bottom sheet. */
export function ContributionSkeleton() {
  return (
    <SkeletonGroup style={styles.contributionSkeleton}>
      {[0, 1].map((item) => (
        <View key={item} style={styles.contributionCard}>
          <View style={styles.contributionDateRow}>
            <TextLine style={styles.contributionDate} />
            <SkeletonBlock style={styles.contributionStatus} />
          </View>
          <View style={styles.contributionMain}>
            <View style={styles.contributionCopy}>
              <TextLine style={styles.contributionTitle} />
              <SkeletonBlock style={styles.contributionTag} />
              <TextLine style={styles.contributionMeta} />
              <TextLine style={styles.contributionDescription} />
            </View>
            <SkeletonBlock style={styles.contributionMedia} />
          </View>
          <View style={styles.contributionFooter}>
            <TextLine style={styles.contributionAction} />
            <TextLine style={styles.contributionEngagement} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Shared compact list placeholder for resource and notification sheets. */
export function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonGroup style={styles.listRows}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.listRow}>
          <SkeletonBlock style={styles.listRowIcon} />
          <View style={styles.listRowCopy}>
            <TextLine style={styles.listRowTitle} />
            <TextLine style={styles.listRowSubtitle} />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** Matches Home's compact official-update card while announcements load. */
export function HomeUpdateSkeleton() {
  return (
    <SkeletonGroup style={styles.homeUpdateLoading}>
      <View style={styles.homeUpdateCard}>
        <SkeletonBlock style={styles.homeUpdateMedia} />
        <View style={styles.homeUpdateCopy}>
          <TextLine style={styles.homeUpdateTitle} />
          <TextLine style={styles.homeUpdateBody} />
          <TextLine style={styles.homeUpdateAction} />
        </View>
      </View>
    </SkeletonGroup>
  );
}

/** Reserves the report detail-sheet layout while full media URLs are prepared. */
export function ReportDetailSheetSkeleton() {
  return (
    <SkeletonGroup style={styles.reportDetailSheet}>
      <View style={styles.feedAuthorRow}>
        <SkeletonBlock style={styles.feedAvatar} />
        <View style={styles.feedAuthorCopy}>
          <TextLine style={styles.feedAuthorName} />
          <TextLine style={styles.feedAuthorMeta} />
        </View>
      </View>
      <SkeletonBlock style={styles.reportDetailMedia} />
      <View style={styles.reportDetailActions}>
        <SkeletonBlock style={styles.reportDetailAction} />
        <SkeletonBlock style={styles.reportDetailAction} />
        <SkeletonBlock style={styles.reportDetailAction} />
      </View>
      <TextLine style={styles.reportDetailTitle} />
      <TextLine style={styles.reportDetailBody} />
      <TextLine style={styles.reportDetailBodyShort} />
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  textLine: { height: 12 },
  homeScreen: { flex: 1, backgroundColor: colors.background },
  homeSkeletonContent: { paddingBottom: spacing.lg },
  homeHeader: { minHeight: 74, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  homeGreetingCopy: { flex: 1, gap: 7 },
  homeGreeting: { width: 132, height: 22 },
  homeLocation: { width: '72%', height: 14 },
  homeNotification: { width: 38, height: 44, borderRadius: radius.full },
  homeAvatar: { width: 46, height: 46, borderRadius: radius.full },
  homeMap: { width: '100%', height: 285, borderRadius: 0 },
  homeNearbySummary: { minHeight: 172, justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  nearbyTitle: { alignSelf: 'center', width: 176, height: 18 },
  nearbyBody: { alignSelf: 'center', width: '76%' },
  nearbyBodyShort: { alignSelf: 'center', width: '54%' },
  homePaddedSection: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  quickAccessTitle: { width: 116, height: 20, marginBottom: 2 },
  quickAccessRow: { flexDirection: 'row', height: 58, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#D9E1EC' },
  quickAccessItem: { flex: 1, marginVertical: spacing.sm, borderRadius: radius.sm },
  homeSectionHeading: { gap: 6, marginTop: spacing.sm },
  homeSectionTitle: { width: 194, height: 20 },
  homeSectionSubtitle: { width: '82%' },
  homeUpdateCard: { overflow: 'hidden', borderWidth: 1, borderColor: '#E1E8F2', borderRadius: radius.sm, backgroundColor: colors.white },
  homeUpdateMedia: { width: '100%', height: 190, borderRadius: 0 },
  homeUpdateCopy: { minHeight: 128, gap: spacing.sm, justifyContent: 'space-between', padding: spacing.md },
  homeUpdateTitle: { width: '74%', height: 17 },
  homeUpdateBody: { width: '100%' },
  homeUpdateAction: { width: 92, height: 14 },
  reminderRow: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.lg },
  reminderCard: { width: 184, height: 164, borderRadius: 4 },
  profileScreen: { gap: 0 },
  profileIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md },
  profileAvatar: { width: 92, height: 92, borderRadius: radius.full },
  profileIdentityCopy: { flex: 1, gap: spacing.sm },
  profileName: { width: '78%', height: 20 },
  profilePhone: { width: '56%' },
  profilePhotoAction: { width: 136, height: 14 },
  profileDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: -spacing.sm, backgroundColor: '#CBD5E1' },
  profileSection: { paddingTop: spacing.sm, paddingBottom: 2 },
  profileSectionLabel: { width: 112, height: 11, marginBottom: 2 },
  profileRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  profileRowCopy: { flex: 1, gap: 5 },
  profileRowTitle: { width: '52%', height: 15 },
  profileRowSubtitle: { width: '88%', height: 11 },
  profileRowSubtitleShort: { width: '64%', height: 11 },
  profileControl: { width: 28, height: 18, borderRadius: radius.full },
  profileSwitchControl: { width: 51, height: 31, borderRadius: radius.full },
  logoutSkeletonRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  logoutTitle: { width: 70, height: 15 },
  logoutSubtitle: { width: 134, height: 11 },
  feedScreen: { gap: 0 },
  feedSectionHeading: { marginBottom: spacing.md },
  feedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  feedSectionTitle: { width: 126, height: 18 },
  feedScopeButton: { width: 34, height: 34, borderRadius: radius.full },
  feedSectionSubtitle: { width: '74%', height: 12, marginTop: 3 },
  feedPost: { gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  feedAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  feedAvatar: { width: 40, height: 40, borderRadius: radius.full },
  feedAuthorCopy: { flex: 1, gap: 5 },
  feedAuthorName: { width: '46%', height: 14 },
  feedAuthorMeta: { width: '28%', height: 10 },
  feedMoreButton: { width: 32, height: 36, borderRadius: radius.full },
  feedCopy: { gap: 5 },
  feedUpdateLabel: { width: 112, height: 10 },
  feedPostTitle: { width: '72%', height: 17 },
  feedPostBody: { width: '100%' },
  feedPostBodyShort: { width: '76%' },
  feedMedia: { width: '100%', borderRadius: radius.md },
  communityFeedMedia: { aspectRatio: 2.1 },
  officialFeedMedia: { aspectRatio: 1.9 },
  feedTags: { flexDirection: 'row', gap: spacing.sm },
  feedTag: { width: 84, height: 23, borderRadius: 6 },
  feedTagWide: { width: 108, height: 23, borderRadius: 6 },
  feedActions: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readAdvisory: { width: 94, height: 14 },
  feedActionButtons: { flexDirection: 'row', gap: spacing.md },
  feedAction: { width: 30, height: 30, borderRadius: radius.full },
  contributionSkeleton: { gap: 0 },
  contributionCard: { gap: spacing.sm, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  contributionDateRow: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  contributionDate: { width: 56, height: 12 },
  contributionStatus: { width: 82, height: 21, borderRadius: radius.full },
  contributionMain: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  contributionCopy: { flex: 1, gap: spacing.sm },
  contributionTitle: { width: '72%', height: 20 },
  contributionTag: { width: 94, height: 23, borderRadius: radius.full },
  contributionMeta: { width: '86%' },
  contributionDescription: { width: '96%', height: 28 },
  contributionMedia: { width: 76, height: 76, borderRadius: radius.md },
  contributionFooter: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contributionAction: { width: 104, height: 14 },
  contributionEngagement: { width: 72, height: 14 },
  listRows: { gap: spacing.sm, padding: spacing.md },
  listRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  listRowIcon: { width: 42, height: 42, borderRadius: radius.full },
  listRowCopy: { flex: 1, gap: spacing.sm },
  listRowTitle: { width: '64%', height: 14 },
  listRowSubtitle: { width: '86%' },
  homeUpdateLoading: { paddingVertical: spacing.sm },
  reportDetailSheet: { gap: spacing.md, paddingVertical: spacing.xs },
  reportDetailMedia: { width: '100%', height: 250, borderRadius: radius.lg },
  reportDetailActions: { flexDirection: 'row', gap: spacing.md },
  reportDetailAction: { width: 52, height: 26, borderRadius: radius.full },
  reportDetailTitle: { width: '64%', height: 20 },
  reportDetailBody: { width: '100%', height: 14 },
  reportDetailBodyShort: { width: '76%', height: 14 },
});
