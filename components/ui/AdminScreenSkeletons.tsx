import React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SkeletonBlock, SkeletonGroup } from './Skeleton';
import { adminColors } from '../../styles/screens/admin.styles';
import { useAccessibilityLayout } from '../../hooks/useAccessibilityLayout';
import { colors, spacing } from '../../styles/theme';

export function AdminShellSkeleton() {
  return (
    <View style={styles.shell} accessibilityLabel="Checking administrator access">
      <AdminHeaderSkeleton />
      <AdminDashboardSkeleton />
    </View>
  );
}

export function AdminHeaderSkeleton() {
  return (
    <SkeletonGroup style={styles.headerRow}>
      <Image
        source={require('../../assets/images/mingla.png')}
        style={styles.headerSeal}
        accessibilityLabel="Minglanilla municipal seal"
      />
      <View style={styles.headerCopy}>
        <SkeletonBlock style={styles.headerTitle} />
        <SkeletonBlock style={styles.headerSubtitle} />
      </View>
    </SkeletonGroup>
  );
}

export function AdminDashboardSkeleton() {
  const { width } = useWindowDimensions();
  const { isLargeText } = useAccessibilityLayout();
  const compactLayout = width < 360 || isLargeText;

  return (
    <View style={styles.dashboard} accessibilityLabel="Loading invitation summary">
      <SkeletonGroup style={styles.accessPanel}>
        <SkeletonBlock style={styles.panelHeading} />
        <View style={[styles.stageRow, compactLayout ? styles.stageRowStacked : null]}>
          <View style={[styles.stage, compactLayout ? styles.stageStacked : null]}>
            <SkeletonBlock style={styles.pendingCount} />
            <SkeletonBlock style={styles.stageLabel} />
          </View>
          <View style={[styles.stageDivider, compactLayout ? styles.stageDividerStacked : null]} />
          <View style={[styles.stage, compactLayout ? styles.stageStacked : null]}>
            <SkeletonBlock style={styles.registeredCount} />
            <SkeletonBlock style={styles.stageLabel} />
          </View>
        </View>
        <SkeletonBlock style={styles.primaryAction} />
      </SkeletonGroup>
      <AdminDashboardDataSkeleton />
    </View>
  );
}

export function AdminDashboardDataSkeleton() {
  const { width } = useWindowDimensions();
  const { isLargeText } = useAccessibilityLayout();
  const compactLayout = width < 360 || isLargeText;

  return (
    <View style={styles.dashboardData} accessibilityLabel="Loading expiry and role summary">
      <SkeletonGroup style={styles.attentionStrip}>
        <SkeletonBlock style={styles.attentionMark} />
        <SkeletonBlock style={styles.attentionCopy} />
        <SkeletonBlock style={styles.attentionAction} />
      </SkeletonGroup>
      <View style={styles.roleSection}>
        <SkeletonBlock style={styles.sectionHeading} />
        <SkeletonBlock style={styles.legend} />
        <View style={[styles.roleTools, compactLayout ? styles.roleToolsStacked : null]}>
          <SkeletonGroup style={[styles.roleTool, compactLayout ? styles.roleToolStacked : null]}>
            {compactLayout ? (
              <>
                <View style={styles.roleIdentity}>
                  <SkeletonBlock style={styles.roleIcon} />
                  <SkeletonBlock style={styles.roleLabel} />
                </View>
                <View style={styles.roleCountLinesStacked}>
                  <SkeletonBlock style={styles.roleCountLineStacked} />
                  <SkeletonBlock style={styles.roleCountLineStacked} />
                </View>
              </>
            ) : (
              <>
                <SkeletonBlock style={styles.roleIcon} />
                <SkeletonBlock style={styles.roleLabel} />
                <SkeletonBlock style={styles.roleCounts} />
              </>
            )}
          </SkeletonGroup>
          <View style={[styles.roleDivider, compactLayout ? styles.roleDividerStacked : null]} />
          <SkeletonGroup style={[styles.roleTool, compactLayout ? styles.roleToolStacked : null]}>
            {compactLayout ? (
              <>
                <View style={styles.roleIdentity}>
                  <SkeletonBlock style={styles.roleIcon} />
                  <SkeletonBlock style={styles.roleLabel} />
                </View>
                <View style={styles.roleCountLinesStacked}>
                  <SkeletonBlock style={styles.roleCountLineStacked} />
                  <SkeletonBlock style={styles.roleCountLineStacked} />
                </View>
              </>
            ) : (
              <>
                <SkeletonBlock style={styles.roleIcon} />
                <SkeletonBlock style={styles.roleLabel} />
                <SkeletonBlock style={styles.roleCounts} />
              </>
            )}
          </SkeletonGroup>
          <View style={[styles.roleDivider, compactLayout ? styles.roleDividerStacked : null]} />
          <SkeletonGroup style={[styles.roleTool, compactLayout ? styles.roleToolStacked : null]}>
            {compactLayout ? (
              <>
                <View style={styles.roleIdentity}>
                  <SkeletonBlock style={styles.roleIcon} />
                  <SkeletonBlock style={styles.roleLabel} />
                </View>
                <View style={styles.roleCountLinesStacked}>
                  <SkeletonBlock style={styles.roleCountLineStacked} />
                  <SkeletonBlock style={styles.roleCountLineStacked} />
                </View>
              </>
            ) : (
              <>
                <SkeletonBlock style={styles.roleIcon} />
                <SkeletonBlock style={styles.roleLabel} />
                <SkeletonBlock style={styles.roleCounts} />
              </>
            )}
          </SkeletonGroup>
        </View>
      </View>
    </View>
  );
}

