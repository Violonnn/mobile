import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import MdrrmoHeader from './MdrrmoHeader';
import { statusLabel } from '../report/ReportDetailCard';
import { ReportsScreenSkeleton } from '../ui/OfficialScreenSkeletons';
import { formatPublishedAt } from '../../lib/formatTime';
import { formatIncidentType } from '../../lib/incidentTypes';
import type { OfficialReportQueueItem, ReportStatus } from '../../lib/officialReports';
import { mdrrmoReportsStyles as styles } from '../../styles/screens/mdrrmoReports.styles';
import { colors } from '../../styles/theme';

type BdrrmoStatusFilter = Exclude<ReportStatus, 'escalated'> | 'all';
type QueueSort = 'recent' | 'relevance' | 'oldest';

type Props = {
  reports: OfficialReportQueueItem[];
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  initialStatus: BdrrmoStatusFilter | null;
  showCommandBack: boolean;
  assignedBarangay: string | null;
  onRefresh: () => Promise<void>;
  onReload: () => Promise<void>;
};

const STATUS_OPTIONS: { value: BdrrmoStatusFilter; label: string }[] = [
  { value: 'all', label: 'All available' },
  { value: 'unverified', label: 'Unverified' },
  { value: 'verified', label: 'Verified' },
  { value: 'resolved', label: 'Resolved' },
];

const SORT_OPTIONS: { value: QueueSort; label: string }[] = [
  { value: 'recent', label: 'Newest first' },
  { value: 'relevance', label: 'Most engaged' },
  { value: 'oldest', label: 'Oldest first' },
];

function statusColor(status: ReportStatus): string {
  if (status === 'unverified') return '#D92D20';
  if (status === 'verified') return '#169B55';
  return '#64748B';
}

function filterLabel(filter: BdrrmoStatusFilter): string {
  if (filter === 'all') return 'All available reports';
  return `${statusLabel(filter)} reports`;
}

