import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
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
  variant?: 'compact' | 'featured';
};

function formatMunicipalCardDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return formatPublishedAt(iso);

  const dateLabel = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const timeLabel = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dateLabel} · ${timeLabel}`;
}

function toReportMedia(item: AnnouncementRecord['media'][number]): ReportMediaAttachment {
  return {
    id: item.id,
    type: item.type,
    url: item.url,
    durationSeconds: item.durationSeconds,
  };
}

export default function HomeUpdateCard({
  announcement,
  label,
  onPress,
  variant = 'compact',
}: HomeUpdateCardProps) {
  const sourceLabel = announcement.author.roleLabel || 'Official';
  const title = announcement.title.trim() || 'Official update';
  const firstMedia = announcement.media[0] ? toReportMedia(announcement.media[0]) : null;
  const badgeLabel = sourceLabel.toLocaleLowerCase() === 'official' ? label : sourceLabel;

  if (variant === 'featured') {
    return (
      <TouchableOpacity
        style={styles.featuredUpdateCard}
        activeOpacity={0.88}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
      >
        <View style={styles.featuredThumb} pointerEvents="none">
          {firstMedia ? (
            <View style={styles.featuredThumbMedia}>
              <CollageCellContent item={firstMedia} />
            </View>
          ) : (
            <View style={styles.featuredThumbFallback}>
              <Ionicons name="megaphone-outline" size={36} color={homeColors.accentBlue} />
            </View>
          )}
          <View style={styles.featuredOfficialBadge}>
            <Text style={styles.featuredOfficialBadgeText}>{badgeLabel.toLocaleUpperCase()}</Text>
          </View>
          {firstMedia?.type === 'video' ? (
            <View style={styles.featuredVideoBadge}>
              <Ionicons name="play" size={12} color={colors.white} />
            </View>
          ) : null}
        </View>

        <View style={styles.featuredCopy}>
          <View style={styles.featuredTextBlock}>
            <Text style={styles.featuredUpdateTitle} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.featuredUpdateDate} numberOfLines={1}>
              {formatMunicipalCardDate(announcement.createdAt)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={23} color={homeColors.ink} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.updateCard}
      activeOpacity={0.86}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${announcement.title || label}`}
    >
      <Image
        source={require('../../assets/images/mingla.png')}
        style={styles.updateSeal}
        resizeMode="contain"
        accessibilityLabel="Minglanilla official seal"
      />

      <View style={styles.updateContent}>
        <Text style={styles.updateLabel}>{label.toLocaleUpperCase()}</Text>
        <Text style={styles.updateTitle} numberOfLines={2}>
          {announcement.title || 'Official update'}
        </Text>
        <Text style={styles.updateMeta} numberOfLines={1}>
          {sourceLabel} · {formatPublishedAt(announcement.createdAt)}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={23} style={styles.updateChevron} />
    </TouchableOpacity>
  );
}
