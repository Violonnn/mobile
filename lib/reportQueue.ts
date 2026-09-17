import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CapturedMedia } from './reportMedia';
import type { GpsPosition } from './location';
import type { IncidentType } from './incidentTypes';

const QUEUE_KEY = 'disasterlink.reportQueue.v1';

// Serialize read-modify-write operations so uploads and delivery checks cannot
// accidentally overwrite each other's newer queue state.
let mutationChain: Promise<void> = Promise.resolve();

/** A media item plus its per-item upload state so retries are idempotent. */
export type QueuedMedia = CapturedMedia & {
  uploadStatus: 'pending' | 'uploaded';
  /** Set once the file lands in Storage; reused on retry (no re-upload). */
  storagePath?: string;
  displayStoragePath?: string | null;
  thumbnailStoragePath?: string | null;
};

export type QueuedReportStatus = 'pending' | 'synced';

/** A report persisted locally the moment the user taps Submit. */
export type QueuedReport = {
  /** Client-generated report id, reused across retries (idempotent DB insert). */
  id: string;
  title: string;
  description: string;
  /** Optional only for queue records created by older app versions. */
  incidentType?: IncidentType;
  incidentTypeOther?: string;
  position: GpsPosition;
  /** Original immutable GPS fix. Older queue rows fall back to position. */
  devicePosition?: GpsPosition;
  addressText?: string;
  /**
   * Selected barangay for BDRRMO routing. Optional so older AsyncStorage
   * queue records (pre-feature) still deserialize and sync via centroid fallback.
   */
  barangayId?: string;
  media: QueuedMedia[];
  status: QueuedReportStatus;
  createdAt: string;
  syncedAt?: string;
  /** Set when delivery is offline, fails, or exceeds the validation window. */
  deliveryDelayedAt?: string;
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

async function mutateReports(
  createNextReports: (reports: QueuedReport[]) => QueuedReport[],
): Promise<void> {
  const operation = mutationChain.then(async () => {
    const reports = await readAll();
    await writeAll(createNextReports(reports));
  });

  // Keep future mutations usable even if this particular operation fails.
  mutationChain = operation.catch(() => undefined);
  await operation;
}

/** Persist a freshly submitted report at the front of the queue. */
export async function enqueueReport(report: QueuedReport): Promise<void> {
  await mutateReports((reports) => {
    const withoutDuplicate = reports.filter((item) => item.id !== report.id);
    return [report, ...withoutDuplicate];
  });
}

/** All reports still waiting to sync (oldest first for FIFO flushing). */
export async function getPendingReports(): Promise<QueuedReport[]> {
  await mutationChain;
  const reports = await readAll();
  return reports
    .filter((r) => r.status === 'pending')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Look up a single queued report by id. */
export async function getQueuedReport(
  id: string,
): Promise<QueuedReport | null> {
  await mutationChain;
  const reports = await readAll();
  return reports.find((r) => r.id === id) ?? null;
}

/** Merge partial changes into a queued report (upload state, status, errors). */
export async function updateQueuedReport(
  id: string,
  patch: Partial<QueuedReport>,
): Promise<void> {
  await mutateReports((reports) =>
    reports.map((report) =>
      report.id === id ? { ...report, ...patch } : report,
    ),
  );
}

/** Mark a pending report delayed without racing a completed delivery update. */
export async function markQueuedReportDeliveryDelayed(
  id: string,
  delayedAt: string,
): Promise<boolean> {
  let didChange = false;

  await mutateReports((reports) =>
    reports.map((report) => {
      if (
        report.id !== id ||
        report.status === 'synced' ||
        report.deliveryDelayedAt
      ) {
        return report;
      }

      didChange = true;
      return {
        ...report,
        deliveryDelayedAt: delayedAt,
      };
    }),
  );

  return didChange;
}

/** Mark sent only after the complete report submission is confirmed. */
export async function markQueuedReportSynced(
  id: string,
  syncedAt: string,
): Promise<boolean> {
  let didChange = false;

  await mutateReports((reports) =>
    reports.map((report) => {
      if (report.id !== id || report.status === 'synced') return report;

      didChange = true;
      return {
        ...report,
        status: 'synced',
        syncedAt,
        deliveryDelayedAt: undefined,
        lastError: undefined,
      };
    }),
  );

  return didChange;
}

/** Record that one media item finished uploading so retries skip it. */
export async function markMediaUploaded(
  reportId: string,
  mediaId: string,
  paths: {
    storagePath: string;
    displayStoragePath: string | null;
    thumbnailStoragePath: string | null;
  },
): Promise<void> {
  await mutateReports((reports) =>
    reports.map((report) => {
      if (report.id !== reportId) return report;
      return {
        ...report,
        media: report.media.map((mediaItem) =>
          mediaItem.id === mediaId
            ? {
                ...mediaItem,
                uploadStatus: 'uploaded' as const,
                ...paths,
              }
            : mediaItem,
        ),
      };
    }),
  );
}

/** Drop a report from the queue once it is confirmed synced/removed. */
export async function removeQueuedReport(id: string): Promise<void> {
  await mutateReports((reports) =>
    reports.filter((report) => report.id !== id),
  );
}

/** Keep every pending report and limit completed local history. */
export async function pruneSyncedReportHistory(maxSyncedRows = 20): Promise<void> {
  await mutateReports((reports) => {
    const pending = reports.filter((report) => report.status === 'pending');
    const synced = reports
      .filter((report) => report.status === 'synced')
      .sort((first, second) =>
        (second.syncedAt ?? second.createdAt).localeCompare(
          first.syncedAt ?? first.createdAt,
        ),
      )
      .slice(0, maxSyncedRows);
    return [...pending, ...synced];
  });
}
