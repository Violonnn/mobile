import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  addPublicSummary,
  type IncidentAction,
  type IncidentCaseDetail,
  recordIncidentFinding,
  reopenIncident,
  requestMunicipalSupport,
} from '../../lib/incidentCases';
import type { OfficialKind } from '../../lib/officialReports';
import { reportOperationsStyles as operationStyles } from '../../styles/components/reportOperations.styles';
import ResourceFormSheet from './ResourceFormSheet';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import {
  WorkflowActionRow,
  WorkflowButton,
  WorkflowChoices,
  WorkflowFeedback,
  WorkflowHistoryRow,
  WorkflowNote,
} from './WorkflowForm';
import ProgressUpdateComposer from './ProgressUpdateComposer';
import ResolveIncidentSheet from './ResolveIncidentSheet';
import ResponseEventSheet from './ResponseEventSheet';
import OperationTimelineStep from './OperationTimelineStep';
import SupportRequestCard from './SupportRequestCard';
import IncidentPublicationPanel from './IncidentPublicationPanel';
import ReportPublicationFields from './ReportPublicationFields';
import {
  getOfficialReportPublicationReview,
  type OfficialReportPublicationReview,
} from '../../lib/reportPublication';
import { randomUuid } from '../../lib/reportMedia';

type FindingPublicationDraft = {
  acknowledged: boolean;
  photoMediaIds: string[];
  approveReporterName: boolean;
  approveReporterAvatar: boolean;
  approveExactLocation: boolean;
};

