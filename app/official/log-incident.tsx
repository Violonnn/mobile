// app/official/log-incident.tsx
// Log a verified field incident (BDRRMO/MDRRMO only).
// Reuses location / optional media / details pieces; submits via Edge Function.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { colors } from '../../styles/theme';
import { goBackOrReplace } from '../../lib/navigation';
import { OfficialShellSkeleton } from '../../components/ui/OfficialScreenSkeletons';
import { useOfficialPortal } from '../../context/OfficialPortalContext';
import LocationStep from '../../components/report/LocationStep';
import AttachmentsStep from '../../components/report/AttachmentsStep';
import DetailsStep from '../../components/report/DetailsStep';
import ReportLocationPicker from '../../components/report/ReportLocationPicker';
import {
  getCurrentGpsWithAddress,
  isLowConfidenceLocation,
  resolveReadableAddress,
  type GpsPosition,
  type ReadableAddress,
} from '../../lib/location';
import {
  MAX_PHOTOS,
  MAX_VIDEO_SECONDS,
  captureReportPhoto,
  captureReportVideo,
  deletePersistedReportMedia,
  randomUuid,
  totalVideoSeconds,
  type CapturedMedia,
} from '../../lib/reportMedia';
import { fetchBarangays, type BarangayOption } from '../../lib/barangays';
import { WorkflowChoices } from '../../components/official/WorkflowForm';
import { submitOfficialReport } from '../../lib/officialReportSubmit';
import type { IncidentType } from '../../lib/incidentTypes';
import ReportPublicationFields from '../../components/official/ReportPublicationFields';

type Step = 'location' | 'attachments' | 'details' | 'retry' | 'done';

