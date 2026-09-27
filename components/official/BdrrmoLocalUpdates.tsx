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
import { formatPublishedAt } from '../../lib/formatTime';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';
import { colors } from '../../styles/theme';

const RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

type Props = {
  announcements: AnnouncementRecord[];
  assignedBarangayId: string | null;
  assignedBarangay: string | null;
  error: string | null;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
  onReload: () => Promise<void>;
};

function firstMediaUrl(announcement: AnnouncementRecord): string | null {
  const media = announcement.media[0];
  return media?.thumbnailUrl || media?.url || null;
}

export default function BdrrmoLocalUpdates({
  announcements,
  assignedBarangayId,
  assignedBarangay,
  error,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onReload,
}: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [recencyReferenceTime, setRecencyReferenceTime] = useState(() => Date.now());
  const cardWidth = Math.min(520, Math.max(260, width - 80));
  const localAnnouncements = useMemo(
    () => announcements
      .filter((announcement) =>
        announcement.scope === 'barangay' &&
        announcement.barangayId === assignedBarangayId,
      )
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()),
    [announcements, assignedBarangayId],
  );
  const recentCutoff = recencyReferenceTime - RECENT_WINDOW_MS;
  const recent = localAnnouncements.filter((announcement) => new Date(announcement.createdAt).getTime() >= recentCutoff).slice(0, 6);
  const earlier = localAnnouncements.filter((announcement) => new Date(announcement.createdAt).getTime() < recentCutoff).slice(0, 4);

  useEffect(() => {
    const recencyTimer = setInterval(() => setRecencyReferenceTime(Date.now()), 60_000);
    return () => clearInterval(recencyTimer);
  }, []);

  useEffect(() => {
    if (!hasMore || loadingMore || earlier.length > 0) return;
    void onLoadMore();
  }, [earlier.length, hasMore, loadingMore, onLoadMore]);

  const openCommunity = () => router.push('/official/community?feed=official' as Href);

  return (
    <View style={styles.fieldUpdatesSection}>
      <View style={styles.fieldUpdatesHeader}>
        <View style={styles.fieldUpdatesHeadingCopy}>
          <Text style={styles.fieldUpdatesTitle}>Local Updates</Text>
          <Text style={styles.fieldUpdatesSubtitle}>
            Announcements published for {assignedBarangay || 'your assigned barangay'}
          </Text>
        </View>
        <TouchableOpacity style={styles.fieldUpdatesViewAll} onPress={openCommunity} accessibilityRole="button" accessibilityLabel="View all local announcements">
          <Text style={styles.fieldUpdatesViewAllText}>View all</Text>
          <Ionicons name="chevron-forward" size={19} color={colors.navigationActive} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.fieldUpdatesEmptyCard}>
          <ActivityIndicator color={colors.navigationActive} />
          <Text style={styles.fieldUpdatesEmptyBody}>Loading local updates…</Text>
        </View>
      ) : error ? (
        <View style={styles.fieldUpdatesEmptyCard} accessibilityRole="alert">
          <View style={styles.fieldUpdatesEmptyIcon}><Ionicons name="cloud-offline-outline" size={27} color={colors.navigationActive} /></View>
          <Text style={styles.fieldUpdatesEmptyTitle}>Could not load local updates</Text>
          <Text style={styles.fieldUpdatesEmptyBody}>{error}</Text>
          <TouchableOpacity style={styles.fieldUpdateMapAction} onPress={() => void onReload()}><Text style={styles.fieldUpdateMapActionText}>Try again</Text></TouchableOpacity>
        </View>
      ) : recent.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fieldUpdateCards} decelerationRate="fast" snapToInterval={cardWidth + 12}>
          {recent.map((announcement) => {
            const mediaUrl = firstMediaUrl(announcement);
            return (
              <View key={announcement.id} style={[styles.fieldUpdateCard, { width: cardWidth }]}>
                <TouchableOpacity activeOpacity={0.88} onPress={openCommunity}>
                  <View style={styles.fieldUpdateMediaFrame}>
                    {mediaUrl ? <Image source={{ uri: mediaUrl }} style={styles.fieldUpdateMedia} resizeMode="cover" /> : <View style={styles.fieldUpdateMediaPlaceholder}><Ionicons name="megaphone-outline" size={34} color={colors.navigationActive} /><Text style={styles.fieldUpdateMediaPlaceholderText}>No media attached</Text></View>}
                    <View style={styles.fieldUpdateMediaLabel}><Text style={styles.fieldUpdateMediaLabelText} numberOfLines={1}>BRGY. {assignedBarangay || 'LOCAL'} · {formatPublishedAt(announcement.createdAt)}</Text></View>
                    {announcement.mediaCount > 0 ? <View style={styles.fieldUpdateMediaCount}><Ionicons name="images-outline" size={15} color={colors.white} /><Text style={styles.fieldUpdateMediaCountText}>{announcement.mediaCount} media</Text></View> : null}
                  </View>
                </TouchableOpacity>
                <View style={styles.fieldUpdateCardCopy}>
                  <Text style={styles.fieldUpdateCardTitle} numberOfLines={2}>{announcement.title.trim() || 'Barangay announcement'}</Text>
                  <Text style={styles.fieldUpdateCardBody} numberOfLines={3}>{announcement.body.trim() || 'No announcement details provided.'}</Text>
                  <TouchableOpacity style={[styles.fieldUpdateMapAction, styles.fieldUpdateCardAction]} onPress={openCommunity}><Text style={styles.fieldUpdateMapActionText}>View announcement</Text><Ionicons name="arrow-forward" size={20} color={colors.navigationActive} /></TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.fieldUpdatesEmptyCard}>
          <View style={styles.fieldUpdatesEmptyIcon}><Ionicons name="time-outline" size={27} color={colors.navigationActive} /></View>
          <Text style={styles.fieldUpdatesEmptyTitle}>No updates in the last 3 days</Text>
          <Text style={styles.fieldUpdatesEmptyBody}>New local announcements will appear here.</Text>
        </View>
      )}

      <View style={styles.earlierDivider} />
      <View style={styles.earlierHeader}>
        <Text style={styles.earlierTitle}>Earlier</Text>
        <Text style={styles.earlierSubtitle}>Local announcements older than 3 days</Text>
      </View>
      {earlier.length > 0 ? (
        <View style={styles.earlierTimeline}>
          {earlier.map((announcement, index) => {
            const isLast = index === earlier.length - 1;
            const mediaUrl = firstMediaUrl(announcement);
            return (
              <TouchableOpacity key={announcement.id} style={styles.earlierItem} onPress={openCommunity} activeOpacity={0.78}>
                <View style={[styles.earlierTimelineRail, earlier.length === 1 && styles.earlierTimelineRailSingle]}>
                  {!isLast ? <View style={styles.earlierTimelineLine} /> : null}
                  <View style={[styles.earlierStatusIcon, { backgroundColor: colors.navigationActive }]}><Ionicons name="megaphone-outline" size={17} color={colors.white} /></View>
                </View>
                <View style={[styles.earlierItemBody, !isLast && styles.earlierItemBorder]}>
                  <View style={styles.earlierItemCopy}>
                    <Text style={styles.earlierItemTime}>{formatPublishedAt(announcement.createdAt)}</Text>
                    <Text style={styles.earlierItemBarangay}>Brgy. {assignedBarangay || 'Local'}</Text>
                    <Text style={styles.earlierItemTitle} numberOfLines={2}>{announcement.title.trim() || 'Barangay announcement'}</Text>
                  </View>
                  {mediaUrl ? <Image source={{ uri: mediaUrl }} style={styles.earlierItemMedia} resizeMode="cover" /> : <View style={styles.earlierItemMediaPlaceholder}><Ionicons name="megaphone-outline" size={22} color={colors.navigationActive} /></View>}
                  <Ionicons name="chevron-forward" size={21} color={colors.navigationActive} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={styles.earlierEmpty}><Ionicons name="checkmark-circle-outline" size={22} color="#8AA0BF" /><Text style={styles.earlierEmptyText}>No earlier announcements to show.</Text></View>
      )}
      {loadingMore ? <ActivityIndicator color={colors.navigationActive} /> : null}
    </View>
  );
}
