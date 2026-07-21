import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCurrentGpsWithAddress,
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
import { onReportQueueChange } from '../lib/reportQueueFlush';

// Step order: location -> attachments ("What are you seeing?") -> details.
export type ReportStep = 'location' | 'attachments' | 'details' | 'success';
export type SyncStatus = 'syncing' | 'synced';

// Progress checkpoints (deliberate jumps, not linear).
const PROGRESS = {
  locationDone: 20,
  firstAttachment: 45,
  bothAttachments: 70,
  detailsFilled: 99,
  submitted: 100,
} as const;

function attachmentsProgress(media: CapturedMedia[]): number {
  const hasPhoto = media.some((m) => m.type === 'photo');
  const hasVideo = media.some((m) => m.type === 'video');
  if (hasPhoto && hasVideo) return PROGRESS.bothAttachments;
  if (hasPhoto || hasVideo) return PROGRESS.firstAttachment;
  return PROGRESS.locationDone;
}

export function useReportFlow(active: boolean) {
  const [step, setStep] = useState<ReportStep>('location');
  const [progress, setProgress] = useState(0);

  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [address, setAddress] = useState<ReadableAddress | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [media, setMedia] = useState<CapturedMedia[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [queuedReportId, setQueuedReportId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitLock = useRef(false);

  const usedPhotoSlots = media.filter((m) => m.type === 'photo').length;
  const usedVideoSeconds = totalVideoSeconds(media);
  const canProceedAttachments =
    media.some((m) => m.type === 'photo') &&
    media.some((m) => m.type === 'video') &&
    usedPhotoSlots <= MAX_PHOTOS &&
    usedVideoSeconds <= MAX_VIDEO_SECONDS;

  const fetchLocation = useCallback(async (autoAdvance: boolean) => {
    setLocationLoading(true);
    setLocationError(null);
    setProgress(0);

    const { position: gps, address: place, error: gpsError } =
      await getCurrentGpsWithAddress();

    setLocationLoading(false);

    if (!gps) {
      setLocationError(gpsError ?? 'Could not get your location.');
      return;
    }

    setPosition(gps);
    setAddress(place);
    setLocationError(place ? null : gpsError);
    setProgress(PROGRESS.locationDone);

    if (autoAdvance) {
      // Auto-advance to the attachments step; the bar holds at 20% until the
      // first attachment is added.
      advanceTimer.current = setTimeout(() => {
        setStep('attachments');
      }, 450);
    }
  }, []);

  const reset = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setStep('location');
    setProgress(0);
    setPosition(null);
    setAddress(null);
    setLocationError(null);
    setLocationLoading(false);
    setTitle('');
    setDescription('');
    setLocationNote('');
    setMedia([]);
    setError(null);
    setSubmitting(false);
    setQueuedReportId(null);
    setSyncStatus('syncing');
    submitLock.current = false;
  }, []);

  useEffect(() => {
    if (!active) return;
    reset();
    void fetchLocation(true);
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const retryLocation = useCallback(() => {
    void fetchLocation(step === 'location');
  }, [fetchLocation, step]);

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
    });

    setSubmitting(false);

    if (submitError || !reportId) {
      submitLock.current = false;
      setError(submitError ?? 'Could not save your report.');
      return;
    }

    setQueuedReportId(reportId);
    setSyncStatus('syncing');
    setProgress(PROGRESS.submitted);
    setStep('success');
  }, [title, description, position, address, locationNote, media]);

  useEffect(() => {
    if (step !== 'success' || !queuedReportId) return;

    let cancelled = false;
    const check = async () => {
      const queued = await getQueuedReport(queuedReportId);
      if (cancelled) return;
      setSyncStatus(!queued || queued.status === 'synced' ? 'synced' : 'syncing');
    };
    void check();
    const unsub = onReportQueueChange(check);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [step, queuedReportId]);

  return {
    step,
    progress,
    // location
    position,
    address,
    locationError,
    locationLoading,
    retryLocation,
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
    queuedReportId,
    maxPhotos: MAX_PHOTOS,
    maxVideoSeconds: MAX_VIDEO_SECONDS,
  };
}
