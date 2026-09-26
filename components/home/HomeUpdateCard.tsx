import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { CollageCellContent } from '../report/ReportDetailCard';
import type { AnnouncementRecord } from '../../lib/announcements';
import { formatPublishedAt } from '../../lib/formatTime';
import type { ReportMediaAttachment } from '../../lib/reports';
import { homeColors, homeStyles as styles } from '../../styles/screens/home.styles';
import { colors } from '../../styles/theme';

type HomeUpdateCardProps = {
  announcement: AnnouncementRecord;
  label: string;
  onPress: () => void;
};

function announcementAgeLabel(createdAt: string): string {
  const formatted = formatPublishedAt(createdAt);
  return /^\d+(s|m|hr)$/.test(formatted) ? `${formatted} ago` : formatted;
}

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

function announcementSourceLabel(announcement: AnnouncementRecord, fallbackLabel: string): string {
  if (announcement.scope === 'barangay' && announcement.barangayName?.trim()) {
    return `Brgy. ${announcement.barangayName.trim()}`;
  }

  return announcement.author.roleLabel.trim() || fallbackLabel;
}

export default function HomeUpdateCard({
  announcement,
  label,
  onPress,
}: HomeUpdateCardProps) {
  const title = announcement.title.trim() || 'Official update';
  const body = announcement.body.trim() || 'No announcement details provided.';
  const sourceLabel = announcementSourceLabel(announcement, label);
  const firstMedia = announcement.media[0] ? toReportMedia(announcement.media[0]) : null;

  return (
    <View style={styles.officialUpdateCard}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
      >
        <View style={styles.officialUpdateMediaFrame}>
          {firstMedia ? (
            <View style={styles.officialUpdateMedia}>
              <CollageCellContent item={firstMedia} />
            </View>
          ) : (
            <View style={styles.officialUpdateMediaPlaceholder}>
              <Ionicons name="megaphone-outline" size={34} color={homeColors.ink} />
              <Text style={styles.officialUpdateMediaPlaceholderText}>No media attached</Text>
            </View>
          )}

          <View style={styles.officialUpdateMediaLabel}>
            <Text style={styles.officialUpdateMediaLabelText} numberOfLines={1}>
              {sourceLabel} · {announcementAgeLabel(announcement.createdAt)}
            </Text>
          </View>

          {announcement.mediaCount > 0 ? (
            <View style={styles.officialUpdateMediaCount}>
              <Ionicons name="images-outline" size={15} color={colors.white} />
              <Text style={styles.officialUpdateMediaCountText}>
                {announcement.mediaCount} media
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.officialUpdateCardCopy}>
        <Text style={styles.officialUpdateTitle}>
          {title}
        </Text>
        <Text style={styles.officialUpdateBody}>
          {body}
        </Text>
        <TouchableOpacity
          style={styles.officialUpdateAction}
          hitSlop={8}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`View ${title} in official updates`}
        >
          <Text style={styles.officialUpdateActionText}>View announcement</Text>
          <Ionicons name="arrow-forward" size={20} color={homeColors.ink} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
