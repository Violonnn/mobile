// app/official/log-incident.tsx
// Log a verified field incident (BDRRMO/MDRRMO only).
// Reuses location / optional media / details pieces; submits via Edge Function.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
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
  totalVideoSeconds,
  type CapturedMedia,
} from '../../lib/reportMedia';
import { fetchBarangays, type BarangayOption } from '../../lib/barangays';
import { submitOfficialReport } from '../../lib/officialReportSubmit';

type Step = 'location' | 'attachments' | 'details' | 'done';

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
    null,
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [media, setMedia] = useState<CapturedMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdReportId, setCreatedReportId] = useState<string | null>(null);

  const submitLock = useRef(false);
  const isBdrrmo = officialKind === 'BDRRMO';
  const canCreate = officialKind === 'BDRRMO' || officialKind === 'MDRRMO';

  const closeForm = () => {
    if (onClose) {
      onClose();
      return;
    }
    router.back();
  };

  const usedPhotoSlots = media.filter((m) => m.type === 'photo').length;
  const usedVideoSeconds = totalVideoSeconds(media);

  const loadBarangays = useCallback(async () => {
    // BDRRMO reports always use the server-assigned barangay, so do not show
    // other barangays as client-side choices.
    if (isBdrrmo) {
      if (!scope?.barangay_id || !scope.barangay_name) {
        setBarangays([]);
        setBarangaysError('Your assigned barangay is unavailable. Please sign in again.');
        return;
      }

      setBarangays([{ id: scope.barangay_id, name: scope.barangay_name }]);
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
  }, [isBdrrmo, scope?.barangay_id, scope?.barangay_name]);

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
    void loadBarangays();
    void fetchLocation();
  }, [canCreate, loadBarangays, fetchLocation]);

  useEffect(() => {
    if (isBdrrmo && scope?.barangay_id) {
      setSelectedBarangayId(scope.barangay_id);
    }
  }, [isBdrrmo, scope?.barangay_id]);

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
    if (!position) {
      setError('Capture a GPS location first.');
      return;
    }
    if (!description.trim()) {
      setError('Enter a description.');
      return;
    }
    if (isBdrrmo && !scope?.barangay_id) {
      setError('Your assigned barangay is unavailable. Please sign in again.');
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setError(null);

    const addressText = [address?.label, locationNote.trim()]
      .filter(Boolean)
      .join(' — ');

    const result = await submitOfficialReport({
      title,
      description,
      position,
      addressText: addressText || undefined,
      // The Edge Function repeats this authorization check before saving.
      barangayId: isBdrrmo ? scope?.barangay_id : selectedBarangayId,
      media,
    });

    setSubmitting(false);
    submitLock.current = false;

    if (result.error || !result.reportId) {
      setError(result.error || 'Could not log this incident.');
      return;
    }

    setCreatedReportId(result.reportId);
    setStep('done');
  }

  if (scopeLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.themeSoft} />
        </View>
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
              Only active BDRRMO and MDRRMO officers can log verified incidents.
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
            <Text style={styles.screenTitle}>Log verified incident</Text>
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
                onRemove={(id) =>
                  setMedia((current) => current.filter((item) => item.id !== id))
                }
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

          {step === 'details' ? (
            <DetailsStep
              title={title}
              onChangeTitle={setTitle}
              description={description}
              onChangeDescription={setDescription}
              locationNote={locationNote}
              onChangeLocationNote={setLocationNote}
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
            />
          ) : null}

          {step === 'done' ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>Incident logged</Text>
              <Text style={styles.stateBody}>
                The report was saved as verified. You can open it now or return
                to the queue.
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
          initialPosition={position}
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
