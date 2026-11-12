import type { OfficialReportQueueItem } from '../../lib/officialReports';
import type { MapReportMarker } from '../../lib/reports';

/** Keep map geometry separate from the official lifecycle used by queue labels. */
export function officialReportMapMarker(
  report: OfficialReportQueueItem,
): MapReportMarker | null {
  if (
    report.latitude == null || report.longitude == null ||
    !Number.isFinite(report.latitude) || !Number.isFinite(report.longitude)
  ) return null;
  return {
    lifecycle: report.lifecycle,
    id: report.id,
    title: report.title,
    description: report.description,
    incidentType: report.incidentType,
    incidentTypeOther: report.incidentTypeOther,
    status: report.status,
    latitude: report.latitude,
    longitude: report.longitude,
    addressText: report.addressText,
    barangay_id: report.barangayId,
    created_at: report.createdAt,
    reporter: report.reporter,
    media: report.media,
    mediaError: report.mediaError,
    upvoteCount: report.upvoteCount,
    commentCount: report.commentCount,
  };
}
