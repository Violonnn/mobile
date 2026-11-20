import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { formatPublishedAt } from '../../lib/formatTime';
import { formatIncidentType } from '../../lib/incidentTypes';
import { getMapReportPresentation } from '../../lib/reports';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { mdrrmoReportsStyles as reportStyles } from '../../styles/screens/mdrrmoReports.styles';
import { colors, fonts, fontSizes, spacing } from '../../styles/theme';
import { reportOperationsStyles as operationStyles } from '../../styles/components/reportOperations.styles';
import { IncidentTagRow } from '../report/ReportDetailCard';
import ResourceFormSheet from './ResourceFormSheet';
import { WorkflowButton, WorkflowFeedback } from './WorkflowForm';
import ReportPublicationFields from './ReportPublicationFields';

function IncidentLinkCandidateTags({ candidate }: { candidate: IncidentLinkCandidate }) {
  const presentation = getMapReportPresentation({
    status: candidate.status,
    lifecycle: undefined,
  }, 'resident');

  return (
    <IncidentTagRow
      statusLabel={presentation.label}
      statusColor={presentation.color}
      statusBackgroundColor={presentation.backgroundColor}
      incidentType={candidate.incidentType}
      incidentTypeLabel={formatIncidentType(candidate.incidentType, candidate.incidentTypeOther)}
      largeText
    />
  );
}

