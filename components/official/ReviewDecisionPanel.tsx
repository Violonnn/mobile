import React, { useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import {
  claimReportReview,
  type OfficialReportDetail,
  type RejectReasonCode,
  releaseReportReview,
  reopenReportReview,
  type ReviewAction,
  reviewOfficialReport,
} from '../../lib/officialReports';
import {
  getOfficialReportPublicationReview,
  type OfficialReportPublicationReview,
} from '../../lib/reportPublication';
import { randomUuid } from '../../lib/reportMedia';
import ResourceFormSheet from './ResourceFormSheet';
import { formatOperationTimestamp } from '../../lib/formatTime';
import { reportOperationsStyles as operationStyles } from '../../styles/components/reportOperations.styles';
import {
  WorkflowActionRow,
  WorkflowButton,
  WorkflowChoices,
  WorkflowFeedback,
  WorkflowNote,
} from './WorkflowForm';
import ReportPublicationFields from './ReportPublicationFields';

type DecisionChoice = Exclude<
  ReviewAction,
  'claim' | 'take_over' | 'release' | 'link'
>;

const decisions: { value: DecisionChoice; label: string }[] = [
  { value: 'verify', label: 'Confirm incident' },
  { value: 'needs_assessment', label: 'Needs field assessment' },
  { value: 'could_not_confirm', label: 'Could not confirm' },
  { value: 'reject', label: 'Reject report' },
];

export default function ReviewDecisionPanel(
  { detail, currentUserId, onChanged, onOpenLinkSheet, onSuccess, stage }: {
    onSuccess?: (message: string) => void;
    stage?: 'claim' | 'decision';
    detail: OfficialReportDetail;
    currentUserId: string;
    onChanged: () => void;
    onOpenLinkSheet: () => void;
  },
) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<DecisionChoice | null>(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState<RejectReasonCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    { note?: string; reason?: string }
  >({});
  const [publicationReview, setPublicationReview] = useState<OfficialReportPublicationReview | null>(null);
  const [publicationLoading, setPublicationLoading] = useState(false);
  const [publicationError, setPublicationError] = useState<string | null>(null);
  const [publicationLoadAttempt, setPublicationLoadAttempt] = useState(0);
  const [publicationAcknowledged, setPublicationAcknowledged] = useState(false);
  const [selectedPhotoMediaIds, setSelectedPhotoMediaIds] = useState<string[]>([]);
  const [approveReporterName, setApproveReporterName] = useState(false);
  const [approveReporterAvatar, setApproveReporterAvatar] = useState(false);
  const [approveExactLocation, setApproveExactLocation] = useState(false);
  const [markSensitive, setMarkSensitive] = useState(false);
  const [sensitivityReason, setSensitivityReason] = useState('');
  const [publicationOperationId, setPublicationOperationId] = useState(randomUuid);

  useEffect(() => {
    if (!open || decision !== 'verify') return;
    let active = true;
    void getOfficialReportPublicationReview(detail.id).then((result) => {
      if (!active) return;
      if (result.error || !result.review) {
        setPublicationReview(null);
        setPublicationError(result.error ?? 'Could not load the publication review.');
        return;
      }
      const review = result.review;
      setPublicationReview(review);
      setPublicationAcknowledged(false);
      setSelectedPhotoMediaIds(review.media
        .filter((item) => item.type === 'photo' && item.isPublicApproved && Boolean(item.safeDisplayUrl || item.privateDisplayUrl))
        .map((item) => item.mediaId));
      setApproveReporterName(review.reporterNameApproved);
      setApproveReporterAvatar(review.reporterAvatarApproved);
      setApproveExactLocation(review.exactLocationApproved);
      setMarkSensitive(review.isSensitive);
      setSensitivityReason('');
      setPublicationOperationId(randomUuid());
    }).catch(() => {
      if (active) setPublicationError('Could not load the publication review. Try again.');
    }).finally(() => {
      if (active) setPublicationLoading(false);
    });
    return () => {
      active = false;
    };
  }, [open, decision, detail.id, publicationLoadAttempt]);

  async function run(action: Exclude<ReviewAction, 'link'> | 'reopen') {
    if (busy) return;
    setFieldErrors({});
    setError(null);

    const noteRequired = ['could_not_confirm', 'reopen'].includes(action) ||
      (action === 'verify' && detail.intakeChannel === 'hotline_call') ||
      (action === 'reject' && reason === 'other');
    if (noteRequired && !note.trim()) {
      setFieldErrors({ note: 'Add a reason before continuing.' });
      return;
    }
    if (action === 'reject' && !reason) {
      setFieldErrors({ reason: 'Select a rejection reason.' });
      return;
    }
    if (action === 'verify') {
      if (!publicationReview) {
        setError(publicationError ?? 'Load the publication review before confirming this report.');
        return;
      }
      if (markSensitive && !sensitivityReason.trim()) {
        setError('Add a safety reason before marking the incident sensitive.');
        return;
      }
      if (!markSensitive && !publicationAcknowledged) {
        setError('Review the source text and selected photos before confirming.');
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      let result: { error: string | null; publicAvailable?: boolean; publicationStatus?: string | null };
      if (action === 'claim' || action === 'take_over') {
        result = await claimReportReview({
          reportId: detail.id,
          takeOver: action === 'take_over',
        });
      } else if (action === 'release') {
        result = await releaseReportReview({ reportId: detail.id, note });
      } else if (action === 'reopen') {
        result = await reopenReportReview({
          reportId: detail.id,
          reason: note,
        });
      } else {
        const publication = action === 'verify'
          ? {
            operationId: publicationOperationId,
            publish: !markSensitive,
            publicationAcknowledged: !markSensitive && publicationAcknowledged,
            approveReporterName: !markSensitive && approveReporterName,
            approveReporterAvatar: !markSensitive && approveReporterAvatar,
            approveExactLocation: !markSensitive && approveExactLocation,
            photoMediaIds: markSensitive ? [] : selectedPhotoMediaIds,
            markIncidentSensitive: markSensitive,
            sensitivityReason: markSensitive ? sensitivityReason : null,
          }
          : { operationId: publicationOperationId };
        result = await reviewOfficialReport({
          reportId: detail.id,
          decision: action,
          reasonCode: reason,
          note,
          publication,
        });
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      setDecision(null);
      setNote('');
      setOpen(false);
      onSuccess?.(
        action === 'claim' || action === 'take_over'
          ? 'Review claimed.'
          : action === 'release'
          ? 'Review released to your office.'
          : action === 'reopen'
          ? 'Report reopened for review.'
          : action === 'verify' && markSensitive
          ? 'Incident confirmed and marked sensitive. Public details and photos remain hidden.'
          : action === 'verify' && result.publicAvailable
          ? 'Incident confirmed and the screened report is public.'
          : action === 'verify' && result.publicationStatus === 'awaiting_lead_review'
          ? 'Confirmation saved. The public copy is awaiting incident lead review.'
          : action === 'verify'
          ? 'Confirmation saved, but the public report is not currently available.'
          : 'Review decision saved.',
      );
      onChanged();
    } catch {
      setError('Could not save the review. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  const actions = detail.allowedReviewActions;
  const canReopen = detail.canReviewReport &&
    ['rejected', 'could_not_confirm'].includes(detail.lifecycle.primaryStage);
  const publicationPhotos = (publicationReview?.media ?? [])
    .filter((item) => item.type === 'photo')
    .map((item) => ({
      mediaId: item.mediaId,
      previewUrl: item.safeThumbnailUrl ?? item.safeDisplayUrl ??
        detail.media.find((attachment) => attachment.id === item.mediaId)?.thumbnailUrl ??
        detail.media.find((attachment) => attachment.id === item.mediaId)?.url ?? null,
      fullSizeUrl: item.safeDisplayUrl ?? item.privateDisplayUrl ??
        detail.media.find((attachment) => attachment.id === item.mediaId)?.url ?? null,
      verified: item.safeCopyVerified,
      publicApproved: item.isPublicApproved,
    }));
  const initialSelectedPhotoIds = (publicationReview?.media ?? [])
    .filter((item) => item.type === 'photo' && item.isPublicApproved &&
      Boolean(item.safeDisplayUrl || item.privateDisplayUrl))
    .map((item) => item.mediaId)
    .sort();
  const currentSelectedPhotoIds = [...selectedPhotoMediaIds].sort();
  const publicationDisclosureChanged = Boolean(publicationReview && (
    approveReporterName !== publicationReview.reporterNameApproved ||
    approveReporterAvatar !== publicationReview.reporterAvatarApproved ||
    approveExactLocation !== publicationReview.exactLocationApproved ||
    markSensitive !== publicationReview.isSensitive ||
    initialSelectedPhotoIds.length !== currentSelectedPhotoIds.length ||
    initialSelectedPhotoIds.some((mediaId, index) => mediaId !== currentSelectedPhotoIds[index])
  ));
  if (actions.length === 0 && !canReopen) return null;
  const needsClaim = actions.includes('claim') || actions.includes('take_over');
  if (stage === 'claim' && !needsClaim) return null;
  if (stage === 'decision' && needsClaim) return null;
  return (
    <View style={operationStyles.section}>
      {actions.includes('claim')
        ? (
          <>
            <Text style={operationStyles.caption}>
              Take responsibility for this review. This does not confirm the
              incident.
            </Text>
            <WorkflowButton
              label='Take for review'
              disabled={busy}
              onPress={() => void run('claim')}
            />
          </>
        )
        : (
          <>
            {detail.reviewClaimedById &&
              detail.reviewClaimedById !== currentUserId &&
              detail.lifecycleFacts.reviewOutcome === 'pending' && (
              <Text style={operationStyles.caption}>
                {'Being reviewed by ' +
                  (detail.lifecycleFacts.reviewClaimedByName ?? 'a colleague')}
                {detail.lifecycleFacts.reviewClaimedAt
                  ? ' - ' +
                    formatOperationTimestamp(
                      detail.lifecycleFacts.reviewClaimedAt,
                    )
                  : ''}
              </Text>
            )}
            {actions.includes('take_over')
              ? (
                <WorkflowButton
                  label='Take over review'
                  disabled={busy}
                  onPress={() =>
                    Alert.alert(
                      'Take over review?',
                      'This report is being reviewed by ' +
                        (detail.lifecycleFacts.reviewClaimedByName ??
                          'a colleague') +
                        '.',
                      [{ text: 'Cancel', style: 'cancel' }, {
                        text: 'Take over',
                        onPress: () => void run('take_over'),
                      }],
                    )}
                />
              )
              : (
                <WorkflowButton
                  label={canReopen ? 'Reopen review' : 'Make a review decision'}
                  onPress={() => setOpen(true)}
                  disabled={busy}
                />
              )}
          </>
        )}
      {actions.includes('link') && (
        <WorkflowActionRow
          title='Find a related incident'
          description='Link only if this is the same incident'
          icon='link-outline'
          onPress={onOpenLinkSheet}
          disabled={busy}
        />
      )}
      <WorkflowFeedback busy={busy} error={open ? null : error} />
      <ResourceFormSheet
        visible={open}
        title={canReopen ? 'Reopen review' : 'Review decision'}
        hasUnsavedChanges={Boolean(
          note.trim() || publicationAcknowledged || sensitivityReason.trim() || publicationDisclosureChanged
        )}
        discardMessage='Your unfinished review details will not be saved.'
        onClose={() => {
          if (!busy) {
            setOpen(false);
            setNote('');
            setDecision(null);
            setPublicationReview(null);
            setPublicationError(null);
            setFieldErrors({});
            setError(null);
          }
        }}
        stableHeight
      >
        {!canReopen && (
          <WorkflowChoices
            compact
            label='What did you find?'
            values={decisions.filter((option) =>
              actions.includes(option.value)
            )}
            selected={decision}
            disabled={busy}
            onSelect={(value) => {
              if (value === decision) return;
              setDecision(value);
              if (value === 'verify') {
                setPublicationReview(null);
                setPublicationLoading(true);
                setPublicationError(null);
              }
              setReason(null);
              setFieldErrors({});
              setError(null);
              setPublicationOperationId(randomUuid());
            }}
          />
        )}
        {decision === 'verify' && !canReopen ? (
          <>
            <WorkflowFeedback busy={publicationLoading} error={publicationError} />
            {publicationError && !publicationLoading ? (
              <WorkflowButton
                secondary
                label='Retry publication review'
                disabled={busy}
                onPress={() => {
                  setPublicationReview(null);
                  setPublicationLoading(true);
                  setPublicationError(null);
                  setPublicationLoadAttempt((attempt) => attempt + 1);
                }}
              />
            ) : null}
            {publicationReview ? (
              <ReportPublicationFields
                sourceTitle={publicationReview.sourceTitle}
                sourceDescription={publicationReview.sourceDescription}
                acknowledged={publicationAcknowledged}
                onAcknowledgedChange={(value) => {
                  setPublicationAcknowledged(value);
                  setPublicationOperationId(randomUuid());
                }}
                photos={publicationPhotos}
                photoError={publicationReview.photoError}
                selectedPhotoMediaIds={selectedPhotoMediaIds}
                onPhotoSelectionChange={(mediaIds) => {
                  setSelectedPhotoMediaIds(mediaIds);
                  setPublicationOperationId(randomUuid());
                }}
                reporterNameAllowed={publicationReview.showReporterName}
                approveReporterName={approveReporterName}
                onApproveReporterNameChange={(value) => {
                  setApproveReporterName(value);
                  setPublicationOperationId(randomUuid());
                }}
                reporterAvatarAllowed={publicationReview.showReporterAvatar}
                approveReporterAvatar={approveReporterAvatar}
                onApproveReporterAvatarChange={(value) => {
                  setApproveReporterAvatar(value);
                  setPublicationOperationId(randomUuid());
                }}
                exactLocationAllowed={publicationReview.allowExactLocation}
                approveExactLocation={approveExactLocation}
                onApproveExactLocationChange={(value) => {
                  setApproveExactLocation(value);
                  setPublicationOperationId(randomUuid());
                }}
                sensitive={markSensitive}
                onSensitiveChange={(value) => {
                  setMarkSensitive(value);
                  setPublicationOperationId(randomUuid());
                }}
                sensitivityReason={sensitivityReason}
                onSensitivityReasonChange={(value) => {
                  setSensitivityReason(value);
                  setPublicationOperationId(randomUuid());
                }}
                disabled={busy || publicationLoading}
              />
            ) : null}
          </>
        ) : null}
        {decision === 'reject' && (
          <WorkflowChoices
            compact
            label='Reason'
            selected={reason}
            error={fieldErrors.reason}
            onSelect={(value) => {
              setReason(value);
              setFieldErrors({});
              setPublicationOperationId(randomUuid());
            }}
            disabled={busy}
            values={[
              { value: 'test_or_spam', label: 'Test or spam' },
              { value: 'not_an_emergency_incident', label: 'Not an emergency' },
              {
                value: 'outside_approved_type',
                label: 'Outside incident types',
              },
              { value: 'abusive_content', label: 'Abusive content' },
              {
                value: 'insufficient_location',
                label: 'Insufficient location',
              },
              { value: 'other', label: 'Other' },
            ]}
          />
        )}
        {(canReopen || decision) && (
          <WorkflowNote
            label={canReopen
              ? 'Reason for reopening'
              : 'Evidence reviewed / reason'}
            value={note}
            error={fieldErrors.note}
            onChange={(value) => {
              setNote(value);
              setFieldErrors((current) => ({ ...current, note: undefined }));
              setPublicationOperationId(randomUuid());
            }}
            disabled={busy}
            scrollEnabled={false}
          />
        )}
        <WorkflowFeedback busy={busy} error={error} />
        {(decision || canReopen) && (
          <WorkflowButton
            label={canReopen ? 'Reopen report' : 'Save decision'}
            danger={decision === 'reject'}
            disabled={busy || (decision === 'verify' && (publicationLoading || !publicationReview))}
            onPress={() =>
              Alert.alert(
                canReopen ? 'Reopen this report?' : 'Save this decision?',
                canReopen
                  ? 'The report will return to your review queue.'
                  : decisions.find((option) => option.value === decision)
                    ?.label,
                [{ text: 'Cancel', style: 'cancel' }, {
                  text: 'Save',
                  onPress: () => void run(canReopen ? 'reopen' : decision!),
                }],
              )}
          />
        )}
        {actions.includes('release') && (
          <TouchableOpacity
            style={operationStyles.quietAction}
            disabled={busy}
            onPress={() =>
              Alert.alert(
                'Release this review?',
                'Another officer in your office can claim this report.',
                [{ text: 'Cancel', style: 'cancel' }, {
                  text: 'Release',
                  onPress: () => void run('release'),
                }],
              )}
          >
            <Text style={operationStyles.quietActionText}>
              Release to another officer
            </Text>
          </TouchableOpacity>
        )}
      </ResourceFormSheet>
    </View>
  );
}
