// Adapts safe official-queue records to the resident report-post presentation.
// Card taps open Report operations; the chat icon opens the same screen focused
// on the comments section (not the resident "Report details" popup).
import React from 'react';
import { Pressable } from 'react-native';
import { ReportDetailContent, reportDetailStyles } from '../report/ReportDetailCard';
import type { OfficialReportQueueItem } from '../../lib/officialReports';
import type { MapReportMarker } from '../../lib/reports';

export function officialQueueItemToPost(report: OfficialReportQueueItem): MapReportMarker {
  return {
    id: report.id,
    title: report.title,
    description: report.description,
    status: report.status,
    latitude: report.latitude ?? 0,
    longitude: report.longitude ?? 0,
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

export default function OfficialReportPostCard({
  report,
  onPress,
  onCommentPress,
}: {
  report: OfficialReportQueueItem;
  onPress: () => void;
  onCommentPress: () => void;
}) {
  const post = officialQueueItemToPost(report);
  return (
    <Pressable style={reportDetailStyles.feedCard} onPress={onPress}>
      <ReportDetailContent
        report={post}
        showStatus
        onRequestComments={onCommentPress}
      />
    </Pressable>
  );
}