function LinkIncidentSheetForm(
  { visible, reportId, onClose, onLinked }: {
    visible: boolean;
    reportId: string;
    onClose: () => void;
    onLinked: () => void;
  },
) {
  const [candidates, setCandidates] = useState<IncidentLinkCandidate[]>([]);
  const [publicationReview, setPublicationReview] = useState<OfficialReportPublicationReview | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
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
    setBusy(true);
    setError(null);
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
      setError('Could not load active reports and publication details.');
    } finally {
      setBusy(false);
    }
  }, [reportId]);
  useEffect(() => {
    void load();
  }, [load]);
  const selectedCandidate = candidates.find(
    (candidate) => candidate.reportId === selectedReportId,
  ) ?? null;
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
      hasUnsavedChanges={Boolean(selectedReportId || publicationAcknowledged)}
      discardMessage='Your report link and screened copy will not be submitted.'
      onClose={() => {
        if (!busy) onClose();
      }}
      stableHeight
    >
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
      {!busy && !error && !selectedCandidate && (
        <>
          <Text style={[reportStyles.sectionLabel, operationStyles.minimumText]}>Active reports</Text>
          {candidates.length === 0 ? (
            <Text style={[styles.subtitle, operationStyles.minimumText]}>No active reports are available to link.</Text>
          ) : candidates.map((candidate, index) => {
            const location = candidate.addressText || candidate.barangayName || 'Location unavailable';
            return (
              <Pressable
                key={candidate.reportId}
                style={({ pressed }) => [
                  reportStyles.queueCard,
                  index === 0 && reportStyles.queueCardFirst,
                  pressed && reportStyles.queueCardPressed,
                ]}
                onPress={() => {
                  setSelectedReportId(candidate.reportId);
                  setOperationId(randomUuid());
                }}
                accessibilityRole='button'
                accessibilityLabel={`View report ${candidate.title || 'Untitled report'}`}
              >
                <View style={reportStyles.mediaFrame}>
                  {candidate.thumbnailUrl ? (
                    <Image
                      source={{ uri: candidate.thumbnailUrl }}
                      style={reportStyles.media}
                      resizeMode='cover'
                    />
                  ) : (
                    <View style={reportStyles.mediaPlaceholder}>
                      <Ionicons name='document-text-outline' size={24} color={colors.textMuted} />
                      <Text style={[reportStyles.mediaPlaceholderText, operationStyles.minimumText]}>No photo</Text>
                    </View>
                  )}
                </View>
                <View style={reportStyles.reportCopy}>
                  <View style={linkIncidentStyles.reportHeading}>
                    <Text style={linkIncidentStyles.reportTitle} numberOfLines={2}>
                      {candidate.title.trim() || 'Untitled report'}
                    </Text>
                    <Text style={linkIncidentStyles.reportDate} numberOfLines={2}>
                      {formatPublishedAt(candidate.createdAt)}
                    </Text>
                  </View>
                  <Text style={[reportStyles.reportLocation, operationStyles.minimumText]} numberOfLines={1}>{location}</Text>
                  <View style={reportStyles.cardFooter}>
                    <IncidentLinkCandidateTags candidate={candidate} />
                    <View style={[reportStyles.reviewAction, linkIncidentStyles.detailsAction]}>
                      <Text style={[reportStyles.reviewActionText, operationStyles.minimumText]}>Details</Text>
                      <Ionicons name='chevron-forward' size={21} color={colors.navigationActive} />
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </>
      )}
      {!busy && !error && selectedCandidate ? (
        <>
          <View style={[styles.card, linkIncidentStyles.selectedReportCard]}>
            <WorkflowButton
              label='Back to active reports'
              secondary
              disabled={busy}
              onPress={() => setSelectedReportId(null)}
            />
            {selectedCandidate.thumbnailUrl ? (
              <Image
                source={{ uri: selectedCandidate.thumbnailUrl }}
                style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 14 }}
                resizeMode='cover'
              />
            ) : null}
            <View style={linkIncidentStyles.selectedReportHeading}>
              <Text style={linkIncidentStyles.selectedReportTitle} numberOfLines={2}>
                {selectedCandidate.title.trim() || 'Untitled report'}
              </Text>
              <Text style={linkIncidentStyles.selectedReportDate} numberOfLines={2}>
                {formatPublishedAt(selectedCandidate.createdAt)}
              </Text>
            </View>
            <Text style={linkIncidentStyles.selectedReportDescription}>
              {selectedCandidate.description || 'No description provided.'}
            </Text>
            <Text style={[reportStyles.reportLocation, operationStyles.minimumText]}>
              {selectedCandidate.addressText || selectedCandidate.barangayName || 'Location unavailable'}
            </Text>
            <IncidentLinkCandidateTags candidate={selectedCandidate} />
          </View>
          {publicationReview ? (
            <View style={[styles.card, linkIncidentStyles.publicationCard]}>
              <Text style={[reportStyles.sectionLabel, operationStyles.minimumText]}>Link this report to the active incident</Text>
              {publicationReview.canPublish ? null : (
                <Text style={[styles.subtitle, operationStyles.minimumText]}>
                  The incident lead will review any public post, so photos stay unselected here.
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
                showSourceText={false}
                showPhotoGuidance={false}
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
                      onPress: () => void link(selectedCandidate.incidentCaseId),
                    }],
                  )}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </ResourceFormSheet>
  );
}

const linkIncidentStyles = StyleSheet.create({
  reportHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  reportTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    lineHeight: 22,
  },
  reportDate: {
    maxWidth: '45%',
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: fontSizes.lg,
    lineHeight: 22,
    textAlign: 'right',
  },
  detailsAction: {
    alignSelf: 'flex-end',
    flexShrink: 0,
    marginLeft: 'auto',
  },
  selectedReportCard: {
    gap: spacing.xs,
    padding: spacing.sm,
  },
  selectedReportHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  selectedReportTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    lineHeight: 22,
  },
  selectedReportDate: {
    maxWidth: '42%',
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: fontSizes.lg,
    lineHeight: 22,
    textAlign: 'right',
  },
  selectedReportDescription: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSizes.lg,
    lineHeight: 22,
  },
  publicationCard: {
    gap: spacing.sm,
    padding: spacing.sm,
  },
});

export default function LinkIncidentSheet(
  props: React.ComponentProps<typeof LinkIncidentSheetForm>,
) {
  return props.visible
    ? <LinkIncidentSheetForm key={props.reportId} {...props} />
    : null;
}
