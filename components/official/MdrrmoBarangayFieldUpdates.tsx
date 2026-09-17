import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';

import type { AnnouncementRecord } from '../../lib/announcements';
import { fetchBarangays } from '../../lib/barangays';
import { formatPublishedAt } from '../../lib/formatTime';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';
import { colors } from '../../styles/theme';

const LATEST_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_LATEST_CARDS = 6;
const MAX_EARLIER_ITEMS = 4;

type Props = {
  announcements: AnnouncementRecord[];
  announcementsError: string | null;
  announcementsLoading: boolean;
  announcementsLoadingMore: boolean;
  hasMoreAnnouncements: boolean;
  loadMoreAnnouncements: () => Promise<void>;
  reloadAnnouncements: () => Promise<void>;
};

function announcementTimestamp(announcement: AnnouncementRecord): number {
  const timestamp = new Date(announcement.createdAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function announcementAgeLabel(createdAt: string): string {
  const formatted = formatPublishedAt(createdAt);
  return /^\d+(s|m|hr)$/.test(formatted) ? `${formatted} ago` : formatted;
}

function announcementBarangayLabel(
  announcement: AnnouncementRecord,
  barangayNameById: Map<string, string>,
): string {
  const barangayName = announcement.barangayId
    ? barangayNameById.get(announcement.barangayId)?.trim()
    : null;
  return barangayName ? `Brgy. ${barangayName}` : 'Barangay update';
}

function firstMediaUrl(announcement: AnnouncementRecord): string | null {
  const firstMedia = announcement.media[0];
  return firstMedia?.thumbnailUrl || firstMedia?.url || null;
}

export default function MdrrmoBarangayFieldUpdates({
  announcements,
  announcementsError,
  announcementsLoading,
  announcementsLoadingMore,
  hasMoreAnnouncements,
  loadMoreAnnouncements,
  reloadAnnouncements,
}: Props) {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const [recencyReferenceTime, setRecencyReferenceTime] = useState(() => Date.now());
  const [barangayNameById, setBarangayNameById] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const recencyTimer = setInterval(() => setRecencyReferenceTime(Date.now()), 60_000);
    return () => clearInterval(recencyTimer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void fetchBarangays().then((result) => {
      if (cancelled || result.error) return;
      setBarangayNameById(
        new Map(result.barangays.map((barangay) => [barangay.id, barangay.name])),
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const { latestAnnouncements, earlierAnnouncements } = useMemo(() => {
    const cutoff = recencyReferenceTime - LATEST_WINDOW_MS;
    const sortedAnnouncements = announcements
      .filter(
        (announcement) =>
          announcement.scope === 'barangay' && Boolean(announcement.barangayId),
      )
      .sort(
        (first, second) =>
          announcementTimestamp(second) - announcementTimestamp(first),
      );

    return {
      latestAnnouncements: sortedAnnouncements.filter(
        (announcement) => announcementTimestamp(announcement) >= cutoff,
      ),
      earlierAnnouncements: sortedAnnouncements.filter(
        (announcement) => announcementTimestamp(announcement) < cutoff,
      ),
    };
  }, [announcements, recencyReferenceTime]);

  // Load another announcement page when the first page has no older barangay update.
  useEffect(() => {
    if (
      !hasMoreAnnouncements ||
      announcementsLoadingMore ||
      earlierAnnouncements.length > 0
    ) return;
    void loadMoreAnnouncements();
  }, [
    announcementsLoadingMore,
    earlierAnnouncements.length,
    hasMoreAnnouncements,
    loadMoreAnnouncements,
  ]);

  // Leave a small preview of the next card, matching the reference carousel.
  const latestCardWidth = Math.min(520, Math.max(260, windowWidth - 80));
  const visibleLatestAnnouncements = latestAnnouncements.slice(0, MAX_LATEST_CARDS);
  const visibleEarlierAnnouncements = earlierAnnouncements.slice(0, MAX_EARLIER_ITEMS);

  function openAnnouncements() {
    router.push('/official/community' as Href);
  }

  return (
    <View style={styles.fieldUpdatesSection}>
      <View style={styles.fieldUpdatesHeader}>
        <View style={styles.fieldUpdatesHeadingCopy}>
          <Text style={styles.fieldUpdatesTitle}>Barangay updates</Text>
          <Text style={styles.fieldUpdatesSubtitle}>
            Latest reports and announcement in each barangay
          </Text>
        </View>
        <TouchableOpacity
          style={styles.fieldUpdatesViewAll}
          onPress={openAnnouncements}
          accessibilityRole="button"
          accessibilityLabel="View all barangay announcements"
        >
          <Text style={styles.fieldUpdatesViewAllText}>View all</Text>
          <Ionicons name="chevron-forward" size={19} color={colors.navigationActive} />
        </TouchableOpacity>
      </View>

      {announcementsLoading ? (
        <View style={styles.fieldUpdatesEmptyCard}>
          <ActivityIndicator color={colors.navigationActive} />
          <Text style={styles.fieldUpdatesEmptyBody}>Loading barangay updates…</Text>
        </View>
      ) : announcementsError ? (
        <View style={styles.fieldUpdatesEmptyCard} accessibilityRole="alert">
          <View style={styles.fieldUpdatesEmptyIcon}>
            <Ionicons name="cloud-offline-outline" size={27} color={colors.navigationActive} />
          </View>
          <Text style={styles.fieldUpdatesEmptyTitle}>Could not load barangay updates</Text>
          <Text style={styles.fieldUpdatesEmptyBody}>{announcementsError}</Text>
          <TouchableOpacity
            style={styles.fieldUpdateMapAction}
            onPress={() => void reloadAnnouncements()}
            accessibilityRole="button"
            accessibilityLabel="Retry barangay announcements"
          >
            <Text style={styles.fieldUpdateMapActionText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : visibleLatestAnnouncements.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.fieldUpdateCards}
          decelerationRate="fast"
          snapToInterval={latestCardWidth + 12}
        >
          {visibleLatestAnnouncements.map((announcement) => {
            const mediaUrl = firstMediaUrl(announcement);
            const barangayLabel = announcementBarangayLabel(
              announcement,
              barangayNameById,
            );

            return (
              <View
                key={announcement.id}
                style={[styles.fieldUpdateCard, { width: latestCardWidth }]}
              >
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={openAnnouncements}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${announcement.title || 'barangay announcement'}`}
                >
                  <View style={styles.fieldUpdateMediaFrame}>
                    {mediaUrl ? (
                      <Image
                        source={{ uri: mediaUrl }}
                        style={styles.fieldUpdateMedia}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.fieldUpdateMediaPlaceholder}>
                        <Ionicons
                          name="megaphone-outline"
                          size={34}
                          color={colors.navigationActive}
                        />
                        <Text style={styles.fieldUpdateMediaPlaceholderText}>No media attached</Text>
                      </View>
                    )}

                    <View style={styles.fieldUpdateMediaLabel}>
                      <Text style={styles.fieldUpdateMediaLabelText} numberOfLines={1}>
                        {barangayLabel} · {announcementAgeLabel(announcement.createdAt)}
                      </Text>
                    </View>

                    {announcement.mediaCount > 0 ? (
                      <View style={styles.fieldUpdateMediaCount}>
                        <Ionicons name="images-outline" size={15} color={colors.white} />
                        <Text style={styles.fieldUpdateMediaCountText}>
                          {announcement.mediaCount} media
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>

                <View style={styles.fieldUpdateCardCopy}>
                  <Text style={styles.fieldUpdateCardTitle} numberOfLines={2}>
                    {announcement.title.trim() || 'Barangay announcement'}
                  </Text>
                  <Text
                    style={styles.fieldUpdateCardBody}
                    numberOfLines={3}
                    ellipsizeMode="tail"
                  >
                    {announcement.body.trim() || 'No announcement details provided.'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.fieldUpdateMapAction, styles.fieldUpdateCardAction]}
                    hitSlop={8}
                    onPress={openAnnouncements}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${announcement.title || 'announcement'} in Community`}
                  >
                    <Text style={styles.fieldUpdateMapActionText}>View announcement</Text>
                    <Ionicons name="arrow-forward" size={20} color={colors.navigationActive} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View
          style={styles.fieldUpdatesEmptyCard}
          accessibilityRole="text"
          accessibilityLabel="No barangay announcements in the last three days"
        >
          <View style={styles.fieldUpdatesEmptyIcon}>
            <Ionicons name="time-outline" size={27} color={colors.navigationActive} />
          </View>
          <Text style={styles.fieldUpdatesEmptyTitle}>No updates in the last 3 days</Text>
          <Text style={styles.fieldUpdatesEmptyBody}>
            New barangay announcements will appear here.
          </Text>
        </View>
      )}

      <View style={styles.earlierDivider} />

      <View style={styles.earlierHeader}>
        <Text style={styles.earlierTitle}>Earlier</Text>
        <Text style={styles.earlierSubtitle}>Barangay announcements older than 3 days</Text>
      </View>

      {visibleEarlierAnnouncements.length > 0 ? (
        <View style={styles.earlierTimeline}>
          {visibleEarlierAnnouncements.map((announcement, index) => {
            const isLastItem = index === visibleEarlierAnnouncements.length - 1;
            const isOnlyItem = visibleEarlierAnnouncements.length === 1;
            const barangayLabel = announcementBarangayLabel(
              announcement,
              barangayNameById,
            );
            const mediaUrl = firstMediaUrl(announcement);

            return (
              <TouchableOpacity
                key={announcement.id}
                style={styles.earlierItem}
                onPress={openAnnouncements}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel={`View earlier announcement ${announcement.title || ''}`.trim()}
              >
                <View
                  style={[
                    styles.earlierTimelineRail,
                    isOnlyItem && styles.earlierTimelineRailSingle,
                  ]}
                >
                  {!isLastItem ? <View style={styles.earlierTimelineLine} /> : null}
                  <View
                    style={[
                      styles.earlierStatusIcon,
                      { backgroundColor: colors.navigationActive },
                    ]}
                  >
                    <Ionicons name="megaphone-outline" size={17} color={colors.white} />
                  </View>
                </View>

                <View style={[styles.earlierItemBody, !isLastItem && styles.earlierItemBorder]}>
                  <View style={styles.earlierItemCopy}>
                    <Text style={styles.earlierItemTime}>
                      {announcementAgeLabel(announcement.createdAt)}
                    </Text>
                    <Text style={styles.earlierItemBarangay} numberOfLines={1}>
                      {barangayLabel}
                    </Text>
                    <Text style={styles.earlierItemTitle} numberOfLines={2}>
                      {announcement.title.trim() || 'Barangay announcement'}
                    </Text>
                  </View>

                  {mediaUrl ? (
                    <Image
                      source={{ uri: mediaUrl }}
                      style={styles.earlierItemMedia}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.earlierItemMediaPlaceholder}>
                      <Ionicons
                        name="megaphone-outline"
                        size={22}
                        color={colors.navigationActive}
                      />
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={21} color={colors.navigationActive} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : announcementsLoadingMore ? (
        <View style={styles.earlierLoading}>
          <ActivityIndicator color={colors.navigationActive} />
          <Text style={styles.earlierEmptyText}>Loading earlier announcements…</Text>
        </View>
      ) : (
        <View style={styles.earlierEmpty}>
          <Ionicons name="checkmark-circle-outline" size={22} color="#8AA0BF" />
          <Text style={styles.earlierEmptyText}>No earlier announcements to show.</Text>
        </View>
      )}
    </View>
  );
}
