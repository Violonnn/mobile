import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';

import type { AnnouncementRecord } from '../../lib/announcements';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';
import { colors, screenEdgeInset } from '../../styles/theme';
import HomeUpdateCard from '../home/HomeUpdateCard';
import { AnnouncementEngagementProvider } from './AnnouncementEngagementProvider';

const RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

type Props = {
  announcements: AnnouncementRecord[];
  assignedBarangayId: string | null;
  error: string | null;
  loading: boolean;
  onReload: () => Promise<void>;
};

export default function BdrrmoLocalUpdates({
  announcements,
  assignedBarangayId,
  error,
  loading,
  onReload,
}: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [recencyReferenceTime, setRecencyReferenceTime] = useState(() => Date.now());
  const availableCardWidth = Math.max(260, width - screenEdgeInset * 2);
  const cardWidth = Math.min(520, availableCardWidth);
  const carouselSideInset = Math.max(
    0,
    (width - screenEdgeInset * 2 - cardWidth) / 2,
  );
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

  useEffect(() => {
    const recencyTimer = setInterval(() => setRecencyReferenceTime(Date.now()), 60_000);
    return () => clearInterval(recencyTimer);
  }, []);

  const openCommunity = () => router.push('/official/community?feed=official' as Href);

  return (
    <View
      style={[
        styles.fieldUpdatesSection,
        styles.bdrrmoLocalUpdatesSection,
        { paddingHorizontal: screenEdgeInset },
      ]}
    >
      <View style={styles.fieldUpdatesHeader}>
        <View style={styles.fieldUpdatesHeadingCopy}>
          <Text style={styles.fieldUpdatesTitle}>Local Updates</Text>
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
        <AnnouncementEngagementProvider announcements={recent}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.fieldUpdateCards, {
              paddingLeft: carouselSideInset,
              paddingRight: carouselSideInset,
            }]}
            decelerationRate="fast"
            snapToInterval={cardWidth + 12}
            snapToAlignment="center"
          >
            {recent.map((announcement) => (
              <View key={announcement.id} style={{ width: cardWidth }}>
                <HomeUpdateCard announcement={announcement} onPress={openCommunity} />
              </View>
            ))}
          </ScrollView>
        </AnnouncementEngagementProvider>
      ) : (
        <View style={styles.fieldUpdatesEmptyCard}>
          <View style={styles.fieldUpdatesEmptyIcon}><Ionicons name="time-outline" size={27} color={colors.navigationActive} /></View>
          <Text style={styles.fieldUpdatesEmptyTitle}>No updates in the last 3 days</Text>
          <Text style={styles.fieldUpdatesEmptyBody}>New local announcements will appear here.</Text>
        </View>
      )}

    </View>
  );
}
