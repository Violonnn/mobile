// Mayor-only paginated, read-only drill-down for dashboard report filters.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchBarangays, type BarangayOption } from '../../lib/barangays';
import { formatPublishedAt } from '../../lib/formatTime';
import {
  fetchMayorSituationPage,
  normalizeMayorBarangayFilter,
  normalizeMayorStatusFilter,
  type MayorBarangayFilter,
  type MayorSituationItem,
  type MayorStatusFilter,
} from '../../lib/mayorAnalytics';
import { supabase } from '../../lib/supabase';
import { ResourceManagementContent } from '../../app/official/resources';
import MdrrmoHeader from './MdrrmoHeader';
import { officialStyles } from '../../styles/screens/official.styles';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

const STATUS_OPTIONS: { value: MayorStatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'unverified', label: 'Unverified' },
  { value: 'verified', label: 'Verified' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
];

function statusLabel(status: MayorStatusFilter): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'All statuses';
}

function statusColor(status: MayorSituationItem['status']): string {
  if (status === 'unverified') return colors.unverified;
  if (status === 'verified') return colors.success;
  if (status === 'escalated') return colors.danger;
  return colors.textMuted;
}

type MayorSituationSection = 'situations' | 'priority';

function MayorSituationSectionSwitch({
  activeSection,
}: {
  activeSection: MayorSituationSection;
}) {
  const router = useRouter();

  function selectSection(nextSection: MayorSituationSection) {
    if (nextSection === activeSection) return;
    router.replace(
      (nextSection === 'priority'
        ? '/official/incidents?section=priority'
        : '/official/incidents') as Href,
    );
  }

  return (
    <View style={localStyles.sectionSwitch}>
      <TouchableOpacity
        style={[
          localStyles.sectionSwitchButton,
          activeSection === 'situations' && localStyles.sectionSwitchButtonActive,
        ]}
        onPress={() => selectSection('situations')}
        accessibilityRole="button"
        accessibilityState={{ selected: activeSection === 'situations' }}
        accessibilityLabel="Situations"
      >
        <Text
          style={[
            localStyles.sectionSwitchText,
            activeSection === 'situations' && localStyles.sectionSwitchTextActive,
          ]}
        >
          Situations
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          localStyles.sectionSwitchButton,
          activeSection === 'priority' && localStyles.sectionSwitchButtonActive,
        ]}
        onPress={() => selectSection('priority')}
        accessibilityRole="button"
        accessibilityState={{ selected: activeSection === 'priority' }}
        accessibilityLabel="Priority evacuation centers"
      >
        <Text
          style={[
            localStyles.sectionSwitchText,
            activeSection === 'priority' && localStyles.sectionSwitchTextActive,
          ]}
        >
          Priority
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function MayorPrioritySection() {
  return (
    <SafeAreaView style={officialStyles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ResourceManagementContent
        header={
          <>
            <MdrrmoHeader title="Situations" showDefaultControls />
            <MayorSituationSectionSwitch activeSection="priority" />
          </>
        }
      />
    </SafeAreaView>
  );
}

export default function MayorSituations() {
  const { section } = useLocalSearchParams<{ section?: string | string[] }>();
  const requestedSection = Array.isArray(section) ? section[0] : section;

  if (requestedSection === 'priority') return <MayorPrioritySection />;
  return <MayorSituationsList />;
}

function MayorSituationsList() {
  const router = useRouter();
  const { barangayId: routeBarangayId, status: routeStatus } =
    useLocalSearchParams<{ barangayId?: string | string[]; status?: string | string[] }>();
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [barangayId, setBarangayId] = useState<MayorBarangayFilter>('all');
  const [status, setStatus] = useState<MayorStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [reports, setReports] = useState<MayorSituationItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barangayError, setBarangayError] = useState<string | null>(null);
  const [barangayPickerOpen, setBarangayPickerOpen] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const appliedRouteKeyRef = useRef<string | null>(null);
  const channelName = useMemo(
    () => `mayor-situations-${Math.random().toString(36).slice(2)}`,
    [],
  );

  const loadBarangays = useCallback(async () => {
    const result = await fetchBarangays();
    if (result.error) {
      setBarangayError(result.error);
      return;
    }
    setBarangays(result.barangays);
    setBarangayError(null);
  }, []);

  // Invalid deep-link values must become All instead of creating an empty query.
  useEffect(() => {
    const routeBarangay = Array.isArray(routeBarangayId)
      ? routeBarangayId[0]
      : routeBarangayId;
    const routeStatusValue = Array.isArray(routeStatus) ? routeStatus[0] : routeStatus;
    const routeKey = `${routeBarangay ?? ''}:${routeStatusValue ?? ''}`;
    if (appliedRouteKeyRef.current === routeKey) return;
    // Wait for known barangays so a valid deep link is not treated as invalid.
    if (routeBarangay && routeBarangay !== 'all' && barangays.length === 0 && !barangayError) {
      return;
    }
    setStatus(normalizeMayorStatusFilter(routeStatus));
    setBarangayId(normalizeMayorBarangayFilter(routeBarangayId, barangays));
    appliedRouteKeyRef.current = routeKey;
  }, [barangayError, barangays, routeBarangayId, routeStatus]);

  const loadPage = useCallback(async (offset: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    const result = await fetchMayorSituationPage({
      barangayId,
      status,
      search,
      offset,
    });

    if (result.error) {
      setError(result.error);
      if (!append) setReports([]);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    setReports((current) => append ? [...current, ...result.reports] : result.reports);
    setTotalCount(result.totalCount);
    setError(null);
    setLoading(false);
    setLoadingMore(false);
  }, [barangayId, search, status]);

  useFocusEffect(
    useCallback(() => {
      void Promise.all([loadBarangays(), loadPage(0, false)]);
    }, [loadBarangays, loadPage]),
  );

  useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => {
          void loadPage(0, false);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, loadPage]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadBarangays(), loadPage(0, false)]);
    setRefreshing(false);
  }

  const selectedBarangayName =
    barangayId === 'all'
      ? 'All Barangays'
      : barangays.find((barangay) => barangay.id === barangayId)?.name ?? 'All Barangays';
  const hasMore = reports.length < totalCount;

  return (
    <SafeAreaView style={localStyles.screen} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[officialStyles.scrollContent, localStyles.content]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <MdrrmoHeader title="Situations" showDefaultControls />
        <MayorSituationSectionSwitch activeSection="situations" />

        <TextInput
          style={localStyles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search title, description, address, resident…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search situations"
        />

        <TouchableOpacity
          style={localStyles.selector}
          onPress={() => {
            setBarangayPickerOpen((open) => !open);
            setStatusPickerOpen(false);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Barangay filter: ${selectedBarangayName}`}
          accessibilityState={{ expanded: barangayPickerOpen }}
        >
          <Text style={localStyles.selectorText} numberOfLines={1}>{selectedBarangayName}</Text>
          <Ionicons name={barangayPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </TouchableOpacity>
        {barangayPickerOpen ? (
          <View style={localStyles.options}>
            <Choice active={barangayId === 'all'} label="All Barangays" onPress={() => { setBarangayId('all'); setBarangayPickerOpen(false); }} />
            {barangays.map((barangay) => (
              <Choice key={barangay.id} active={barangayId === barangay.id} label={barangay.name} onPress={() => { setBarangayId(barangay.id); setBarangayPickerOpen(false); }} />
            ))}
          </View>
        ) : null}

        <TouchableOpacity
          style={localStyles.selector}
          onPress={() => {
            setStatusPickerOpen((open) => !open);
            setBarangayPickerOpen(false);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Status filter: ${statusLabel(status)}`}
          accessibilityState={{ expanded: statusPickerOpen }}
        >
          <Text style={localStyles.selectorText}>{statusLabel(status)}</Text>
          <Ionicons name={statusPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </TouchableOpacity>
        {statusPickerOpen ? (
          <View style={localStyles.options}>
            {STATUS_OPTIONS.map((option) => (
              <Choice key={option.value} active={status === option.value} label={option.label} onPress={() => { setStatus(option.value); setStatusPickerOpen(false); }} />
            ))}
          </View>
        ) : null}

        {barangayError ? <Text style={localStyles.partial}>Barangay labels are unavailable. Showing report labels where available.</Text> : null}
        {loading ? <View style={localStyles.stateCard}><ActivityIndicator color={colors.themeSoft} /><Text style={localStyles.stateText}>Loading matching reports…</Text></View> : null}
        {!loading && error ? (
          <View style={localStyles.stateCard}>
            <Text style={localStyles.stateTitle}>Could not load situations</Text>
            <Text style={localStyles.stateText}>{error}</Text>
            <TouchableOpacity style={localStyles.retry} onPress={() => void loadPage(0, false)} accessibilityRole="button"><Text style={localStyles.retryText}>Try again</Text></TouchableOpacity>
          </View>
        ) : null}
        {!loading && !error && reports.length === 0 ? <View style={localStyles.stateCard}><Text style={localStyles.stateTitle}>No matching reports</Text><Text style={localStyles.stateText}>Try another status, barangay, or search term.</Text></View> : null}

        {!loading && !error ? <Text style={localStyles.resultCount}>{totalCount.toLocaleString()} matching report{totalCount === 1 ? '' : 's'}</Text> : null}
        {!loading && !error && reports.map((report) => (
          <TouchableOpacity
            key={report.id}
            style={localStyles.reportCard}
            onPress={() => router.push(`/official/${report.id}` as Href)}
            accessibilityRole="button"
            accessibilityLabel={`Open read-only report ${report.title || 'untitled'}`}
          >
            <View style={localStyles.reportHeader}>
              <Text style={localStyles.reportTitle} numberOfLines={2}>{report.title.trim() || 'Untitled report'}</Text>
              <View style={[localStyles.statusPill, { borderColor: statusColor(report.status) }]}><Text style={[localStyles.statusPillText, { color: statusColor(report.status) }]}>{statusLabel(report.status)}</Text></View>
            </View>
            <Text style={localStyles.reportBody} numberOfLines={2}>{report.description.trim() || 'No description provided.'}</Text>
            <Text style={localStyles.reportMeta}>{report.barangayName} • {report.reporterName}</Text>
            <Text style={localStyles.reportMeta}>{report.createdAt ? formatPublishedAt(report.createdAt) : 'Date unavailable'}</Text>
            {report.addressText ? <Text style={localStyles.reportMeta} numberOfLines={1}>{report.addressText}</Text> : null}
          </TouchableOpacity>
        ))}

        {!loading && !error && hasMore ? (
          <TouchableOpacity
            style={localStyles.loadMore}
            onPress={() => void loadPage(reports.length, true)}
            disabled={loadingMore}
            accessibilityRole="button"
            accessibilityLabel="Load more matching reports"
          >
            {loadingMore ? <ActivityIndicator color={colors.white} /> : <Text style={localStyles.loadMoreText}>Load more</Text>}
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <TouchableOpacity style={[localStyles.choice, active && localStyles.choiceActive]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}><Text style={[localStyles.choiceText, active && localStyles.choiceTextActive]}>{label}</Text></TouchableOpacity>;
}

const localStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { gap: spacing.md },
  sectionSwitch: { flexDirection: 'row', gap: spacing.xs, padding: spacing.xs, borderRadius: radius.full, backgroundColor: colors.primaryLight },
  sectionSwitchButton: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  sectionSwitchButtonActive: { backgroundColor: colors.text },
  sectionSwitchText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.textMuted },
  sectionSwitchTextActive: { color: colors.white },
  searchInput: { minHeight: 48, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.white, fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.text },
  selector: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.white },
  selectorText: { flex: 1, fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.text },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: -spacing.sm },
  choice: { minHeight: 34, maxWidth: '100%', justifyContent: 'center', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, backgroundColor: colors.white },
  choiceActive: { backgroundColor: colors.text, borderColor: colors.text },
  choiceText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.text },
  choiceTextActive: { color: colors.white },
  partial: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: '#FFF7ED', fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  stateCard: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  stateTitle: { fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text, textAlign: 'center' },
  stateText: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  retry: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.themeSoft },
  retryText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.white },
  resultCount: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.textMuted },
  reportCard: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.white },
  reportHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  reportTitle: { flex: 1, fontFamily: fonts.bold, fontSize: fontSizes.md, color: colors.text },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderWidth: 1, borderRadius: radius.full },
  statusPillText: { fontFamily: fonts.semibold, fontSize: fontSizes.xs },
  reportBody: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: 19 },
  reportMeta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  loadMore: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.primary },
  loadMoreText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.white },
});
