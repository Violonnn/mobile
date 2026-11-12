import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatOperationTimestamp } from '../../lib/formatTime';
import type { ResidentTimelineEntry } from '../../lib/reports';
import { colors, fonts, radius, spacing } from '../../styles/theme';

export default function ResidentReportTimeline({ entries }: { entries: ResidentTimelineEntry[] }): React.JSX.Element {
  return <View style={styles.container}>
    <Text style={styles.heading}>Report activity</Text>
    {entries.length === 0 && <Text style={styles.meta}>No activity has been posted yet.</Text>}
    {entries.map((entry, index) => <View key={`${entry.occurredAt}-${entry.entryType}-${index}`} style={styles.entry}>
      <Text style={styles.body}>{entry.publicText}</Text>
      <Text style={styles.office}>Responsible office: {entry.responsibleOfficeLabel || 'Awaiting assignment'}</Text>
      <Text style={styles.meta}>{formatOperationTimestamp(entry.occurredAt)}</Text>
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  heading: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  entry: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.offWhite, gap: spacing.xs },
  body: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  office: { fontFamily: fonts.regular, fontSize: 12, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
});