export function AdminInviteListSkeleton() {
  return (
    <View style={styles.list} accessibilityLabel="Loading invitations">
      {[0, 1, 2].map((index) => (
        <SkeletonGroup key={index} style={styles.listRow}>
          <SkeletonBlock style={styles.listAvatar} />
          <View style={styles.listCopy}>
            <SkeletonBlock style={styles.listEmail} />
            <SkeletonBlock style={styles.listStatus} />
            <SkeletonBlock style={styles.listMeta} />
          </View>
        </SkeletonGroup>
      ))}
    </View>
  );
}

export function AdminSettingsIdentitySkeleton() {
  return (
    <View accessibilityLabel="Loading administrator identity">
      <SkeletonGroup style={styles.identityContent}>
        <SkeletonBlock style={styles.identityAvatar} />
        <View style={styles.identityCopy}>
          <SkeletonBlock style={styles.identityName} />
          <SkeletonBlock style={styles.identityEmail} />
          <SkeletonBlock style={styles.identityRole} />
        </View>
      </SkeletonGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    backgroundColor: colors.white,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerSeal: {
    width: 42,
    height: 42,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  headerTitle: {
    width: 132,
    height: 25,
    borderRadius: 2,
  },
  headerSubtitle: {
    width: 164,
    height: 13,
    borderRadius: 2,
  },
  dashboard: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  dashboardData: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  accessPanel: {
    minHeight: 232,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    backgroundColor: adminColors.accessPanel,
  },
  panelHeading: {
    height: 36,
    width: '55%',
    borderRadius: 2,
  },
  stageRow: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stageRowStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  stage: {
    flex: 1,
    gap: spacing.sm,
  },
  stageStacked: {
    flex: 0,
  },
  pendingCount: {
    height: 58,
    width: 110,
    borderRadius: 2,
  },
  registeredCount: {
    height: 40,
    width: 76,
    borderRadius: 2,
  },
  stageLabel: {
    width: 82,
    height: 18,
    borderRadius: 2,
  },
  stageDivider: {
    width: StyleSheet.hairlineWidth,
    height: 56,
    backgroundColor: 'rgba(15,32,68,0.18)',
  },
  stageDividerStacked: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    minHeight: 0,
  },
  primaryAction: {
    width: 142,
    height: 48,
    borderRadius: 6,
  },
  attentionStrip: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6D9CB',
  },
  attentionMark: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  attentionCopy: {
    flex: 1,
    height: 17,
    borderRadius: 2,
  },
  attentionAction: {
    width: 66,
    height: 32,
    borderRadius: 4,
  },
  roleSection: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CBD5E1',
  },
  sectionHeading: {
    width: 118,
    height: 24,
    borderRadius: 2,
  },
  legend: {
    width: 144,
    height: 14,
    borderRadius: 2,
  },
  roleTools: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  roleToolsStacked: {
    flexDirection: 'column',
  },
  roleTool: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  roleToolStacked: {
    flex: 0,
    minHeight: 0,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  roleIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  roleCountLinesStacked: {
    width: '100%',
    gap: spacing.xs,
  },
  roleCountLineStacked: {
    width: '100%',
    height: 18,
    borderRadius: 2,
  },
  roleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  roleLabel: {
    width: 66,
    height: 15,
    borderRadius: 2,
  },
  roleCounts: {
    width: 44,
    height: 15,
    borderRadius: 2,
  },
  roleDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#CBD5E1',
  },
  roleDividerStacked: {
    width: 'auto',
    height: StyleSheet.hairlineWidth,
  },
  list: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    backgroundColor: colors.white,
  },
  listRow: {
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  listCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  listEmail: {
    width: '74%',
    height: 17,
    borderRadius: 2,
  },
  listStatus: {
    width: 72,
    height: 12,
    borderRadius: 2,
  },
  listMeta: {
    width: '88%',
    height: 14,
    borderRadius: 2,
  },
  identityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 3,
    borderBottomColor: '#E8F1F5',
  },
  identityAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  identityCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  identityName: {
    width: '70%',
    height: 18,
    borderRadius: 2,
  },
  identityEmail: {
    width: '92%',
    height: 14,
    borderRadius: 2,
  },
  identityRole: {
    width: 140,
    height: 13,
    borderRadius: 2,
  },
});