export function OfficialReportForm({
  onClose,
  onSubmitted,
}: {
  onClose?: () => void;
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const { scope, officialKind, loading: scopeLoading } = useOfficialPortal();

  const [step, setStep] = useState<Step>('location');
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [address, setAddress] = useState<ReadableAddress | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [barangaysLoading, setBarangaysLoading] = useState(false);
  const [barangaysError, setBarangaysError] = useState<string | null>(null);
  const [selectedBarangayId, setSelectedBarangayId] = useState<string | null>(
    officialKind === 'BDRRMO' ? scope?.barangay_id ?? null : null,
  );

  const [intakeChannel, setIntakeChannel] = useState<'official_field' | 'hotline_call' | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [incidentType, setIncidentType] = useState<IncidentType | null>(null);
  const [incidentTypeOther, setIncidentTypeOther] = useState('');
  const [media, setMedia] = useState<CapturedMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdReportId, setCreatedReportId] = useState<string | null>(null);
  const [publicationAcknowledged, setPublicationAcknowledged] = useState(false);
  const [publicPhotoMediaIds, setPublicPhotoMediaIds] = useState<string[]>([]);
  const [markIncidentSensitive, setMarkIncidentSensitive] = useState(false);
  const [sensitivityReason, setSensitivityReason] = useState('');
  const [publicAvailable, setPublicAvailable] = useState(false);
  const [publicationStatus, setPublicationStatus] = useState<string | null>(null);
  const [submissionIdentity, setSubmissionIdentity] = useState(() => ({ reportId: randomUuid(), operationId: randomUuid() }));
  const [retryOutcome, setRetryOutcome] = useState<'ambiguous' | 'definitive' | null>(null);

  const submitLock = useRef(false);
  const isBdrrmo = officialKind === 'BDRRMO';
  const canCreate = officialKind === 'BDRRMO' || officialKind === 'MDRRMO';
  const scopeBarangayId = scope?.barangay_id ?? null;
  const scopeBarangayName = scope?.barangay_name ?? null;
  const assignedBarangayId = isBdrrmo ? scopeBarangayId : null;
  const [previousAssignedBarangayId, setPreviousAssignedBarangayId] =
    useState(assignedBarangayId);

  if (assignedBarangayId !== previousAssignedBarangayId) {
    setPreviousAssignedBarangayId(assignedBarangayId);
    if (assignedBarangayId) setSelectedBarangayId(assignedBarangayId);
  }

  const closeForm = () => {
    if (submitting) return;
    if (step === 'retry') {
      if (retryOutcome !== 'definitive') {
        setError('The server result is still unknown. Retry this exact submission to check whether it was saved.');
        return;
      }
      Alert.alert('Discard rejected submission?', 'The current request was rejected. Your saved draft will be removed. If an earlier attempt was saved, it will still appear in Incidents.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: leaveForm },
      ]);
      return;
    }
    leaveForm();
  };

  function leaveForm() {
    media.forEach(deletePersistedReportMedia);
    if (onClose) {
      onClose();
      return;
    }
    goBackOrReplace(router, '/official/incidents');
  }

  function editRejectedSubmission() {
    if (retryOutcome !== 'definitive' || submitting) return;
    setSubmissionIdentity((current) => ({ ...current, operationId: randomUuid() }));
    setRetryOutcome(null);
    setError(null);
    setStep('details');
  }

  const usedPhotoSlots = media.filter((m) => m.type === 'photo').length;
  const usedVideoSeconds = totalVideoSeconds(media);

  const loadBarangays = useCallback(async () => {
    // BDRRMO reports always use the server-assigned barangay, so do not show
    // other barangays as client-side choices.
    if (isBdrrmo) {
      if (!scopeBarangayId || !scopeBarangayName) {
        setBarangays([]);
        setBarangaysError('Your assigned barangay is unavailable. Please sign in again.');
        return;
      }

      setBarangays([{ id: scopeBarangayId, name: scopeBarangayName }]);
      setBarangaysError(null);
      return;
    }

    setBarangaysLoading(true);
    const result = await fetchBarangays();
    setBarangaysLoading(false);
    if (result.error) {
      setBarangays([]);
      setBarangaysError(result.error);
      return;
    }
    setBarangays(result.barangays);
    setBarangaysError(null);
  }, [isBdrrmo, scopeBarangayId, scopeBarangayName]);

  const fetchLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);
    setNeedsConfirmation(false);
    setLocationConfirmed(false);

    const { position: gps, address: place, error: gpsError } =
      await getCurrentGpsWithAddress();

    setLocationLoading(false);

    if (!gps) {
      setPosition(null);
      setLocationError(gpsError ?? 'Could not get your location.');
      return;
    }

    setPosition(gps);
    if (place) {
      setAddress(place);
      if (!isBdrrmo) {
        setSelectedBarangayId(place.barangayId);
      }
    }

    const needsConfirm = isLowConfidenceLocation(gps);
    setNeedsConfirmation(needsConfirm);
    if (!needsConfirm) {
      setLocationConfirmed(true);
      setStep('attachments');
    }
  }, [isBdrrmo]);

  useEffect(() => {
    if (!canCreate) return;
    const initializationTimer = setTimeout(() => {
      void loadBarangays();
      void fetchLocation();
    }, 0);
    return () => clearTimeout(initializationTimer);
  }, [canCreate, loadBarangays, fetchLocation]);

  async function handleAddPhoto() {
    const result = await captureReportPhoto();
    if (result.error || !result.media) {
      setError(result.error || 'Could not capture photo.');
      return;
    }
    setError(null);
    setMedia((current) => [...current, result.media!]);
  }

  async function handleAddVideo() {
    const result = await captureReportVideo();
    if (result.error || !result.media) {
      setError(result.error || 'Could not capture video.');
      return;
    }
    setError(null);
    setMedia((current) => [...current, result.media!]);
  }

  async function handleConfirmPicker(nextPosition: GpsPosition) {
    setPosition(nextPosition);
    setNeedsConfirmation(false);
    setLocationConfirmed(true);
    setPickerVisible(false);
    const placeResult = await resolveReadableAddress(nextPosition);
    if (placeResult.address) {
      setAddress(placeResult.address);
      if (!isBdrrmo) {
        setSelectedBarangayId(placeResult.address.barangayId);
      }
    }
    setStep('attachments');
  }

  async function handleSubmit() {
    if (submitLock.current || submitting) return;
    if (!intakeChannel) { setError('Choose whether you observed this on site or are recording a caller account.'); return; }
    if (!position) {
      setError('Capture a GPS location first.');
      return;
    }
    if (!description.trim()) {
      setError('Enter a description.');
      return;
    }
    if (!incidentType) {
      setError('Select an incident type.');
      return;
    }
    if (incidentType === 'other' && !incidentTypeOther.trim()) {
      setError('Specify the incident type.');
      return;
    }
    if (isBdrrmo && !scope?.barangay_id) {
      setError('Your assigned barangay is unavailable. Please sign in again.');
      return;
    }
    const publishPublicPost = intakeChannel === 'official_field' && !markIncidentSensitive;
    if (publishPublicPost && !publicationAcknowledged) {
      setError('Review the report text and selected photos before publishing.');
      return;
    }
    if (intakeChannel === 'official_field' && markIncidentSensitive && !sensitivityReason.trim()) {
      setError('Give a short safety reason for marking this incident sensitive.');
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setError(null);

    const addressText = [address?.label, locationNote.trim()]
      .filter(Boolean)
      .join(' — ');

    let result: Awaited<ReturnType<typeof submitOfficialReport>>;
    try {
      result = await submitOfficialReport({
      reportId: submissionIdentity.reportId,
      operationId: submissionIdentity.operationId,
      intakeChannel,
      title,
      description,
      position,
      incidentType,
      incidentTypeOther:
        incidentType === 'other' ? incidentTypeOther : undefined,
      addressText: addressText || undefined,
      // The Edge Function repeats this authorization check before saving.
      barangayId: isBdrrmo ? scope?.barangay_id : selectedBarangayId,
      media,
      publishPublicPost,
      publicationAcknowledged,
      publicPhotoMediaIds: publishPublicPost ? publicPhotoMediaIds : [],
      markIncidentSensitive: intakeChannel === 'official_field' && markIncidentSensitive,
      sensitivityReason: markIncidentSensitive ? sensitivityReason : null,
      });
    } catch {
      result = { reportId: null, error: 'The connection ended before the server confirmed the result.', definitiveFailure: false };
    }

    setSubmitting(false);
    submitLock.current = false;

    if (result.error || !result.reportId) {
      setError(result.error || 'Could not log this incident.');
      setRetryOutcome(result.definitiveFailure ? 'definitive' : 'ambiguous');
      setStep('retry');
      return;
    }

    setRetryOutcome(null);
    setCreatedReportId(result.reportId);
    setPublicAvailable(result.publicAvailable === true);
    setPublicationStatus(result.publicationStatus ?? null);
    setError(null);
    setStep('done');
  }

  if (scopeLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <OfficialShellSkeleton />
      </SafeAreaView>
    );
  }

  if (!canCreate) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={[styles.scrollContent, { flex: 1, justifyContent: 'center' }]}>
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>Not available</Text>
            <Text style={styles.stateBody}>
              Only active BDRRMO and MDRRMO officers can record incidents.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={closeForm}
              activeOpacity={0.85}
            >
              <Text style={styles.retryButtonText}>Go back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.headerRow, { paddingHorizontal: 24, paddingTop: 8 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={closeForm}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTextGroup}>
            <Text style={styles.brandLabel}>DisasterLink</Text>
            <Text style={styles.screenTitle}>Log incident</Text>
            <Text style={styles.screenSubtitle}>
              GPS and description required · media optional
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: 8 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'location' ? (
              <LocationStep
                loading={locationLoading}
                error={locationError}
                position={position}
                address={address}
                needsConfirmation={needsConfirmation}
              accuracyMeters={position?.accuracyMeters ?? null}
              onRetry={() => void fetchLocation()}
              onConfirmOnMap={() => setPickerVisible(true)}
            />
          ) : null}

          {step === 'attachments' ? (
            <View style={styles.section}>
              <AttachmentsStep
                media={media}
                usedPhotoSlots={usedPhotoSlots}
                usedVideoSeconds={usedVideoSeconds}
                maxPhotos={MAX_PHOTOS}
                maxVideoSeconds={MAX_VIDEO_SECONDS}
                canProceed
                error={error}
                onAddPhoto={() => void handleAddPhoto()}
                onAddVideo={() => void handleAddVideo()}
                onRemove={(id) => {
                  const removedMedia = media.find((item) => item.id === id);
                  if (removedMedia) deletePersistedReportMedia(removedMedia);
                  setMedia((current) =>
                    current.filter((item) => item.id !== id),
                  );
                }}
                onNext={() => {
                  setError(null);
                  setStep('details');
                }}
              />
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => {
                  setError(null);
                  setStep('details');
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryActionText}>Skip media</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {step === 'details' ? (<>
            <WorkflowChoices label="How was this incident reported?" selected={intakeChannel} onSelect={setIntakeChannel} disabled={submitting} values={[{ value: 'official_field', label: 'I observed this on site' }, { value: 'hotline_call', label: "I'm recording a caller's account" }]} />
            <DetailsStep
              title={title}
              onChangeTitle={setTitle}
              description={description}
              onChangeDescription={setDescription}
              locationNote={locationNote}
              onChangeLocationNote={setLocationNote}
              incidentType={incidentType}
              onChangeIncidentType={(value) => {
                setIncidentType(value);
                if (value !== 'other') setIncidentTypeOther('');
              }}
              incidentTypeOther={incidentTypeOther}
              onChangeIncidentTypeOther={setIncidentTypeOther}
              address={address}
              barangays={barangays}
              barangaysLoading={barangaysLoading}
              barangaysError={barangaysError}
              selectedBarangayId={selectedBarangayId}
              onSelectBarangay={(id) => {
                if (isBdrrmo) return;
                setSelectedBarangayId(id);
              }}
              barangaySelectionLocked={isBdrrmo}
              barangayLockMessage={
                isBdrrmo
                  ? 'Locked to your assigned barangay.'
                  : undefined
              }
              onRetryBarangays={() => void loadBarangays()}
              locationConfirmed={locationConfirmed}
              error={error}
              submitting={submitting}
              onBack={() => setStep('attachments')}
              onSubmit={() => void handleSubmit()}
              submitLabel="Log incident"
            />
            {intakeChannel === 'official_field' ? (
              <View style={styles.section}>
                <ReportPublicationFields
                  sourceTitle={title}
                  sourceDescription={description}
                  acknowledged={publicationAcknowledged}
                  onAcknowledgedChange={setPublicationAcknowledged}
                  photos={media.filter((item) => item.type === 'photo').map((item) => ({
                    mediaId: item.id,
                    previewUrl: item.thumbnailLocalUri ?? item.displayLocalUri ?? item.localUri,
                    fullSizeUrl: item.displayLocalUri ?? item.localUri,
                    verified: false,
                    publicApproved: false,
                  }))}
                  selectedPhotoMediaIds={publicPhotoMediaIds}
                  onPhotoSelectionChange={setPublicPhotoMediaIds}
                  reporterNameAllowed={false}
                  approveReporterName={false}
                  onApproveReporterNameChange={() => undefined}
                  reporterAvatarAllowed={false}
                  approveReporterAvatar={false}
                  onApproveReporterAvatarChange={() => undefined}
                  exactLocationAllowed={false}
                  approveExactLocation={false}
                  onApproveExactLocationChange={() => undefined}
                  sensitive={markIncidentSensitive}
                  onSensitiveChange={setMarkIncidentSensitive}
                  sensitivityReason={sensitivityReason}
                  onSensitivityReasonChange={setSensitivityReason}
                  disabled={submitting}
                />
              </View>
            ) : null}
          </>) : null}

          {step === 'retry' ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>{retryOutcome === 'definitive' ? 'Submission was rejected' : 'Submission needs a retry'}</Text>
              <Text accessibilityRole="alert" style={styles.stateBody}>
                {error ?? (retryOutcome === 'definitive'
                  ? 'This request was rejected. You can edit and submit again with a new operation id.'
                  : 'The connection ended before the result was confirmed. Retry with the same report id and screened details.')}
              </Text>
              {retryOutcome === 'definitive' ? <>
                <TouchableOpacity style={styles.primaryAction} onPress={editRejectedSubmission} activeOpacity={0.85}>
                  <Text style={styles.primaryActionText}>Edit submission</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.retryButton} onPress={closeForm} activeOpacity={0.85}>
                  <Text style={styles.retryButtonText}>Discard rejected submission</Text>
                </TouchableOpacity>
              </> : <TouchableOpacity style={styles.primaryAction} onPress={() => void handleSubmit()} activeOpacity={0.85}>
                <Text style={styles.primaryActionText}>{submitting ? 'Retrying…' : 'Retry same submission'}</Text>
              </TouchableOpacity>}
            </View>
          ) : null}

          {step === 'done' ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>Incident logged</Text>
              <Text style={styles.stateBody}>
                {intakeChannel === 'hotline_call'
                  ? "The caller's account was recorded and is waiting for review. It remains private."
                  : publicAvailable
                  ? 'Your on-site observation was confirmed and its screened public report was published.'
                  : publicationStatus === 'sensitive'
                  ? 'Your on-site observation was confirmed and marked sensitive. Screened text, location detail, and photos remain hidden.'
                  : 'Your on-site observation was recorded.'}
              </Text>
              {createdReportId ? (
                <TouchableOpacity
                  style={styles.primaryAction}
                  onPress={() =>
                    router.replace(`/official/${createdReportId}` as Href)
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryActionText}>Open report</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => {
                  if (onSubmitted) {
                    onSubmitted();
                    return;
                  }
                  router.replace('/official/incidents' as Href);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryActionText}>Back to incidents</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {position ? (
        <ReportLocationPicker
          visible={pickerVisible}
          incidentPosition={position}
          onConfirm={(next) => void handleConfirmPicker(next)}
          onClose={() => setPickerVisible(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

export default function OfficialLogIncidentScreen() {
  return <OfficialReportForm />;
}
