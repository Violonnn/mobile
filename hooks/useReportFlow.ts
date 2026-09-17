import { useCallback, useEffect, useRef, useState } from 'react';
import {
  distanceBetweenCoordinates,
  getCurrentGpsWithAddress,
  getReportLocationAdjustmentLimit,
  isLowConfidenceLocation,
  resolveReadableAddress,
  type GpsPosition,
  type ReadableAddress,
} from '../lib/location';
import type { IncidentType } from '../lib/incidentTypes';
import {
  MAX_PHOTOS,
  MAX_VIDEO_SECONDS,
  captureReportPhoto,
  captureReportVideo,
  deletePersistedReportMedia,
  totalVideoSeconds,
  type CapturedMedia,
} from '../lib/reportMedia';
import { enqueueResidentReport } from '../lib/reports';
import { getQueuedReport } from '../lib/reportQueue';
import { flushReportQueue, onReportQueueChange } from '../lib/reportQueueFlush';
import { fetchBarangays, type BarangayOption } from '../lib/barangays';

// Resident review is explicit so nothing is submitted from the details form.
export type ReportStep =
  | 'location'
  | 'attachments'
  | 'details'
  | 'review'
  | 'success';
export type SyncStatus = 'syncing' | 'synced' | 'delayed' | 'failed';

// Progress checkpoints (deliberate jumps, not linear).
const PROGRESS = {
  locationDone: 25,
  firstAttachment: 38,
  bothAttachments: 50,
  detailsFilled: 75,
  review: 100,
  submitted: 100,
} as const;

const MUNICIPALITY_LABEL = 'Minglanilla';

function attachmentsProgress(media: CapturedMedia[]): number {
  const hasPhoto = media.some((m) => m.type === 'photo');
  const hasVideo = media.some((m) => m.type === 'video');
  if (hasPhoto && hasVideo) return PROGRESS.bothAttachments;
  if (hasPhoto || hasVideo) return PROGRESS.firstAttachment;
  return PROGRESS.locationDone;
}

function buildAddressFromBarangay(
  barangay: BarangayOption,
  municipality = MUNICIPALITY_LABEL,
): ReadableAddress {
  return {
    barangayId: barangay.id,
    barangay: barangay.name,
    municipality,
    label: `${barangay.name}, ${municipality}`,
  };
}

