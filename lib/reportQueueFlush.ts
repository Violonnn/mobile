import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { getActiveSession } from './auth';
import { readEdgeFunctionErrorMessage } from './edgeFunctionErrors';
import {
  deletePersistedReportMedia,
  isTransientMediaUploadError,
  uploadReportMedia,
} from './reportMedia';
import {
  getPendingReports,
  markMediaUploaded,
  markQueuedReportDeliveryDelayed,
  markQueuedReportSynced,
  pruneSyncedReportHistory,
  updateQueuedReport,
  type QueuedReport,
} from './reportQueue';

let isFlushing = false;
let listenersBound = false;
let automaticRetryTimer: ReturnType<typeof setTimeout> | null = null;
let automaticRetryDelayMs = 5_000;
const deliveryValidationTimers = new Map<
  string,
  ReturnType<typeof setTimeout>
>();

const MAXIMUM_AUTOMATIC_RETRY_DELAY_MS = 60_000;
const DELIVERY_VALIDATION_DELAY_MS = 30_000;

type FlushListener = () => void;
const listeners = new Set<FlushListener>();

/** Notify UI (e.g. the success screen sync chip) that queue state changed. */
export function onReportQueueChange(listener: FlushListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitChange(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // ignore listener errors
    }
  });
}

/** Call after enqueue so the map can show a pending pin immediately. */
export function notifyReportQueueChange(): void {
  emitChange();
}

function clearDeliveryValidation(reportId: string): void {
  const timer = deliveryValidationTimers.get(reportId);
  if (timer) clearTimeout(timer);
  deliveryValidationTimers.delete(reportId);
}

async function markReportDeliveryDelayed(reportId: string): Promise<void> {
  const didChange = await markQueuedReportDeliveryDelayed(
    reportId,
    new Date().toISOString(),
  );
  if (!didChange) return;

  emitChange();
}

function scheduleDeliveryValidation(
  reportId: string,
  reportCreatedAt: string,
): void {
  if (deliveryValidationTimers.has(reportId)) return;

  const reportCreatedAtMs = Date.parse(reportCreatedAt);
  const elapsedDeliveryMs = Number.isFinite(reportCreatedAtMs)
    ? Math.max(0, Date.now() - reportCreatedAtMs)
    : 0;
  const remainingValidationMs = Math.max(
    0,
    DELIVERY_VALIDATION_DELAY_MS - elapsedDeliveryMs,
  );

  const timer = setTimeout(() => {
    deliveryValidationTimers.delete(reportId);
    void markReportDeliveryDelayed(reportId);
  }, remainingValidationMs);
  deliveryValidationTimers.set(reportId, timer);
}

/**
 * Upload any still-pending media for one report, then insert the report row.
 * Idempotent: already-uploaded media is skipped, and the same reportId is
 * reused so a retry resumes instead of restarting.
 */
async function syncReport(
  report: QueuedReport,
  userId: string,
): Promise<{ synced: boolean; error: string | null; retryable: boolean }> {
  const uploaded: {
    id: string;
    type: 'photo' | 'video';
    storagePath: string;
    displayStoragePath: string | null;
    thumbnailStoragePath: string | null;
    durationSeconds: number | null;
    fileSizeBytes: number | null;
    width: number | null;
    height: number | null;
  }[] = [];

  for (const item of report.media) {
    if (item.uploadStatus === 'uploaded' && item.storagePath) {
      uploaded.push({
        id: item.id,
        type: item.type,
        storagePath: item.storagePath,
        displayStoragePath: item.displayStoragePath ?? null,
        thumbnailStoragePath: item.thumbnailStoragePath ?? null,
        durationSeconds: item.durationSeconds,
        fileSizeBytes: item.fileSizeBytes ?? null,
        width: item.width ?? null,
        height: item.height ?? null,
      });
      continue;
    }

    const {
      storagePath,
      displayStoragePath,
      thumbnailStoragePath,
      error,
      retryable,
    } = await uploadReportMedia({
      userId,
      reportId: report.id,
      media: item,
    });
    if (error || !storagePath) {
      return {
        synced: false,
        error: error ?? 'Media upload failed.',
        retryable,
      };
    }

    await markMediaUploaded(report.id, item.id, {
      storagePath,
      displayStoragePath,
      thumbnailStoragePath,
    });
    emitChange();
    uploaded.push({
      id: item.id,
      type: item.type,
      storagePath,
      displayStoragePath,
      thumbnailStoragePath,
      durationSeconds: item.durationSeconds,
      fileSizeBytes: item.fileSizeBytes ?? null,
      width: item.width ?? null,
      height: item.height ?? null,
    });
  }

  try {
    const { error, response } = await supabase.functions.invoke(
      'create-report',
      {
        body: {
          reportId: report.id,
          title: report.title,
          description: report.description,
          incidentType: report.incidentType,
          incidentTypeOther: report.incidentTypeOther,
          latitude: report.position.latitude,
          longitude: report.position.longitude,
          deviceLatitude:
            report.devicePosition?.latitude ?? report.position.latitude,
          deviceLongitude:
            report.devicePosition?.longitude ?? report.position.longitude,
          gpsAccuracyMeters:
            report.devicePosition?.accuracyMeters ??
            report.position.accuracyMeters ??
            undefined,
          addressText: report.addressText || undefined,
          // Omit for legacy queue rows so the server uses centroid fallback.
          barangayId: report.barangayId || undefined,
          media: uploaded,
        },
      },
    );

    if (error) {
      const message = await readEdgeFunctionErrorMessage(
        error,
        response,
        'Could not submit your report. Please try again.',
      );
      return {
        synced: false,
        error: message,
        retryable: isTransientMediaUploadError(message),
      };
    }

    return { synced: true, error: null, retryable: false };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown error';
    return {
      synced: false,
      error: detail,
      retryable: isTransientMediaUploadError(detail),
    };
  }
}

