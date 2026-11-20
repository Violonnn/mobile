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
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import WorkflowQueuePicker, { workflowQueueLabel } from './WorkflowQueuePicker';
import OfficialReportQueueRow from './OfficialReportQueueRow';
import MdrrmoHeader from './MdrrmoHeader';
import OfficialReportModal from './OfficialReportModal';
import { statusLabel } from '../report/ReportDetailCard';
import type {
  OfficialWorkflowQueue,
  OfficialReportQueueItem,
  ReportStatus,
} from '../../lib/officialReports';
import { mdrrmoReportsStyles as styles } from '../../styles/screens/mdrrmoReports.styles';
import { colors } from '../../styles/theme';
import { ReportsScreenSkeleton } from '../ui/OfficialScreenSkeletons';

type StatusFilter = ReportStatus | 'all';
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
  initialStatus: StatusFilter | null;
  showCommandBack: boolean;
  onRefresh: () => Promise<void>;
  onReload: () => Promise<void>;
};

const STATUS_STEPS: { status: ReportStatus; label: string; color: string }[] = [
  { status: 'unverified', label: 'Unverified', color: '#D92D20' },
  { status: 'verified', label: 'Verified', color: '#169B55' },
  { status: 'escalated', label: 'Escalated', color: colors.escalated },
  { status: 'resolved', label: 'Resolved', color: '#64748B' },
];

const SORT_OPTIONS: { value: QueueSort; label: string }[] = [
  { value: 'recent', label: 'Newest first' },
  { value: 'relevance', label: 'Most engaged' },
  { value: 'oldest', label: 'Oldest first' },
];

function filterLabel(filter: StatusFilter): string {
  if (filter === 'all') return 'All reports';
  return `Recorded status: ${statusLabel(filter)}`;
}

