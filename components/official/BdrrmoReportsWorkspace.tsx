import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

import WorkflowQueuePicker, { workflowQueueLabel } from './WorkflowQueuePicker';
import OfficialReportQueueRow from './OfficialReportQueueRow';
import MdrrmoHeader from './MdrrmoHeader';
import { statusLabel } from '../report/ReportDetailCard';
import { ReportsScreenSkeleton } from '../ui/OfficialScreenSkeletons';
import type { OfficialWorkflowQueue, OfficialReportQueueItem, ReportStatus } from '../../lib/officialReports';
import { mdrrmoReportsStyles as styles } from '../../styles/screens/mdrrmoReports.styles';
import { colors } from '../../styles/theme';

type BdrrmoStatusFilter = ReportStatus | 'all';
type QueueSort = 'recent' | 'relevance' | 'oldest';

type Props = {
  reports: OfficialReportQueueItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => Promise<void>;
  workflowQueue: OfficialWorkflowQueue;
  onQueueChange: (queue: OfficialWorkflowQueue) => void;
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

function filterLabel(filter: BdrrmoStatusFilter): string {
  if (filter === 'all') return 'All available reports';
  return `Recorded status: ${statusLabel(filter)}`;
}

export default function BdrrmoReportsWorkspace({
  reports,
  hasMore,
  loadingMore,
  onLoadMore,
  workflowQueue,
  onQueueChange,
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
    initialStatus ?? 'all',
  );
  const [draftStatusFilter, setDraftStatusFilter] =
    useState<BdrrmoStatusFilter>(initialStatus ?? 'all');
  const [sort, setSort] = useState<QueueSort>('recent');
  const [draftSort, setDraftSort] = useState<QueueSort>('recent');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [previousInitialStatus, setPreviousInitialStatus] = useState(initialStatus);

  if (initialStatus !== previousInitialStatus) {
    setPreviousInitialStatus(initialStatus);
    setStatusFilter(initialStatus ?? 'all');
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
      if (workflowQueue === 'all' && statusFilter !== 'all' && report.status !== statusFilter) return false;
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
  }, [reports, searchQuery, sort, statusFilter, workflowQueue]);

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

        <WorkflowQueuePicker municipal={false} selected={workflowQueue} onSelect={onQueueChange} />
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
              <Text style={styles.sectionLabel}>{(workflowQueue === 'all' ? filterLabel(statusFilter) : workflowQueueLabel(workflowQueue, false)).toUpperCase()}</Text>
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

          {!error ? visibleReports.map((report, index) => (
            <OfficialReportQueueRow
              key={report.id}
              report={report}
              audience="bdrrmo"
              locationFallback={assignedBarangay}
              actionLabel="Review"
              onPress={() => router.push(('/official/' + report.id) as Href)}
              first={index === 0}
            />
          )) : null}
        </View>
        {hasMore && <TouchableOpacity style={styles.applyButton} onPress={() => void onLoadMore()} disabled={loadingMore} accessibilityRole="button"><Text style={styles.applyButtonText}>{loadingMore ? 'Loading more reports...' : 'Load more reports'}</Text></TouchableOpacity>}
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
              <Text style={styles.filterLabel}>Recorded status</Text>
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
              {workflowQueue !== 'all' ? (
                <Text style={styles.filterHint}>
                  This status filter applies when All reports is selected. The workflow queue determines results otherwise.
                </Text>
              ) : null}
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
