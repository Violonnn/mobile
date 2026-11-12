import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AdminInviteFiltersSheet from '../../components/admin/AdminInviteFiltersSheet';
import AdminInviteFormSheet from '../../components/admin/AdminInviteFormSheet';
import AdminInviteRow from '../../components/admin/AdminInviteRow';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { AdminInviteListSkeleton } from '../../components/ui/AdminScreenSkeletons';
import { useAdminInvites } from '../../context/AdminInvitesContext';
import { useAccessibilityLayout } from '../../hooks/useAccessibilityLayout';
import {
  filterAdminInvites,
  isInviteExpiringSoon,
  type AdminInviteExpiryFilter,
  type AdminInviteGroupFilter,
  type AdminInviteRoleFilter,
} from '../../lib/adminInvitePolicy';
import {
  formatInviteKind,
  formatInviteScopeLabel,
  revokeOfficialInvite,
  type InviteListItem,
} from '../../lib/invites';
import { adminStyles as styles } from '../../styles/screens/admin.styles';
import { colors } from '../../styles/theme';

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function parseGroup(value: string): AdminInviteGroupFilter {
  return value === 'registered' || value === 'used' ? 'registered' : 'pending';
}

function parseRole(value: string): AdminInviteRoleFilter {
  if (value === 'mayor' || value === 'mdrrmo' || value === 'bdrrmo') return value;
  return 'all';
}

function roleName(role: AdminInviteRoleFilter): string {
  switch (role) {
    case 'mayor':
      return 'Mayor';
    case 'mdrrmo':
      return 'MDRRMO';
    case 'bdrrmo':
      return 'BDRRMO';
    default:
      return 'All roles';
  }
}

