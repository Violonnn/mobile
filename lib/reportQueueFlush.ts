import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { getActiveSession } from './auth';
import { readEdgeFunctionErrorMessage } from './edgeFunctionErrors';
import { uploadReportMedia } from './reportMedia';
import {
  getPendingReports,
  markMediaUploaded,
  removeQueuedReport,
  updateQueuedReport,
  type QueuedReport,
} from './reportQueue';

let isFlushing = false;
let listenersBound = false;

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

/**
 * Upload any still-pending media for one report, then insert the report row.
 * Idempotent: already-uploaded media is skipped, and the same reportId is
 * reused so a retry resumes instead of restarting.
 */
async function syncReport(
  report: QueuedReport,
  userId: string,
): Promise<{ synced: boolean; error: string | null }> {
  const uploaded: {
    id: string;
    type: 'photo' | 'video';
    storagePath: string;
    durationSeconds: number | null;
  }[] = [];

  for (const item of report.media) {
    if (item.uploadStatus === 'uploaded' && item.storagePath) {
      uploaded.push({
        id: item.id,
        type: item.type,
        storagePath: item.storagePath,
        durationSeconds: item.durationSeconds,
      });
      continue;
    }

    const { storagePath, error } = await uploadReportMedia({
      userId,
      reportId: report.id,
      media: item,
    });
    if (error || !storagePath) {
      return { synced: false, error: error ?? 'Media upload failed.' };
    }

    await markMediaUploaded(report.id, item.id, storagePath);
    emitChange();
    uploaded.push({
      id: item.id,
      type: item.type,
      storagePath,
      durationSeconds: item.durationSeconds,
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
          latitude: report.position.latitude,
          longitude: report.position.longitude,
          addressText: report.addressText || undefined,
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
      return { synced: false, error: message };
    }

    return { synced: true, error: null };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown error';
    return { synced: false, error: detail };
  }
}

/**
 * Attempt to flush every pending report. Safe to call repeatedly and
 * concurrently — a single in-flight flush is enforced.
 */
export async function flushReportQueue(): Promise<void> {
  if (isFlushing) return;

  const pending = await getPendingReports();
  if (pending.length === 0) return;

  const net = await NetInfo.fetch();
  if (net.isConnected === false) return;

  const session = await getActiveSession();
  const userId = session?.user?.id;
  if (!userId) return;

  isFlushing = true;
  try {
    for (const report of pending) {
      const { synced, error } = await syncReport(report, userId);
      if (synced) {
        await updateQueuedReport(report.id, {
          status: 'synced',
          lastError: undefined,
        });
        emitChange();
        // Keep synced rows briefly so the success screen can reflect it,
        // then drop to avoid unbounded growth.
        await removeQueuedReport(report.id);
      } else {
        await updateQueuedReport(report.id, {
          lastError: error ?? 'Sync failed.',
        });
        emitChange();
        // Keep going: one failing report must not block the rest of the
        // queue (it would otherwise pin every later report to this device).
      }
    }
  } finally {
    isFlushing = false;
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
    if (state.isConnected) void flushReportQueue();
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
    listenersBound = false;
  };
}
