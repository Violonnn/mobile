import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { residentLabel, type LifecycleSummary } from '../../lib/reportLifecycle';
import { scopedLifecyclePresentation } from '../../lib/reportPresentation';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

const reasons: Record<string, string> = {
  test_or_spam: 'The submission was identified as a test or spam.',
  not_an_emergency_incident: 'The submission does not describe an emergency incident.',
  outside_approved_type: 'This incident type is outside the service coverage.',
  abusive_content: 'The submission contains abusive content.',
  insufficient_location: 'There was not enough location information to assess this report.',
};
export default function ReportOutcomeNotice({ summary, reasonCode, publicSummary, publicCorrection, onSendNewReport, useScopedPresentation = false }: {
  summary: LifecycleSummary; reasonCode: string | null; publicSummary: string | null;
  publicCorrection: string | null; onSendNewReport?: () => void;
  useScopedPresentation?: boolean;
}): React.JSX.Element {
  const stage = summary.primaryStage;
  if (!['resolved', 'withdrawn', 'not_confirmed', 'could_not_confirm', 'rejected', 'outside_coverage', 'linked'].includes(stage)) return <></>;
  const explanation = stage === 'withdrawn' ? publicCorrection || 'The earlier confirmation has been withdrawn. A correction has not been posted yet.'
    : stage === 'resolved' ? publicSummary || 'The office has not posted an outcome summary yet.'
    : stage === 'rejected' ? reasons[reasonCode ?? ''] || 'This report was not accepted. Contact the responsible office for clarification.'
    : stage === 'outside_coverage' ? 'This location is outside DisasterLink coverage. This report was not forwarded to another office. Use the emergency hotlines for assistance.'
    : stage === 'linked' ? 'Your submission has been added to an existing incident and follows its updates.'
    : 'Officials could not confirm this incident. You can send a new report if the situation changes or you have new information.';
  const title = useScopedPresentation
    ? scopedLifecyclePresentation(summary, { audience: 'resident' }).stageLabel
    : residentLabel(summary, { barangayName: null });
  return <View style={styles.notice}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.body}>{explanation}</Text>
    {onSendNewReport && ['not_confirmed', 'could_not_confirm', 'rejected'].includes(stage) && <TouchableOpacity accessibilityRole='button' onPress={onSendNewReport} style={styles.button}><Text style={styles.link}>Send a new report</Text></TouchableOpacity>}
  </View>;
}
const styles = StyleSheet.create({
  notice: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: radius.md },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.md, color: colors.text },
  button: { paddingVertical: spacing.sm },
  link: { fontFamily: fonts.semibold, color: colors.primary },
});
