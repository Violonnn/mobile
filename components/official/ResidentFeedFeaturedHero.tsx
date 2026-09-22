// Onboarding-style LATEST hero: overlay text sits on fading official-update images.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type {
  AnnouncementMediaAttachment,
  AnnouncementRecord,
} from '../../lib/announcements';
import { formatPublishedAt } from '../../lib/formatTime';
import type { ReportMediaAttachment } from '../../lib/reports';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
import { CollageCellContent } from '../report/ReportDetailCard';
import { useAnnouncementEngagement } from './AnnouncementEngagementProvider';

const SLIDE_INTERVAL_MS = 4000;
const MAX_OFFICIAL_SLIDES = 5;

type HeroSlide = {
  key: string;
  announcement: AnnouncementRecord;
  media: ReportMediaAttachment | null;
};

function toReportMedia(item: AnnouncementMediaAttachment): ReportMediaAttachment {
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

function buildHeroSlides(announcements: AnnouncementRecord[]): HeroSlide[] {
  if (announcements.length === 0) return [];

  const latestUpdates = announcements.slice(0, MAX_OFFICIAL_SLIDES);

  // One latest update: fade through that update's own photos/videos.
  if (latestUpdates.length === 1) {
    const announcement = latestUpdates[0];
    if (announcement.media.length === 0) {
      return [{ key: announcement.id, announcement, media: null }];
    }
    return announcement.media.map((item) => ({
      key: `${announcement.id}-${item.id}`,
      announcement,
      media: toReportMedia(item),
    }));
  }

  // Several latest updates: each official update is one slide.
  return latestUpdates.map((announcement) => ({
    key: announcement.id,
    announcement,
    media: announcement.media[0] ? toReportMedia(announcement.media[0]) : null,
  }));
}

export default function ResidentFeedFeaturedHero({
  announcements,
  paused = false,
  onActiveChange,
  onRequestComments,
  onShareAnnouncement,
}: {
  announcements: AnnouncementRecord[];
  paused?: boolean;
  onActiveChange: (announcement: AnnouncementRecord) => void;
  onRequestComments: () => void;
  onShareAnnouncement: (announcement: AnnouncementRecord) => void;
}) {
  const slides = useMemo(() => buildHeroSlides(announcements), [announcements]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const { getState, toggleUpvote } = useAnnouncementEngagement();

  const slideKey = slides.map((slide) => slide.key).join(',');
  const [previousSlideKey, setPreviousSlideKey] = useState(slideKey);

  if (slideKey !== previousSlideKey) {
    setPreviousSlideKey(slideKey);
    setActiveSlideIndex(0);
  }

  useEffect(() => {
    if (paused || slides.length < 2) return;

    const fadeTimer = setTimeout(() => {
      const nextIndex = (activeSlideIndex + 1) % slides.length;
      setActiveSlideIndex(nextIndex);
    }, SLIDE_INTERVAL_MS);

    return () => clearTimeout(fadeTimer);
  }, [activeSlideIndex, paused, slides.length]);

  const safeIndex = slides.length === 0 ? 0 : Math.min(activeSlideIndex, slides.length - 1);
  const currentSlide = slides[safeIndex] ?? null;
  const currentAnnouncement = currentSlide?.announcement ?? announcements[0];

  useEffect(() => {
    if (!currentAnnouncement) return;
    onActiveChange(currentAnnouncement);
  }, [currentAnnouncement, onActiveChange]);

  if (!currentAnnouncement) return null;

  const scopeLabel =
    currentAnnouncement.scope === 'municipal' ? 'Municipal update' : 'Barangay update';
  const title =
    currentAnnouncement.title.trim() ||
    currentAnnouncement.body.trim() ||
    'Official update';
  const bodyText = currentAnnouncement.body.trim();
  const showBody = bodyText.length > 0 && bodyText !== title;
  const { upvoteCount, commentCount, hasUpvoted } = getState(currentAnnouncement);

  return (
    <View style={styles.content}>
      <View style={styles.heroWrapper}>
        <View style={styles.slideFill} pointerEvents="none">
            {currentSlide?.media ? (
              <>
                <CollageCellContent item={currentSlide.media} />
                {currentSlide.media.type === 'video' ? (
                  <View style={styles.videoBadge}>
                    <Ionicons name="play" size={12} color={colors.white} />
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.fallback}>
                <Ionicons name="megaphone-outline" size={36} color="rgba(255,255,255,0.72)" />
              </View>
            )}
        </View>

        <LinearGradient
          colors={[
            'rgba(17, 24, 39, 0.42)',
            'transparent',
            'transparent',
            'rgba(17, 24, 39, 0.78)',
          ]}
          locations={[0, 0.28, 0.48, 1]}
          style={styles.heroScrim}
          pointerEvents="none"
        />

        <View style={styles.heroOverlay} pointerEvents="none">
          <Text style={styles.brandText}>{scopeLabel}</Text>

          <View style={styles.copyBlock}>
            <Text style={styles.officeText} numberOfLines={1}>
              {currentAnnouncement.author.roleLabel}  ·  Official
            </Text>
            <Text style={styles.titleText} numberOfLines={2}>
              {title}
            </Text>
            {showBody ? (
              <Text style={styles.bodyText} numberOfLines={2}>
                {bodyText}
              </Text>
            ) : null}
            <Text style={styles.metaText}>
              {formatPublishedAt(currentAnnouncement.createdAt)}
            </Text>
          </View>

          {slides.length > 1 ? (
            <View
              style={styles.paginationDots}
              accessible
              accessibilityLabel={`Update ${safeIndex + 1} of ${slides.length}`}
            >
              {slides.map((slide, index) => (
                <View
                  key={`pagination-dot-${slide.key}`}
                  style={[
                    styles.paginationDot,
                    index === safeIndex && styles.paginationDotActive,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => toggleUpvote(currentAnnouncement)}
        >
          <Ionicons
            name={hasUpvoted ? 'arrow-up-circle' : 'arrow-up-outline'}
            size={24}
            color={hasUpvoted ? colors.primary : colors.text}
          />
          <Text style={styles.actionText}>{upvoteCount} Upvote</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onRequestComments}>
          <Ionicons name="chatbubble-outline" size={22} color={colors.text} />
          <Text style={styles.actionText}>{commentCount} Comments</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(event) => {
            event.stopPropagation?.();
            onShareAnnouncement(currentAnnouncement);
          }}
        >
          <Ionicons name="paper-plane-outline" size={23} color={colors.text} />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    overflow: 'hidden',
    borderRadius: radius.lg,
  },
  heroWrapper: {
    width: '100%',
    aspectRatio: 0.92,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  slideFill: {
    ...StyleSheet.absoluteFill,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  videoBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
  },
  heroScrim: {
    ...StyleSheet.absoluteFill,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  brandText: {
    fontFamily: fonts.medium,
    fontSize: 20,
    color: colors.white,
    letterSpacing: 0.5,
  },
  copyBlock: {
    gap: 4,
    paddingRight: 72,
    paddingBottom: 2,
  },
  officeText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.white,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  titleText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    lineHeight: 26,
    color: colors.white,
  },
  bodyText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.md,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.86)',
  },
  metaText: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1.1,
  },
  paginationDots: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  paginationDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  paginationDotActive: {
    width: 20,
    backgroundColor: colors.white,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
  },
  actionButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.text,
  },
});
