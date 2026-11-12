import React, { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AdminInviteFormSheet from '../../components/admin/AdminInviteFormSheet';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { AdminDashboardDataSkeleton } from '../../components/ui/AdminScreenSkeletons';
import { useAccessibilityLayout } from '../../hooks/useAccessibilityLayout';
import { useAdminInvites } from '../../context/AdminInvitesContext';
import { formatInviteKind } from '../../lib/invites';
import {
  isInviteExpiringSoon,
  summarizeInvitesByRole,
  type AdminInviteRoleFilter,
} from '../../lib/adminInvitePolicy';
import { adminColors, adminStyles as styles } from '../../styles/screens/admin.styles';
import { colors } from '../../styles/theme';

type RoleShortcut = Exclude<AdminInviteRoleFilter, 'all'>;

type RoleTool = {
  key: RoleShortcut;
  label: string;
  icon: 'person-outline' | 'business-outline' | 'people-outline';
  pending: number;
  registered: number;
};

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isLargeText } = useAccessibilityLayout();
  const compactLayout = width < 360 || isLargeText;
  const {
    active,
    used,
    loading,
    refreshing,
    error,
    lastLoadedAt,
    now,
    reload,
    refreshAfterMutation,
  } = useAdminInvites();
  const [createVisible, setCreateVisible] = useState(false);
  const hasSnapshot = lastLoadedAt !== null;

  const roleCounts = useMemo(
    () => summarizeInvitesByRole(active, used, now, formatInviteKind),
    [active, used, now],
  );
  const expiringSoonCount = useMemo(
    () => active.filter((invite) => isInviteExpiringSoon(invite.expires_at, now)).length,
    [active, now],
  );
  const roleTools: RoleTool[] = useMemo(
    () => [
      {
        ...roleCounts[0],
        icon: 'person-outline',
      },
      {
        ...roleCounts[1],
        icon: 'business-outline',
      },
      {
        ...roleCounts[2],
        icon: 'people-outline',
      },
    ],
    [roleCounts],
  );

  const openInviteRecords = useCallback(
    (
      group: 'pending' | 'registered',
      role: RoleShortcut | 'all',
      expiry: 'any' | 'soon',
    ) => {
      router.push({
        pathname: '/admin/invitations',
        params: { group, role, expiry, search: '' },
      });
    },
    [router],
  );

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const retrySnapshot = useCallback(() => {
    void reload({ force: true });
  }, [reload]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <AdminPageHeader
        title="Admin"
        action={
          <TouchableOpacity
            style={styles.iconAction}
            onPress={() => router.push('/admin/settings')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
          >
            <Ionicons name="settings-outline" size={22} color={colors.navigationActive} />
          </TouchableOpacity>
        }
      />
      <ScrollView
        contentContainerStyle={styles.dashboardScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={retrySnapshot}
            tintColor={colors.navigationActive}
            colors={[colors.navigationActive]}
          />
        }
      >
        {error && hasSnapshot ? (
          <View style={[styles.errorPanel, styles.dashboardInset]}>
            <Text style={styles.sectionError}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={retrySnapshot}
              accessibilityRole="button"
              accessibilityLabel="Retry refreshing invitation summary"
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.accessPanel}>
          <Text style={styles.accessPanelTitle}>Official access</Text>
          <View style={[styles.accessStages, compactLayout ? styles.accessStagesStacked : null]}>
            <TouchableOpacity
              style={[styles.accessStagePending, compactLayout ? styles.accessStageStacked : null]}
              onPress={() => openInviteRecords('pending', 'all', 'any')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={
                'Pending invitations, ' +
                (hasSnapshot ? active.length : loading ? 'loading' : 'unavailable') +
                '. View pending invitations.'
              }
            >
              <Text
                style={[styles.stageCount, !hasSnapshot && styles.stageCountUnavailable]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {hasSnapshot ? active.length : '—'}
              </Text>
              <View style={styles.stageLabelRow}>
                <Text style={styles.stageLabel}>Pending</Text>
                <Ionicons name="arrow-forward-outline" size={16} color={colors.navigationActive} />
              </View>
            </TouchableOpacity>
            <View
              style={[
                styles.accessMetricDivider,
                compactLayout ? styles.accessMetricDividerHorizontal : null,
              ]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <TouchableOpacity
              style={[
                styles.accessStageRegistered,
                compactLayout ? styles.accessStageStacked : null,
              ]}
              onPress={() => openInviteRecords('registered', 'all', 'any')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={
                'Registered invitations, ' +
                (hasSnapshot ? used.length : loading ? 'loading' : 'unavailable') +
                '. View registered invitations.'
              }
            >
              <Text
                style={[styles.stageCountRegistered, !hasSnapshot && styles.stageCountUnavailable]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {hasSnapshot ? used.length : '—'}
              </Text>
              <Text style={[styles.stageLabel, styles.stageLabelRegistered]}>Registered</Text>
            </TouchableOpacity>
          </View>

          {!hasSnapshot && error ? (
            <Text style={styles.accessError}>Refresh the summary to see invitation counts.</Text>
          ) : null}

          <TouchableOpacity
            style={styles.heroButton}
            onPress={() => setCreateVisible(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Create a new invite"
          >
            <Ionicons name="add-outline" size={20} color={colors.white} />
            <Text style={styles.primaryButtonText}>New invite</Text>
          </TouchableOpacity>
        </View>

        {!hasSnapshot && loading ? (
          <AdminDashboardDataSkeleton />
        ) : !hasSnapshot ? (
          <View style={[styles.errorPanel, styles.dashboardInset]}>
            <Text style={styles.sectionError}>
              Invitation expiry and role summaries are unavailable until a list loads.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={retrySnapshot}
              accessibilityRole="button"
              accessibilityLabel="Retry loading invitation summary"
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.dashboardSections}>
            {expiringSoonCount > 0 ? (
              <View
                style={[
                  styles.attentionStrip,
                  styles.attentionStripWarm,
                  compactLayout ? styles.attentionStripCompact : null,
                ]}
              >
                <View style={styles.attentionStripContent}>
                  <View style={styles.attentionAccent} />
                  <Ionicons name="time-outline" size={19} color={adminColors.attentionInk} />
                  <Text style={styles.attentionStripText}>
                    {expiringSoonCount} expiring in 48h
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.attentionReview,
                    compactLayout ? styles.attentionReviewCompact : null,
                  ]}
                  onPress={() => openInviteRecords('pending', 'all', 'soon')}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Review pending invites expiring within 48 hours"
                >
                  <Text style={styles.attentionReviewText}>Review</Text>
                  <Ionicons name="chevron-forward-outline" size={17} color={colors.navigationActive} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.attentionZero}>
                <Ionicons name="checkmark-circle-outline" size={19} color={adminColors.registeredInk} />
                <Text style={styles.attentionZeroText}>No invites expiring soon</Text>
              </View>
            )}

            <View style={styles.roleSection}>
              <Text style={styles.roleSectionTitle}>By role</Text>
              {!compactLayout ? (
                <Text style={styles.roleLegend}>Pending / Registered</Text>
              ) : null}
              <View style={[styles.roleTools, compactLayout ? styles.roleToolsStacked : null]}>
                {roleTools.map((role, index) => (
                  <React.Fragment key={role.key}>
                    <TouchableOpacity
                      style={[styles.roleTool, compactLayout ? styles.roleToolStacked : null]}
                      onPress={() => openInviteRecords('pending', role.key, 'any')}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={
                        role.label +
                        ', ' +
                        role.pending +
                        ' pending and ' +
                        role.registered +
                        ' registered invites. View pending.'
                      }
                    >
                      <View
                        style={[
                          styles.roleToolIdentity,
                          compactLayout ? styles.roleToolIdentityStacked : null,
                        ]}
                      >
                        <Ionicons name={role.icon} size={22} color={colors.navigationActive} />
                        <Text style={styles.roleToolLabel}>{role.label}</Text>
                      </View>
                      {compactLayout ? (
                        <View style={styles.roleToolCountsStacked}>
                          <View style={styles.roleToolCountLine}>
                            <Text style={styles.roleToolCountLabel}>Pending</Text>
                            <Text style={styles.roleToolPending}>{role.pending}</Text>
                          </View>
                          <View style={styles.roleToolCountLine}>
                            <Text style={styles.roleToolCountLabel}>Registered</Text>
                            <Text style={styles.roleToolRegistered}>{role.registered}</Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.roleToolCounts}>
                          <Text style={styles.roleToolPending}>{role.pending}</Text>
                          <Text style={styles.roleToolSeparator}>/</Text>
                          <Text style={styles.roleToolRegistered}>{role.registered}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {index < roleTools.length - 1 ? (
                      <View
                        style={[
                          styles.roleDivider,
                          compactLayout ? styles.roleDividerStacked : null,
                        ]}
                      />
                    ) : null}
                  </React.Fragment>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {createVisible ? (
        <AdminInviteFormSheet
          visible
          onRequestClose={() => setCreateVisible(false)}
          onCreated={refreshAfterMutation}
        />
      ) : null}
    </SafeAreaView>
  );
}
