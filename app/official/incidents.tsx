// app/official/incidents.tsx
// Filterable incident queue. Defaults: BDRRMO=unverified, MDRRMO=escalated,
// Mayor=read-only search across all statuses.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { colors } from '../../styles/theme';
import { useOfficialPortal } from '../../context/OfficialPortalContext';
import { useOfficialReportQueue } from '../../hooks/useOfficialReports';
import MdrrmoHeader from '../../components/official/MdrrmoHeader';
import { statusLabel } from '../../components/report/ReportDetailCard';
import { formatPublishedAt } from '../../lib/formatTime';
import type { ReportStatus } from '../../lib/officialReports';
import OfficialReportModal from '../../components/official/OfficialReportModal';
import MayorSituations from '../../components/official/MayorSituations';

type StatusFilter = ReportStatus | 'all';
type OfficialReportSort = 'recent' | 'relevance' | 'oldest';

function defaultFilter(kind: string | null): StatusFilter {
  if (kind === 'BDRRMO') return 'unverified';
  if (kind === 'MDRRMO') return 'escalated';
  return 'all';
}

function routeStatus(value: string | string[] | undefined): ReportStatus | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    candidate === 'unverified' ||
    candidate === 'verified' ||
    candidate === 'escalated' ||
    candidate === 'resolved'
  ) {
    return candidate;
  }
  return null;
}

function statusPillStyle(status: ReportStatus) {
  if (status === 'verified') return styles.statusVerified;
  if (status === 'escalated') return styles.statusEscalated;
  if (status === 'resolved') return styles.statusResolved;
  return styles.statusUnverified;
}

// Active status filter chip uses the same Command status palette as overview cards.
function statusFilterChipStyle(filter: StatusFilter) {
  if (filter === 'unverified') return styles.filterChipStatusUnverified;
  if (filter === 'verified') return styles.filterChipStatusVerified;
  if (filter === 'escalated') return styles.filterChipStatusEscalated;
  if (filter === 'resolved') return styles.filterChipStatusResolved;
  return styles.filterChipStatusAll;
}

function statusFilterChipTextStyle(filter: StatusFilter) {
  if (filter === 'unverified') return styles.statusTextUnverified;
  if (filter === 'verified') return styles.statusTextVerified;
  if (filter === 'escalated') return styles.statusTextEscalated;
  if (filter === 'resolved') return styles.statusTextResolved;
  return styles.filterChipTextBlackActive;
}

const SORT_OPTIONS: { key: OfficialReportSort; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'relevance', label: 'Relevance' },
  { key: 'oldest', label: 'Oldest' },
];

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unverified', label: 'Unverified' },
  { key: 'verified', label: 'Verified' },
  { key: 'escalated', label: 'Escalated' },
  { key: 'resolved', label: 'Resolved' },
];