export default function MdrrmoReportsWorkspace({
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
  onRefresh,
  onReload,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus ?? 'all');
  const [sort, setSort] = useState<QueueSort>('recent');
  const [draftStatusFilter, setDraftStatusFilter] = useState<StatusFilter>(initialStatus ?? 'all');
  const [draftSort, setDraftSort] = useState<QueueSort>('recent');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [addMenuVisible, setAddMenuVisible] = useState(false);
  const [previousInitialStatus, setPreviousInitialStatus] = useState(initialStatus);

  if (initialStatus !== previousInitialStatus) {
    setPreviousInitialStatus(initialStatus);
    setStatusFilter(initialStatus ?? 'all');
  }

  useFocusEffect(
    useCallback(() => {
      // Keep the selected filters and query, but return to the compact queue header.
      setSearchVisible(false);
      setFilterVisible(false);
      setAddMenuVisible(false);
      return undefined;
    }, []),
  );

  const filteredReports = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    const matched = reports.filter((report) => {
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
          second.upvoteCount + second.commentCount - (first.upvoteCount + first.commentCount);
        if (engagementDifference !== 0) return engagementDifference;
      }
      return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
    });
  }, [reports, searchQuery, sort, statusFilter, workflowQueue]);

  const openReport = (reportId: string) => {
    router.push(`/official/${reportId}` as Href);
  };

  function openFilters() {
    // Keep filter changes temporary until the user explicitly applies them.
    setDraftStatusFilter(statusFilter);
    setDraftSort(sort);
    setAddMenuVisible(false);
    setFilterVisible(true);
  }

  function closeFilters() {
    setFilterVisible(false);
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
        onScrollBeginDrag={() => setAddMenuVisible(false)}
      >
        <MdrrmoHeader
          title="Reports"
          showCommandBack={showCommandBack}
          right={
            <>
              <TouchableOpacity
                style={styles.headerAction}
                onPress={() => {
                  setAddMenuVisible(false);
                  setSearchVisible((current) => !current);
                }}
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
              <View style={styles.addReportMenuAnchor}>
                <TouchableOpacity
                  style={styles.headerAction}
                  onPress={() => setAddMenuVisible((current) => !current)}
                  accessibilityRole="button"
                  accessibilityLabel="Open report actions"
                  accessibilityState={{ expanded: addMenuVisible }}
                >
                  <FontAwesome6 name="plus" size={25} color={colors.navigationActive} />
                </TouchableOpacity>

                {addMenuVisible ? (
                  <View style={styles.addReportMenu}>
                    <TouchableOpacity
                      style={styles.addReportMenuItem}
                      onPress={() => {
                        setAddMenuVisible(false);
                        setReportModalVisible(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Add a report"
                    >
                      <Ionicons name="document-text-outline" size={20} color={colors.navigationActive} />
                      <Text style={styles.addReportMenuText}>Add a report</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </>
          }
        />

        <WorkflowQueuePicker municipal={true} selected={workflowQueue} onSelect={onQueueChange} />
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
              <Text style={styles.sectionLabel}>{(workflowQueue === 'all' ? filterLabel(statusFilter) : workflowQueueLabel(workflowQueue, true)).toUpperCase()}</Text>
              <Text style={styles.sectionSubtitle}>
                {filteredReports.length} {filteredReports.length === 1 ? 'result' : 'results'} · tap a report to manage it
              </Text>
            </View>
          </View>

          {loading && reports.length === 0 ? (
            <ReportsScreenSkeleton />
          ) : null}
          {loading && reports.length > 0 ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={colors.navigationActive} />
              <Text style={styles.stateBody}>Loading municipal reports…</Text>
            </View>
          ) : null}

          {!loading && error ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>Could not load reports</Text>
              <Text style={styles.stateBody}>{error}</Text>
              <TouchableOpacity onPress={() => void onReload()}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!loading && !error && filteredReports.length === 0 ? (
            <View style={styles.stateBox}>
              <Ionicons name="checkmark-circle-outline" size={32} color={colors.textMuted} />
              <Text style={styles.stateTitle}>No matching reports</Text>
              <Text style={styles.stateBody}>Try another status, sort order, or search term.</Text>
            </View>
          ) : null}

          {!loading && !error ? filteredReports.map((report, index) => (
            <OfficialReportQueueRow
              key={report.id}
              report={report}
              audience="mitcom"
              actionLabel="View"
              onPress={() => openReport(report.id)}
              first={index === 0}
            />
          )) : null}
        </View>
        {hasMore && <TouchableOpacity style={styles.applyButton} onPress={() => void onLoadMore()} disabled={loadingMore} accessibilityRole="button"><Text style={styles.applyButtonText}>{loadingMore ? 'Loading more reports...' : 'Load more reports'}</Text></TouchableOpacity>}
      </ScrollView>

      <Modal
        visible={filterVisible}
        transparent
        animationType="fade"
        hardwareAccelerated
        onRequestClose={closeFilters}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeFilters} />
          <View style={[styles.filterSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Report filters</Text>
              <TouchableOpacity onPress={closeFilters} accessibilityLabel="Close filters">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Recorded status</Text>
              <View style={styles.filterChoices}>
                {([{ value: 'all', label: 'All' }, ...STATUS_STEPS.map((step) => ({ value: step.status, label: step.label }))] as { value: StatusFilter; label: string }[]).map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.filterChoice, draftStatusFilter === option.value && styles.filterChoiceActive]}
                    onPress={() => setDraftStatusFilter(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: draftStatusFilter === option.value }}
                  >
                    <Text style={[styles.filterChoiceText, draftStatusFilter === option.value && styles.filterChoiceTextActive]}>{option.label}</Text>
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
                    accessibilityRole="button"
                    accessibilityState={{ selected: draftSort === option.value }}
                  >
                    <Text style={[styles.filterChoiceText, draftSort === option.value && styles.filterChoiceTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
              <Text style={styles.applyButtonText}>Apply filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <OfficialReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        onSubmitted={() => {
          setReportModalVisible(false);
          void onReload();
        }}
      />
    </SafeAreaView>
  );
}
