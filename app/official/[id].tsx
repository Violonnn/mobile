// app/official/[id].tsx
// Official report detail: content, attribution, timeline, status actions,
// and protected reporter contact (revealed through the audited confirmation flow).

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { colors } from '../../styles/theme';
import { type BarangayOption, fetchBarangays } from '../../lib/barangays';
import {
  getReportLocationAdjustmentLimit,
  type GpsPosition,
} from '../../lib/location';
import { mayorReportStatusLabel } from '../../lib/mayorStatusLabels';
import { goBackOrReplace } from '../../lib/navigation';
import { ReportOperationsSkeleton } from '../../components/ui/OfficialScreenSkeletons';
import { useOfficialPortal } from '../../context/OfficialPortalContext';
import { useOfficialReportDetail } from '../../hooks/useOfficialReports';
import {
  CommunityReportTags,
  MediaCollage,
  ReportMediaPreviewModal,
  statusLabel,
} from '../../components/report/ReportDetailCard';
import {
  formatOperationTimestamp,
  formatPublishedAt,
} from '../../lib/formatTime';
import {
  type ReportStatus,
  type ResponseEventType,
} from '../../lib/officialReports';
import type { ReportMediaAttachment } from '../../lib/reports';
import {
  correctOfficialReportLocation,
  updateOfficialReport,
} from '../../lib/officialReportSubmit';
import { useReportCallFlow } from '../../hooks/useReportCallFlow';
import {
  callOutcomeFeedback,
  hotlineEventDetails,
} from '../../lib/reportContactFlow';
import { reportOperationsStyles as operationStyles } from '../../styles/components/reportOperations.styles';
import { lifecycleColor, officialLabel } from '../../lib/reportLifecycle';
import {
  WorkflowActionRow,
  WorkflowButton,
  WorkflowFeedback,
  WorkflowHistoryRow,
  WorkflowSuccess,
} from '../../components/official/WorkflowForm';
import ResourceFormSheet from '../../components/official/ResourceFormSheet';
import OperationTimelineStep from '../../components/official/OperationTimelineStep';
import ReviewDecisionPanel from '../../components/official/ReviewDecisionPanel';
import JurisdictionCheckPanel, {
  ReportRoutingPanel,
} from '../../components/official/JurisdictionCheckPanel';
import LinkIncidentSheet from '../../components/official/LinkIncidentSheet';
import ResponseEventSheet from '../../components/official/ResponseEventSheet';
import UrgentDangerCard from '../../components/official/UrgentDangerCard';
import WorkflowToast from '../../components/official/WorkflowToast';
import IncidentCasePanel from '../../components/official/IncidentCasePanel';
import IncidentTypeBadge from '../../components/report/IncidentTypeBadge';
import { ReporterAvatar } from '../../components/report/ReporterAvatar';
import ReportBarangayPicker from '../../components/report/ReportBarangayPicker';
import ReportLocationPicker from '../../components/report/ReportLocationPicker';

function statusPillStyle(status: ReportStatus) {
  if (status === 'verified') return styles.statusVerified;
  if (status === 'escalated') return styles.statusEscalated;
  if (status === 'resolved') return styles.statusResolved;
  return styles.statusUnverified;
}

function formatAttribution(
  name: string | null,
  at: string | null,
): string {
  if (!name && !at) return 'Not set';
  if (name && at) return `${name} · ${formatPublishedAt(at)}`;
  if (name) return name;
  return at ? formatPublishedAt(at) : 'Not set';
}

function timelineLabel(event: {
  eventType: string;
  fromStatus: ReportStatus | null;
  toStatus: ReportStatus | null;
}): string {
  const workflowLabels: Record<string, string> = {
    review_claimed: 'Taken for review',
    review_taken_over: 'Review taken over',
    review_released: 'Review released',
    review_decided: 'Review decision recorded',
    review_reopened: 'Review reopened',
    contact_logged: 'Contact / response activity recorded',
    routing_changed: 'Report routed to another barangay',
    jurisdiction_checked: 'Jurisdiction checked',
  };
  if (workflowLabels[event.eventType]) return workflowLabels[event.eventType];
  if (event.eventType === 'barangay_change') {
    return 'Barangay updated';
  }
  if (event.eventType === 'location_change') {
    return 'Incident location corrected';
  }
  if (event.eventType === 'incident_type_change') {
    return 'Incident type updated';
  }
  if (event.toStatus && event.fromStatus) {
    return `${statusLabel(event.fromStatus)} → ${statusLabel(event.toStatus)}`;
  }
  if (event.toStatus) {
    return `Reported as ${statusLabel(event.toStatus)}`;
  }
  return 'Status update';
}

