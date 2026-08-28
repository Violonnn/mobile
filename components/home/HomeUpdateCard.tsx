import React from 'react';
import { Image, Share, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAnnouncementEngagement } from '../official/AnnouncementEngagementProvider';
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

  const now = new Date();
  const dateLabel = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
  const timeLabel = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dateLabel}, ${timeLabel}`;
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
  const officeLabel = sourceLabel.trim();
  const showOfficeLabel = officeLabel.length > 0 && officeLabel.toLowerCase() !== 'official';
  const title = announcement.title.trim() || 'Official update';
  const bodyText = announcement.body.trim();
  const showBody = bodyText.length > 0 && bodyText !== title;
  const firstMedia = announcement.media[0] ? toReportMedia(announcement.media[0]) : null;
  const { getState, toggleUpvote } = useAnnouncementEngagement();
  const { upvoteCount, commentCount, hasUpvoted } = getState(announcement);

  const shareAnnouncement = async () => {
    try {
      await Share.share({
        title: title,
        message: [title, bodyText].filter(Boolean).join('\n\n'),
      });
    } catch {
      // Dismissing the native share sheet should not interrupt Home.
    }
  };

  if (variant === 'featured') {
    return (
      <View style={styles.featuredUpdateCard}>
        <TouchableOpacity
          style={styles.featuredUpdateContent}
          activeOpacity={0.88}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Open ${title}`}
        >
          <View style={styles.featuredMainRow}>
            <View style={styles.featuredCopy}>
              <View style={styles.featuredOfficialRow}>
                <View style={styles.featuredOfficialBadge}>
                  <Text style={styles.featuredOfficialBadgeText}>Latest</Text>
                </View>
                {showOfficeLabel ? (
                  <Text style={styles.featuredOfficeLabel} numberOfLines={1}>
                    {officeLabel}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.featuredUpdateTitle} numberOfLines={2}>
                {title}
              </Text>
              {showBody ? (
                <Text style={styles.featuredUpdateBody} numberOfLines={3}>
                  {bodyText}
                </Text>
              ) : null}
              <View style={styles.featuredDateRow}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={colors.textMuted}
                  style={styles.featuredDateIcon}
                />
                <Text style={styles.featuredUpdateDate} numberOfLines={1}>
                  {formatMunicipalCardDate(announcement.createdAt)}
                </Text>
              </View>
              <View style={styles.featuredReadMoreRow}>
                <Text style={styles.featuredReadMoreText}>Read more</Text>
                <Ionicons name="chevron-forward" size={14} color={homeColors.accentBlue} />
              </View>
            </View>

            <View style={styles.featuredThumb} pointerEvents="none">
              {firstMedia ? (
                <View style={styles.featuredThumbMedia}>
                  <CollageCellContent item={firstMedia} />
                </View>
              ) : (
                <View style={styles.featuredThumbFallback}>
                  <Ionicons name="megaphone-outline" size={28} color={homeColors.accentBlue} />
                </View>
              )}
              {firstMedia?.type === 'video' ? (
                <View style={styles.featuredVideoBadge}>
                  <Ionicons name="play" size={11} color={colors.white} />
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.featuredActionsRow}>
          <TouchableOpacity
            style={styles.featuredActionButton}
            activeOpacity={0.75}
            onPress={() => void shareAnnouncement()}
            accessibilityRole="button"
            accessibilityLabel="Share announcement"
          >
            <Ionicons name="paper-plane-outline" size={18} style={styles.featuredActionIcon} />
          </TouchableOpacity>
          <View style={styles.featuredActionDivider} />
          <TouchableOpacity
            style={styles.featuredActionButton}
            activeOpacity={0.75}
            onPress={() => toggleUpvote(announcement)}
            accessibilityRole="button"
            accessibilityState={{ selected: hasUpvoted }}
            accessibilityLabel={`Upvote announcement, ${upvoteCount} upvotes`}
          >
            <Ionicons
              name={hasUpvoted ? 'arrow-up' : 'arrow-up-outline'}
              size={20}
              style={[
                styles.featuredActionIcon,
                hasUpvoted && styles.featuredActionIconActive,
              ]}
            />
            <Text
              style={[
                styles.featuredActionCount,
                hasUpvoted && styles.featuredActionCountActive,
              ]}
            >
              {upvoteCount}
            </Text>
          </TouchableOpacity>
          <View style={styles.featuredActionDivider} />
          <TouchableOpacity
            style={styles.featuredActionButton}
            activeOpacity={0.75}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Open comments, ${commentCount} comments`}
          >
            <Ionicons name="chatbubble-outline" size={18} style={styles.featuredActionIcon} />
            <Text style={styles.featuredActionCount}>{commentCount}</Text>
          </TouchableOpacity>
        </View>
      </View>
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
        <Text style={styles.updateBody} numberOfLines={2}>
          {announcement.body}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={23} style={styles.updateChevron} />
    </TouchableOpacity>
  );
}
