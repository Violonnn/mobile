// app/admin/index.tsx — Admin Overview dashboard.
// Real invitation metrics + recent rows only (no fake analytics).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { adminStyles as styles } from '../../styles/screens/admin.styles';
import { colors } from '../../styles/theme';
import { logout } from '../../lib/auth';
import {
  formatInviteKind,
  listOfficialInvites,
  type InviteListItem,
} from '../../lib/invites';

function formatShortDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

/** Sort key: prefer used_at when present, otherwise created_at. */
function inviteRecencyTimestamp(invite: InviteListItem): number {
  const raw = invite.used_at ?? invite.created_at;
  const time = Date.parse(raw);
  return Number.isNaN(time) ? 0 : time;
}

export default function AdminOverviewScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeInvites, setActiveInvites] = useState<InviteListItem[]>([]);
  const [usedInvites, setUsedInvites] = useState<InviteListItem[]>([]);
  const [listError, setListError] = useState('');

  const loadInvites = useCallback(async () => {
    const { active, used, error } = await listOfficialInvites();
    if (error) {
      setListError(error);
      setActiveInvites([]);
      setUsedInvites([]);
      return;
    }
    setListError('');
    setActiveInvites(active);
    setUsedInvites(used);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadInvites();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadInvites]);

  const recentInvites = useMemo(() => {
    const combined = [...activeInvites, ...usedInvites];
    combined.sort(
      (left, right) =>
        inviteRecencyTimestamp(right) - inviteRecencyTimestamp(left),
    );
    return combined.slice(0, 3);
  }, [activeInvites, usedInvites]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadInvites();
    setRefreshing(false);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const { error } = await logout();
      if (error) throw new Error(error);
      router.replace('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not log out.';
      Alert.alert('Logout failed', message);
    } finally {
      setLoggingOut(false);
    }
  }

  function openInvitations() {
    router.push('/admin/invitations');
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.themeSoft} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerIdentity}>
            <View style={styles.brandMark}>
              <Image
                source={require('../../assets/images/mingla.png')}
                style={styles.brandMarkImage}
                accessibilityLabel="DisasterLink"
              />
            </View>
            <View style={styles.headerTextGroup}>
              <Text style={styles.brandLabel}>DisasterLink</Text>
              <Text style={styles.title}>Admin workspace</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text style={styles.logoutButtonText}>Log out</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invitation activity</Text>
          <Text style={styles.sectionHint}>
            Live counts from official invite links. Tap a tile to manage them.
          </Text>

          {listError ? (
            <View style={styles.listGap}>
              <Text style={styles.errorText}>{listError}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRefresh}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Retry loading invites"
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.metricsRow}>
              <TouchableOpacity
                style={styles.metricTile}
                onPress={openInvitations}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Active invites"
              >
                <View style={styles.metricTileTop}>
                  <Text style={styles.metricValue}>{activeInvites.length}</Text>
                  <View style={styles.metricArrow}>
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={colors.themeSoft}
                    />
                  </View>
                </View>
                <Text style={styles.metricLabel}>Active invites</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.metricTile}
                onPress={openInvitations}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Used invites"
              >
                <View style={styles.metricTileTop}>
                  <Text style={styles.metricValue}>{usedInvites.length}</Text>
                  <View style={styles.metricArrow}>
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={colors.themeSoft}
                    />
                  </View>
                </View>
                <Text style={styles.metricLabel}>Used invites</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>Recent invitations</Text>
            <TouchableOpacity
              style={styles.linkAction}
              onPress={openInvitations}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="View all invitations"
            >
              <Text style={styles.linkActionText}>View all</Text>
            </TouchableOpacity>
          </View>

          {listError ? (
            <Text style={styles.errorText}>{listError}</Text>
          ) : recentInvites.length === 0 ? (
            <Text style={styles.emptyText}>No invitations yet.</Text>
          ) : (
            <View style={styles.recentList}>
              {recentInvites.map((invite, index) => {
                const isUsed = invite.list_group === 'used';
                const isLast = index === recentInvites.length - 1;
                const dateLabel = isUsed
                  ? `Used ${formatShortDate(invite.used_at ?? invite.created_at)}`
                  : `Created ${formatShortDate(invite.created_at)}`;

                return (
                  <View
                    key={invite.id}
                    style={[styles.recentRow, isLast && styles.recentRowLast]}
                  >
                    <View style={styles.recentRowTop}>
                      <Text style={styles.recentKind} numberOfLines={1}>
                        {formatInviteKind(invite.role, invite.barangay_id)}
                        {invite.barangay_name ? ` · ${invite.barangay_name}` : ''}
                      </Text>
                      <View
                        style={[
                          styles.statusChip,
                          isUsed ? styles.statusChipUsed : styles.statusChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            isUsed
                              ? styles.statusChipTextUsed
                              : styles.statusChipTextActive,
                          ]}
                        >
                          {isUsed ? 'Used' : 'Active'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.recentEmail} numberOfLines={1}>
                      {invite.invited_email}
                    </Text>
                    <Text style={styles.recentDate}>{dateLabel}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={openInvitations}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Create invitation"
        >
          <Text style={styles.primaryButtonText}>Create invitation</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
