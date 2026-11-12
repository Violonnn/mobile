import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  fetchIncidentLinkCandidates,
  type IncidentLinkCandidate,
  reviewOfficialReport,
} from '../../lib/officialReports';
import {
  getOfficialReportPublicationReview,
  type OfficialReportPublicationReview,
} from '../../lib/reportPublication';
import { randomUuid } from '../../lib/reportMedia';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import ResourceFormSheet from './ResourceFormSheet';
import { WorkflowButton, WorkflowFeedback } from './WorkflowForm';
import ReportPublicationFields from './ReportPublicationFields';

function LinkIncidentSheetForm(
  { visible, reportId, onClose, onLinked }: {
    visible: boolean;
    reportId: string;
    onClose: () => void;
    onLinked: () => void;
  },
) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<IncidentLinkCandidate[]>([]);
  const [publicationReview, setPublicationReview] = useState<OfficialReportPublicationReview | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [publicationAcknowledged, setPublicationAcknowledged] = useState(false);
  const [selectedPhotoMediaIds, setSelectedPhotoMediaIds] = useState<string[]>([]);
  const [approveReporterName, setApproveReporterName] = useState(false);
  const [approveReporterAvatar, setApproveReporterAvatar] = useState(false);
  const [approveExactLocation, setApproveExactLocation] = useState(false);
  const [markSensitive, setMarkSensitive] = useState(false);
  const [sensitivityReason, setSensitivityReason] = useState('');
  const [operationId, setOperationId] = useState(randomUuid);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [candidateResult, reviewResult] = await Promise.all([
        fetchIncidentLinkCandidates(reportId),
        getOfficialReportPublicationReview(reportId),
      ]);
      setCandidates(candidateResult.candidates);
      setPublicationReview(reviewResult.review);
      setError(candidateResult.error ?? reviewResult.error);
      if (reviewResult.review) {
        setSelectedPhotoMediaIds(reviewResult.review.media
          .filter((item) => item.type === 'photo' && item.isPublicApproved && Boolean(item.safeDisplayUrl || item.privateDisplayUrl))
          .map((item) => item.mediaId));
        setApproveReporterName(reviewResult.review.reporterNameApproved);
        setApproveReporterAvatar(reviewResult.review.reporterAvatarApproved);
        setApproveExactLocation(reviewResult.review.exactLocationApproved);
        setMarkSensitive(reviewResult.review.isSensitive);
        setSensitivityReason('');
      }
      setOperationId(randomUuid());
    } catch {
      setError('Could not load incident suggestions and publication details.');
    } finally {
      setBusy(false);
    }
  }, [reportId]);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetchIncidentLinkCandidates(reportId),
      getOfficialReportPublicationReview(reportId),
    ]).then(([result, reviewResult]) => {
      if (!active) return;
      setCandidates(result.candidates);
      setPublicationReview(reviewResult.review);
      setError(result.error ?? reviewResult.error);
      if (reviewResult.review) {
        setSelectedPhotoMediaIds(reviewResult.review.media
          .filter((item) => item.type === 'photo' && item.isPublicApproved && Boolean(item.safeDisplayUrl || item.privateDisplayUrl))
          .map((item) => item.mediaId));
        setApproveReporterName(reviewResult.review.reporterNameApproved);
        setApproveReporterAvatar(reviewResult.review.reporterAvatarApproved);
        setApproveExactLocation(reviewResult.review.exactLocationApproved);
        setMarkSensitive(reviewResult.review.isSensitive);
        setSensitivityReason('');
      }
      setOperationId(randomUuid());
      setBusy(false);
    }).catch(() => {
      if (!active) return;
      setError('Could not load incident suggestions.');
      setBusy(false);
    });
    return () => {
      active = false;
    };
  }, [reportId]);
  function markPublicationEdited() {
    setOperationId(randomUuid());
  }

  async function link(incidentCaseId: string) {
    if (!publicationReview) {
      setError('Publication details are unavailable. Reload this sheet and try again.');
      return;
    }
    if (markSensitive && !sensitivityReason.trim()) {
      setError('Add a safety reason before marking the incident sensitive.');
      return;
    }
    if (!markSensitive && !publicationAcknowledged) {
      setError('Review the source text and selected photos before linking.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await reviewOfficialReport({
        reportId,
        decision: 'link',
        linkIncidentCaseId: incidentCaseId,
        publication: {
          operationId,
          publish: !markSensitive,
          publicationAcknowledged: !markSensitive && publicationAcknowledged,
          approveReporterName: !markSensitive && approveReporterName,
          approveReporterAvatar: !markSensitive && approveReporterAvatar,
          approveExactLocation: !markSensitive && approveExactLocation,
          photoMediaIds: markSensitive || !publicationReview.canPublish ? [] : selectedPhotoMediaIds,
          markIncidentSensitive: markSensitive,
          sensitivityReason: markSensitive ? sensitivityReason : null,
        },
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onLinked();
      const successMessage = result.publicAvailable
        ? 'The report was linked and its screened copy is public.'
        : result.publicationStatus === 'awaiting_lead_review'
        ? 'The report was linked. The incident lead must review its public copy.'
        : result.publicationStatus === 'awaiting_confirmation'
        ? 'The report was linked and will be reviewed when the incident is confirmed.'
        : result.publicationStatus === 'sensitive'
        ? 'The report was linked to a sensitive incident. Public details and photos remain hidden.'
        : 'The report was linked and remains private pending publication review.';
      Alert.alert('Report linked', successMessage, [{ text: 'Done', onPress: onClose }]);
    } catch {
      setError('Could not link this report.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <ResourceFormSheet
      visible={visible}
      title='Link to an incident'
      hasUnsavedChanges={Boolean(selectedCandidateId || publicationAcknowledged)}
      discardMessage='Your screened report copy will not be submitted.'
      onClose={() => {
        if (!busy) onClose();
      }}
      stableHeight
    >
      <Text style={styles.subtitle}>
        Suggestions are not automatic matches. Check the location and incident
        before linking.
      </Text>
      <WorkflowFeedback busy={busy} error={error} />
      {error && (
        <WorkflowButton
          label='Try again'
          onPress={() => {
            setBusy(true);
            setError(null);
            void load();
          }}
          disabled={busy}
        />
      )}
      {!busy && !error && candidates.length === 0 && (
        <Text style={styles.subtitle}>
          No eligible incidents nearby. Suggestions include active cases in your
          office’s scope, within 500 metres, created in the last 24 hours. Cases
          may be confirmed or still being assessed. Separate pending reports are
          not incident cases yet. Continue reviewing this report if none
          qualify.
        </Text>
      )}
      {candidates.map((candidate) => (
        <View key={candidate.incidentCaseId} style={styles.card}>
          <Text style={styles.subtitle}>
            {candidate.incidentType ?? 'Incident'} · {candidate.verification} ·
            {' '}
            {candidate.distanceMeters == null
              ? 'Distance unavailable'
              : `${Math.round(candidate.distanceMeters)} m`} ·{' '}
            {candidate.linkedReportCount} reports
          </Text>
          <WorkflowButton
            label='View source report'
            disabled={busy}
            onPress={() => {
              onClose();
              router.push({
                pathname: '/official/[id]',
                params: { id: candidate.sourceReportId },
              });
            }}
          />
          <WorkflowButton
            disabled={busy}
            label={selectedCandidateId === candidate.incidentCaseId ? 'Selected incident' : 'Select this incident'}
            onPress={() => {
              setSelectedCandidateId(candidate.incidentCaseId);
              setOperationId(randomUuid());
            }}
          />
        </View>
      ))}
      {selectedCandidateId && publicationReview ? (
        <View style={styles.card}>
          {publicationReview.canPublish ? null : (
            <Text style={styles.subtitle}>
              Your report can be linked in this office’s scope. The incident lead will review any public post, so photos stay unselected here.
            </Text>
          )}
          <ReportPublicationFields
            sourceTitle={publicationReview.sourceTitle}
            sourceDescription={publicationReview.sourceDescription}
            acknowledged={publicationAcknowledged}
            onAcknowledgedChange={(value) => { setPublicationAcknowledged(value); markPublicationEdited(); }}
            photos={publicationReview.canPublish
              ? publicationReview.media.filter((item) => item.type === 'photo').map((item) => ({
                mediaId: item.mediaId,
                previewUrl: item.safeThumbnailUrl ?? item.privateThumbnailUrl ?? item.safeDisplayUrl ?? item.privateDisplayUrl,
                fullSizeUrl: item.safeDisplayUrl ?? item.privateDisplayUrl,
                verified: item.safeCopyVerified,
                publicApproved: item.isPublicApproved,
              }))
              : []}
            photoError={publicationReview.photoError}
            selectedPhotoMediaIds={selectedPhotoMediaIds}
            onPhotoSelectionChange={(mediaIds) => { setSelectedPhotoMediaIds(mediaIds); markPublicationEdited(); }}
            reporterNameAllowed={publicationReview.showReporterName}
            approveReporterName={approveReporterName}
            onApproveReporterNameChange={(value) => { setApproveReporterName(value); markPublicationEdited(); }}
            reporterAvatarAllowed={publicationReview.showReporterAvatar}
            approveReporterAvatar={approveReporterAvatar}
            onApproveReporterAvatarChange={(value) => { setApproveReporterAvatar(value); markPublicationEdited(); }}
            exactLocationAllowed={publicationReview.allowExactLocation}
            approveExactLocation={approveExactLocation}
            onApproveExactLocationChange={(value) => { setApproveExactLocation(value); markPublicationEdited(); }}
            sensitive={markSensitive}
            onSensitiveChange={(value) => { setMarkSensitive(value); markPublicationEdited(); }}
            sensitivityReason={sensitivityReason}
            onSensitivityReasonChange={(value) => { setSensitivityReason(value); markPublicationEdited(); }}
            disabled={busy}
          />
          <WorkflowButton
            disabled={busy || !publicationReview || (!markSensitive && !publicationAcknowledged) || (markSensitive && !sensitivityReason.trim())}
            label='Link report'
            onPress={() =>
              Alert.alert(
                'Link this report?',
                'The report becomes part of the selected incident. Public sharing follows the incident lead’s review authority.',
                [{ text: 'Cancel', style: 'cancel' }, {
                  text: 'Link report',
                  onPress: () => void link(selectedCandidateId),
                }],
              )}
          />
        </View>
      ) : null}
    </ResourceFormSheet>
  );
}

export default function LinkIncidentSheet(
  props: React.ComponentProps<typeof LinkIncidentSheetForm>,
) {
  return props.visible
    ? <LinkIncidentSheetForm key={props.reportId} {...props} />
    : null;
}
