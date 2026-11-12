import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Image } from 'expo-image';
import {
  getOfficialReportPublicationReview,
  notifyReportPublicationChanged,
  setPublicResidentReport,
  type OfficialReportPublicationReview,
} from '../../lib/reportPublication';
import { colors, fonts, spacing } from '../../styles/theme';
import { WorkflowButton } from './WorkflowForm';
import { PublicationDisclosureTiles, PublicSourceText } from './ReportPublicationFields';
import { officialStyles as styles } from '../../styles/screens/official.styles';

export default function IncidentReportPublicationReview({
  reportId,
  onChanged,
}: {
  reportId: string;
  onChanged: () => void;
}) {
  const [review, setReview] = useState<OfficialReportPublicationReview | null>(null);
  const [approveName, setApproveName] = useState(false);
  const [approveAvatar, setApproveAvatar] = useState(false);
  const [approveExactLocation, setApproveExactLocation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getOfficialReportPublicationReview(reportId);
    if (result.error || !result.review) {
      setReview(null);
      setError(result.error ?? 'This report is not available for publication review.');
      setLoading(false);
      return;
    }
    const loaded = result.review;
    setReview(loaded);
    setApproveName(loaded.reporterNameApproved);
    setApproveAvatar(loaded.reporterAvatarApproved);
    setApproveExactLocation(loaded.exactLocationApproved);
    setLoading(false);
  }, [reportId]);

  useEffect(() => {
    let isCurrent = true;
    async function loadInitialReview() {
      const result = await getOfficialReportPublicationReview(reportId);
      if (!isCurrent) return;
      if (result.error || !result.review) {
        setReview(null);
        setError(result.error ?? 'This report is not available for publication review.');
        setLoading(false);
        return;
      }

      const loaded = result.review;
      setReview(loaded);
      setApproveName(loaded.reporterNameApproved);
      setApproveAvatar(loaded.reporterAvatarApproved);
      setApproveExactLocation(loaded.exactLocationApproved);
      setLoading(false);
    }

    void loadInitialReview();
    return () => {
      isCurrent = false;
    };
  }, [reportId]);

  async function save(publish: boolean) {
    if (busy || !review) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const result = await setPublicResidentReport({
      reportId,
      publish,
      approveReporterName: review.showReporterName && approveName,
      approveReporterAvatar: review.showReporterAvatar && approveAvatar,
      approveExactLocation: review.allowExactLocation && approveExactLocation,
    });
    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }

    setSuccess(publish ? 'This screened report is now public.' : 'This report was hidden from public reads.');
    setBusy(false);
    notifyReportPublicationChanged();
    onChanged();
    await loadReview();
  }

  if (loading) {
    return (
      <View style={reviewStyles.stateRow}>
        <ActivityIndicator color={colors.primary} />
        <Text style={reviewStyles.body}>Loading this report’s publication review…</Text>
      </View>
    );
  }

  if (!review) {
    return (
      <View style={reviewStyles.stateBlock}>
        {error ? <Text accessibilityRole="alert" style={reviewStyles.error}>{error}</Text> : null}
        <WorkflowButton secondary label="Retry report review" onPress={() => void loadReview()} disabled={busy} />
      </View>
    );
  }

  const canApproveName = review.showReporterName;
  const canApproveAvatar = review.showReporterAvatar;
  const canApproveExactLocation = review.allowExactLocation;

  return (
    <View style={reviewStyles.panel}>
      <Text style={reviewStyles.body}>
        Source text stays unchanged. Disclosure follows the owner’s choices.
      </Text>
      <View style={reviewStyles.statusBox}>
        <Text style={reviewStyles.statusText}>
          {review.isPublished ? 'Public · approved report post' : 'Private · awaiting official publication'}
        </Text>
      </View>
      <PublicSourceText title={review.sourceTitle} description={review.sourceDescription} />

      <View style={reviewStyles.sourcePrivacyCard}>
        <Text style={styles.subtitle}>Private source context for screening</Text>
        <Text style={reviewStyles.body}>Private context for authorized responders.</Text>
        <View style={reviewStyles.sourceIdentityRow}>
          {review.reporterAvatarUrl ? (
            <Image source={{ uri: review.reporterAvatarUrl }} style={reviewStyles.avatar} contentFit="cover" accessibilityLabel="Private source reporter profile picture" />
          ) : null}
          <Text style={reviewStyles.body}>Reporter: {review.reporterName ?? 'Name unavailable'}</Text>
        </View>
        <Text style={reviewStyles.body}>
          Exact submitted coordinates: {review.sourceLatitude != null && review.sourceLongitude != null
            ? `${review.sourceLatitude.toFixed(6)}, ${review.sourceLongitude.toFixed(6)}`
            : 'Unavailable'}
        </Text>
      </View>

      <PublicationDisclosureTiles
        disabled={busy}
        choices={[
          { label: 'Name', icon: 'person-outline', allowed: canApproveName, selected: approveName, onChange: setApproveName },
          { label: 'Profile', icon: 'person-circle-outline', allowed: canApproveAvatar, selected: approveAvatar, onChange: setApproveAvatar },
          { label: 'Exact pin', icon: 'location-outline', allowed: canApproveExactLocation, selected: approveExactLocation, onChange: setApproveExactLocation },
        ]}
      />
      <Text style={reviewStyles.body}>
        Exact location remains available to authorized responders for operations.
      </Text>

      {error ? <Text accessibilityRole="alert" style={reviewStyles.error}>{error}</Text> : null}
      {success ? <Text accessibilityLiveRegion="polite" style={reviewStyles.success}>{success}</Text> : null}
      {review.isPublished ? (
        <WorkflowButton secondary label={busy ? 'Saving…' : 'Hide this public report'} onPress={() => void save(false)} disabled={busy} />
      ) : null}
      <WorkflowButton label={busy ? 'Saving…' : 'Approve and publish screened report'} onPress={() => void save(true)} disabled={busy} />
      {busy ? <ActivityIndicator color={colors.primary} /> : null}
    </View>
  );
}

const reviewStyles = {
  panel: { gap: spacing.md },
  body: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  stateRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
  stateBlock: { gap: spacing.sm },
  statusBox: { padding: spacing.sm, borderRadius: 10, backgroundColor: '#EEF2FF' },
  statusText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  sourcePrivacyCard: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: '#F9FAFB' },
  sourceIdentityRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.unverified },
  success: { fontFamily: fonts.medium, fontSize: 13, color: colors.success },
};