export default function AdminInvitationsScreen() {
  const router = useRouter();
  const { isLargeText } = useAccessibilityLayout();
  const params = useLocalSearchParams<{
    group?: string | string[];
    role?: string | string[];
    expiry?: string | string[];
    search?: string | string[];
  }>();
  const {
    active,
    used,
    loading,
    refreshing,
    error,
    lastLoadedAt,
    now,
    reload,
    removeActiveInvite,
    refreshAfterMutation,
  } = useAdminInvites();

  const group = parseGroup(firstParam(params.group));
  const role = parseRole(firstParam(params.role));
  const expiry: AdminInviteExpiryFilter =
    group === 'pending' && firstParam(params.expiry) === 'soon' ? 'soon' : 'any';
  const search = firstParam(params.search).slice(0, 120);
  const hasSnapshot = lastLoadedAt !== null;
  const [filterVisible, setFilterVisible] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [revokePendingId, setRevokePendingId] = useState<string | null>(null);
  const [revokeErrors, setRevokeErrors] = useState<Record<string, string>>({});
  const revokeLockRef = useRef(false);
  const mountedRef = useRef(true);
  const revokeGenerationRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      revokeGenerationRef.current += 1;
    };
  }, []);

  const pendingInvites = active;
  const registeredInvites = used;
  const groupInvites = group === 'pending' ? pendingInvites : registeredInvites;
  const rows = useMemo(
    () =>
      filterAdminInvites({
        pendingInvites,
        registeredInvites,
        group,
        role,
        expiry,
        search,
        now,
        formatInviteKind,
      }),
    [pendingInvites, registeredInvites, group, role, expiry, search, now],
  );
  const hasFilters = role !== 'all' || expiry === 'soon' || search.trim().length > 0;
  const hasSearch = search.trim().length > 0;
  const countText = (count: number) => (hasSnapshot ? String(count) : loading ? '…' : '—');

  const handleRefresh = useCallback(() => {
    void reload({ force: true });
  }, [reload]);

  const clearFilters = useCallback(() => {
    router.setParams({
      group,
      role: 'all',
      expiry: 'any',
      search: '',
    });
  }, [group, router]);

  const openFilters = useCallback(() => {
    Keyboard.dismiss();
    setFilterVisible(true);
  }, []);

  const openCreateSheet = useCallback(() => {
    Keyboard.dismiss();
    setSheetVisible(true);
  }, []);

  const applyFilters = useCallback(
    (nextRole: AdminInviteRoleFilter, nextExpiry: AdminInviteExpiryFilter) => {
      router.setParams({
        role: nextRole,
        expiry: group === 'pending' ? nextExpiry : 'any',
      });
      setFilterVisible(false);
    },
    [group, router],
  );

  const confirmRevoke = useCallback((invite: InviteListItem) => {
    if (!mountedRef.current || revokeLockRef.current) return;
    const actionGeneration = revokeGenerationRef.current;
    const scopeLabel = formatInviteScopeLabel(invite);
    setRevokeErrors((currentErrors) => ({ ...currentErrors, [invite.id]: '' }));
    Alert.alert(
      'Revoke invite?',
      'Revoke the ' + scopeLabel + ' invitation for ' + invite.invited_email + '? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => {
            if (
              !mountedRef.current ||
              actionGeneration !== revokeGenerationRef.current ||
              revokeLockRef.current
            ) {
              return;
            }
            revokeLockRef.current = true;
            setRevokePendingId(invite.id);
            void (async () => {
              try {
                const result = await revokeOfficialInvite(invite.id);
                if (
                  !mountedRef.current ||
                  actionGeneration !== revokeGenerationRef.current
                ) {
                  return;
                }
                if (result.error) {
                  setRevokeErrors((currentErrors) => ({
                    ...currentErrors,
                    [invite.id]: result.error ?? 'Could not revoke invite.',
                  }));
                  return;
                }

                removeActiveInvite(invite.id);
                await refreshAfterMutation();
              } catch {
                if (
                  mountedRef.current &&
                  actionGeneration === revokeGenerationRef.current
                ) {
                  setRevokeErrors((currentErrors) => ({
                    ...currentErrors,
                    [invite.id]: 'Could not revoke invite. Check your connection and retry.',
                  }));
                }
              } finally {
                revokeLockRef.current = false;
                if (
                  mountedRef.current &&
                  actionGeneration === revokeGenerationRef.current
                ) {
                  setRevokePendingId(null);
                }
              }
            })();
          },
        },
      ],
    );
  }, [refreshAfterMutation, removeActiveInvite]);

  const listHeader = (
    <View style={styles.invitationListHeader}>
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={(value) => router.setParams({ search: value.slice(0, 120) })}
            placeholder="Search email, barangay, or role"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={120}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            accessibilityLabel="Search invitations by email, barangay, or role"
          />
          {hasSearch ? (
            <TouchableOpacity
              onPress={() => router.setParams({ search: '' })}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear invitation search"
            >
              <Ionicons name="close-circle" size={19} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={openFilters}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={
            hasFilters
              ? 'Edit invitation filters. ' + (role !== 'all' ? roleName(role) + ' role, ' : '') +
                (expiry === 'soon' ? 'expiring within 48 hours' : 'any expiry')
              : 'Filter invitations'
          }
        >
          <Ionicons name="options-outline" size={20} color={colors.navigationActive} />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.segmentControl,
          isLargeText ? styles.segmentControlStacked : null,
        ]}
        accessibilityRole="tablist"
      >
        {([
          { group: 'pending', label: 'Pending', count: pendingInvites.length },
          { group: 'registered', label: 'Registered', count: registeredInvites.length },
        ] as const).map((option) => {
          const selected = group === option.group;
          const accessibleCount = hasSnapshot
            ? ', count ' + option.count
            : ', count ' + (loading ? 'loading' : 'unavailable');
          return (
            <TouchableOpacity
              key={option.group}
              style={[
                styles.segmentButton,
                isLargeText ? styles.segmentButtonStacked : null,
                selected && styles.segmentButtonActive,
              ]}
              onPress={() =>
                router.setParams({
                  group: option.group,
                  expiry: option.group === 'pending' ? expiry : 'any',
                })
              }
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label + ' invites' + accessibleCount}
            >
              <Text style={[styles.segmentLabel, selected && styles.segmentLabelActive]}>
                {option.label}
              </Text>
              <Text style={[styles.segmentCount, !hasSnapshot && styles.segmentCountUnknown]}>
                {countText(option.count)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {hasFilters ? (
        <View style={styles.activeFilters}>
          {role !== 'all' ? (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>Role: {roleName(role)}</Text>
              <TouchableOpacity
                onPress={() => router.setParams({ role: 'all' })}
                hitSlop={7}
                accessibilityRole="button"
                accessibilityLabel="Remove role filter"
              >
                <Ionicons name="close-circle" size={17} color={colors.navigationActive} />
              </TouchableOpacity>
            </View>
          ) : null}
          {expiry === 'soon' ? (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>Expiring in 48h</Text>
              <TouchableOpacity
                onPress={() => router.setParams({ expiry: 'any' })}
                hitSlop={7}
                accessibilityRole="button"
                accessibilityLabel="Remove expiry filter"
              >
                <Ionicons name="close-circle" size={17} color={colors.navigationActive} />
              </TouchableOpacity>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={clearFilters}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={styles.clearFiltersText}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {error && hasSnapshot ? (
        <View style={styles.errorPanel}>
          <Text style={styles.sectionError}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRefresh}
            accessibilityRole="button"
            accessibilityLabel="Retry refreshing invites"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  let emptyState = null;
  if (loading && !hasSnapshot) {
    emptyState = <AdminInviteListSkeleton />;
  } else if (error && !hasSnapshot) {
    emptyState = (
      <View style={styles.emptyState}>
        <View style={styles.emptyStateMark}>
          <Ionicons name="cloud-offline-outline" size={24} color={colors.navigationActive} />
        </View>
        <Text style={styles.emptyStateTitle}>Invites could not be loaded</Text>
        <Text style={styles.emptyStateBody}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRefresh}
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (groupInvites.length > 0 && rows.length === 0) {
    emptyState = (
      <View style={styles.emptyState}>
        <View style={styles.emptyStateMark}>
          <Ionicons name="search-outline" size={24} color={colors.navigationActive} />
        </View>
        <Text style={styles.emptyStateTitle}>No matching invites</Text>
        <Text style={styles.emptyStateBody}>
          Change or clear the search and filters to see more invitation records.
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={clearFilters}
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>Clear filters</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (groupInvites.length === 0) {
    emptyState = (
      <View style={styles.emptyState}>
        <View style={styles.emptyStateMark}>
          <Ionicons name="mail-outline" size={24} color={colors.navigationActive} />
        </View>
        <Text style={styles.emptyStateTitle}>
          {group === 'pending' ? 'No pending invites' : 'No registered invites'}
        </Text>
        <Text style={styles.emptyStateBody}>
          {group === 'pending'
            ? 'New invitations will appear here after they are created.'
            : 'Invitations appear here after an invited person registers.'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <AdminPageHeader
        title="Invites"
        action={
          <TouchableOpacity
            style={styles.headerAction}
            onPress={openCreateSheet}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Create a new invite"
          >
            <Ionicons name="add-outline" size={19} color={colors.navigationActive} />
            <Text style={styles.headerActionText}>New invite</Text>
          </TouchableOpacity>
        }
      />
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={rows}
          keyExtractor={(invite) => invite.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={emptyState ?? undefined}
          renderItem={({ item }) => (
            <AdminInviteRow
              invite={item}
              expiringSoon={
                item.list_group === 'active' &&
                isInviteExpiringSoon(item.expires_at, now)
              }
              onRevoke={item.list_group === 'active' ? () => confirmRevoke(item) : undefined}
              revokePending={revokePendingId === item.id}
              revokeError={revokeErrors[item.id] || null}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.inviteDivider} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.navigationActive}
              colors={[colors.navigationActive]}
            />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </KeyboardAvoidingView>

      {filterVisible ? (
        <AdminInviteFiltersSheet
          group={group}
          role={role}
          expiry={expiry}
          onClose={() => setFilterVisible(false)}
          onApply={applyFilters}
        />
      ) : null}
      {sheetVisible ? (
        <AdminInviteFormSheet
          visible
          onRequestClose={() => setSheetVisible(false)}
          onCreated={refreshAfterMutation}
        />
      ) : null}
    </SafeAreaView>
  );
}