export default function BdrrmoReportsWorkspace({
  reports,
  error,
  loading,
  refreshing,
  initialStatus,
  showCommandBack,
  assignedBarangay,
  onRefresh,
  onReload,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [statusFilter, setStatusFilter] = useState<BdrrmoStatusFilter>(
    initialStatus ?? 'unverified',
  );
  const [draftStatusFilter, setDraftStatusFilter] =
    useState<BdrrmoStatusFilter>(initialStatus ?? 'unverified');
  const [sort, setSort] = useState<QueueSort>('recent');
  const [draftSort, setDraftSort] = useState<QueueSort>('recent');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [previousInitialStatus, setPreviousInitialStatus] = useState(initialStatus);

  if (initialStatus !== previousInitialStatus) {
    setPreviousInitialStatus(initialStatus);
    setStatusFilter(initialStatus ?? 'unverified');
  }

  useFocusEffect(
    useCallback(() => {
      // Preserve applied values while closing temporary presentation surfaces.
      setSearchVisible(false);
      setFilterVisible(false);
      return undefined;
    }, []),
  );

  const visibleReports = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    const matched = reports.filter((report) => {
      // Client filtering is defensive; RLS is still the authorization boundary.
      if (report.status === 'escalated') return false;
      if (statusFilter !== 'all' && report.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      return [
        report.title,
        report.description,
        report.reporterName,
        report.addressText ?? '',
        report.barangayName ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });

    return matched.sort((first, second) => {
      if (sort === 'oldest') {
        return new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
      }
      if (sort === 'relevance') {
        const engagementDifference =
          second.upvoteCount + second.commentCount -
          (first.upvoteCount + first.commentCount);
        if (engagementDifference !== 0) return engagementDifference;
      }
      return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
    });
  }, [reports, searchQuery, sort, statusFilter]);

  function openFilters() {
    setDraftStatusFilter(statusFilter);
    setDraftSort(sort);
    setFilterVisible(true);
  }

  function applyFilters() {
    setStatusFilter(draftStatusFilter);
    setSort(draftSort);
    setFilterVisible(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <MdrrmoHeader
          title="Reports"
          showCommandBack={showCommandBack}
          subtitleOverride={assignedBarangay}
          right={
            <>
              <TouchableOpacity
                style={styles.headerAction}
                onPress={() => setSearchVisible((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={searchVisible ? 'Close report search' : 'Search reports'}
              >
                <Ionicons name={searchVisible ? 'close' : 'search'} size={25} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerAction}
                onPress={openFilters}
                accessibilityRole="button"
                accessibilityLabel="Filter reports"
              >
                <Ionicons name="options-outline" size={25} color={colors.navigationActive} />
              </TouchableOpacity>
            </>
          }
        />

        {searchVisible ? (
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search title, location, or reporter"
              placeholderTextColor={colors.textMuted}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.queueSection}>
          <View style={[styles.sectionHeader, styles.queueHeader]}>
            <View style={styles.sectionTitleGroup}>
              <Text style={styles.sectionLabel}>{filterLabel(statusFilter).toUpperCase()}</Text>
              <Text style={styles.sectionSubtitle}>
                {assignedBarangay ? `${assignedBarangay} · ` : 'Assigned barangay · '}
                {visibleReports.length} {visibleReports.length === 1 ? 'result' : 'results'}
              </Text>
            </View>
          </View>

          {loading && reports.length === 0 ? <ReportsScreenSkeleton /> : null}
          {loading && reports.length > 0 ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={colors.navigationActive} />
              <Text style={styles.stateBody}>Refreshing local reports…</Text>
            </View>
          ) : null}
          {!loading && error ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>Could not load reports</Text>
              <Text style={styles.stateBody}>{error}</Text>
              <TouchableOpacity onPress={() => void onReload()} accessibilityRole="button">
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {!loading && !error && visibleReports.length === 0 ? (
            <View style={styles.stateBox}>
              <Ionicons name="checkmark-circle-outline" size={32} color={colors.textMuted} />
              <Text style={styles.stateTitle}>No matching reports</Text>
              <Text style={styles.stateBody}>
                New assigned-barangay reports will appear here. Try another filter or search term.
              </Text>
            </View>
          ) : null}

          {!error ? visibleReports.map((report, index) => {
            const accentColor = statusColor(report.status);
            return (
              <TouchableOpacity
                key={report.id}
                style={[
                  styles.queueCard,
                  index === 0 && styles.queueCardFirst,
                  index % 2 === 0 && styles.queueCardOdd,
                ]}
                onPress={() => router.push(`/official/${report.id}` as Href)}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel={`Review report ${report.title || 'untitled'}`}
              >
                <View style={styles.mediaFrame}>
                  {report.firstPhotoUrl ? (
                    <Image source={{ uri: report.firstPhotoUrl }} style={styles.media} resizeMode="cover" />
                  ) : (
                    <View style={styles.mediaPlaceholder}>
                      <Ionicons name="document-text-outline" size={24} color={colors.textMuted} />
                      <Text style={styles.mediaPlaceholderText}>No photo</Text>
                    </View>
                  )}
                </View>
                <View style={styles.reportCopy}>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: accentColor }]} />
                    <Text style={[styles.statusText, { color: accentColor }]}>
                      {statusLabel(report.status).toUpperCase()}
                    </Text>
                    <Text style={styles.statusSeparator}>·</Text>
                    <Text style={styles.timeText}>{formatPublishedAt(report.createdAt)}</Text>
                  </View>
                  <Text style={styles.reportTitle} numberOfLines={2}>
                    {report.title.trim() || 'Untitled report'}
                  </Text>
                  <Text style={styles.reportLocation} numberOfLines={1}>
                    {report.addressText || assignedBarangay || 'Location unavailable'}
                  </Text>
                  <View style={styles.cardFooter}>
                    <View style={styles.attachmentMeta}>
                      <View style={styles.attachmentCount}>
                        <Ionicons name="images-outline" size={16} color={colors.navigationActive} />
                        <Text style={styles.attachmentCountText}>{report.mediaCount}</Text>
                      </View>
                      <View style={styles.attachmentDivider} />
                      <Text style={styles.incidentTypeText} numberOfLines={1}>
                        {formatIncidentType(report.incidentType, report.incidentTypeOther)}
                      </Text>
                    </View>
                    <View style={styles.reviewAction}>
                      <Text style={styles.reviewActionText}>Review</Text>
                      <Ionicons name="chevron-forward" size={21} color={colors.navigationActive} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }) : null}
        </View>
      </ScrollView>

      <Modal visible={filterVisible} transparent animationType="fade" onRequestClose={() => setFilterVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setFilterVisible(false)} />
          <View style={[styles.filterSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Report filters</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)} accessibilityLabel="Close filters">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Status</Text>
              <View style={styles.filterChoices}>
                {STATUS_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.filterChoice, draftStatusFilter === option.value && styles.filterChoiceActive]}
                    onPress={() => setDraftStatusFilter(option.value)}
                    accessibilityState={{ selected: draftStatusFilter === option.value }}
                  >
                    <Text style={[styles.filterChoiceText, draftStatusFilter === option.value && styles.filterChoiceTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Order</Text>
              <View style={styles.filterChoices}>
                {SORT_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.filterChoice, draftSort === option.value && styles.filterChoiceActive]}
                    onPress={() => setDraftSort(option.value)}
                    accessibilityState={{ selected: draftSort === option.value }}
                  >
                    <Text style={[styles.filterChoiceText, draftSort === option.value && styles.filterChoiceTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={styles.applyButton} onPress={applyFilters} accessibilityRole="button">
              <Text style={styles.applyButtonText}>Apply filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
