import React, { useState } from 'react';
import { Image as NativeImage, ScrollView, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { isDemoAuthEnabled } from '../../lib/demoAuth';
import type { ResponseEventType } from '../../lib/officialReports';
import { callOutcomeFeedback } from '../../lib/reportContactFlow';
import WorkflowToast from '../../components/official/WorkflowToast';
import OperationTimelineStep from '../../components/official/OperationTimelineStep';
import ResponseEventSheet from '../../components/official/ResponseEventSheet';
import ResourceFormSheet from '../../components/official/ResourceFormSheet';
import ReportPublicationFields from '../../components/official/ReportPublicationFields';
import ReportBarangayPicker from '../../components/report/ReportBarangayPicker';
import {
  WorkflowActionRow,
  WorkflowButton,
  WorkflowChoices,
} from '../../components/official/WorkflowForm';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { reportOperationsStyles as operationStyles } from '../../styles/components/reportOperations.styles';

/** Local presentation fixtures. Every action stays in component state; no calls or RPCs. */
export default function OperationsPreviewScreen() {
  const insets = useSafeAreaInsets();
  const [reminderHeight, setReminderHeight] = useState(0);
  const [phase, setPhase] = useState<
    'unclaimed' | 'review' | 'assessment' | 'response' | 'resolved'
  >('unclaimed');
  const [assessmentRequested, setAssessmentRequested] = useState(false);
  const claimed = phase === 'review';
  const pending = phase === 'unclaimed' || claimed;
  const [success, setSuccess] = useState<string | null>(null);
  const [successVersion, setSuccessVersion] = useState(0);
  function showSuccess(message: string | null) {
    setSuccess(message);
    if (message) setSuccessVersion((version) => version + 1);
  }
  const [sheet, setSheet] = useState<
    'activity' | 'reporter' | 'hotline' | 'review' | null
  >(null);
  const [decision, setDecision] = useState<
    'confirm' | 'assess' | null
  >(null);
  const [publicationAcknowledged, setPublicationAcknowledged] = useState(false);
  const [selectedPhotoMediaIds, setSelectedPhotoMediaIds] = useState(['photo-selected']);
  const [approveReporterName, setApproveReporterName] = useState(true);
  const [approveReporterAvatar, setApproveReporterAvatar] = useState(false);
  const [approveExactLocation, setApproveExactLocation] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [sensitivityReason, setSensitivityReason] = useState('');
  const [picker, setPicker] = useState(false);
  const [barangay, setBarangay] = useState('1');
  if (!isDemoAuthEnabled()) return null;
  const previewPhotoUri = NativeImage.resolveAssetSource(
    require('../../tests/fixtures/public-photo.jpg'),
  )?.uri ?? '';
  const initialType: ResponseEventType | undefined = sheet === 'reporter'
    ? 'reporter_call'
    : sheet === 'hotline'
    ? 'hotline_contacted'
    : undefined;
  return (
    <SafeAreaView style={styles.container}>
      {claimed && (
        <View
          style={operationStyles.claimReminder}
          onLayout={(event) =>
            setReminderHeight(event.nativeEvent.layout.height)}
        >
          <Text
            style={[operationStyles.caption, operationStyles.claimReminderText]}
          >
            You are reviewing this report
          </Text>
        </View>
      )}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps='handled'
      >
        <Text style={styles.title}>Report operations</Text>
        <Text style={operationStyles.caption}>
          LOCAL PREVIEW · fixture data only
        </Text>
        <View style={styles.reportMetaTimeline}>
          <OperationTimelineStep
            title='Review & routing'
            summary='Assigned response office'
            icon='location'
            current={phase === 'unclaimed'}
          >
            {phase === 'unclaimed' && (
              <WorkflowButton
                label='Take for review'
                onPress={() => {
                  setPhase('review');
                  showSuccess('Review claimed.');
                }}
              />
            )}
            <WorkflowActionRow
              title={barangay === '1'
                ? 'Assigned to Calajo-an'
                : 'Assigned to Pakigne'}
              description='Wrong barangay? Change routing'
              icon='location-outline'
              onPress={() => setPicker(true)}
            />
            {phase === 'unclaimed' && (
              <WorkflowActionRow
                title='Record activity'
                icon='create-outline'
                onPress={() => setSheet('activity')}
              />
            )}
          </OperationTimelineStep>
          <OperationTimelineStep
            title='Evidence & contact'
            key={claimed ? 'owned-evidence' : 'unclaimed-evidence'}
            defaultExpanded={pending}
            last={phase === 'unclaimed'}
            summary='Read the report and contact the reporter if needed'
            icon='document-text'
          >
            <Text style={operationStyles.caption}>
              Fixture report: water rising beside the road in Calajo-an.
            </Text>
            <WorkflowActionRow
              title='Call reporter'
              description='Preview outcome only; no dialer opens'
              icon='call-outline'
              onPress={() => setSheet('reporter')}
            />
          </OperationTimelineStep>
          {phase !== 'unclaimed' && (
            <OperationTimelineStep
              title='Review decision'
              current={claimed}
              last={pending}
              summary='Decide from the available evidence; a call is optional'
              icon='checkmark-circle'
            >
              {claimed && (
                <WorkflowButton
                  label='Make a review decision'
                  onPress={() => setSheet('review')}
                />
              )}
              {claimed && (
                <WorkflowActionRow
                  title='Record activity'
                  icon='create-outline'
                  onPress={() => setSheet('activity')}
                />
              )}
            </OperationTimelineStep>
          )}
          {assessmentRequested && !pending && (
            <OperationTimelineStep
              title='Field assessment'
              summary={phase === 'assessment'
                ? 'Assess the incident; it is not yet confirmed'
                : 'Assessment recorded'}
              icon='search-outline'
              current={phase === 'assessment'}
              last={phase === 'assessment'}
              collapsible={phase === 'assessment'}
            >
              {phase === 'assessment' && (
                <>
                  <WorkflowButton
                    label='Record field finding'
                    onPress={() => {
                      setPhase('response');
                      showSuccess('Fixture finding confirmed.');
                    }}
                  />
                  <WorkflowActionRow
                    title='Record activity'
                    icon='create-outline'
                    onPress={() => setSheet('activity')}
                  />
                </>
              )}
            </OperationTimelineStep>
          )}
          {(phase === 'response' || phase === 'resolved') && (
            <OperationTimelineStep
              title='Incident response'
              summary='Confirmed incident - no response action recorded'
              icon='people-outline'
              current={phase === 'response'}
            >
              <Text style={operationStyles.caption}>
                Lead: Calajo-an BDRRMO.
              </Text>
              {phase === 'response' && (
                <>
                  <WorkflowActionRow
                    title='Coordinate response'
                    icon='people-outline'
                    onPress={() => showSuccess('Preview coordination only.')}
                  />
                  <WorkflowActionRow
                    title='Record activity'
                    icon='create-outline'
                    onPress={() => setSheet('activity')}
                  />
                </>
              )}
            </OperationTimelineStep>
          )}
          {(phase === 'response' || phase === 'resolved') && (
            <OperationTimelineStep
              title={phase === 'resolved' ? 'Outcome' : 'Resolution'}
              summary={phase === 'resolved'
                ? 'Incident resolved'
                : 'Record the outcome when response is complete'}
              icon='checkmark-done-outline'
              collapsible={false}
              last
            >
              {phase === 'response'
                ? (
                  <WorkflowButton
                    label='Resolve incident'
                    onPress={() => {
                      setPhase('resolved');
                      showSuccess('Fixture incident resolved.');
                    }}
                  />
                )
                : (
                  <Text style={operationStyles.caption}>
                    Fixture outcome recorded.
                  </Text>
                )}
            </OperationTimelineStep>
          )}
        </View>
        <WorkflowActionRow
          title='Call a response service'
          description='Preview outcome only; no dialer opens'
          icon='call-outline'
          onPress={() => setSheet('hotline')}
        />
        <WorkflowActionRow
          title='Restart fixture'
          icon='refresh-outline'
          onPress={() => {
            setAssessmentRequested(false);
            setPhase('unclaimed');
          }}
        />
      </ScrollView>
      {success && (
        <WorkflowToast
          key={successVersion}
          topOffset={insets.top + (claimed ? reminderHeight : 0)}
          message={success}
          onDismiss={() => showSuccess(null)}
        />
      )}
      <ResponseEventSheet
        visible={sheet === 'activity' || sheet === 'reporter' ||
          sheet === 'hotline'}
        target={pending
          ? { reportId: '00000000-0000-4000-8000-000000000001' }
          : { incidentCaseId: '00000000-0000-4000-8000-000000000002' }}
        initialType={initialType}
        initialDetails={sheet === 'hotline'
          ? { service: 'other', service_other: 'Minglanilla rescue hotline' }
          : undefined}
        saveActivity={async () => ({ error: null })}
        onClose={() => setSheet(null)}
        onLogged={(result) => showSuccess(callOutcomeFeedback(result))}
      />
      <ResourceFormSheet
        visible={sheet === 'review'}
        title='Review decision'
        hasUnsavedChanges={false}
        onClose={() => setSheet(null)}
        stableHeight
      >
        <WorkflowChoices
          compact
          label='What did you find?'
          selected={decision}
          onSelect={setDecision}
          values={[
            { value: 'confirm', label: 'Confirm incident' },
            { value: 'assess', label: 'Needs field assessment' },
          ]}
        />
        {decision === 'confirm' ? (
          <ReportPublicationFields
            sourceTitle='Water rising beside the road'
            sourceDescription='Water is rising near the roadside market in Calajo-an. The road remains open.'
            acknowledged={publicationAcknowledged}
            onAcknowledgedChange={setPublicationAcknowledged}
            photos={[
              { mediaId: 'photo-public', previewUrl: previewPhotoUri, fullSizeUrl: previewPhotoUri, verified: true, publicApproved: true },
              { mediaId: 'photo-selected', previewUrl: previewPhotoUri, fullSizeUrl: previewPhotoUri, verified: false, publicApproved: false },
              { mediaId: 'photo-hidden', previewUrl: previewPhotoUri, fullSizeUrl: previewPhotoUri, verified: true, publicApproved: false },
            ]}
            selectedPhotoMediaIds={selectedPhotoMediaIds}
            onPhotoSelectionChange={setSelectedPhotoMediaIds}
            reporterNameAllowed
            approveReporterName={approveReporterName}
            onApproveReporterNameChange={setApproveReporterName}
            reporterAvatarAllowed
            approveReporterAvatar={approveReporterAvatar}
            onApproveReporterAvatarChange={setApproveReporterAvatar}
            exactLocationAllowed
            approveExactLocation={approveExactLocation}
            onApproveExactLocationChange={setApproveExactLocation}
            sensitive={sensitive}
            onSensitiveChange={setSensitive}
            sensitivityReason={sensitivityReason}
            onSensitivityReasonChange={setSensitivityReason}
          />
        ) : null}
        {decision && (
          <WorkflowButton
            label='Save decision'
            onPress={() => {
              setSheet(null);
              setAssessmentRequested(decision === 'assess');
              setPhase(decision === 'confirm' ? 'response' : 'assessment');
              showSuccess('Preview review decision saved locally. No request was sent.');
            }}
          />
        )}
      </ResourceFormSheet>
      <ReportBarangayPicker
        visible={picker}
        barangays={[{ id: '1', name: 'Calajo-an' }, {
          id: '2',
          name: 'Pakigne',
        }]}
        selectedBarangayId={barangay}
        loading={false}
        error={null}
        onSelect={setBarangay}
        onRetry={() => {}}
        onClose={() => setPicker(false)}
      />
    </SafeAreaView>
  );
}
