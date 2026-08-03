import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCurrentGpsWithAddress,
  isLowConfidenceLocation,
  resolveReadableAddress,
  type GpsPosition,
  type ReadableAddress,
} from '../lib/location';
import {
  MAX_PHOTOS,
  MAX_VIDEO_SECONDS,
  captureReportPhoto,
  captureReportVideo,
  totalVideoSeconds,
  type CapturedMedia,
} from '../lib/reportMedia';
import { enqueueResidentReport } from '../lib/reports';
import { getQueuedReport } from '../lib/reportQueue';
import { flushReportQueue, onReportQueueChange } from '../lib/reportQueueFlush';
import { fetchBarangays, type BarangayOption } from '../lib/barangays';

// Step order: location -> attachments ("What are you seeing?") -> details.
export type ReportStep = 'location' | 'attachments' | 'details' | 'success';
export type SyncStatus = 'syncing' | 'synced' | 'failed';

// Progress checkpoints (deliberate jumps, not linear).
const PROGRESS = {
  locationDone: 20,
  firstAttachment: 45,
  bothAttachments: 70,
  detailsFilled: 99,
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
  const [media, setMedia] = useState<CapturedMedia[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [queuedReportId, setQueuedReportId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const [syncError, setSyncError] = useState<string | null>(null);

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitLock = useRef(false);
  // Keep a resident's manual barangay pick across GPS retries / pin moves.
  const barangayManuallySelected = useRef(false);
  const barangaysRef = useRef<BarangayOption[]>([]);

  const usedPhotoSlots = media.filter((m) => m.type === 'photo').length;
  const usedVideoSeconds = totalVideoSeconds(media);
  const canProceedAttachments =
    media.some((m) => m.type === 'photo') &&
    media.some((m) => m.type === 'video') &&
    usedPhotoSlots <= MAX_PHOTOS &&
    usedVideoSeconds <= MAX_VIDEO_SECONDS;

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
    async (autoAdvance: boolean) => {
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
        setLocationError(gpsError ?? 'Could not get your location.');
        return;
      }

      setPosition(gps);
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

      // High-confidence fixes may advance; low-confidence stays on location.
      if (autoAdvance && !needsConfirm) {
        advanceTimer.current = setTimeout(() => {
          setStep('attachments');
        }, 450);
      }
    },
    [applySuggestedBarangay],
  );

  const reset = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setStep('location');
    setProgress(0);
    setPosition(null);
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
    setMedia([]);
    setError(null);
    setSubmitting(false);
    setQueuedReportId(null);
    setSyncStatus('syncing');
    setSyncError(null);
    submitLock.current = false;
  }, []);

  useEffect(() => {
    if (!active) return;
    reset();
    void loadBarangays();
    void fetchLocation(true);
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const retryLocation = useCallback(() => {
    void fetchLocation(step === 'location');
  }, [fetchLocation, step]);

  const openLocationPicker = useCallback(() => {
    if (!position) return;
    setLocationPickerVisible(true);
  }, [position]);

  const closeLocationPicker = useCallback(() => {
    setLocationPickerVisible(false);
  }, []);

  const confirmManualPosition = useCallback(
    async (nextPosition: GpsPosition) => {
      // Keep original GPS accuracy so the pin stays marked low-confidence;
      // explicit map confirmation is what unlocks the rest of the flow.
      const confirmed: GpsPosition = {
        latitude: nextPosition.latitude,
        longitude: nextPosition.longitude,
        accuracyMeters: position?.accuracyMeters ?? null,
      };

      setPosition(confirmed);
      setLocationConfirmed(true);
      setLocationNeedsConfirmation(false);
      setLocationPickerVisible(false);
      setLocationError(null);
      setProgress(PROGRESS.locationDone);

      if (!barangayManuallySelected.current) {
        const { address: place } = await resolveReadableAddress(confirmed);
        applySuggestedBarangay(place);
      }

      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        setStep('attachments');
      }, 450);
    },
    [position?.accuracyMeters, applySuggestedBarangay],
  );

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
      setError(`Videos must stay within ${MAX_VIDEO_SECONDS}s total.`);
      return;
    }
    setMedia((prev) => {
      const next = [...prev, captured];
      setProgress((p) => Math.max(p, attachmentsProgress(next)));
      return next;
    });
  }, [media]);

  const removeMedia = useCallback((id: string) => {
    setError(null);
    setMedia((prev) => {
      const next = prev.filter((m) => m.id !== id);
      setProgress(attachmentsProgress(next));
      return next;
    });
  }, []);

  const goToDetails = useCallback(() => {
    setError(null);
    if (!canProceedAttachments) {
      setError('Capture at least one photo and one video.');
      return;
    }
    setStep('details');
  }, [canProceedAttachments]);

  const goBack = useCallback(() => {
    setError(null);
    if (step === 'details') {
      setStep('attachments');
      setProgress(attachmentsProgress(media));
    }
  }, [step, media]);

  // Details step is "live": progress reflects title + description.
  useEffect(() => {
    if (step !== 'details') return;
    const ready = title.trim() && description.trim();
    setProgress(ready ? PROGRESS.detailsFilled : PROGRESS.bothAttachments);
  }, [step, title, description]);

  const submit = useCallback(async () => {
    if (submitLock.current || !position) return;

    if (!selectedBarangayId) {
      setError(
        barangaysError
          ? 'Barangay list could not load. Retry before submitting.'
          : 'Select a barangay before submitting.',
      );
      return;
    }

    if (barangaysError || barangays.length === 0) {
      setError('Barangay list could not load. Retry before submitting.');
      return;
    }

    const barangayExists = barangays.some((item) => item.id === selectedBarangayId);
    if (!barangayExists) {
      setError('The selected barangay is no longer available. Please select again.');
      return;
    }

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!description.trim()) {
      setError('Description of the report is required.');
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setError(null);

    const { reportId, error: submitError } = await enqueueResidentReport({
      title,
      description,
      position,
      addressText: address?.label,
      locationNote,
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
    setProgress(PROGRESS.submitted);
    setStep('success');
  }, [
    title,
    description,
    position,
    address,
    locationNote,
    media,
    selectedBarangayId,
    barangays,
    barangaysError,
  ]);

  useEffect(() => {
    if (step !== 'success' || !queuedReportId) return;

    let cancelled = false;
    const check = async () => {
      const queued = await getQueuedReport(queuedReportId);
      if (cancelled) return;
      if (!queued || queued.status === 'synced') {
        setSyncStatus('synced');
        setSyncError(null);
        return;
      }

      if (queued.lastError) {
        setSyncStatus('failed');
        setSyncError(queued.lastError);
        return;
      }

      setSyncStatus('syncing');
      setSyncError(null);
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
    void flushReportQueue();
  }, [queuedReportId]);

  return {
    step,
    progress,
    // location
    position,
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
    canProceedAttachments,
    goToDetails,
    // details
    title,
    setTitle,
    description,
    setDescription,
    locationNote,
    setLocationNote,
    // shared
    error,
    submitting,
    goBack,
    submit,
    reset,
    // success
    syncStatus,
    syncError,
    retrySync,
    queuedReportId,
    maxPhotos: MAX_PHOTOS,
    maxVideoSeconds: MAX_VIDEO_SECONDS,
  };
}