export function useReportFlow(active: boolean) {
  const [step, setStep] = useState<ReportStep>('location');
  const [progress, setProgress] = useState(0);

  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [devicePosition, setDevicePosition] = useState<GpsPosition | null>(null);
  const [address, setAddress] = useState<ReadableAddress | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationNeedsConfirmation, setLocationNeedsConfirmation] =
    useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [barangaysLoading, setBarangaysLoading] = useState(false);
  const [barangaysError, setBarangaysError] = useState<string | null>(null);
  const [selectedBarangayId, setSelectedBarangayIdState] = useState<
    string | null
  >(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [incidentType, setIncidentTypeState] = useState<IncidentType | null>(null);
  const [incidentTypeOther, setIncidentTypeOther] = useState('');
  const [media, setMedia] = useState<CapturedMedia[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [queuedReportId, setQueuedReportId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncCanRetry, setSyncCanRetry] = useState(true);

  const submitLock = useRef(false);
  // Keep a resident's manual barangay pick across GPS retries / pin moves.
  const barangayManuallySelected = useRef(false);
  const barangaysRef = useRef<BarangayOption[]>([]);

  const usedPhotoSlots = media.filter((m) => m.type === 'photo').length;
  const usedVideoSeconds = totalVideoSeconds(media);
  const canProceedAttachments =
    media.length >= 1 &&
    usedPhotoSlots <= MAX_PHOTOS &&
    usedVideoSeconds <= MAX_VIDEO_SECONDS;
  const maximumAdjustmentMeters = getReportLocationAdjustmentLimit(
    devicePosition?.accuracyMeters,
  );
  const movedDistanceMeters =
    devicePosition && position
      ? distanceBetweenCoordinates(devicePosition, position)
      : 0;

  const loadBarangays = useCallback(async () => {
    setBarangaysLoading(true);
    setBarangaysError(null);
    const { barangays: options, error: loadError } = await fetchBarangays();
    setBarangaysLoading(false);

    if (loadError) {
      setBarangays([]);
      barangaysRef.current = [];
      setBarangaysError(loadError);
      return;
    }

    setBarangays(options);
    barangaysRef.current = options;
    setBarangaysError(null);
  }, []);

  const applySuggestedBarangay = useCallback(
    (place: ReadableAddress | null) => {
      if (!place) return;

      // Never overwrite a barangay the resident already chose by hand.
      if (barangayManuallySelected.current) return;

      setSelectedBarangayIdState(place.barangayId);
      setAddress(place);
    },
    [],
  );

  const fetchLocation = useCallback(
    async () => {
      setLocationLoading(true);
      setLocationError(null);
      setLocationNeedsConfirmation(false);
      setLocationConfirmed(false);
      setLocationPickerVisible(false);
      setProgress(0);

      const { position: gps, address: place, error: gpsError } =
        await getCurrentGpsWithAddress();

      setLocationLoading(false);

      if (!gps) {
        setPosition(null);
        setDevicePosition(null);
        setLocationError(gpsError ?? 'Could not get your location.');
        return;
      }

      setPosition(gps);
      // Device position stays separate and immutable for this report draft.
      setDevicePosition(gps);
      applySuggestedBarangay(place);

      const needsConfirm = isLowConfidenceLocation(gps);
      setLocationNeedsConfirmation(needsConfirm);
      // Address resolution is only a suggestion; low-confidence UX owns the step.
      setLocationError(
        needsConfirm
          ? null
          : place || barangayManuallySelected.current
            ? null
            : gpsError,
      );
      setProgress(PROGRESS.locationDone);
    },
    [applySuggestedBarangay],
  );

  const reset = useCallback(() => {
    setStep('location');
    setProgress(0);
    setPosition(null);
    setDevicePosition(null);
    setAddress(null);
    setLocationError(null);
    setLocationLoading(false);
    setLocationNeedsConfirmation(false);
    setLocationConfirmed(false);
    setLocationPickerVisible(false);
    setSelectedBarangayIdState(null);
    barangayManuallySelected.current = false;
    setTitle('');
    setDescription('');
    setLocationNote('');
    setIncidentTypeState(null);
    setIncidentTypeOther('');
    setMedia([]);
    setError(null);
    setSubmitting(false);
    setQueuedReportId(null);
    setSyncStatus('syncing');
    setSyncError(null);
    setSyncCanRetry(true);
    submitLock.current = false;
  }, []);

  useEffect(() => {
    if (!active) return;
    const initializationTimer = setTimeout(() => {
      reset();
      void loadBarangays();
      void fetchLocation();
    }, 0);
    return () => {
      clearTimeout(initializationTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const retryLocation = useCallback(() => {
    void fetchLocation();
  }, [fetchLocation]);

  const openLocationPicker = useCallback(() => {
    if (!position || !devicePosition) return;
    setLocationPickerVisible(true);
  }, [devicePosition, position]);

  const closeLocationPicker = useCallback(() => {
    setLocationPickerVisible(false);
  }, []);

  const confirmManualPosition = useCallback(
    async (nextPosition: GpsPosition) => {
      if (!devicePosition) return;

      const adjustmentMeters = distanceBetweenCoordinates(
        devicePosition,
        nextPosition,
      );
      if (adjustmentMeters > maximumAdjustmentMeters) {
        setLocationError(
          `Keep the incident pin within ${Math.round(maximumAdjustmentMeters)} m of the verified device location.`,
        );
        return;
      }

      // Only the incident coordinate moves. GPS origin and accuracy stay intact.
      const confirmed: GpsPosition = {
        latitude: nextPosition.latitude,
        longitude: nextPosition.longitude,
        accuracyMeters: devicePosition.accuracyMeters,
      };

      setPosition(confirmed);
      setLocationConfirmed(false);
      setLocationPickerVisible(false);
      setLocationError(null);
      setProgress(PROGRESS.locationDone);

      if (!barangayManuallySelected.current) {
        const { address: place } = await resolveReadableAddress(confirmed);
        applySuggestedBarangay(place);
      }

    },
    [
      applySuggestedBarangay,
      devicePosition,
      maximumAdjustmentMeters,
    ],
  );

  const confirmLocation = useCallback(() => {
    if (!position || !devicePosition) {
      setLocationError('Capture a GPS location before continuing.');
      return;
    }

    if (movedDistanceMeters > maximumAdjustmentMeters) {
      setLocationError(
        `Keep the incident pin within ${Math.round(maximumAdjustmentMeters)} m of the verified device location.`,
      );
      return;
    }

    setLocationConfirmed(true);
    setLocationError(null);
    setStep('attachments');
  }, [devicePosition, maximumAdjustmentMeters, movedDistanceMeters, position]);

  const setSelectedBarangayId = useCallback((id: string) => {
    const match = barangaysRef.current.find((item) => item.id === id);
    if (!match) return;

    barangayManuallySelected.current = true;
    setSelectedBarangayIdState(id);
    setAddress((prev) =>
      buildAddressFromBarangay(match, prev?.municipality ?? MUNICIPALITY_LABEL),
    );
  }, []);

  const retryBarangays = useCallback(() => {
    void loadBarangays();
  }, [loadBarangays]);

  const addPhoto = useCallback(async () => {
    setError(null);
    if (media.filter((m) => m.type === 'photo').length >= MAX_PHOTOS) {
      setError(`You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const { media: captured, error: captureError } = await captureReportPhoto();
    if (captureError) {
      setError(captureError);
      return;
    }
    if (!captured) return;
    setMedia((prev) => {
      const next = [...prev, captured];
      setProgress((p) => Math.max(p, attachmentsProgress(next)));
      return next;
    });
  }, [media]);

  const addVideo = useCallback(async () => {
    setError(null);
    const { media: captured, error: captureError } = await captureReportVideo();
    if (captureError) {
      setError(captureError);
      return;
    }
    if (!captured) return;
    const duration = captured.durationSeconds ?? 0;
    if (totalVideoSeconds(media) + duration > MAX_VIDEO_SECONDS) {
      deletePersistedReportMedia(captured);
      setError(`Videos must stay within ${MAX_VIDEO_SECONDS}s total.`);
      return;
    }
    setMedia((prev) => {
      const next = [...prev, captured];
      setProgress((p) => Math.max(p, attachmentsProgress(next)));
      return next;
    });
  }, [media]);

  const removeMedia = useCallback(
    (id: string) => {
      setError(null);
      const removedMedia = media.find((item) => item.id === id);
      if (removedMedia) deletePersistedReportMedia(removedMedia);

      setMedia((previousMedia) => {
        const next = previousMedia.filter((item) => item.id !== id);
        setProgress(attachmentsProgress(next));
        return next;
      });
    },
    [media],
  );

  const discardDraftMedia = useCallback(() => {
    media.forEach(deletePersistedReportMedia);
  }, [media]);

  const goToDetails = useCallback(() => {
    setError(null);
    if (!canProceedAttachments) {
      setError('Add at least one clear photo or video.');
      return;
    }
    setStep('details');
  }, [canProceedAttachments]);

  const setIncidentType = useCallback((value: IncidentType) => {
    setIncidentTypeState(value);
    if (value !== 'other') {
      setIncidentTypeOther('');
    }
    setError(null);
  }, []);

  const validateDetails = useCallback((): boolean => {
    if (!incidentType) {
      setError('Select an incident type.');
      return false;
    }
    if (incidentType === 'other' && !incidentTypeOther.trim()) {
      setError('Specify the incident type.');
      return false;
    }
    if (!selectedBarangayId) {
      setError(
        barangaysError
          ? 'Barangay list could not load. Retry before continuing.'
          : 'Select a barangay before continuing.',
      );
      return false;
    }
    if (barangaysError || barangays.length === 0) {
      setError('Barangay list could not load. Retry before continuing.');
      return false;
    }
    if (!barangays.some((item) => item.id === selectedBarangayId)) {
      setError('The selected barangay is no longer available. Please select again.');
      return false;
    }
    if (!title.trim()) {
      setError('Title is required.');
      return false;
    }
    if (!description.trim()) {
      setError('Description of the report is required.');
      return false;
    }
    return true;
  }, [
    barangays,
    barangaysError,
    description,
    incidentType,
    incidentTypeOther,
    selectedBarangayId,
    title,
  ]);

  const goToReview = useCallback(() => {
    setError(null);
    if (!validateDetails()) return;
    setProgress(PROGRESS.review);
    setStep('review');
  }, [validateDetails]);

  const goBack = useCallback(() => {
    setError(null);
    if (step === 'review') {
      setStep('details');
      return;
    }
    if (step === 'details') {
      setStep('attachments');
      setProgress(attachmentsProgress(media));
      return;
    }
    if (step === 'attachments') {
      setStep('location');
      setProgress(PROGRESS.locationDone);
    }
  }, [step, media]);

  const editLocation = useCallback(() => {
    setError(null);
    setLocationConfirmed(false);
    setStep('location');
    setProgress(PROGRESS.locationDone);
  }, []);

  const editEvidence = useCallback(() => {
    setError(null);
    setStep('attachments');
    setProgress(attachmentsProgress(media));
  }, [media]);

  const editDetails = useCallback(() => {
    setError(null);
    setStep('details');
  }, []);

  // Details progress is derived directly so typing does not require an effect-driven render.
  const visibleProgress =
    step === 'details'
      ? incidentType && title.trim() && description.trim()
        ? PROGRESS.detailsFilled
        : PROGRESS.bothAttachments
      : step === 'review'
        ? PROGRESS.review
      : progress;

  const submit = useCallback(async () => {
    if (submitLock.current) return;
    if (!position || !devicePosition) {
      setError('Capture and confirm a GPS location before sending.');
      return;
    }
    if (movedDistanceMeters > maximumAdjustmentMeters) {
      setError(
        `The incident pin must stay within ${Math.round(maximumAdjustmentMeters)} m of the verified device location.`,
      );
      return;
    }
    if (!validateDetails() || !selectedBarangayId || !incidentType) return;
    submitLock.current = true;
    setSubmitting(true);
    setError(null);

    const { reportId, error: submitError } = await enqueueResidentReport({
      title,
      description,
      position,
      devicePosition,
      addressText: address?.label,
      locationNote,
      incidentType,
      incidentTypeOther:
        incidentType === 'other' ? incidentTypeOther : undefined,
      media,
      barangayId: selectedBarangayId,
    });

    setSubmitting(false);

    if (submitError || !reportId) {
      submitLock.current = false;
      setError(submitError ?? 'Could not save your report.');
      return;
    }

    setQueuedReportId(reportId);
    setSyncStatus('syncing');
    setSyncError(null);
    setSyncCanRetry(true);
    setProgress(PROGRESS.submitted);
    setStep('success');
  }, [
    title,
    description,
    position,
    devicePosition,
    address,
    locationNote,
    incidentType,
    incidentTypeOther,
    media,
    selectedBarangayId,
    maximumAdjustmentMeters,
    movedDistanceMeters,
    validateDetails,
  ]);

  useEffect(() => {
    if (step !== 'success' || !queuedReportId) return;

    let cancelled = false;
    const check = async () => {
      const queued = await getQueuedReport(queuedReportId);
      if (cancelled) return;
      if (!queued) {
        // Missing local state is not proof that Supabase received the report.
        setSyncStatus('failed');
        setSyncError('We could not confirm this report was sent.');
        setSyncCanRetry(false);
        return;
      }

      if (queued.status === 'synced') {
        setSyncStatus('synced');
        setSyncError(null);
        setSyncCanRetry(false);
        return;
      }

      if (queued.lastError) {
        setSyncStatus('failed');
        setSyncError(queued.lastError);
        setSyncCanRetry(true);
        return;
      }

      if (queued.deliveryDelayedAt) {
        setSyncStatus('delayed');
        setSyncError(null);
        return;
      }

      setSyncStatus('syncing');
      setSyncError(null);
      setSyncCanRetry(true);
    };
    void check();
    const unsub = onReportQueueChange(check);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [step, queuedReportId]);

  const retrySync = useCallback(() => {
    if (!queuedReportId) return;
    setSyncStatus('syncing');
    setSyncError(null);
    setSyncCanRetry(true);
    void flushReportQueue();
  }, [queuedReportId]);

  return {
    step,
    progress: visibleProgress,
    // location
    position,
    devicePosition,
    address,
    locationError,
    locationLoading,
    locationNeedsConfirmation,
    locationConfirmed,
    locationPickerVisible,
    retryLocation,
    openLocationPicker,
    closeLocationPicker,
    confirmManualPosition,
    confirmLocation,
    maximumAdjustmentMeters,
    movedDistanceMeters,
    // barangay
    barangays,
    barangaysLoading,
    barangaysError,
    selectedBarangayId,
    setSelectedBarangayId,
    retryBarangays,
    // attachments
    media,
    usedPhotoSlots,
    usedVideoSeconds,
    addPhoto,
    addVideo,
    removeMedia,
    discardDraftMedia,
    canProceedAttachments,
    goToDetails,
    editEvidence,
    // details
    title,
    setTitle,
    description,
    setDescription,
    locationNote,
    setLocationNote,
    incidentType,
    setIncidentType,
    incidentTypeOther,
    setIncidentTypeOther,
    goToReview,
    editDetails,
    editLocation,
    // shared
    error,
    submitting,
    goBack,
    submit,
    reset,
    // success
    syncStatus,
    syncError,
    syncCanRetry,
    retrySync,
    queuedReportId,
    maxPhotos: MAX_PHOTOS,
    maxVideoSeconds: MAX_VIDEO_SECONDS,
  };
}