function scheduleAutomaticRetry(): void {
  if (automaticRetryTimer) return;

  automaticRetryTimer = setTimeout(() => {
    automaticRetryTimer = null;
    void flushReportQueue();
  }, automaticRetryDelayMs);

  // Repeated connection failures back off to avoid aggressive network use.
  automaticRetryDelayMs = Math.min(
    automaticRetryDelayMs * 2,
    MAXIMUM_AUTOMATIC_RETRY_DELAY_MS,
  );
}

function resetAutomaticRetry(): void {
  if (automaticRetryTimer) clearTimeout(automaticRetryTimer);
  automaticRetryTimer = null;
  automaticRetryDelayMs = 5_000;
}

/**
 * Attempt to flush every pending report. Safe to call repeatedly and
 * concurrently — a single in-flight flush is enforced.
 */
export async function flushReportQueue(): Promise<void> {
  if (isFlushing) return;
  isFlushing = true;
  let hasRetryableFailure = false;

  try {
    if (automaticRetryTimer) {
      clearTimeout(automaticRetryTimer);
      automaticRetryTimer = null;
    }

    const pending = await getPendingReports();
    if (pending.length === 0) {
      resetAutomaticRetry();
      return;
    }

    pending.forEach((report) => {
      if (!report.deliveryDelayedAt) {
        scheduleDeliveryValidation(report.id, report.createdAt);
      }
    });

    const net = await NetInfo.fetch();
    if (net.isConnected === false || net.isInternetReachable === false) {
      for (const report of pending) {
        clearDeliveryValidation(report.id);
        await markReportDeliveryDelayed(report.id);
      }
      return;
    }

    const session = await getActiveSession();
    const userId = session?.user?.id;
    if (!userId) return;

    for (const report of pending) {
      // Clear a stale failure while a new manual/reconnect retry is active.
      await updateQueuedReport(report.id, { lastError: undefined });
      emitChange();

      const { synced, error, retryable } = await syncReport(report, userId);
      if (synced) {
        clearDeliveryValidation(report.id);
        await markQueuedReportSynced(report.id, new Date().toISOString());
        report.media.forEach(deletePersistedReportMedia);
        emitChange();
        await pruneSyncedReportHistory();
      } else {
        if (retryable) hasRetryableFailure = true;
        clearDeliveryValidation(report.id);
        await updateQueuedReport(report.id, {
          deliveryDelayedAt:
            report.deliveryDelayedAt ?? new Date().toISOString(),
          lastError: retryable ? undefined : (error ?? 'Sync failed.'),
        });
        emitChange();
        // Keep going: one failing report must not block the rest of the
        // queue (it would otherwise pin every later report to this device).
      }
    }
  } finally {
    isFlushing = false;
    if (hasRetryableFailure) {
      scheduleAutomaticRetry();
    } else {
      resetAutomaticRetry();
    }
  }
}

/**
 * Bind connectivity + app-foreground triggers once. Expo Go cannot run true
 * background tasks, so we flush on reconnect and whenever the app becomes
 * active (covers launch + returning from background).
 */
export function startReportQueueWatcher(): () => void {
  if (listenersBound) return () => {};
  listenersBound = true;

  const netSub = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void flushReportQueue();
    }
  });

  const appSub = AppState.addEventListener(
    'change',
    (status: AppStateStatus) => {
      if (status === 'active') void flushReportQueue();
    },
  );

  // Flush once at startup.
  void flushReportQueue();

  return () => {
    netSub();
    appSub.remove();
    resetAutomaticRetry();
    deliveryValidationTimers.forEach((timer) => clearTimeout(timer));
    deliveryValidationTimers.clear();
    listenersBound = false;
  };
}