export default function IncidentCasePanel(
  {
    incident,
    viewerKind,
    allowedActions,
    onChanged,
    currentReportId,
    onLogActivity,
    assessmentRequested = false,
  }: {
    incident: IncidentCaseDetail;
    onLogActivity?: () => void;
    assessmentRequested?: boolean;
    currentReportId?: string;
    viewerKind: OfficialKind;
    allowedActions: IncidentAction[];
    onChanged: () => void;
  },
) {
  const router = useRouter();
  const [task, setTask] = useState<
    | 'finding'
    | 'coordination'
    | 'summary'
    | 'reopen'
    | 'progress'
    | 'requests'
    | 'history'
    | 'publication'
    | null
  >(null);
  const [note, setNote] = useState('');
  const [publicText, setPublicText] = useState('');
  const [choice, setChoice] = useState<'local' | 'support' | 'transfer'>(
    'local',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    { note?: string; publicText?: string }
  >({});
  const [eventVisible, setEventVisible] = useState(false);
  const [resolveVisible, setResolveVisible] = useState(false);
  const [findingReviews, setFindingReviews] = useState<OfficialReportPublicationReview[]>([]);
  const [findingDrafts, setFindingDrafts] = useState<Record<string, FindingPublicationDraft>>({});
  const [findingPublicationLoading, setFindingPublicationLoading] = useState(false);
  const [findingOperationId, setFindingOperationId] = useState(randomUuid);
  const [markIncidentSensitive, setMarkIncidentSensitive] = useState(incident.isSensitive);
  const [sensitivityReason, setSensitivityReason] = useState('');

  useEffect(() => {
    if (task !== 'finding') return;
    let active = true;
    const reportIds = [...new Set([incident.sourceReportId, currentReportId].filter((id): id is string => Boolean(id)))];
    void Promise.all(reportIds.map((reportId) => getOfficialReportPublicationReview(reportId)))
      .then((results) => {
        if (!active) return;
        const failed = results.find((result) => result.error || !result.review);
        if (failed) {
          setError(failed.error ?? 'Could not load every report’s publication review.');
          return;
        }
        const reviews = results.flatMap((result) => result.review ? [result.review] : []);
        setFindingReviews(reviews);
        setFindingDrafts(Object.fromEntries(reviews.map((review) => [review.reportId, {
          acknowledged: false,
          photoMediaIds: review.media.filter((item) => item.type === 'photo' && item.isPublicApproved && Boolean(item.safeDisplayUrl || item.privateDisplayUrl)).map((item) => item.mediaId),
          approveReporterName: review.reporterNameApproved,
          approveReporterAvatar: review.reporterAvatarApproved,
          approveExactLocation: review.exactLocationApproved,
        }])));
        setMarkIncidentSensitive(incident.isSensitive);
        setSensitivityReason('');
        setFindingOperationId(randomUuid());
      }).catch(() => {
        if (active) setError('Could not load publication review details. Try again.');
      }).finally(() => {
        if (active) setFindingPublicationLoading(false);
      });
    return () => {
      active = false;
    };
  }, [task, incident.id, incident.sourceReportId, incident.isSensitive, currentReportId]);

  function editFindingDraft(reportId: string, patch: Partial<FindingPublicationDraft>) {
    setFindingDrafts((current) => ({
      ...current,
      [reportId]: { ...current[reportId], ...patch },
    }));
    setFindingOperationId(randomUuid());
  }
  async function save(
    action: 'confirmed' | 'not_confirmed' | 'request' | 'reopen' | 'summary',
  ) {
    if (busy) return;
    setFieldErrors({});
    setError(null);
    if (action !== 'summary' && !note.trim()) {
      setFieldErrors({ note: 'Add an internal reason or finding note.' });
      return;
    }
    if (
      (action === 'summary' ||
        (action === 'not_confirmed' &&
          incident.verification === 'confirmed')) && !publicText.trim()
    ) {
      setFieldErrors({ publicText: 'Add the public summary or correction.' });
      return;
    }
    if (action === 'confirmed' && markIncidentSensitive && !sensitivityReason.trim()) {
      setError('Add a safety reason before marking this incident sensitive.');
      return;
    }
    if (action === 'confirmed' && !markIncidentSensitive) {
      if (findingPublicationLoading || findingReviews.length === 0) {
        setError('Load the source report’s publication review before confirming.');
        return;
      }
      if (findingReviews.some((review) => {
        const draft = findingDrafts[review.reportId];
        return !draft?.acknowledged;
      })) {
        setError('Review every report’s text and selected photos before confirming.');
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      let result: { error: string | null; publicAvailable?: boolean; publicationStatus?: string | null };
      if (action === 'request') {
        result = await requestMunicipalSupport({
          incidentCaseId: incident.id,
          kind: choice === 'transfer' ? 'transfer' : 'support',
          note,
        });
      } else if (action === 'reopen') {
        result = await reopenIncident({
          incidentCaseId: incident.id,
          reason: note,
        });
      } else if (action === 'summary') {
        result = await addPublicSummary({
          incidentCaseId: incident.id,
          publicSummary: publicText,
        });
      } else {
        result = await recordIncidentFinding({
          incidentCaseId: incident.id,
          finding: action,
          note,
          publicCorrection: publicText || null,
          operationId: findingOperationId,
          reportPublications: action === 'confirmed' && !markIncidentSensitive
            ? findingReviews.map((review) => {
              const draft = findingDrafts[review.reportId];
              return {
                reportId: review.reportId,
                publish: true,
                publicationAcknowledged: draft.acknowledged,
                approveReporterName: draft.approveReporterName,
                approveReporterAvatar: draft.approveReporterAvatar,
                approveExactLocation: draft.approveExactLocation,
                photoMediaIds: draft.photoMediaIds,
              };
            })
            : [],
          markIncidentSensitive: action === 'confirmed' && markIncidentSensitive,
          sensitivityReason: action === 'confirmed' && markIncidentSensitive ? sensitivityReason : null,
        });
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      setNote('');
      setPublicText('');
      setTask(null);
      if (action === 'confirmed') {
        Alert.alert(
          'Field finding recorded',
          markIncidentSensitive
            ? 'The incident is marked sensitive. Public details and photos remain hidden.'
            : result.publicAvailable
            ? 'The incident is confirmed and its screened report posts are public.'
            : result.publicationStatus === 'awaiting_lead_review'
            ? 'The finding was recorded. A lead office must review the public report.'
            : 'The finding was recorded, but a public report is not currently available.',
        );
      }
      onChanged();
    } catch {
      setError('Could not update this incident. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  const taskTitles = {
    finding: 'Record field finding',
    coordination: 'Response coordination',
    summary: 'Add outcome summary',
    reopen: 'Reopen incident',
    progress: 'Public progress update',
    requests: 'Support & transfer requests',
    history: 'Incident activity',
    publication: 'Public visibility',
  };
  function changed() {
    setTask(null);
    onChanged();
  }
  const sortedEvents = [...incident.events].sort((first, second) => {
    const firstTime = Date.parse(first.occurredAt || first.createdAt) || 0;
    const secondTime = Date.parse(second.occurredAt || second.createdAt) || 0;
    return secondTime - firstTime;
  });
  function historyRow(event: IncidentCaseDetail['events'][number]) {
    return (
      <WorkflowHistoryRow
        key={event.id}
        title={event.eventType.replace(/_/g, ' ')}
        eventType={event.eventType}
        timestamp={event.occurredAt || event.createdAt}
        actorName={event.actorName}
        officeLabel={event.officeLabel}
        details={event.details}
        publicText={event.publicText}
        note={event.note}
      />
    );
  }
  const active = incident.state === 'active';
  const needsFinding = active &&
    (incident.verification === 'pending' ||
      (incident.leadOffice === 'municipal' &&
        incident.municipalFinding === null));
  const readyToResolve = active && allowedActions.includes('resolve');
  const currentPhase = !active
    ? null
    : needsFinding
    ? 'assessment'
    : 'response';
  const showAssessment = needsFinding || assessmentRequested ||
    incident.events.some((event) =>
      event.eventType === 'finding_recorded' || event.eventType === 'withdrawn'
    );
  const showResponse = incident.verification === 'confirmed' ||
    incident.confirmedAt != null;
  const leadLabel = incident.leadOffice === 'municipal'
    ? 'MDRRMO'
    : 'Brgy. ' + (incident.barangayName ?? 'assigned barangay') + ' BDRRMO';
  const coordinationLabel = {
    local: 'Local response',
    support_requested: 'Support requested - awaiting acceptance',
    support_active: 'Support active',
    transfer_requested: 'Transfer requested - current lead remains in charge',
    municipal_lead: 'Municipal lead',
  }[incident.coordination];
  function activityEntry() {
    if (!active || !allowedActions.includes('log_event')) return null;
    return (
      <WorkflowActionRow
        title='Record activity'
        icon='create-outline'
        onPress={onLogActivity ?? (() => setEventVisible(true))}
      />
    );
  }
  function coordinationTools() {
    return (
      <>
        {incident.publicCorrection && (
          <Text style={styles.subtitle}>
            Public correction: {incident.publicCorrection}
          </Text>
        )}
        {incident.publicSummary && (
          <Text style={operationStyles.caption}>
            Previous outcome: {incident.publicSummary}
          </Text>
        )}
        <Text style={operationStyles.caption}>
          Lead: {leadLabel}. {coordinationLabel}.
        </Text>
        {(allowedActions.includes('request_support') ||
          allowedActions.includes('request_transfer')) && (
          <WorkflowActionRow
            title='Coordinate response'
            description='Request support or transfer the lead'
            icon='people-outline'
            onPress={() => setTask('coordination')}
          />
        )}
        {incident.supportRequests.length > 0 && (
          <WorkflowActionRow
            title='Support & transfer requests'
            description={String(
              incident.supportRequests.filter((request) =>
                request.status === 'requested'
              ).length,
            ) + ' awaiting a response'}
            icon='swap-horizontal-outline'
            onPress={() => setTask('requests')}
          />
        )}
        {allowedActions.includes('post_progress') &&
          incident.verification === 'confirmed' && (
          <WorkflowActionRow
            title='Post a public update'
            icon='megaphone-outline'
            onPress={() => setTask('progress')}
          />
        )}
      </>
    );
  }
  return (
    <>
      {showAssessment && (
        <OperationTimelineStep
          title='Field assessment'
          summary={active && needsFinding
            ? (incident.verification === 'pending'
              ? 'Assess the incident; it is not yet confirmed'
              : 'Record the municipal finding')
            : incident.verification === 'not_confirmed'
            ? 'Assessment closed without confirmation'
            : 'Assessment recorded'}
          icon='search-outline'
          current={currentPhase === 'assessment'}
          last={!showResponse && active}
          collapsible={active && needsFinding}
        >
          {currentPhase === 'assessment' && (
            <>
              {allowedActions.includes('record_finding')
                ? (
                  <WorkflowButton
                    label='Record field finding'
                    onPress={() => {
                      setFindingPublicationLoading(true);
                      setFindingReviews([]);
                      setFindingDrafts({});
                      setError(null);
                      setTask('finding');
                    }}
                  />
                )
                : (
                  <Text style={operationStyles.caption}>
                    {leadLabel} is responsible for recording the field finding.
                  </Text>
                )}
              {coordinationTools()}
              {activityEntry()}
            </>
          )}
        </OperationTimelineStep>
      )}
      {showResponse && (
        <OperationTimelineStep
          title='Incident response'
          summary={incident.verification === 'not_confirmed'
            ? 'Previous confirmation withdrawn'
            : incident.hasQualifyingResponseAction
            ? 'Response action recorded'
            : 'Confirmed incident - no response action recorded'}
          icon='people-outline'
          current={currentPhase === 'response'}
          last={active && !readyToResolve}
        >
          {currentPhase === 'response'
            ? (
              <>
                {coordinationTools()}
                {!allowedActions.includes('request_support') &&
                  !allowedActions.includes('request_transfer') &&
                  !allowedActions.includes('resolve') && (
                  <Text style={operationStyles.caption}>
                    {leadLabel} manages response coordination and resolution.
                  </Text>
                )}
                {activityEntry()}
              </>
            )
            : (
              <Text style={operationStyles.caption}>
                Lead: {leadLabel}. {coordinationLabel}.
              </Text>
            )}
        </OperationTimelineStep>
      )}
      {(readyToResolve || !active) && (
        <OperationTimelineStep
          title={active ? 'Resolution' : 'Outcome'}
          summary={active
            ? 'Record the outcome when response is complete'
            : incident.state === 'resolved'
            ? 'Incident resolved'
            : 'Incident closed'}
          icon='checkmark-done-outline'
          last
          collapsible={false}
        >
          {incident.publicCorrection && (
            <Text style={styles.subtitle}>
              Correction: {incident.publicCorrection}
            </Text>
          )}
          {incident.publicSummary && (
            <Text style={styles.subtitle}>{incident.publicSummary}</Text>
          )}
          {readyToResolve && (
            <>
              <WorkflowButton
                label='Resolve incident'
                onPress={() => setResolveVisible(true)}
              />
            </>
          )}
          {allowedActions.includes('add_public_summary') && (
            <WorkflowActionRow
              title='Add outcome summary'
              icon='document-text-outline'
              onPress={() => setTask('summary')}
            />
          )}
          {allowedActions.includes('reopen') && (
            <WorkflowActionRow
              title='Reopen incident'
              icon='refresh-outline'
              onPress={() => setTask('reopen')}
            />
          )}
        </OperationTimelineStep>
      )}
      <OperationTimelineStep
        title='Incident history'
        collapsible={false}
        summary={String(incident.events.length) + ' recorded events'}
        icon='time-outline'
        utility
      >
        {sortedEvents.length === 0 && (
          <Text style={operationStyles.caption}>No activity recorded yet.</Text>
        )}
        {sortedEvents.slice(0, 3).map(historyRow)}
        {sortedEvents.length > 0 && (
          <WorkflowActionRow
            title='View all incident activity'
            icon='time-outline'
            onPress={() => setTask('history')}
          />
        )}
        {currentReportId && currentReportId !== incident.sourceReportId && (
          <WorkflowActionRow
            title='View source report'
            description='This report is linked to an incident'
            icon='link-outline'
            onPress={() =>
              router.push({
                pathname: '/official/[id]',
                params: { id: incident.sourceReportId },
              })}
          />
        )}
        {!active && incident.supportRequests.length > 0 && (
          <WorkflowActionRow
            title='Support & transfer history'
            icon='swap-horizontal-outline'
            onPress={() => setTask('requests')}
          />
        )}
      </OperationTimelineStep>
      {allowedActions.includes('publish_photo') && <WorkflowActionRow title='Public visibility' description='Review photo, location, and sensitive-case settings' icon='eye-outline' onPress={() => setTask('publication')} />}
      <ResourceFormSheet
        visible={task !== null}
        title={task ? taskTitles[task] : 'Incident response'}
        hasUnsavedChanges={Boolean(note.trim() || publicText.trim() || Object.values(findingDrafts).some((draft) => draft.acknowledged || draft.photoMediaIds.length > 0))}
        discardMessage='Your unfinished incident notes and screened report copies will not be saved.'
        onClose={() => {
          if (!busy) {
            setTask(null);
            setFindingPublicationLoading(false);
            setFieldErrors({});
            setError(null);
            setNote('');
            setPublicText('');
            setChoice('local');
          }
        }}
        stableHeight
      >
        {task === 'publication' && <IncidentPublicationPanel key={incident.id + String(incident.isSensitive) + incident.publicLocationMode} incident={incident} currentReportId={currentReportId} onChanged={onChanged} />}
        {task === 'coordination' && (
          <>
            <Text style={operationStyles.caption}>
              Support keeps your office in charge. A transfer changes the lead
              only after MDRRMO accepts.
            </Text>
            <WorkflowChoices
              compact
              label='Next step'
              selected={choice}
              onSelect={(value) => {
                setChoice(value);
                setFieldErrors({});
              }}
              disabled={busy}
              values={[
                { value: 'local', label: 'Respond locally' },
                ...(allowedActions.includes('request_support')
                  ? [{ value: 'support' as const, label: 'Request support' }]
                  : []),
                ...(allowedActions.includes('request_transfer')
                  ? [{ value: 'transfer' as const, label: 'Transfer lead' }]
                  : []),
              ]}
            />
          </>
        )}
        {(task === 'finding' || task === 'reopen' ||
          (task === 'coordination' && choice !== 'local')) && (
          <WorkflowNote
            label={task === 'finding' ? 'Field finding / evidence' : 'Reason'}
            value={note}
            error={fieldErrors.note}
            onChange={(value) => {
              setNote(value);
              setFieldErrors((current) => ({ ...current, note: undefined }));
              if (task === 'finding') setFindingOperationId(randomUuid());
            }}
            disabled={busy}
            scrollEnabled={false}
          />
        )}
        {task === 'finding' ? (
          <>
            <WorkflowFeedback busy={findingPublicationLoading} error={null} />
            {findingReviews.map((review, index) => {
              const draft = findingDrafts[review.reportId];
              if (!draft) return null;
              const reportMedia = incident.media;
              return (
                <View key={review.reportId} style={styles.card}>
                  <Text style={styles.subtitle}>
                    Screen public copy for {review.reportId === incident.sourceReportId ? 'the source report' : 'this linked report'}
                  </Text>
                  <ReportPublicationFields
                    sourceTitle={review.sourceTitle}
                    sourceDescription={review.sourceDescription}
                    acknowledged={draft.acknowledged}
                    onAcknowledgedChange={(value) => editFindingDraft(review.reportId, { acknowledged: value })}
                    photos={review.media.filter((item) => item.type === 'photo').map((item) => {
                      const attachment = reportMedia.find((mediaItem) => mediaItem.id === item.mediaId && mediaItem.reportId === review.reportId);
                      return {
                        mediaId: item.mediaId,
                        previewUrl: item.safeThumbnailUrl ?? item.privateThumbnailUrl ?? item.safeDisplayUrl ?? item.privateDisplayUrl ?? attachment?.thumbnailUrl ?? attachment?.url ?? null,
                        fullSizeUrl: item.safeDisplayUrl ?? item.privateDisplayUrl ?? attachment?.url ?? null,
                        verified: item.safeCopyVerified,
                        publicApproved: item.isPublicApproved,
                      };
                    })}
                    photoError={review.photoError}
                    selectedPhotoMediaIds={draft.photoMediaIds}
                    onPhotoSelectionChange={(mediaIds) => editFindingDraft(review.reportId, { photoMediaIds: mediaIds })}
                    reporterNameAllowed={review.showReporterName}
                    approveReporterName={draft.approveReporterName}
                    onApproveReporterNameChange={(value) => editFindingDraft(review.reportId, { approveReporterName: value })}
                    reporterAvatarAllowed={review.showReporterAvatar}
                    approveReporterAvatar={draft.approveReporterAvatar}
                    onApproveReporterAvatarChange={(value) => editFindingDraft(review.reportId, { approveReporterAvatar: value })}
                    exactLocationAllowed={review.allowExactLocation}
                    approveExactLocation={draft.approveExactLocation}
                    onApproveExactLocationChange={(value) => editFindingDraft(review.reportId, { approveExactLocation: value })}
                    sensitive={markIncidentSensitive}
                    onSensitiveChange={(value) => {
                      setMarkIncidentSensitive(value);
                      setFindingOperationId(randomUuid());
                      if (value) {
                        setFindingDrafts((current) => Object.fromEntries(Object.entries(current).map(([reportId, reportDraft]) => [
                          reportId,
                          { ...reportDraft, acknowledged: false, photoMediaIds: [] },
                        ])));
                      }
                    }}
                    sensitivityReason={sensitivityReason}
                    onSensitivityReasonChange={(value) => {
                      setSensitivityReason(value);
                      setFindingOperationId(randomUuid());
                    }}
                    showSensitiveChoice={index === 0}
                    showSensitiveReason={index === 0}
                    disabled={busy || findingPublicationLoading}
                  />
                </View>
              );
            })}
            {markIncidentSensitive && findingReviews.length === 0 ? (
              <WorkflowNote
                label='Safety reason (internal)'
                value={sensitivityReason}
                onChange={(value) => {
                  setSensitivityReason(value);
                  setFindingOperationId(randomUuid());
                }}
                disabled={busy || findingPublicationLoading}
                scrollEnabled={false}
              />
            ) : null}
          </>
        ) : null}
        {(task === 'summary' ||
          (task === 'finding' && incident.verification === 'confirmed')) && (
          <WorkflowNote
            label={task === 'summary'
              ? 'Public outcome summary'
              : 'Public correction (required if not confirmed)'}
            value={publicText}
            error={fieldErrors.publicText}
            onChange={(value) => {
              setPublicText(value);
              setFieldErrors((current) => ({
                ...current,
                publicText: undefined,
              }));
              if (task === 'finding') setFindingOperationId(randomUuid());
            }}
            maxLength={280}
            disabled={busy}
            scrollEnabled={false}
          />
        )}
        {task === 'finding' && (
          <>
            <WorkflowButton
              label='Confirmed on site'
              disabled={busy || findingPublicationLoading || (!markIncidentSensitive && findingReviews.length === 0)}
              onPress={() => void save('confirmed')}
            />
            <WorkflowButton
              label='Not confirmed'
              danger
              disabled={busy}
              onPress={() =>
                Alert.alert(
                  'Record not confirmed?',
                  incident.verification === 'confirmed'
                    ? 'This withdraws the public incident and publishes your correction.'
                    : 'This closes the assessment as not confirmed.',
                  [{ text: 'Cancel', style: 'cancel' }, {
                    text: 'Record finding',
                    style: 'destructive',
                    onPress: () => void save('not_confirmed'),
                  }],
                )}
            />
          </>
        )}
        {task === 'coordination' && choice === 'local' && (
          <Text style={operationStyles.caption}>
            Your office remains the lead. Record response actions as they
            happen.
          </Text>
        )}
        {task === 'coordination' && choice !== 'local' && (
          <WorkflowButton
            label='Send request'
            disabled={busy}
            onPress={() => void save('request')}
          />
        )}
        {task === 'summary' && (
          <WorkflowButton
            label='Save outcome summary'
            disabled={busy || !publicText.trim()}
            onPress={() => void save('summary')}
          />
        )}
        {task === 'reopen' && (
          <WorkflowButton
            label='Reopen incident'
            disabled={busy || !note.trim()}
            onPress={() => void save('reopen')}
          />
        )}
        {task === 'requests' &&
          incident.supportRequests.map((request) => (
            <SupportRequestCard
              key={request.id}
              request={request}
              viewerKind={viewerKind}
              canAct={allowedActions.includes('respond_request') ||
                allowedActions.includes('cancel_request')}
              onChanged={changed}
            />
          ))}
        {task === 'progress' && (
          <ProgressUpdateComposer
            incidentCaseId={incident.id}
            disabledReason={incident.verification !== 'confirmed'
              ? 'Public updates are available after confirmation.'
              : null}
            onPosted={changed}
          />
        )}
        {task === 'history' && (
          <>
            {incident.events.length === 0 && (
              <Text style={operationStyles.caption}>
                No activity recorded yet.
              </Text>
            )}
            {sortedEvents.map(historyRow)}
          </>
        )}
        <WorkflowFeedback busy={busy} error={error} />
      </ResourceFormSheet>
      <ResponseEventSheet
        visible={eventVisible}
        target={{ incidentCaseId: incident.id }}
        onClose={() => setEventVisible(false)}
        onLogged={onChanged}
      />
      <ResolveIncidentSheet
        visible={resolveVisible}
        incidentCaseId={incident.id}
        onClose={() => setResolveVisible(false)}
        onResolved={onChanged}
      />
    </>
  );
}
