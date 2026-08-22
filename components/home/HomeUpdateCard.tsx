import React from 'react';
import { Image, Share, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAnnouncementEngagement } from '../official/AnnouncementEngagementProvider';
import { CollageCellContent } from '../report/ReportDetailCard';
import type { AnnouncementRecord } from '../../lib/announcements';
import { formatPublishedAt } from '../../lib/formatTime';
import { homeStyles as styles } from '../../styles/screens/home.styles';
import { colors } from '../../styles/theme';

type HomeUpdateCardProps = {
  announcement: AnnouncementRecord;
  label: string;
  onPress: () => void;
  variant?: 'compact' | 'featured';
};

function formatAnnouncementDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return formatPublishedAt(iso);

  const dateLabel = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
  const timeLabel = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dateLabel} · ${timeLabel}`;
}

export default function HomeUpdateCard({
  announcement,
  label,
  onPress,
  variant = 'compact',
}: HomeUpdateCardProps) {
  const sourceLabel = announcement.author.roleLabel || 'Official';
  const firstMedia = announcement.media[0] ?? null;
  const { getState, toggleUpvote } = useAnnouncementEngagement();
  const { upvoteCount, commentCount, hasUpvoted } = getState(announcement);

  const shareAnnouncement = async () => {
    await Share.share({
      title: announcement.title || label,
      message: [announcement.title, announcement.body].filter(Boolean).join('\n\n'),
    });
  };

  if (variant === 'featured') {
    return (
      <View style={styles.featuredUpdateCard}>
        <TouchableOpacity
          style={styles.featuredUpdateMedia}
          activeOpacity={0.9}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Open ${announcement.title || label}`}
        >
          {firstMedia ? (
            <CollageCellContent item={firstMedia} />
          ) : (
            <View style={styles.featuredUpdateMediaFallback}>
              <Ionicons name="megaphone-outline" size={42} color={colors.primary} />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.featuredUpdateContent}>
          <View style={styles.featuredUpdateAuthorRow}>
            <Text style={styles.featuredUpdateAuthor}>{sourceLabel}</Text>
            <Text style={styles.featuredUpdateAuthorDivider}>·</Text>
            <Text style={styles.featuredUpdateVerified}>VERIFIED</Text>
          </View>
          <Text style={styles.featuredUpdateDate}>
            {formatAnnouncementDate(announcement.createdAt)}
          </Text>
          <Text style={styles.featuredUpdateTitle}>
            {announcement.title || 'Official update'}
          </Text>
          <Text style={styles.featuredUpdateBody} numberOfLines={3}>
            {announcement.body}
          </Text>
          <TouchableOpacity
            style={styles.featuredReadMoreButton}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel="Read the full announcement"
          >
            <Text style={styles.featuredReadMoreText}>Read more</Text>
          </TouchableOpacity>

          <View style={styles.featuredActionsRow}>
            <TouchableOpacity
              style={styles.featuredActionButton}
              activeOpacity={0.75}
              onPress={() => void shareAnnouncement()}
              accessibilityRole="button"
              accessibilityLabel="Share announcement"
            >
              <Ionicons name="paper-plane-outline" size={19} style={styles.featuredActionIcon} />
              <Text style={styles.featuredActionText} numberOfLines={1}>Share</Text>
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
                  styles.featuredActionText,
                  hasUpvoted && styles.featuredActionTextActive,
                ]}
                numberOfLines={1}
              >
                Upvote {upvoteCount}
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
              <Ionicons name="chatbubble-outline" size={19} style={styles.featuredActionIcon} />
              <Text style={styles.featuredActionText} numberOfLines={1}>
                Comment {commentCount}
              </Text>
            </TouchableOpacity>
          </View>
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
