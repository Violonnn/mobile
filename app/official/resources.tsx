// Resources (BDRRMO/MDRRMO) / Priority (Mayor): compact, scoped directory management.
import React, { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { colors } from '../../styles/theme';
import { useOfficialPortal } from '../../context/OfficialPortalContext';
import { useResources } from '../../hooks/useResources';
import { useEvacuationCenters } from '../../hooks/useEvacuationCenters';
import { fetchBarangays, type BarangayOption } from '../../lib/barangays';
import {
  evacuationStatusLabel,
  facilityTypeLabel,
  hotlineCategoryLabel,
  isReviewOverdue,
  openHotlineDialer,
  updateEvacuationCenter,
  updateFacility,
  updateHotline,
  type EvacuationCenterRecord,
  type EvacuationStatus,
  type FacilityRecord,
  type HotlineRecord,
} from '../../lib/resources';
import HotlineFormSheet from '../../components/official/HotlineFormSheet';
import FacilityFormSheet from '../../components/official/FacilityFormSheet';
import EvacuationCenterFormSheet from '../../components/official/EvacuationCenterFormSheet';
import ResourceDetailSheet, {
  ResourceDetailRow,
} from '../../components/official/ResourceDetailSheet';

type TabKey = 'hotlines' | 'facilities' | 'centers';
type EditorKey = 'hotline' | 'facility' | 'center' | null;
type ResourceDetail =
  | { kind: 'hotline'; record: HotlineRecord }
  | { kind: 'facility'; record: FacilityRecord }
  | { kind: 'center'; record: EvacuationCenterRecord }
  | null;

function formatVerificationDate(value: string | null): string {
  if (!value) return 'Not verified yet';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : 'Not verified yet';
}

function formatCenterUpdate(value: string | null): string {
  if (!value) return 'Not updated yet';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Not updated yet';
}

function matchesSearch(values: (string | null)[], search: string): boolean {
  const term = search.trim().toLocaleLowerCase();
  if (!term) return true;
  return values.some((value) => value?.toLocaleLowerCase().includes(term));
}

function ResourceSectionHeader({
  title,
  count,
  canAdd,
  onAdd,
}: {
  title: string;
  count: number;
  canAdd: boolean;
  onAdd: () => void;
}) {
  return (
    <View style={styles.resourceSectionHeader}>
      <View style={styles.resourceSectionTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.resourceCount}>{count}</Text>
      </View>
      {canAdd ? (
        <TouchableOpacity
          style={styles.addResourceButton}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={`Add ${title.slice(0, -1).toLocaleLowerCase()}`}
        >
          <Ionicons name="add" size={21} color={colors.white} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function CardActions({ children }: { children: ReactNode }) {
  return <View style={styles.resourceCardActions}>{children}</View>;
}

function CardAction({
  label,
  onPress,
  disabled = false,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.resourceCardAction,
        primary && styles.resourceCardActionPrimary,
        disabled && styles.actionDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Text style={[styles.resourceCardActionText, primary && styles.resourceCardActionTextPrimary]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Shared RLS-backed resource management body for Resources and MDRRMO Community. */
export function ResourceManagementContent({ header }: { header?: ReactNode }) {
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string | string[] }>();
  const { scope, officialKind, loading: scopeLoading, error: scopeError } = useOfficialPortal();
  const isMayor = officialKind === 'Mayor';
  const isBdrrmo = officialKind === 'BDRRMO';
  const isMdrrmo = officialKind === 'MDRRMO';
  const canManageDirectory = isBdrrmo || isMdrrmo;
  const barangayFilter = isBdrrmo ? scope?.barangay_id ?? null : null;

  const {
    hotlines,
    facilities,
    hotlinesError,
    facilitiesError,
    loading: resourcesLoading,
    refreshing: resourcesRefreshing,
    refresh: refreshResources,
    reload: reloadResources,
  } = useResources({ mode: 'official', barangayId: barangayFilter });
  const {
    centers,
    error: centersError,
    loading: centersLoading,
    refreshing: centersRefreshing,
    refresh: refreshCenters,
    reload: reloadCenters,
  } = useEvacuationCenters({ barangayId: barangayFilter });

  const [tab, setTab] = useState<TabKey>(isMayor ? 'centers' : 'hotlines');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<EditorKey>(null);
  const [editingHotline, setEditingHotline] = useState<HotlineRecord | null>(null);
  const [editingFacility, setEditingFacility] = useState<FacilityRecord | null>(null);
  const [editingCenter, setEditingCenter] = useState<EvacuationCenterRecord | null>(null);
  const [detail, setDetail] = useState<ResourceDetail>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [barangaysError, setBarangaysError] = useState<string | null>(null);

  useEffect(() => {
    const requestedTab = Array.isArray(tabParam) ? tabParam[0] : tabParam;
    if (requestedTab === 'hotlines' || requestedTab === 'facilities' || requestedTab === 'centers') {
      setTab(requestedTab);
    }
  }, [tabParam]);

  useEffect(() => {
    if (!isMdrrmo) return;
    void fetchBarangays().then((result) => {
      setBarangays(result.barangays);
      setBarangaysError(result.error);
    });
  }, [isMdrrmo]);

  useEffect(() => {
    setSearch('');
  }, [tab]);

  const facilityById = useMemo(
    () => new Map(facilities.map((facility) => [facility.id, facility])),
    [facilities],
  );
  const barangayNameById = useMemo(() => {
    const names = new Map(barangays.map((barangay) => [barangay.id, barangay.name]));
    if (isBdrrmo && scope?.barangay_id && scope.barangay_name) {
      names.set(scope.barangay_id, scope.barangay_name);
    }
    return names;
  }, [barangays, isBdrrmo, scope?.barangay_id, scope?.barangay_name]);
  const visibleHotlines = useMemo(
    () => hotlines.filter((item) => matchesSearch([item.name, item.number, hotlineCategoryLabel(item.category)], search)),
    [hotlines, search],
  );
  const visibleFacilities = useMemo(
    () => facilities.filter((item) => matchesSearch([item.name, item.address, item.contact, facilityTypeLabel(item.type)], search)),
    [facilities, search],
  );
  const visibleCenters = useMemo(
    () => centers.filter((item) => matchesSearch([item.name, barangayNameById.get(item.barangayId ?? '') ?? null, evacuationStatusLabel(item.status)], search)),
    [barangayNameById, centers, search],
  );

  const activeRecords = tab === 'hotlines' ? hotlines.length : tab === 'facilities' ? facilities.length : centers.length;
  const currentError = tab === 'hotlines' ? hotlinesError : tab === 'facilities' ? facilitiesError : centersError;
  const currentLoading = tab === 'centers' ? centersLoading : resourcesLoading;
  const shouldShowSearch = activeRecords > 5;

  function canEditDirectoryRecord(recordBarangayId: string | null): boolean {
    if (isMdrrmo) return true;
    return isBdrrmo && recordBarangayId === scope?.barangay_id;
  }

  function isSaving(id: string): boolean {
    return savingIds.has(id);
  }

  async function runRecordAction(id: string, action: () => Promise<{ error: string | null }>) {
    if (isSaving(id)) return;
    setSavingIds((current) => new Set(current).add(id));
    const result = await action();
    setSavingIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    if (result.error) {
      Alert.alert('Update failed', result.error);
      return;
    }
    if (id.startsWith('center:')) {
      void reloadCenters();
      return;
    }
    void reloadResources();
  }

  function confirmNationalHotlineUpdate(hotline: HotlineRecord, nextActive: boolean) {
    const apply = () => void runRecordAction(hotline.id, () => updateHotline(hotline.id, { isActive: nextActive }));
    if (hotline.category !== 'national_emergency') {
      apply();
      return;
    }
    Alert.alert(
      'Change national hotline?',
      'The seeded emergency hotline is used across the public directory.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: nextActive ? 'Activate' : 'Deactivate', style: 'destructive', onPress: apply },
      ],
    );
  }

  async function handleRefresh() {
    await Promise.all([refreshResources(), refreshCenters()]);
  }

  function openHotlineEditor(hotline: HotlineRecord | null) {
    setEditingHotline(hotline);
    setEditor('hotline');
  }

  function openFacilityEditor(facility: FacilityRecord | null) {
    setEditingFacility(facility);
    setEditor('facility');
  }

  function openCenterEditor(center: EvacuationCenterRecord | null) {
    setEditingCenter(center);
    setEditor('center');
  }

  function closeEditor() {
    setEditor(null);
  }

  function openMap() {
    router.push('/official/map' as Href);
  }

  if (scopeLoading || (!scope && !scopeError)) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.themeSoft} /></View>;
  }

  if (scopeError || !scope) {
    return (
      <View style={[styles.scrollContent, { flex: 1, justifyContent: 'center' }]}>
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>Official access unavailable</Text>
          <Text style={styles.stateBody}>{scopeError || 'Could not load your official scope.'}</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={resourcesRefreshing || centersRefreshing} onRefresh={handleRefresh} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {header ?? (
          <View style={styles.headerTextGroup}>
            <Text style={styles.brandLabel}>DisasterLink</Text>
            <Text style={styles.screenTitle}>{isMayor ? 'Priority' : 'Resources'}</Text>
            <Text style={styles.screenSubtitle}>
              {isMayor
                ? 'Prioritize evacuation centers only'
                : isBdrrmo && scope?.barangay_name
                  ? `Manage directory records in ${scope.barangay_name}`
                  : 'Manage directory records in your scope'}
            </Text>
          </View>
        )}

        {!isMayor ? (
          <View style={styles.resourceTabRow}>
            {(['hotlines', 'facilities', 'centers'] as TabKey[]).map((item) => {
              const active = tab === item;
              return <TouchableOpacity key={item} style={[styles.resourceTabChip, active && styles.resourceTabChipActive]} onPress={() => setTab(item)} accessibilityRole="button" accessibilityState={{ selected: active }}><Text style={[styles.resourceTabChipText, active && styles.resourceTabChipTextActive]}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text></TouchableOpacity>;
            })}
          </View>
        ) : null}

        {shouldShowSearch ? <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder={`Search ${tab}`} placeholderTextColor={colors.textMuted} /> : null}

        {currentLoading ? <View style={styles.stateBox}><ActivityIndicator color={colors.themeSoft} /></View> : null}
        {!currentLoading && currentError ? <View style={styles.stateBox}><Text style={styles.stateTitle}>Could not load {tab}</Text><Text style={styles.stateBody}>{currentError}</Text><TouchableOpacity style={styles.retryButton} onPress={() => tab === 'centers' ? void reloadCenters() : void reloadResources()}><Text style={styles.retryButtonText}>Try again</Text></TouchableOpacity></View> : null}

        {!currentLoading && !currentError && tab === 'hotlines' && !isMayor ? (
          <View style={styles.section}>
            <ResourceSectionHeader title="Hotlines" count={hotlines.length} canAdd={canManageDirectory} onAdd={() => openHotlineEditor(null)} />
            {visibleHotlines.length === 0 ? <View style={styles.stateBox}><Text style={styles.stateTitle}>{hotlines.length === 0 ? 'No hotlines yet' : 'No matching hotlines'}</Text><Text style={styles.stateBody}>{hotlines.length === 0 ? 'Use the add button to create the first directory number.' : 'Try a different search term.'}</Text></View> : visibleHotlines.map((hotline) => {
              const linkedFacility = hotline.facilityId ? facilityById.get(hotline.facilityId) : null;
              const editable = canEditDirectoryRecord(hotline.barangayId) && (hotline.category !== 'national_emergency' || isMdrrmo);
              return <View key={hotline.id} style={styles.resourceCard}>
                <View style={styles.queueCardHeader}><Text style={styles.queueTitle}>{hotline.name}</Text><View style={[styles.resourceStatusChip, hotline.isActive ? styles.resourceStatusActive : styles.resourceStatusInactive]}><Text style={styles.resourceStatusChipText}>{hotline.isActive ? 'Active' : 'Inactive'}</Text></View></View>
                <Text style={styles.queueMeta}>{hotline.number} · {hotlineCategoryLabel(hotline.category)}</Text>
                {linkedFacility ? <Text style={styles.queueMeta}>Linked to {linkedFacility.name}</Text> : null}
                <Text style={styles.queueMeta}>{isReviewOverdue(hotline.lastVerifiedAt) ? 'Review overdue' : `Verified ${formatVerificationDate(hotline.lastVerifiedAt)}`}</Text>
                <CardActions>
                  <CardAction label="Call" onPress={() => void openHotlineDialer(hotline.number).then((result) => result.error && Alert.alert('Call unavailable', result.error))} />
                  <CardAction label="Details" onPress={() => setDetail({ kind: 'hotline', record: hotline })} />
                  {editable ? <CardAction label="Edit" primary onPress={() => openHotlineEditor(hotline)} disabled={isSaving(hotline.id)} /> : null}
                  {editable ? <CardAction label={hotline.isActive ? 'Deactivate' : 'Activate'} onPress={() => confirmNationalHotlineUpdate(hotline, !hotline.isActive)} disabled={isSaving(hotline.id)} /> : null}
                </CardActions>
              </View>;
            })}
          </View>
        ) : null}

        {!currentLoading && !currentError && tab === 'facilities' && !isMayor ? (
          <View style={styles.section}>
            <ResourceSectionHeader title="Facilities" count={facilities.length} canAdd={canManageDirectory} onAdd={() => openFacilityEditor(null)} />
            {visibleFacilities.length === 0 ? <View style={styles.stateBox}><Text style={styles.stateTitle}>{facilities.length === 0 ? 'No facilities yet' : 'No matching facilities'}</Text><Text style={styles.stateBody}>{facilities.length === 0 ? 'Use the add button to create the first facility.' : 'Try a different search term.'}</Text></View> : visibleFacilities.map((facility) => {
              const linkedHotlines = hotlines.filter((hotline) => hotline.facilityId === facility.id);
              const editable = canEditDirectoryRecord(facility.barangayId);
              return <View key={facility.id} style={styles.resourceCard}>
                <View style={styles.queueCardHeader}><Text style={styles.queueTitle}>{facility.name}</Text><View style={[styles.resourceStatusChip, facility.isActive ? styles.resourceStatusActive : styles.resourceStatusInactive]}><Text style={styles.resourceStatusChipText}>{facility.isActive ? 'Active' : 'Inactive'}</Text></View></View>
                <Text style={styles.queueMeta}>{facilityTypeLabel(facility.type)}{facility.address ? ` · ${facility.address}` : ''}</Text>
                {facility.contact ? <Text style={styles.queueMeta}>Contact: {facility.contact}</Text> : null}
                <Text style={styles.queueMeta}>{linkedHotlines.length ? `${linkedHotlines.length} linked hotline${linkedHotlines.length === 1 ? '' : 's'}` : 'No linked hotlines'} · {isReviewOverdue(facility.lastVerifiedAt) ? 'Review overdue' : `Verified ${formatVerificationDate(facility.lastVerifiedAt)}`}</Text>
                <CardActions>
                  <CardAction label="View on map" onPress={openMap} />
                  <CardAction label="Details" onPress={() => setDetail({ kind: 'facility', record: facility })} />
                  {editable ? <CardAction label="Edit" primary onPress={() => openFacilityEditor(facility)} disabled={isSaving(facility.id)} /> : null}
                  {editable ? <CardAction label={facility.isActive ? 'Deactivate' : 'Activate'} onPress={() => void runRecordAction(facility.id, () => updateFacility(facility.id, { isActive: !facility.isActive }))} disabled={isSaving(facility.id)} /> : null}
                </CardActions>
              </View>;
            })}
          </View>
        ) : null}

        {!currentLoading && !currentError && (tab === 'centers' || isMayor) ? (
          <View style={styles.section}>
            <ResourceSectionHeader title={isMayor ? 'Priority centers' : 'Evacuation centers'} count={centers.length} canAdd={isMdrrmo} onAdd={() => openCenterEditor(null)} />
            {barangaysError && isMdrrmo ? <Text style={styles.stateBody}>Barangays could not load: {barangaysError}</Text> : null}
            {visibleCenters.length === 0 ? <View style={styles.stateBox}><Text style={styles.stateTitle}>{centers.length === 0 ? 'No centers yet' : 'No matching centers'}</Text><Text style={styles.stateBody}>{centers.length === 0 ? 'MDRRMO can add a center and assign its responsible barangay.' : 'Try a different search term.'}</Text></View> : visibleCenters.map((center) => {
              const canSetStatus = (isMdrrmo || isBdrrmo) && (!isBdrrmo || center.barangayId === scope.barangay_id);
              const canSetPriority = isMdrrmo || isMayor;
              const savingCenter = isSaving(`center:${center.id}`);
              return <View key={center.id} style={styles.resourceCard}>
                <View style={styles.queueCardHeader}><Text style={styles.queueTitle}>{center.name}</Text><View style={[styles.resourceStatusChip, center.status === 'open' ? styles.resourceStatusOpen : center.status === 'full' ? styles.resourceStatusFull : styles.resourceStatusInactive]}><Text style={styles.resourceStatusChipText}>{evacuationStatusLabel(center.status)}</Text></View></View>
                <Text style={styles.queueMeta}>{barangayNameById.get(center.barangayId ?? '') || 'Barangay not available'}{center.capacity != null ? ` · Capacity ${center.capacity}` : ' · Capacity not declared'}</Text>
                <Text style={styles.queueMeta}>{center.isPriority ? 'Priority center' : 'Standard priority'} · {formatCenterUpdate(center.lastUpdatedAt)}</Text>
                <CardActions>
                  <CardAction label="Details" onPress={() => setDetail({ kind: 'center', record: center })} />
                  {isMdrrmo ? <CardAction label="Edit" primary onPress={() => openCenterEditor(center)} disabled={savingCenter} /> : null}
                  {canSetPriority ? <CardAction label={center.isPriority ? 'Remove priority' : 'Mark priority'} onPress={() => void runRecordAction(`center:${center.id}`, () => updateEvacuationCenter(center.id, { isPriority: !center.isPriority }))} disabled={savingCenter} /> : null}
                </CardActions>
                {canSetStatus ? <View style={styles.resourceStatusActions}>{(['open', 'full', 'closed_temporarily'] as EvacuationStatus[]).map((status) => <CardAction key={status} label={evacuationStatusLabel(status)} onPress={() => void runRecordAction(`center:${center.id}`, () => updateEvacuationCenter(center.id, { status }))} disabled={savingCenter || center.status === status} primary={center.status === status} />)}</View> : null}
              </View>;
            })}
          </View>
        ) : null}
      </ScrollView>

      <HotlineFormSheet visible={editor === 'hotline'} hotline={editingHotline} facilities={facilities} barangayId={isBdrrmo ? scope.barangay_id : null} canEditNational={isMdrrmo} onSaved={() => { closeEditor(); void reloadResources(); }} onClose={closeEditor} />
      <FacilityFormSheet visible={editor === 'facility'} facility={editingFacility} barangayId={isBdrrmo ? scope.barangay_id : null} onSaved={() => { closeEditor(); void reloadResources(); }} onClose={closeEditor} />
      <EvacuationCenterFormSheet visible={editor === 'center'} center={editingCenter} barangays={barangays} onSaved={() => { closeEditor(); void reloadCenters(); }} onClose={closeEditor} />

      <ResourceDetailSheet visible={detail !== null} title={detail?.record.name ?? ''} onClose={() => setDetail(null)}>
        {detail?.kind === 'hotline' ? <><ResourceDetailRow label="Number" value={detail.record.number} /><ResourceDetailRow label="Category" value={hotlineCategoryLabel(detail.record.category)} /><ResourceDetailRow label="Linked facility" value={detail.record.facilityId ? facilityById.get(detail.record.facilityId)?.name || 'Unavailable facility' : 'Standalone number'} /><ResourceDetailRow label="Last verified" value={formatVerificationDate(detail.record.lastVerifiedAt)} /></> : null}
        {detail?.kind === 'facility' ? <><ResourceDetailRow label="Type" value={facilityTypeLabel(detail.record.type)} /><ResourceDetailRow label="Address or landmark" value={detail.record.address || 'Not provided'} /><ResourceDetailRow label="Contact" value={detail.record.contact || 'Not provided'} /><ResourceDetailRow label="Coordinates" value={`${detail.record.latitude.toFixed(5)}, ${detail.record.longitude.toFixed(5)}`} /><ResourceDetailRow label="Last verified" value={formatVerificationDate(detail.record.lastVerifiedAt)} /></> : null}
        {detail?.kind === 'center' ? <><ResourceDetailRow label="Barangay" value={barangayNameById.get(detail.record.barangayId ?? '') || 'Not available'} /><ResourceDetailRow label="Status" value={evacuationStatusLabel(detail.record.status)} /><ResourceDetailRow label="Declared capacity" value={detail.record.capacity == null ? 'Not declared' : String(detail.record.capacity)} /><ResourceDetailRow label="Priority" value={detail.record.isPriority ? 'Priority center' : 'Standard priority'} /><ResourceDetailRow label="Last update" value={formatCenterUpdate(detail.record.lastUpdatedAt)} /><ResourceDetailRow label="Coordinates" value={`${detail.record.latitude.toFixed(5)}, ${detail.record.longitude.toFixed(5)}`} /></> : null}
      </ResourceDetailSheet>
    </>
  );
}

export default function OfficialResourcesScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string | string[] }>();
  const { officialKind } = useOfficialPortal();

  const redirectsToCommunityResources =
    officialKind === 'BDRRMO' || officialKind === 'MDRRMO';
  const redirectsMayorToSituations = officialKind === 'Mayor';
  const requestedTab = Array.isArray(tab) ? tab[0] : tab;
  const preservedTab =
    requestedTab === 'hotlines' ||
    requestedTab === 'facilities' ||
    requestedTab === 'centers'
      ? `&tab=${requestedTab}`
      : '';

  useEffect(() => {
    if (redirectsToCommunityResources) {
      router.replace(
        `/official/community?section=resources${preservedTab}` as Href,
      );
      return;
    }
    if (redirectsMayorToSituations) {
      router.replace('/official/incidents?section=priority' as Href);
    }
  }, [preservedTab, redirectsMayorToSituations, redirectsToCommunityResources, router]);

  if (redirectsToCommunityResources || redirectsMayorToSituations) {
    return <SafeAreaView style={styles.container} edges={['top', 'bottom']}><StatusBar style="dark" /><View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.themeSoft} /></View></SafeAreaView>;
  }

  return <SafeAreaView style={styles.container} edges={['top', 'bottom']}><StatusBar style="dark" /><ResourceManagementContent /></SafeAreaView>;
}
