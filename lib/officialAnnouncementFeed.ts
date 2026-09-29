import type { AnnouncementRecord } from './announcements';

export type OfficialUpdateFeedScope = 'priority' | 'all';
export type OfficialUpdateFeedOrder = 'latest' | 'oldest';

type OfficialUpdateFeedAnnouncement = Pick<
  AnnouncementRecord,
  'authorRank' | 'barangayId' | 'createdAt' | 'id'
>;

type BuildOfficialUpdateFeedOptions = {
  residentBarangayId: string | null;
  scope: OfficialUpdateFeedScope;
  sort: OfficialUpdateFeedOrder;
};

function announcementTimestamp(announcement: OfficialUpdateFeedAnnouncement): number {
  const timestamp = Date.parse(announcement.createdAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Mayor and MDRRMO updates apply municipality-wide. A BDRRMO update is
 * relevant by default only when it belongs to the resident's barangay.
 */
function priorityForResident(
  announcement: OfficialUpdateFeedAnnouncement,
  residentBarangayId: string | null,
): number | null {
  if (announcement.authorRank === 1) return 1;
  if (announcement.authorRank === 2) return 2;
  if (
    announcement.authorRank === 3 &&
    residentBarangayId !== null &&
    announcement.barangayId === residentBarangayId
  ) {
    return 3;
  }
  return null;
}

/**
 * The resident default groups announcements by the office most responsible
 * for their area: Mayor, MDRRMO, then their own BDRRMO. Dates sort updates
 * inside each group. The all-updates mode returns every authorized barangay.
 */
export function buildOfficialUpdateFeed<T extends OfficialUpdateFeedAnnouncement>(
  announcements: T[],
  options: BuildOfficialUpdateFeedOptions,
): T[] {
  const eligibleAnnouncements =
    options.scope === 'all'
      ? announcements
      : announcements.filter(
          (announcement) =>
            priorityForResident(announcement, options.residentBarangayId) !== null,
        );

  return [...eligibleAnnouncements].sort((first, second) => {
    if (options.scope === 'priority') {
      const firstPriority = priorityForResident(first, options.residentBarangayId) ?? 4;
      const secondPriority = priorityForResident(second, options.residentBarangayId) ?? 4;
      const priorityDifference = firstPriority - secondPriority;
      if (priorityDifference) return priorityDifference;
    }

    const firstTimestamp = announcementTimestamp(first);
    const secondTimestamp = announcementTimestamp(second);
    const timestampDifference =
      options.sort === 'latest'
        ? secondTimestamp - firstTimestamp
        : firstTimestamp - secondTimestamp;
    if (timestampDifference) return timestampDifference;

    // Keep the order stable when announcements have the same publish time.
    return first.id.localeCompare(second.id);
  });
}