export default function OfficialIncidentsScreen() {
  const router = useRouter();
  const { status } = useLocalSearchParams<{ status?: string | string[] }>();
  const { scope, officialKind, loading: scopeLoading, error: scopeError } =
    useOfficialPortal();

  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<OfficialReportSort>('recent');
  const [statusOpen, setStatusOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [officialReportModalVisible, setOfficialReportModalVisible] = useState(false);

  useEffect(() => {
    // A validated link temporarily overrides the role's normal queue default.
    const requestedStatus = routeStatus(status);
    setStatusFilter(requestedStatus);
  }, [status]);

  const activeFilter = statusFilter ?? defaultFilter(officialKind);
  const { reports, error, loading, refreshing, refresh, reload } =
    useOfficialReportQueue(officialKind === 'Mayor' ? null : scope);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matched = reports.filter((report) => {
      if (activeFilter !== 'all' && report.status !== activeFilter) {
        return false;
      }
      if (!needle) return true;
      const haystack = [
        report.title,
        report.description,
        report.reporterName,
        report.addressText ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
    return matched.sort((left, right) => {
      if (sort === 'oldest') return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      if (sort === 'relevance') {
        const scoreDifference = (right.upvoteCount + right.commentCount) - (left.upvoteCount + left.commentCount);
        if (scoreDifference) return scoreDifference;
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }, [reports, activeFilter, search, sort]);

  const canLogIncident = officialKind === 'BDRRMO' || officialKind === 'MDRRMO';
  const usesOfficerReportFormat =
    officialKind === 'BDRRMO' || officialKind === 'MDRRMO';
  const screenTitle = officialKind === 'Mayor' ? 'Situations' : 'Reports';

  if (scopeLoading || (!scope && !scopeError)) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.themeSoft} />
        </View>
      </SafeAreaView>
    );
  }

  if (scopeError || !scope) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={[styles.scrollContent, { flex: 1, justifyContent: 'center' }]}>
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>Official access unavailable</Text>
            <Text style={styles.stateBody}>
              {scopeError || 'Could not load your official workspace.'}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (officialKind === 'Mayor') {
    return <MayorSituations />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {usesOfficerReportFormat ? (
          <MdrrmoHeader
            title={screenTitle}
            right={
              canLogIncident ? (
                <TouchableOpacity
                  style={styles.headerLogoutButton}
                  onPress={() => {
                    if (officialKind === 'MDRRMO') {
                      setOfficialReportModalVisible(true);
                      return;
                    }
                    router.push('/official/log-incident' as Href);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Log verified incident"
                >
                  <Ionicons name="add" size={22} color={colors.text} />
                </TouchableOpacity>
              ) : null
            }
          />
        ) : (
          <View style={styles.headerRow}>
            <View style={styles.headerTextGroup}>
              <Text style={styles.brandLabel}>DisasterLink</Text>
              <Text style={styles.screenTitle}>{screenTitle}</Text>
              <Text style={styles.screenSubtitle}>
                {officialKind === 'Mayor'
                  ? 'Read-only municipal situation search'
                  : 'Scoped incident queue'}
              </Text>
            </View>
            {canLogIncident ? (
              <TouchableOpacity
                style={styles.headerLogoutButton}
                onPress={() => router.push('/official/log-incident' as Href)}
                accessibilityRole="button"
                accessibilityLabel="Log verified incident"
              >
                <Ionicons name="add" size={22} color={colors.text} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search title, description, reporter…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />

        {usesOfficerReportFormat ? (
          <View style={statusOpen ? styles.filterRowSingleLine : styles.filterRow}>
            {(statusOpen
              ? FILTERS
              : FILTERS.filter((filter) => filter.key === activeFilter)
            ).map((filter) => {
              const active = activeFilter === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterChip,
                    statusOpen ? styles.filterChipFlexible : null,
                    active ? statusFilterChipStyle(filter.key) : null,
                  ]}
                  onPress={() => {
                    if (!statusOpen) {
                      setStatusOpen(true);
                      setSortOpen(false);
                      return;
                    }
                    setStatusFilter(filter.key);
                    setStatusOpen(false);
                  }}
                  activeOpacity={0.85}
                  accessibilityLabel={`Filter reports by ${filter.label}`}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      statusOpen ? styles.filterChipTextFlexible : null,
                      active ? statusFilterChipTextStyle(filter.key) : null,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {/* Hide time sort while status options are open so all statuses fit one row. */}
            {!statusOpen
              ? (sortOpen
                  ? SORT_OPTIONS
                  : SORT_OPTIONS.filter((option) => option.key === sort)
                ).map((option) => {
                  const active = sort === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.filterChip,
                        active ? styles.filterChipBlackActive : null,
                      ]}
                      onPress={() => {
                        if (!sortOpen) {
                          setSortOpen(true);
                          setStatusOpen(false);
                          return;
                        }
                        setSort(option.key);
                        setSortOpen(false);
                      }}
                      activeOpacity={0.85}
                      accessibilityLabel={`Sort reports by ${option.label}`}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          active ? styles.filterChipTextBlackActive : null,
                        ]}
                        numberOfLines={1}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              : null}
          </View>
        ) : (
          <View style={styles.filterRow}>
            {FILTERS.map((filter) => {
              const active = activeFilter === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setStatusFilter(filter.key)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.themeSoft} />
            <Text style={styles.stateBody}>Loading reports…</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>Could not load reports</Text>
            <Text style={styles.stateBody}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void reload()}
              activeOpacity={0.85}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && !error && filtered.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>No matching reports</Text>
            <Text style={styles.stateBody}>
              Try another filter or search term.
            </Text>
          </View>
        ) : null}

        {!loading &&
          !error &&
          filtered.map((report) => (
            <TouchableOpacity
              key={report.id}
              style={styles.queueCard}
              activeOpacity={0.85}
              onPress={() => router.push(`/official/${report.id}` as Href)}
              accessibilityRole="button"
              accessibilityLabel={`Open report ${report.title || 'untitled'}`}
            >
              <View style={styles.queueCardHeader}>
                <Text style={styles.queueTitle} numberOfLines={2}>
                  {report.title.trim() || 'Untitled report'}
                </Text>
                <View
                  style={[styles.statusPill, statusPillStyle(report.status)]}
                >
                  <Text style={styles.statusPillText}>
                    {statusLabel(report.status)}
                  </Text>
                </View>
              </View>
              <Text style={styles.queueMeta} numberOfLines={2}>
                {report.description.trim() || 'No description provided.'}
              </Text>
              <Text style={styles.queueMeta}>
                {report.reporterName}
                {report.createdAt
                  ? ` · ${formatPublishedAt(report.createdAt)}`
                  : ''}
              </Text>
              {report.addressText ? (
                <Text style={styles.queueMeta} numberOfLines={1}>
                  {report.addressText}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
      </ScrollView>
      {officialKind === 'MDRRMO' ? (
        <OfficialReportModal
          visible={officialReportModalVisible}
          onClose={() => setOfficialReportModalVisible(false)}
          onSubmitted={() => {
            setOfficialReportModalVisible(false);
            void reload();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
