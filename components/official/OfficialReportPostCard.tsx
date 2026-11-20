// Adapts safe official-queue records to community report posts. BDRRMO opens
// the resident-style post sheet, while the default official view opens Report Operations.
import React from 'react';
import { Pressable } from 'react-native';
import {
  ReportDetailCard,
  ReportDetailContent,
  ResidentFeedReportContent,
  reportDetailStyles,
} from '../report/ReportDetailCard';
import { officialLabel, lifecycleColor } from '../../lib/reportLifecycle';
import {
  scopedLifecyclePresentation,
  type ScopedOfficialAudience,
} from '../../lib/reportPresentation';
import type { OfficialReportQueueItem } from '../../lib/officialReports';
import { formatReportLocation, type MapReportMarker } from '../../lib/reports';
import { useShareSheetGuard } from '../../hooks/useShareSheetGuard';

export function officialQueueItemToPost(report: OfficialReportQueueItem): MapReportMarker {
  return {
    id: report.id,
    title: report.title,
    description: report.description,
    incidentType: report.incidentType,
    incidentTypeOther: report.incidentTypeOther,
    status: report.status,
    latitude: report.latitude ?? 0,
    longitude: report.longitude ?? 0,
    addressText: report.addressText,
    barangay_id: report.barangayId,
    created_at: report.createdAt,
    latestActivityAt: report.latestActivityAt,
    reporter: report.reporter,
    media: report.media,
    mediaError: report.mediaError,
    upvoteCount: report.upvoteCount,
    commentCount: report.commentCount,
  };
}

export default function OfficialReportPostCard({
  report,
  variant = 'officialCommunity',
  isLast = false,
  onPress,
  onCommentPress,
  audience,
  openPostDetails = false,
}: {
  report: OfficialReportQueueItem;
  variant?: 'officialCommunity' | 'residentFeed';
  isLast?: boolean;
  onPress: () => void;
  onCommentPress: () => void;
  /** Opens the resident-style full report post instead of Report Operations. */
  openPostDetails?: boolean;
  /** Opts selected official community feeds into scoped stage and office labels. */
  audience?: ScopedOfficialAudience;
}) {
  const post = officialQueueItemToPost(report);
  const scoped = audience
    ? scopedLifecyclePresentation(report.lifecycle, {
        audience,
        barangayName: report.barangayName,
        leadOffice: report.lifecycleFacts.leadOffice,
        claimedByName: report.lifecycleFacts.reviewClaimedByName,
        claimedAt: report.lifecycleFacts.reviewClaimedAt,
      })
    : null;
  const statusPresentation = scoped
    ? {
        label: scoped.stageLabel,
        color: scoped.tone.color,
        backgroundColor: scoped.tone.softColor,
        coordinationLabel: scoped.coordinationLabel,
      }
    : {
        label: officialLabel(report.lifecycle, {
          claimedByName: report.lifecycleFacts.reviewClaimedByName,
          claimedAt: report.lifecycleFacts.reviewClaimedAt,
        }),
        color: lifecycleColor(report.lifecycle),
      };
  const { shareSafely, canOpenCard } = useShareSheetGuard();

  const shareReport = () => {
    void shareSafely({
      message: `${post.title}\n${post.description}\n${formatReportLocation(post)}`,
      title: post.title,
    });
  };

  if (openPostDetails) {
    return (
      <ReportDetailCard
        report={post}
        isLast={isLast}
        variant="residentFeed"
        statusPresentation={statusPresentation}
        showCommunityTags
      />
    );
  }

  return (
    <Pressable
      style={[
        reportDetailStyles.feedCard,
        isLast && reportDetailStyles.feedCardLast,
      ]}
      onPress={() => {
        if (!canOpenCard()) return;
        onPress();
      }}
    >
      {variant === 'residentFeed' ? (
        <ResidentFeedReportContent
          report={post}
          statusPresentation={statusPresentation}
          onRequestExpand={onPress}
          onRequestComments={onCommentPress}
          onShareReport={shareReport}
        />
      ) : (
        <ReportDetailContent
          report={post}
          statusPresentation={statusPresentation}
          showCommunityTags
          onRequestComments={onCommentPress}
        />
      )}
    </Pressable>
  );
}
