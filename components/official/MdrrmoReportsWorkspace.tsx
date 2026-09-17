import React, { useMemo, useState } from 'react';
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
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import MdrrmoHeader from './MdrrmoHeader';
import OfficialReportModal from './OfficialReportModal';
import { statusLabel } from '../report/ReportDetailCard';
import { formatPublishedAt } from '../../lib/formatTime';
import { formatIncidentType } from '../../lib/incidentTypes';
import type {
  OfficialReportQueueItem,
  ReportStatus,
} from '../../lib/officialReports';
import { mdrrmoReportsStyles as styles } from '../../styles/screens/mdrrmoReports.styles';
import { colors } from '../../styles/theme';

type StatusFilter = ReportStatus | 'all';
type QueueSort = 'recent' | 'relevance' | 'oldest';

type Props = {
  reports: OfficialReportQueueItem[];
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

function statusColor(status: ReportStatus): string {
  return STATUS_STEPS.find((step) => step.status === status)?.color ?? colors.textMuted;
}

function filterLabel(filter: StatusFilter): string {
  if (filter === 'all') return 'All reports';
  return `${statusLabel(filter)} reports`;
}

export default function MdrrmoReportsWorkspace({
  reports,
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus ?? 'escalated');
  const [sort, setSort] = useState<QueueSort>('recent');
  const [draftStatusFilter, setDraftStatusFilter] = useState<StatusFilter>(initialStatus ?? 'escalated');
  const [draftSort, setDraftSort] = useState<QueueSort>('recent');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [addMenuVisible, setAddMenuVisible] = useState(false);
  const [previousInitialStatus, setPreviousInitialStatus] = useState(initialStatus);

  if (initialStatus !== previousInitialStatus) {
    setPreviousInitialStatus(initialStatus);
    setStatusFilter(initialStatus ?? 'escalated');
  }

  const filteredReports = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    const matched = reports.filter((report) => {
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
          second.upvoteCount + second.commentCount - (first.upvoteCount + first.commentCount);
        if (engagementDifference !== 0) return engagementDifference;
      }
      return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
    });
  }, [reports, searchQuery, sort, statusFilter]);

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
                {filteredReports.length} {filteredReports.length === 1 ? 'result' : 'results'} · tap a report to manage it
              </Text>
            </View>
          </View>

          {loading ? (
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

          {!loading && !error ? filteredReports.map((report, index) => {
            const accentColor = statusColor(report.status);
            return (
              <TouchableOpacity
                key={report.id}
                style={[
                  styles.queueCard,
                  index === 0 && styles.queueCardFirst,
                  index % 2 === 0 && styles.queueCardOdd,
                ]}
                onPress={() => openReport(report.id)}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel={`Open report ${report.title || 'untitled'}`}
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
                    {report.addressText || report.barangayName || 'Location unavailable'}
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
                      <Text style={styles.reviewActionText}>View</Text>
                      <Ionicons name="chevron-forward" size={21} color={colors.navigationActive} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }) : null}
        </View>
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
              <Text style={styles.filterLabel}>Status</Text>
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
