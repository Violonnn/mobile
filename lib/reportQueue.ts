import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CapturedMedia } from './reportMedia';
import type { GpsPosition } from './location';

const QUEUE_KEY = 'disasterlink.reportQueue.v1';

/** A media item plus its per-item upload state so retries are idempotent. */
export type QueuedMedia = CapturedMedia & {
  uploadStatus: 'pending' | 'uploaded';
  /** Set once the file lands in Storage; reused on retry (no re-upload). */
  storagePath?: string;
};

export type QueuedReportStatus = 'pending' | 'synced';

/** A report persisted locally the moment the user taps Submit. */
export type QueuedReport = {
  /** Client-generated report id, reused across retries (idempotent DB insert). */
  id: string;
  title: string;
  description: string;
  position: GpsPosition;
  addressText?: string;
  /**
   * Selected barangay for BDRRMO routing. Optional so older AsyncStorage
   * queue records (pre-feature) still deserialize and sync via centroid fallback.
   */
  barangayId?: string;
  media: QueuedMedia[];
  status: QueuedReportStatus;
  createdAt: string;
  lastError?: string;
};

async function readAll(): Promise<QueuedReport[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedReport[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(reports: QueuedReport[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(reports));
}

/** Persist a freshly submitted report at the front of the queue. */
export async function enqueueReport(report: QueuedReport): Promise<void> {
  const reports = await readAll();
  const withoutDupe = reports.filter((r) => r.id !== report.id);
  await writeAll([report, ...withoutDupe]);
}

/** All reports still waiting to sync (oldest first for FIFO flushing). */
export async function getPendingReports(): Promise<QueuedReport[]> {
  const reports = await readAll();
  return reports
    .filter((r) => r.status === 'pending')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Look up a single queued report by id. */
export async function getQueuedReport(
  id: string,
): Promise<QueuedReport | null> {
  const reports = await readAll();
  return reports.find((r) => r.id === id) ?? null;
}

/** Merge partial changes into a queued report (upload state, status, errors). */
export async function updateQueuedReport(
  id: string,
  patch: Partial<QueuedReport>,
): Promise<void> {
  const reports = await readAll();
  const next = reports.map((r) => (r.id === id ? { ...r, ...patch } : r));
  await writeAll(next);
}

/** Record that one media item finished uploading so retries skip it. */
export async function markMediaUploaded(
  reportId: string,
  mediaId: string,
  storagePath: string,
): Promise<void> {
  const reports = await readAll();
  const next = reports.map((r) => {
    if (r.id !== reportId) return r;
    return {
      ...r,
      media: r.media.map((m) =>
        m.id === mediaId
          ? { ...m, uploadStatus: 'uploaded' as const, storagePath }
          : m,
      ),
    };
  });
  await writeAll(next);
}

/** Drop a report from the queue once it is confirmed synced/removed. */
export async function removeQueuedReport(id: string): Promise<void> {
  const reports = await readAll();
  await writeAll(reports.filter((r) => r.id !== id));
}
