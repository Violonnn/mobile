import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { fetchResidentReportTimeline, type MapReportMarker, type ResidentTimelineEntry } from '../../lib/reports';
import { colors, spacing } from '../../styles/theme';
import ReportStatusTimeline from './ReportStatusTimeline';
import ReportOutcomeNotice from './ReportOutcomeNotice';
import ResidentReportTimeline from './ResidentReportTimeline';

/** Mount only for the resident's own report; the RPC independently enforces ownership. */
export default function ResidentReportProgress({ report, refreshSignal = 0, onSendNewReport }: { report: MapReportMarker; refreshSignal?: number; onSendNewReport?: () => void }) {
  const [entries, setEntries] = useState<ResidentTimelineEntry[]>([]);
  const [loading, setLoading] = useState(!report.isPending);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const requestKey = `${report.id}:${Boolean(report.isPending)}:${refreshSignal}:${retry}`;
  const [previousRequestKey, setPreviousRequestKey] = useState(requestKey);
  if (requestKey !== previousRequestKey) {
    setPreviousRequestKey(requestKey);
    setLoading(!report.isPending);
    setEntries([]);
    setError(null);
  }
  useEffect(() => {
    if (report.isPending) return;
    let cancelled = false;
    void fetchResidentReportTimeline(report.id).then((result) => {
      if (cancelled) return;
      setEntries(result.entries);
      setError(result.error);
    }).catch(() => { if (!cancelled) setError('Could not load report activity.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [report.id, report.isPending, refreshSignal, retry]);
  return <View style={{ gap: spacing.md, paddingVertical: spacing.md }}>
    <ReportStatusTimeline
      lifecycle={report.lifecycle}
      status={report.status}
      useStatusProgressColors
    />
    {report.lifecycle && <ReportOutcomeNotice summary={report.lifecycle} reasonCode={report.reviewReasonCode ?? null} publicSummary={report.publicSummary ?? null} publicCorrection={report.publicCorrection ?? null} onSendNewReport={onSendNewReport} />}
    {loading ? <ActivityIndicator color={colors.primary} accessibilityLabel='Loading report activity' />
      : error ? <View><Text accessibilityRole='alert' style={{ color: colors.text }}>{error}</Text><TouchableOpacity accessibilityRole='button' onPress={() => setRetry((value) => value + 1)} style={{ paddingVertical: spacing.md }}><Text style={{ color: colors.primary }}>Retry activity</Text></TouchableOpacity></View>
      : !report.isPending && <ResidentReportTimeline entries={entries} />}
  </View>;
}
