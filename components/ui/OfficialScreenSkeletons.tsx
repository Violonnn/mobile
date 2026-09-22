import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../../styles/theme';
import { SkeletonBlock, SkeletonGroup } from './Skeleton';

function HeaderSkeleton() {
  return (
    <View style={styles.header}>
      <View style={styles.titleLines}>
        <SkeletonBlock style={styles.title} />
        <SkeletonBlock style={styles.subtitle} />
      </View>
      <SkeletonBlock style={styles.headerAction} />
    </View>
  );
}

function ListCard({ media = false }: { media?: boolean }) {
  return (
    <View style={styles.listCard}>
      {media ? <SkeletonBlock style={styles.thumbnail} /> : <SkeletonBlock style={styles.icon} />}
      <View style={styles.cardCopy}>
        <SkeletonBlock style={styles.lineWide} />
        <SkeletonBlock style={styles.lineMedium} />
        <SkeletonBlock style={styles.lineShort} />
      </View>
    </View>
  );
}

export function OfficialShellSkeleton() {
  return (
    <SkeletonGroup style={styles.screen}>
      <HeaderSkeleton />
      <SkeletonBlock style={styles.shellHero} />
      <ListCard />
      <ListCard />
    </SkeletonGroup>
  );
}

export function CommandScreenSkeleton() {
  return (
    <SkeletonGroup style={styles.screen}>
      <HeaderSkeleton />
      <SkeletonBlock style={styles.commandMap} />
      <View style={styles.summaryRow}>
        <SkeletonBlock style={styles.summaryCard} />
        <SkeletonBlock style={styles.summaryCard} />
        <SkeletonBlock style={styles.summaryCard} />
      </View>
      <SkeletonBlock style={styles.sectionLabel} />
      <ListCard media />
      <ListCard media />
    </SkeletonGroup>
  );
}

export function ReportsScreenSkeleton() {
  return (
    <SkeletonGroup style={styles.screen}>
      <HeaderSkeleton />
      <View style={styles.controls}><SkeletonBlock style={styles.search} /><SkeletonBlock style={styles.filter} /></View>
      <SkeletonBlock style={styles.sectionLabel} />
      <ListCard media />
      <ListCard media />
      <ListCard media />
    </SkeletonGroup>
  );
}

export function CommunityScreenSkeleton() {
  return (
    <SkeletonGroup style={styles.screen}>
      <HeaderSkeleton />
      <View style={styles.tabs}><SkeletonBlock style={styles.tab} /><SkeletonBlock style={styles.tab} /></View>
      <SkeletonBlock style={styles.composer} />
      <ListCard media />
      <ListCard media />
    </SkeletonGroup>
  );
}

export function MapScreenSkeleton() {
  return (
    <SkeletonGroup style={styles.mapScreen}>
      <SkeletonBlock style={styles.mapShell} />
      <View style={styles.mapQueue}><SkeletonBlock style={styles.queueHandle} /><SkeletonBlock style={styles.queueTitle} /></View>
    </SkeletonGroup>
  );
}

export function ResourcesScreenSkeleton() {
  return (
    <SkeletonGroup style={styles.screen}>
      <HeaderSkeleton />
      <View style={styles.tabs}><SkeletonBlock style={styles.tab} /><SkeletonBlock style={styles.tab} /><SkeletonBlock style={styles.tab} /></View>
      <SkeletonBlock style={styles.search} />
      <SkeletonBlock style={styles.summary} />
      <ListCard />
      <ListCard />
      <ListCard />
    </SkeletonGroup>
  );
}

export function SettingsScreenSkeleton() {
  return (
    <SkeletonGroup style={styles.screen}>
      <HeaderSkeleton />
      <View style={styles.identity}><SkeletonBlock style={styles.avatar} /><View style={styles.cardCopy}><SkeletonBlock style={styles.lineWide} /><SkeletonBlock style={styles.lineMedium} /></View></View>
      <SkeletonBlock style={styles.sectionLabel} />
      <ListCard />
      <ListCard />
      <SkeletonBlock style={styles.sectionLabel} />
      <ListCard />
      <ListCard />
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: spacing.lg, padding: spacing.lg, backgroundColor: colors.background },
  mapScreen: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titleLines: { flex: 1, gap: spacing.sm },
  title: { width: 132, height: 22 }, subtitle: { width: 190, height: 12 }, headerAction: { width: 42, height: 42, borderRadius: radius.full },
  shellHero: { height: 164, borderRadius: radius.xl }, commandMap: { height: 220, borderRadius: radius.xl },
  summaryRow: { flexDirection: 'row', gap: spacing.sm }, summaryCard: { flex: 1, height: 80, borderRadius: radius.lg },
  sectionLabel: { width: 138, height: 14 }, controls: { flexDirection: 'row', gap: spacing.sm }, search: { flex: 1, height: 46, borderRadius: radius.full }, filter: { width: 46, height: 46, borderRadius: radius.full },
  listCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.white },
  icon: { width: 44, height: 44, borderRadius: radius.md }, thumbnail: { width: 72, height: 64, borderRadius: radius.md }, cardCopy: { flex: 1, gap: spacing.sm },
  lineWide: { width: '82%', height: 15 }, lineMedium: { width: '60%', height: 12 }, lineShort: { width: '38%', height: 10 },
  tabs: { flexDirection: 'row', gap: spacing.sm }, tab: { flex: 1, height: 36, borderRadius: radius.full }, composer: { height: 72, borderRadius: radius.xl }, summary: { height: 56, borderRadius: radius.lg },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.sm }, avatar: { width: 80, height: 80, borderRadius: radius.full },
  mapShell: { flex: 1, borderRadius: 0 }, mapQueue: { minHeight: 88, gap: spacing.sm, padding: spacing.md, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.white }, queueHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: radius.full }, queueTitle: { width: 156, height: 14 },
});
