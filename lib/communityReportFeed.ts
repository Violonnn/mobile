import {
  distanceInMeters,
  normalizeSearchText,
  type Coordinate,
} from './reportProximity.ts';
import type { MapReportMarker } from './reports';

export type CommunityReportSort = 'activity' | 'newest' | 'oldest';
export type CommunityReportScope = 'barangay' | 'municipality';
export type CommunityReportStatusFilter =
  | 'all'
  | 'active'
  | 'unverified'
  | 'verified'
  | 'escalated'
  | 'resolved';
export type CommunityReportSectionId = CommunityReportScope;

export type CommunityReportFeedItem = {
  report: MapReportMarker;
  distance: number | null;
};

export type CommunityReportSection = {
  id: CommunityReportSectionId;
  data: CommunityReportFeedItem[];
};

type BuildCommunityReportSectionsOptions = {
  barangayCenter: Coordinate | null;
  barangayId: string | null;
  requestedReportId?: string;
  searchQuery: string;
  scope: CommunityReportScope;
  sort: CommunityReportSort;
  statusFilter: CommunityReportStatusFilter;
};

function reportMatchesSearch(
  report: MapReportMarker,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return true;

  const searchableReport = [
    report.title,
    report.description,
    report.incidentType,
    report.incidentTypeOther,
    report.addressText,
    report.reporter.firstName,
    report.reporter.middleName,
    report.reporter.lastName,
  ]
    .filter(Boolean)
    .join(' ');

  return normalizeSearchText(searchableReport).includes(normalizedQuery);
}

function reportMatchesStatus(
  report: MapReportMarker,
  statusFilter: CommunityReportStatusFilter,
): boolean {
  const normalizedStatus = report.status.trim().toLocaleLowerCase();

  if (statusFilter === 'active') return normalizedStatus !== 'resolved';
  if (statusFilter === 'all') return true;
  return normalizedStatus === statusFilter;
}

function reportTimestamp(report: MapReportMarker): number {
  const timestamp = Date.parse(report.created_at);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function activityTimestamp(report: MapReportMarker): number {
  const timestamp = Date.parse(report.latestActivityAt ?? report.created_at);
  return Number.isFinite(timestamp) ? timestamp : reportTimestamp(report);
}

function compareFeedItems(
  first: CommunityReportFeedItem,
  second: CommunityReportFeedItem,
  sort: CommunityReportSort,
): number {
  if (sort === 'oldest') {
    const firstTimestamp = reportTimestamp(first.report);
    const secondTimestamp = reportTimestamp(second.report);
    const timeDifference = firstTimestamp - secondTimestamp;
    return timeDifference || first.report.id.localeCompare(second.report.id);
  }

  if (sort === 'newest') {
    const firstTimestamp = reportTimestamp(first.report);
    const secondTimestamp = reportTimestamp(second.report);
    const timeDifference = secondTimestamp - firstTimestamp;
    return timeDifference || first.report.id.localeCompare(second.report.id);
  }

  // Latest Activity intentionally ignores views, reactions, resident comments,
  // metadata edits, and background sync timestamps.
  const timeDifference =
    activityTimestamp(second.report) - activityTimestamp(first.report);
  return timeDifference || first.report.id.localeCompare(second.report.id);
}

/**
 * Build the one resident feed scope selected in the UI. Barangay is the safe
 * default; municipality-wide reports appear only after the resident switches.
 */
export function buildCommunityReportSections(
  reports: MapReportMarker[],
  options: BuildCommunityReportSectionsOptions,
): CommunityReportSection[] {
  const normalizedQuery = normalizeSearchText(options.searchQuery);
  const reportsInScope = reports.filter((report) => {
    if (options.scope === 'municipality') return true;
    return Boolean(options.barangayId && report.barangay_id === options.barangayId);
  });
  const requestedReport = options.requestedReportId
    ? reportsInScope.find((report) => report.id === options.requestedReportId)
    : undefined;

  const visibleReports = reportsInScope.filter((report) => {
    if (report.id === requestedReport?.id) return true;
    if (!reportMatchesSearch(report, normalizedQuery)) return false;
    return reportMatchesStatus(report, options.statusFilter);
  });

  const data = visibleReports
    .map((report) => ({
      report,
      distance: options.barangayCenter
        ? distanceInMeters(options.barangayCenter, report)
        : null,
    }))
    .sort((first, second) => compareFeedItems(first, second, options.sort));

  const sections: CommunityReportSection[] =
    data.length > 0 ? [{ id: options.scope, data }] : [];

  if (!requestedReport) return sections;

  // A virtualized list only mounts its first rows. Promote a report opened from
  // the map or a notification so its detail sheet can mount and open at once.
  const requestedSection = sections[0];
  if (!requestedSection) return sections;
  const requestedItemIndex = requestedSection.data.findIndex(
    (item) => item.report.id === requestedReport.id,
  );
  if (requestedItemIndex > 0) {
    const [requestedItem] = requestedSection.data.splice(requestedItemIndex, 1);
    requestedSection.data.unshift(requestedItem);
  }

  return sections;
}
