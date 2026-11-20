import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  EngagementActionsRow,
  CollageCellContent,
} from '../report/ReportDetailCard';
import {
  formatAnnouncementAuthorName,
  formatAnnouncementOfficeLabel,
  type AnnouncementRecord,
} from '../../lib/announcements';
import { formatPublishedAt } from '../../lib/formatTime';
import type { ReportMediaAttachment } from '../../lib/reports';
import { useAccessibilityLayout } from '../../hooks/useAccessibilityLayout';
import { useShareSheetGuard } from '../../hooks/useShareSheetGuard';
import { homeStyles as styles } from '../../styles/screens/home.styles';
import { colors } from '../../styles/theme';
import { ReporterAvatar } from '../report/ReporterAvatar';
import { useAnnouncementEngagement } from '../official/AnnouncementEngagementProvider';

type HomeUpdateCardProps = {
  announcement: AnnouncementRecord;
  onPress: () => void;
};

function toReportMedia(item: AnnouncementRecord['media'][number]): ReportMediaAttachment {
  return {
    id: item.id,
    type: item.type,
    url: item.url,
    durationSeconds: item.durationSeconds,
    thumbnailUrl: item.thumbnailUrl,
    storagePath: item.storagePath,
    thumbnailStoragePath: item.thumbnailStoragePath,
    displayStoragePath: item.displayStoragePath,
    width: item.width,
    height: item.height,
    bucket: 'announcement-media',
    detailUrlResolved: item.detailUrlResolved,
  };
}

export default function HomeUpdateCard({
  announcement,
  onPress,
}: HomeUpdateCardProps) {
  const { isLargeText } = useAccessibilityLayout();
  const { getState, toggleUpvote } = useAnnouncementEngagement();
  const { shareSafely } = useShareSheetGuard();
  const rawTitle = announcement.title.trim();
  const actualBarangayName = announcement.barangayName?.trim();
  const barangayDisplayName = actualBarangayName
    ? `Barangay ${actualBarangayName.replace(/^barangay\s+/i, '')}`
    : null;
  const isGenericBarangayAnnouncement =
    announcement.scope === 'barangay' &&
    /^(?:BDRRMO|BDRMMO|BARANGAY)\s+ANNOUNCEMENT$/i.test(rawTitle);
  const title = isGenericBarangayAnnouncement && barangayDisplayName
    ? barangayDisplayName
    : rawTitle || 'Official update';
  const body = announcement.body.trim() || 'No announcement details provided.';
  const firstMedia = announcement.media[0] ? toReportMedia(announcement.media[0]) : null;
  const displayName = formatAnnouncementAuthorName(announcement.author);
  const officeLabel = formatAnnouncementOfficeLabel(announcement, undefined, 'MITCOM');
  const { upvoteCount, commentCount, hasUpvoted } = getState(announcement);
  const showTitle =
    title !== 'Official update' &&
    !/^(?:MDRRMO|MDRMMO|BDRRMO|BDRMMO|BARANGAY)\s+ANNOUNCEMENT$/i.test(rawTitle);

  return (
    <View style={styles.officialUpdateCard}>
      <TouchableOpacity
        style={styles.officialUpdatePostMain}
        activeOpacity={0.88}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
      >
        <View style={styles.officialUpdatePostContent}>
          <View style={styles.officialUpdatePostAuthorRow}>
            <ReporterAvatar
              reporter={{
                id: announcement.author.id,
                firstName: announcement.author.firstName,
                lastName: announcement.author.lastName,
                middleName: announcement.author.middleName,
                avatarPath: announcement.author.avatarPath,
              }}
              size={40}
            />
            <View style={styles.officialUpdatePostAuthorCopy}>
              <View style={styles.officialUpdatePostAuthorLine}>
                <Text
                  style={[
                    styles.officialUpdatePostAuthorName,
                    isLargeText && styles.officialUpdatePostAuthorNameLargeText,
                  ]}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text
                  style={[
                    styles.officialUpdatePostOffice,
                    isLargeText && styles.officialUpdatePostMetaLargeText,
                  ]}
                  numberOfLines={1}
                >
                  {officeLabel}
                </Text>
              </View>
              <Text
                style={[
                  styles.officialUpdatePostDate,
                  isLargeText && styles.officialUpdatePostMetaLargeText,
                ]}
                numberOfLines={1}
              >
                {formatPublishedAt(announcement.createdAt)}
              </Text>
            </View>
          </View>

          <View style={styles.officialUpdatePostCopy}>
            {showTitle ? (
              <Text
                style={[
                  styles.officialUpdatePostTitle,
                  isLargeText && styles.officialUpdatePostTitleLargeText,
                ]}
              >
                {title}
              </Text>
            ) : null}
            <Text
              style={[
                styles.officialUpdatePostBody,
                isLargeText && styles.officialUpdatePostBodyLargeText,
              ]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {body}
            </Text>
          </View>
        </View>

        {firstMedia ? (
          <View style={styles.officialUpdateMediaFrame}>
            <View style={styles.officialUpdateMedia}>
              <CollageCellContent item={firstMedia} />
            </View>
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={styles.officialUpdatePostActions}>
        <EngagementActionsRow
          upvoteCount={upvoteCount}
          commentCount={commentCount}
          hasUpvoted={hasUpvoted}
          tightVerticalSpacing
          onToggleUpvote={() => toggleUpvote(announcement)}
          onCommentPress={onPress}
          onShare={() => {
            void shareSafely({ message: `${title}\n${body}`, title });
          }}
        />
      </View>
    </View>
  );
}