export default function OfficialReportDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const reportId = typeof params.id === 'string' ? params.id : undefined;

  const {
    scope,
    officialKind: kind,
    loading: scopeLoading,
    error: scopeError,
  } = useOfficialPortal();
  const isResponseOfficial = kind === 'MDRRMO' || kind === 'BDRRMO';
  const [linkVisible, setLinkVisible] = useState(false);
  const [responseType, setResponseType] = useState<ResponseEventType | null>(
    null,
  );
  const callFlow = useReportCallFlow();
  const contactBusy = callFlow.calling;
  const [responseVisible, setResponseVisible] = useState(false);
  const [responseForCall, setResponseForCall] = useState(false);
  const [reroutedTo, setReroutedTo] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successVersion, setSuccessVersion] = useState(0);
  const [claimReminderHeight, setClaimReminderHeight] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLatitude, setEditLatitude] = useState('');
  const [editLongitude, setEditLongitude] = useState('');
  const [editCorrectionNote, setEditCorrectionNote] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  // Verification / Timeline start collapsed; tap a header to reveal its content.
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [reportHistoryVisible, setReportHistoryVisible] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<
    ReportMediaAttachment | null
  >(null);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [barangayPickerVisible, setBarangayPickerVisible] = useState(false);
  const [correctedPosition, setCorrectedPosition] = useState<
    GpsPosition | null
  >(null);
  const [correctionBarangays, setCorrectionBarangays] = useState<
    BarangayOption[]
  >([]);
  const [correctionBarangaysLoading, setCorrectionBarangaysLoading] = useState(
    false,
  );
  const [correctionBarangaysError, setCorrectionBarangaysError] = useState<
    string | null
  >(null);
  const [selectedCorrectionBarangayId, setSelectedCorrectionBarangayId] =
    useState<string | null>(null);
  const [locationCorrectionBusy, setLocationCorrectionBusy] = useState(false);

  const { detail, error, loading, refreshing, refresh, reload } =
    useOfficialReportDetail(reportId, scope);
  const canLogResponse = detail != null && (
    detail.allowedIncidentActions.includes('log_event') ||
    (!detail.incidentCase && detail.canReviewReport &&
      detail.lifecycleFacts.reviewOutcome === 'pending' &&
      detail.lifecycleFacts.jurisdictionStatus === 'in_coverage')
  );
  const correctionDevicePosition =
    detail && detail.deviceLatitude != null && detail.deviceLongitude != null
      ? {
        latitude: detail.deviceLatitude,
        longitude: detail.deviceLongitude,
        accuracyMeters: detail.gpsAccuracyMeters,
      }
      : undefined;
  const canCorrectTimelineLocation = isResponseOfficial &&
    detail?.canCorrectLocation === true &&
    detail.status === 'unverified';
  const correctionBarangayOptions = kind === 'BDRRMO' && scope?.barangay_id
    ? correctionBarangays.filter((barangay) =>
      barangay.id === scope.barangay_id
    )
    : correctionBarangays;
  const locationWasUpdated = detail?.timeline.some(
    (event) =>
      event.eventType === 'location_change' ||
      event.eventType === 'barangay_change',
  );
  const currentLocation = detail
    ? detail.addressText?.trim() ||
      `${detail.latitude.toFixed(5)}, ${detail.longitude.toFixed(5)}`
    : 'Unknown location';
  const currentLocationWithPin = detail?.addressText?.trim()
    ? `${currentLocation} (${detail.latitude.toFixed(5)}, ${
      detail.longitude.toFixed(5)
    })`
    : currentLocation;

  const sortedReportEvents = [...(detail?.timeline ?? [])].sort((
    first,
    second,
  ) =>
    (Date.parse(second.createdAt) || 0) - (Date.parse(first.createdAt) || 0)
  );
  const ownsPendingReview = Boolean(
    detail &&
      detail.reviewClaimedById === detail.currentUserId &&
      detail.lifecycleFacts.reviewOutcome === 'pending',
  );
  // Evidence supports review; only an available decision marks its required step.
  const canMakeReviewDecision = ownsPendingReview && !detail?.incidentCase &&
    detail?.allowedReviewActions.some((action) =>
      ['verify', 'link', 'needs_assessment', 'could_not_confirm', 'reject']
        .includes(action)
    );
  const operationStep =
    detail?.lifecycleFacts.jurisdictionStatus === 'needs_check'
      ? 'review'
      : canMakeReviewDecision
      ? 'decision'
      : !detail?.incidentCase &&
          detail?.lifecycleFacts.reviewOutcome === 'pending'
      ? 'review'
      : null;

  const reviewOutcome = detail?.lifecycleFacts.reviewOutcome;
  // Match the decision panel's visibility so a historical summary never opens an empty body.
  const canReopenReview = detail?.canReviewReport &&
    ['rejected', 'could_not_confirm'].includes(detail.lifecycle.primaryStage);
  const hasReviewDecisionControls = Boolean(
    detail &&
      !detail.allowedReviewActions.some((action) =>
        action === 'claim' || action === 'take_over'
      ) &&
      (detail.allowedReviewActions.length > 0 || canReopenReview),
  );
  const showReviewDecision =
    detail?.lifecycleFacts.jurisdictionStatus !== 'needs_check' &&
    (operationStep === 'decision' ||
      (reviewOutcome != null && reviewOutcome !== 'pending'));
  const reviewDecisionSummary = {
    pending: 'Record what the evidence supports',
    verified: 'Report verified',
    linked: 'Report linked to an existing incident',
    needs_assessment: 'Field assessment requested',
    could_not_confirm: 'Could not confirm this report',
    rejected: 'Report rejected',
    outside_coverage: 'Report outside coverage',
  }[reviewOutcome ?? 'pending'];

  function openReportOperationsHelp() {
    Alert.alert(
      'Report operations help',
      'Take the report for review, check evidence, and record a review decision. Calling is optional. Record response actions separately.',
    );
  }

  function handleCallReporter() {
    if (!detail || contactBusy) return;
    void callFlow.startReporterCall(detail.id);
  }

  function openActivityComposer() {
    setResponseForCall(false);
    setResponseType(null);
    setResponseVisible(true);
  }

  function openCallOutcome() {
    if (!callFlow.pendingCall || callFlow.pendingCall.reportId !== detail?.id) {
      return;
    }
    setResponseForCall(true);
    setResponseType(
      callFlow.pendingCall.kind === 'reporter'
        ? 'reporter_call'
        : 'hotline_contacted',
    );
    setResponseVisible(true);
  }

  function showSuccess(message: string | null) {
    setSuccessMessage(message);
    if (message) setSuccessVersion((version) => version + 1);
  }

  function operationSaved(message: string) {
    showSuccess(message);
    void reload();
  }

  function clearCallFollowup() {
    callFlow.clearPendingCall();
    showSuccess('Call follow-up cleared. No call activity was recorded.');
  }

  function handleReportRouted(targetName?: string) {
    if (kind === 'BDRRMO') {
      setReroutedTo(targetName ?? 'the selected barangay');
      return;
    }
    operationSaved(
      'Report routed to ' + (targetName ?? 'the selected office') + '.',
    );
  }

  async function loadCorrectionBarangays() {
    setCorrectionBarangaysLoading(true);
    setCorrectionBarangaysError(null);
    const result = await fetchBarangays();
    setCorrectionBarangays(result.barangays);
    setCorrectionBarangaysError(result.error);
    setCorrectionBarangaysLoading(false);
  }

  function openTimelineLocationCorrection() {
    if (!detail || !canCorrectTimelineLocation || locationCorrectionBusy) {
      return;
    }

    setCorrectedPosition({
      latitude: detail.latitude,
      longitude: detail.longitude,
      accuracyMeters: detail.gpsAccuracyMeters,
    });
    setSelectedCorrectionBarangayId(detail.barangayId);
    setLocationPickerVisible(true);
    void loadCorrectionBarangays();
  }

  function confirmCorrectedPin(position: GpsPosition) {
    setCorrectedPosition(position);
    setLocationPickerVisible(false);
    setBarangayPickerVisible(true);
  }

  async function saveTimelineLocationCorrection(barangayId: string) {
    if (!detail || !correctedPosition || locationCorrectionBusy) return;

    const selectedBarangay = correctionBarangays.find(
      (barangay) => barangay.id === barangayId,
    );
    setLocationCorrectionBusy(true);
    const result = await correctOfficialReportLocation({
      reportId: detail.id,
      position: correctedPosition,
      addressText: selectedBarangay
        ? `${selectedBarangay.name}, Minglanilla, Cebu`
        : detail.addressText ?? undefined,
      barangayId,
    });
    setLocationCorrectionBusy(false);

    if (result.error) {
      Alert.alert('Could not update location', result.error);
      return;
    }

    setCorrectedPosition(null);
    await reload();
  }

  function beginEdit() {
    if (!detail) return;
    setEditTitle(detail.title);
    setEditDescription(detail.description);
    setEditAddress(detail.addressText ?? '');
    setEditLatitude(String(detail.latitude));
    setEditLongitude(String(detail.longitude));
    setEditCorrectionNote('');
    setEditing(true);
  }

  async function saveEdit() {
    if (!detail || editBusy) return;
    setEditBusy(true);
    const correctedPosition = {
      latitude: Number(editLatitude),
      longitude: Number(editLongitude),
      accuracyMeters: null,
    };
    const result = detail.canEditContent
      ? await updateOfficialReport({
        reportId: detail.id,
        title: editTitle,
        description: editDescription,
        position: correctedPosition,
        addressText: editAddress,
        barangayId: detail.barangayId,
      })
      : await correctOfficialReportLocation({
        reportId: detail.id,
        position: correctedPosition,
        addressText: editAddress,
        barangayId: detail.barangayId,
        note: editCorrectionNote,
      });
    setEditBusy(false);
    if (result.error) {
      Alert.alert('Could not update incident', result.error);
      return;
    }
    setEditing(false);
    await reload();
  }

  if (scopeLoading || (!scope && !scopeError)) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style='dark' />
        <ReportOperationsSkeleton />
      </SafeAreaView>
    );
  }

  if (scopeError || !scope) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style='dark' />
        <View
          style={[styles.scrollContent, { flex: 1, justifyContent: 'center' }]}
        >
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>Official access unavailable</Text>
            <Text style={styles.stateBody}>{scopeError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => router.replace('/official')}
              activeOpacity={0.85}
            >
              <Text style={styles.retryButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (
    !reroutedTo &&
    !loading &&
    kind === 'BDRRMO' &&
    !detail &&
    error === 'Report not found in your scope.'
  ) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style='dark' />
        <View
          style={[styles.scrollContent, { flex: 1, justifyContent: 'center' }]}
        >
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>Report unavailable</Text>
            <Text style={styles.stateBody}>
              This report is no longer available in your BDRRMO workspace.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() =>
                router.replace(
                  '/official/incidents?status=unverified' as never,
                )}
              accessibilityRole='button'
            >
              <Text style={styles.retryButtonText}>Back to reports</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !reroutedTo) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style='dark' />
        <ReportOperationsSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style='dark' />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {isResponseOfficial && !reroutedTo && ownsPendingReview && (
          <View
            style={operationStyles.claimReminder}
            onLayout={(event) =>
              setClaimReminderHeight(event.nativeEvent.layout.height)}
          >
            <Ionicons
              name='person-circle-outline'
              size={20}
              color={colors.navigationActive}
            />
            <Text
              style={[
                operationStyles.caption,
                operationStyles.claimReminderText,
              ]}
            >
              You are reviewing this report
            </Text>
          </View>
        )}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          keyboardShouldPersistTaps='handled'
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={[styles.backButton, styles.reportOperationsHeaderButton]}
              onPress={() => goBackOrReplace(router, '/official/incidents')}
              accessibilityRole='button'
              accessibilityLabel='Back to queue'
            >
              <Ionicons name='arrow-back' size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.headerTextGroup}>
              <Text style={styles.incidentDetailLabel}>Incident detail</Text>
              <Text style={styles.screenTitle} numberOfLines={1}>
                Report operations
              </Text>
              {isResponseOfficial
                ? (
                  <Text style={styles.reportOperationsInstruction}>
                    Review. Verify. Respond.
                  </Text>
                )
                : null}
            </View>
            <TouchableOpacity
              style={[styles.backButton, styles.reportOperationsHeaderButton]}
              onPress={openReportOperationsHelp}
              accessibilityRole='button'
              accessibilityLabel='Report operations help'
            >
              <Ionicons
                name='help-circle-outline'
                size={23}
                color={colors.navigationActive}
              />
            </TouchableOpacity>
          </View>

          {loading && !reroutedTo
            ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color={colors.themeSoft} />
                <Text style={styles.stateBody}>Loading report…</Text>
              </View>
            )
            : null}

          {!reroutedTo && !loading && error
            ? (
              <View style={styles.stateBox}>
                <Text style={styles.stateTitle}>Could not load report</Text>
                <Text style={styles.stateBody}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => void reload()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.retryButtonText}>Try again</Text>
                </TouchableOpacity>
              </View>
            )
            : null}

          {reroutedTo && (
            <View style={styles.card}>
              <WorkflowSuccess
                message={'Report moved to ' + reroutedTo +
                  ' BDRRMO. Your office no longer handles this report.'}
              />
              <WorkflowButton
                label='Back to reports'
                onPress={() => router.replace('/official/incidents')}
              />
            </View>
          )}
          {!reroutedTo && !loading && !error && detail
            ? (
              <>
                {isResponseOfficial
                  ? (
                    <View style={styles.reporterIdentity}>
                      <ReporterAvatar reporter={detail.reporter} size={48} />
                      <View style={styles.reporterIdentityCopy}>
                        <Text
                          style={styles.reporterIdentityName}
                          numberOfLines={1}
                        >
                          {detail.reporterName}
                        </Text>
                        <Text style={styles.reporterIdentityRole}>
                          Reporter
                        </Text>
                      </View>
                    </View>
                  )
                  : null}

                {isResponseOfficial
                  ? (
                    <View style={styles.reportSummary}>
                      <CommunityReportTags
                        report={detail}
                        statusPresentation={{
                          label: ownsPendingReview
                            ? 'Under review'
                            : officialLabel(detail.lifecycle, {
                              claimedByName:
                                detail.lifecycleFacts.reviewClaimedByName,
                              claimedAt: detail.lifecycleFacts.reviewClaimedAt,
                            }),
                          color: lifecycleColor(detail.lifecycle),
                        }}
                      />
                      {canLogResponse && (
                        <UrgentDangerCard
                          barangayId={scope?.barangay_id}
                          calling={callFlow.calling ||
                            Boolean(callFlow.pendingCall)}
                          onLogActivity={openActivityComposer}
                          hideActivityEntry
                          onCallHotline={(hotline) =>
                            void callFlow.startHotlineCall(
                              hotline,
                              detail.id,
                            )}
                        />
                      )}
                      {callFlow.pendingCall?.reportId === detail.id && (
                        <View style={styles.card}>
                          <Text style={styles.sectionTitle}>
                            Back from your call?
                          </Text>
                          <Text style={operationStyles.caption}>
                            {callFlow.pendingCall.kind === 'hotline'
                              ? callFlow.pendingCall.hotline?.name
                              : 'Reporter'}{' '}
                            - record what happened when you are ready.
                          </Text>
                          <WorkflowButton
                            label='Record call outcome'
                            onPress={openCallOutcome}
                          />
                          <TouchableOpacity
                            style={operationStyles.quietAction}
                            onPress={clearCallFollowup}
                          >
                            <Text style={operationStyles.quietActionText}>
                              No call made
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      <WorkflowFeedback
                        busy={callFlow.calling}
                        error={callFlow.error}
                      />
                      <View style={styles.reportMetaTimeline}>
                        <OperationTimelineStep
                          title='Review & routing'
                          summary={detail.barangayName
                            ? 'Assigned to ' + detail.barangayName
                            : 'Check the receiving office'}
                          icon='location'
                          current={operationStep === 'review'}
                        >
                          {detail.lifecycleFacts.jurisdictionStatus ===
                                'needs_check' && kind === 'MDRRMO'
                            ? (
                              <JurisdictionCheckPanel
                                reportId={detail.id}
                                onDone={() =>
                                  operationSaved(
                                    'Jurisdiction decision saved.',
                                  )}
                              />
                            )
                            : (
                              <ReviewDecisionPanel
                                stage='claim'
                                key={detail.id}
                                detail={detail}
                                currentUserId={detail.currentUserId}
                                onChanged={() => void reload()}
                                onSuccess={showSuccess}
                                onOpenLinkSheet={() => setLinkVisible(true)}
                              />
                            )}

                          {!detail.canReroute &&
                            !detail.allowedReviewActions.some((action) =>
                              action === 'claim' || action === 'take_over'
                            ) &&
                            detail.lifecycleFacts.jurisdictionStatus !==
                              'needs_check' &&
                            (
                              <Text style={operationStyles.caption}>
                                Routing is set.
                              </Text>
                            )}
                          {detail.canReroute && (
                            <ReportRoutingPanel
                              reportId={detail.id}
                              barangayName={detail.barangayName}
                              onDone={handleReportRouted}
                            />
                          )}
                          {operationStep === 'review' && canLogResponse &&
                            !detail.incidentCase && (
                            <WorkflowActionRow
                              title='Record activity'
                              icon='create-outline'
                              onPress={openActivityComposer}
                            />
                          )}
                        </OperationTimelineStep>
                        <OperationTimelineStep
                          title='Evidence & contact'
                          key={'evidence-' + detail.id + '-' +
                            (operationStep ?? 'completed')}
                          defaultExpanded={operationStep !== null}
                          last={!showReviewDecision && !detail.incidentCase}
                          summary='Report details and optional contact'
                          icon='document-text'
                        >
                          <View style={operationStyles.section}>
                            <Text style={styles.detailBody}>
                              {detail.description.trim() ||
                                'No description provided.'}
                            </Text>
                            <Text style={operationStyles.caption}>
                              Received{' '}
                              {formatOperationTimestamp(detail.createdAt)}
                            </Text>
                            {detail.media.length > 0 && (
                              <MediaCollage
                                media={detail.media}
                                onOpenPreview={setMediaPreview}
                                onOpenGallery={() =>
                                  setMediaPreview(detail.media[0])}
                              />
                            )}
                            {locationWasUpdated && (
                              <Text style={operationStyles.caption}>
                                Updated location: {currentLocationWithPin}
                              </Text>
                            )}
                            {canCorrectTimelineLocation && (
                              <WorkflowActionRow
                                title='Correct incident location'
                                icon='location-outline'
                                onPress={openTimelineLocationCorrection}
                                disabled={locationCorrectionBusy}
                              />
                            )}
                            {detail.canContactReporter && (
                              <WorkflowActionRow
                                title='Call reporter'
                                description='Optional - a call is not required to verify'
                                icon='call-outline'
                                onPress={handleCallReporter}
                                disabled={contactBusy ||
                                  Boolean(callFlow.pendingCall)}
                              />
                            )}
                          </View>
                        </OperationTimelineStep>
                        {showReviewDecision && (
                          <OperationTimelineStep
                            title='Review decision'
                            collapsible={hasReviewDecisionControls}
                            summary={reviewDecisionSummary}
                            icon='checkmark-circle'
                            current={operationStep === 'decision'}
                            last={!detail.incidentCase}
                          >
                            <ReviewDecisionPanel
                              stage='decision'
                              key={detail.id}
                              detail={detail}
                              currentUserId={detail.currentUserId}
                              onChanged={() => void reload()}
                              onSuccess={showSuccess}
                              onOpenLinkSheet={() => setLinkVisible(true)}
                            />
                            {operationStep === 'decision' && canLogResponse &&
                              !detail.incidentCase && (
                              <WorkflowActionRow
                                title='Record activity'
                                icon='create-outline'
                                onPress={openActivityComposer}
                              />
                            )}
                          </OperationTimelineStep>
                        )}
                        {detail.incidentCase && kind && (
                          <IncidentCasePanel
                            key={detail.incidentCase.id}
                            currentReportId={detail.id}
                            incident={detail.incidentCase}
                            viewerKind={kind}
                            allowedActions={detail.allowedIncidentActions}
                            onChanged={() =>
                              operationSaved('Incident updated.')}
                            assessmentRequested={reviewOutcome ===
                              'needs_assessment'}
                            onLogActivity={openActivityComposer}
                          />
                        )}
                      </View>


                      <OperationTimelineStep
                        title='Report history'
                        collapsible={false}
                        summary='Review decisions and routing changes'
                        icon='chatbubbles'
                        utility
                      >
                        {sortedReportEvents.length === 0 && (
                          <Text style={operationStyles.caption}>
                            No review activity recorded yet.
                          </Text>
                        )}
                        {sortedReportEvents.slice(0, 3).map((event) => (
                          <WorkflowHistoryRow
                            key={event.id}
                            title={timelineLabel(event)}
                            eventType={event.eventType}
                            timestamp={event.createdAt}
                            actorName={event.changedByName}
                            details={event.detail}
                            note={event.note}
                          />
                        ))}
                        {sortedReportEvents.length > 0 && (
                          <WorkflowActionRow
                            title='View all report history'
                            icon='time-outline'
                            onPress={() => setReportHistoryVisible(true)}
                          />
                        )}
                      </OperationTimelineStep>

                      {detail.mediaError
                        ? (
                          <Text
                            style={[styles.detailBody, {
                              color: colors.danger,
                            }]}
                          >
                            {detail.mediaError}
                          </Text>
                        )
                        : null}
                    </View>
                  )
                  : null}

                {!isResponseOfficial
                  ? (
                    <View style={styles.detailCard}>
                      {!isResponseOfficial
                        ? (
                          <>
                            <View style={styles.queueCardHeader}>
                              <Text style={styles.detailTitle}>
                                {detail.title.trim() || 'Untitled report'}
                              </Text>
                              <View
                                style={[
                                  styles.statusPill,
                                  statusPillStyle(detail.status),
                                ]}
                              >
                                <Text style={styles.statusPillText}>
                                  {kind === 'Mayor'
                                    ? mayorReportStatusLabel({
                                      status: detail.status,
                                      barangayName: detail.barangayName,
                                      reverifiedAt: detail.reverified.at,
                                    })
                                    : statusLabel(detail.status)}
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.detailBody}>
                              {detail.description.trim() ||
                                'No description provided.'}
                            </Text>
                          </>
                        )
                        : null}

                      {!isResponseOfficial
                        ? (
                          <IncidentTypeBadge
                            incidentType={detail.incidentType}
                            incidentTypeOther={detail.incidentTypeOther}
                          />
                        )
                        : null}

                      {!isResponseOfficial
                        ? (
                          <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Reporter</Text>
                            <Text style={styles.metaValue}>
                              {detail.reporterName}
                            </Text>
                          </View>
                        )
                        : null}

                      {!isResponseOfficial
                        ? (
                          <>
                            <View style={styles.metaRow}>
                              <Text style={styles.metaLabel}>Location</Text>
                              <Text style={styles.metaValue}>
                                {detail.addressText?.trim() ||
                                  `${detail.latitude.toFixed(5)}, ${
                                    detail.longitude.toFixed(5)
                                  }`}
                              </Text>
                            </View>

                            <View style={styles.metaRow}>
                              <Text style={styles.metaLabel}>Reported</Text>
                              <Text style={styles.metaValue}>
                                {detail.createdAt
                                  ? formatPublishedAt(detail.createdAt)
                                  : 'Unknown'}
                              </Text>
                            </View>
                          </>
                        )
                        : null}

                      {!isResponseOfficial && detail.media.length > 0
                        ? (
                          <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Media</Text>
                            <View style={styles.mediaRow}>
                              {detail.media.map((item) => (
                                <TouchableOpacity
                                  key={item.id}
                                  style={styles.mediaThumb}
                                  onPress={() => setMediaPreview(item)}
                                  activeOpacity={0.85}
                                  accessibilityRole='button'
                                  accessibilityLabel={item.type === 'video'
                                    ? 'View video'
                                    : 'View photo'}
                                >
                                  {item.type === 'photo'
                                    ? (
                                      <Image
                                        source={{ uri: item.url }}
                                        style={styles.mediaThumbImage}
                                        resizeMode='cover'
                                      />
                                    )
                                    : (
                                      <View style={styles.mediaVideoThumb}>
                                        <Ionicons
                                          name='play-circle'
                                          size={36}
                                          color={colors.themeSoft}
                                        />
                                      </View>
                                    )}
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        )
                        : null}

                      {!isResponseOfficial && detail.mediaError
                        ? (
                          <Text
                            style={[styles.detailBody, {
                              color: colors.danger,
                            }]}
                          >
                            {detail.mediaError}
                          </Text>
                        )
                        : null}

                      {detail.canContactReporter
                        ? (
                          <TouchableOpacity
                            style={[
                              styles.primaryAction,
                              styles.callReporterAction,
                              contactBusy && styles.actionDisabled,
                            ]}
                            onPress={handleCallReporter}
                            disabled={contactBusy}
                            activeOpacity={0.85}
                            accessibilityRole='button'
                            accessibilityLabel={`Call reporter ${
                              detail.maskedPhone ?? ''
                            }`}
                          >
                            {contactBusy
                              ? <ActivityIndicator color={colors.white} />
                              : (
                                <>
                                  <Ionicons
                                    name='call'
                                    size={18}
                                    color={colors.white}
                                  />
                                  <Text style={styles.primaryActionText}>
                                    {detail.maskedPhone ?? 'Number unavailable'}
                                  </Text>
                                </>
                              )}
                          </TouchableOpacity>
                        )
                        : null}
                    </View>
                  )
                  : null}

                {!isResponseOfficial &&
                    (detail.canEditContent || detail.canCorrectLocation)
                  ? (
                    <View style={styles.detailCard}>
                      <View style={styles.queueCardHeader}>
                        <Text style={styles.sectionTitle}>
                          {detail.canEditContent
                            ? 'Correct incident details'
                            : 'Correct incident location'}
                        </Text>
                        {!editing
                          ? (
                            <TouchableOpacity
                              style={styles.retryButton}
                              onPress={beginEdit}
                              accessibilityRole='button'
                              accessibilityLabel='Edit incident details'
                            >
                              <Text style={styles.retryButtonText}>Edit</Text>
                            </TouchableOpacity>
                          )
                          : null}
                      </View>
                      {editing
                        ? (
                          <>
                            {detail.canEditContent
                              ? (
                                <>
                                  <Text style={styles.formLabel}>
                                    Title (optional)
                                  </Text>
                                  <TextInput
                                    style={styles.formInput}
                                    value={editTitle}
                                    onChangeText={setEditTitle}
                                    maxLength={120}
                                    editable={!editBusy}
                                  />
                                  <Text style={styles.formLabel}>
                                    Description
                                  </Text>
                                  <TextInput
                                    style={[
                                      styles.formInput,
                                      styles.formTextArea,
                                    ]}
                                    value={editDescription}
                                    onChangeText={setEditDescription}
                                    multiline
                                    maxLength={2000}
                                    editable={!editBusy}
                                  />
                                </>
                              )
                              : null}
                            <Text style={styles.formLabel}>Address</Text>
                            <TextInput
                              style={styles.formInput}
                              value={editAddress}
                              onChangeText={setEditAddress}
                              maxLength={300}
                              editable={!editBusy}
                            />
                            {!detail.canEditContent
                              ? (
                                <>
                                  <Text style={styles.formLabel}>
                                    Correction note (optional)
                                  </Text>
                                  <TextInput
                                    style={[
                                      styles.formInput,
                                      styles.formTextArea,
                                    ]}
                                    value={editCorrectionNote}
                                    onChangeText={setEditCorrectionNote}
                                    placeholder='Why is the response location being corrected?'
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    maxLength={500}
                                    editable={!editBusy}
                                  />
                                </>
                              )
                              : null}
                            <Text style={styles.formLabel}>Coordinates</Text>
                            <TextInput
                              style={styles.formInput}
                              value={editLatitude}
                              onChangeText={setEditLatitude}
                              placeholder='Latitude'
                              placeholderTextColor={colors.textMuted}
                              keyboardType='decimal-pad'
                              editable={!editBusy}
                            />
                            <TextInput
                              style={styles.formInput}
                              value={editLongitude}
                              onChangeText={setEditLongitude}
                              placeholder='Longitude'
                              placeholderTextColor={colors.textMuted}
                              keyboardType='decimal-pad'
                              editable={!editBusy}
                            />
                            <TouchableOpacity
                              style={[
                                styles.primaryAction,
                                editBusy && styles.actionDisabled,
                              ]}
                              onPress={() => void saveEdit()}
                              disabled={editBusy}
                              activeOpacity={0.85}
                            >
                              {editBusy
                                ? <ActivityIndicator color={colors.white} />
                                : (
                                  <Text style={styles.primaryActionText}>
                                    Save corrections
                                  </Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.secondaryAction}
                              onPress={() => setEditing(false)}
                              disabled={editBusy}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.secondaryActionText}>
                                Cancel
                              </Text>
                            </TouchableOpacity>
                          </>
                        )
                        : (
                          <Text style={styles.queueMeta}>
                            {detail.canEditContent
                              ? 'The submitting officer may correct content and location. Every location change is audited.'
                              : 'Authorized responders may correct the response point. The original device location remains unchanged.'}
                          </Text>
                        )}
                    </View>
                  )
                  : null}

                {!isResponseOfficial
                  ? (
                    <View style={styles.collapsibleRow}>
                      <View style={styles.collapsiblePanel}>
                        <TouchableOpacity
                          style={styles.collapsibleHeader}
                          onPress={() => setVerificationOpen((open) => !open)}
                          activeOpacity={0.85}
                          accessibilityRole='button'
                          accessibilityState={{ expanded: verificationOpen }}
                          accessibilityLabel='Verification'
                        >
                          <Text
                            style={styles.collapsibleHeaderText}
                            numberOfLines={1}
                          >
                            Verification
                          </Text>
                          <Ionicons
                            name={verificationOpen
                              ? 'chevron-up'
                              : 'chevron-down'}
                            size={18}
                            color={colors.textMuted}
                          />
                        </TouchableOpacity>
                        {verificationOpen
                          ? (
                            <View style={styles.collapsibleBody}>
                              <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>Device GPS</Text>
                                <Text style={styles.metaValue}>
                                  {detail.deviceLatitude == null ||
                                      detail.deviceLongitude == null
                                    ? 'Not available for this legacy report'
                                    : `${detail.deviceLatitude.toFixed(5)}, ${
                                      detail.deviceLongitude.toFixed(5)
                                    }`}
                                </Text>
                              </View>
                              <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>
                                  GPS accuracy
                                </Text>
                                <Text style={styles.metaValue}>
                                  {detail.gpsAccuracyMeters == null
                                    ? 'Not recorded'
                                    : `±${
                                      Math.round(detail.gpsAccuracyMeters)
                                    } m`}
                                </Text>
                              </View>
                              <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>
                                  Pin adjustment
                                </Text>
                                <Text style={styles.metaValue}>
                                  {detail.locationAdjustmentMeters == null
                                    ? 'Not recorded'
                                    : `${
                                      Math.round(
                                        detail.locationAdjustmentMeters,
                                      )
                                    } m`}
                                </Text>
                              </View>
                              <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>
                                  Verified by
                                </Text>
                                <Text style={styles.metaValue}>
                                  {formatAttribution(
                                    detail.verified.name,
                                    detail.verified.at,
                                  )}
                                </Text>
                              </View>
                              <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>
                                  Re-verified by
                                </Text>
                                <Text style={styles.metaValue}>
                                  {formatAttribution(
                                    detail.reverified.name,
                                    detail.reverified.at,
                                  )}
                                </Text>
                              </View>
                              <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>
                                  Escalated by
                                </Text>
                                <Text style={styles.metaValue}>
                                  {formatAttribution(
                                    detail.escalated.name,
                                    detail.escalated.at,
                                  )}
                                </Text>
                              </View>
                              <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>
                                  Resolved by
                                </Text>
                                <Text style={styles.metaValue}>
                                  {formatAttribution(
                                    detail.resolved.name,
                                    detail.resolved.at,
                                  )}
                                </Text>
                              </View>
                            </View>
                          )
                          : null}
                      </View>

                      <View style={styles.collapsiblePanel}>
                        <TouchableOpacity
                          style={styles.collapsibleHeader}
                          onPress={() => setTimelineOpen((open) => !open)}
                          activeOpacity={0.85}
                          accessibilityRole='button'
                          accessibilityState={{ expanded: timelineOpen }}
                          accessibilityLabel='Timeline'
                        >
                          <Text
                            style={styles.collapsibleHeaderText}
                            numberOfLines={1}
                          >
                            Timeline
                          </Text>
                          <Ionicons
                            name={timelineOpen ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={colors.textMuted}
                          />
                        </TouchableOpacity>
                        {timelineOpen
                          ? (
                            <View style={styles.collapsibleBody}>
                              {detail.timeline.length === 0
                                ? (
                                  <Text style={styles.queueMeta}>
                                    No timeline events yet.
                                  </Text>
                                )
                                : (
                                  detail.timeline.map((event) => (
                                    <View
                                      key={event.id}
                                      style={styles.timelineItem}
                                    >
                                      <Text style={styles.timelineTitle}>
                                        {timelineLabel(event)}
                                      </Text>
                                      <Text style={styles.timelineMeta}>
                                        {[
                                          event.changedByName,
                                          event.createdAt
                                            ? formatPublishedAt(event.createdAt)
                                            : null,
                                        ]
                                          .filter(Boolean)
                                          .join(' · ')}
                                      </Text>
                                      {event.note
                                        ? (
                                          <Text style={styles.timelineNote}>
                                            {event.note}
                                          </Text>
                                        )
                                        : null}
                                    </View>
                                  ))
                                )}
                            </View>
                          )
                          : null}
                      </View>
                    </View>
                  )
                  : null}

                {kind === 'Mayor'
                  ? (
                    <View style={styles.readOnlyBanner}>
                      <Text style={styles.readOnlyText}>
                        Mayor view is read-only. Status changes and reporter
                        contact are not available.
                      </Text>
                    </View>
                  )
                  : null}
              </>
            )
            : null}
        </ScrollView>
        {isResponseOfficial && !reroutedTo && successMessage && (
          <WorkflowToast
            key={successVersion}
            topOffset={ownsPendingReview ? claimReminderHeight : 0}
            message={successMessage}
            onDismiss={() => showSuccess(null)}
          />
        )}
      </KeyboardAvoidingView>

      {detail && (
        <>
          <LinkIncidentSheet
            visible={linkVisible}
            reportId={detail.id}
            onClose={() => setLinkVisible(false)}
            onLinked={() => operationSaved('Report linked to the incident.')}
          />
          <ResponseEventSheet
            visible={responseVisible}
            target={detail.incidentCase
              ? { incidentCaseId: detail.incidentCase.id }
              : { reportId: detail.id }}
            initialType={responseType}
            initialDetails={responseForCall && callFlow.pendingCall?.hotline
              ? hotlineEventDetails(callFlow.pendingCall.hotline)
              : undefined}
            onClose={() => setResponseVisible(false)}
            onLogged={(result) => {
              if (responseForCall) callFlow.clearPendingCall();
              operationSaved(callOutcomeFeedback(result));
            }}
          />
        </>
      )}
      <ResourceFormSheet
        visible={reportHistoryVisible}
        title='Report history'
        hasUnsavedChanges={false}
        onClose={() => setReportHistoryVisible(false)}
      >
        {sortedReportEvents.map((event) => (
          <WorkflowHistoryRow
            key={event.id}
            title={timelineLabel(event)}
            eventType={event.eventType}
            timestamp={event.createdAt}
            actorName={event.changedByName}
            details={event.detail}
            note={event.note}
          />
        ))}
      </ResourceFormSheet>
      <ReportMediaPreviewModal
        preview={mediaPreview}
        onClose={() => setMediaPreview(null)}
      />
      {detail && correctedPosition
        ? (
          <ReportLocationPicker
            visible={locationPickerVisible}
            incidentPosition={correctedPosition}
            devicePosition={correctionDevicePosition}
            adjustmentBoundaryPosition={{
              latitude: detail.latitude,
              longitude: detail.longitude,
              accuracyMeters: detail.gpsAccuracyMeters,
            }}
            maximumDistanceMeters={getReportLocationAdjustmentLimit(
              detail.gpsAccuracyMeters,
            )}
            onConfirm={confirmCorrectedPin}
            onClose={() => setLocationPickerVisible(false)}
          />
        )
        : null}
      <ReportBarangayPicker
        visible={barangayPickerVisible}
        barangays={correctionBarangayOptions}
        selectedBarangayId={selectedCorrectionBarangayId}
        loading={correctionBarangaysLoading || locationCorrectionBusy}
        error={correctionBarangaysError}
        onSelect={(barangayId) => {
          setSelectedCorrectionBarangayId(barangayId);
          setBarangayPickerVisible(false);
          void saveTimelineLocationCorrection(barangayId);
        }}
        onRetry={() => void loadCorrectionBarangays()}
        onClose={() => setBarangayPickerVisible(false)}
      />
    </SafeAreaView>
  );
}
