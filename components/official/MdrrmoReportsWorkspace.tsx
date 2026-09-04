import React, { useEffect, useMemo, useState } from 'react';
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
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import MdrrmoHeader from './MdrrmoHeader';
import OfficialReportModal from './OfficialReportModal';
import { statusLabel } from '../report/ReportDetailCard';
import { formatPublishedAt } from '../../lib/formatTime';
import { fetchMyOfficialPublicProfile, type OfficialPublicProfile } from '../../lib/profile';
import type {
  OfficialReportQueueItem,
  OfficialStatusCounts,
  ReportStatus,
} from '../../lib/officialReports';
import { mdrrmoReportsStyles as styles } from '../../styles/screens/mdrrmoReports.styles';
import { colors } from '../../styles/theme';

type StatusFilter = ReportStatus | 'all';
type QueueSort = 'recent' | 'relevance' | 'oldest';

type Props = {
  reports: OfficialReportQueueItem[];
  counts: OfficialStatusCounts;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  initialStatus: ReportStatus | null;
  onRefresh: () => Promise<void>;
  onReload: () => Promise<void>;
};

const STATUS_STEPS: { status: ReportStatus; label: string; color: string }[] = [
  { status: 'unverified', label: 'Unverified', color: '#D92D20' },
  { status: 'verified', label: 'Verified', color: '#169B55' },
  { status: 'escalated', label: 'Escalated', color: '#F04424' },
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
  counts,
  error,
  loading,
  refreshing,
  initialStatus,
  onRefresh,
  onReload,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus ?? 'escalated');
  const [sort, setSort] = useState<QueueSort>('recent');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [officialProfile, setOfficialProfile] = useState<OfficialPublicProfile | null>(null);
  const [previousInitialStatus, setPreviousInitialStatus] = useState(initialStatus);

  const compactHeader = windowWidth < 360;
  const profileInitials = [officialProfile?.first_name, officialProfile?.last_name]
    .filter((part) => part?.trim())
    .map((part) => part!.trim().charAt(0).toUpperCase())
    .join('') || 'M';

  if (initialStatus !== previousInitialStatus) {
    setPreviousInitialStatus(initialStatus);
    setStatusFilter(initialStatus ?? 'escalated');
  }

  useEffect(() => {
    let cancelled = false;
    void fetchMyOfficialPublicProfile().then((result) => {
      if (!cancelled) setOfficialProfile(result.profile);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
                onPress={() => setFilterVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Filter reports"
              >
                <Ionicons name="options-outline" size={25} color={colors.text} />
              </TouchableOpacity>
              {!compactHeader ? (
                <TouchableOpacity
                  style={styles.avatar}
                  onPress={() => router.push('/official/settings' as Href)}
                  accessibilityRole="button"
                  accessibilityLabel="Open settings"
                >
                  <Text style={styles.avatarText}>{profileInitials}</Text>
                </TouchableOpacity>
              ) : null}
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

        <View style={styles.createStrip}>
          <View style={styles.createCopy}>
            <Text style={styles.eyebrow}>CREATE</Text>
            <Text style={styles.createTitle}>Log a verified municipal incident</Text>
          </View>
          <TouchableOpacity
            style={styles.createAction}
            onPress={() => setReportModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Create official report"
          >
            <Text style={styles.createActionText}>{compactHeader ? 'New' : 'New report'}</Text>
            <Ionicons name="add" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.pipelineSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleGroup}>
              <Text style={styles.sectionLabel}>REPORT PIPELINE</Text>
              <Text style={styles.sectionSubtitle}>{counts.total} reports in the municipal workspace</Text>
            </View>
            <TouchableOpacity onPress={() => setStatusFilter('all')} accessibilityRole="button">
              <Text style={styles.linkText}>View all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.pipelineRow}>
            {STATUS_STEPS.map((step, index) => {
              const selected = statusFilter === step.status;
              return (
                <TouchableOpacity
                  key={step.status}
                  style={styles.pipelineStep}
                  onPress={() => setStatusFilter(step.status)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Show ${step.label.toLowerCase()} reports`}
                >
                  <View style={[styles.pipelineDot, { backgroundColor: step.color }]} />
                  <Text style={[styles.pipelineValue, { color: step.color }]}>{counts[step.status]}</Text>
                  <Text
                    style={[styles.pipelineLabel, selected && styles.pipelineSelected]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                  >
                    {step.label}
                  </Text>
                  {index < STATUS_STEPS.length - 1 ? <View style={styles.pipelineStepDivider} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.queueSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleGroup}>
              <Text style={styles.sectionLabel}>{filterLabel(statusFilter).toUpperCase()}</Text>
              <Text style={styles.sectionSubtitle}>
                {filteredReports.length} {filteredReports.length === 1 ? 'result' : 'results'} · tap a report to manage it
              </Text>
            </View>
            <TouchableOpacity style={styles.queueHeaderRight} onPress={() => setFilterVisible(true)}>
              <Text style={styles.linkText}>
                {SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Newest first'}
              </Text>
              <Ionicons name="chevron-down" size={17} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={colors.primary} />
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

          {!loading && !error ? filteredReports.map((report) => {
            const accentColor = statusColor(report.status);
            return (
              <TouchableOpacity
                key={report.id}
                style={styles.queueCard}
                onPress={() => openReport(report.id)}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel={`Open report ${report.title || 'untitled'}`}
              >
                <View style={styles.queueCardTop}>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: accentColor }]} />
                    <Text style={[styles.statusText, { color: accentColor }]}>{statusLabel(report.status).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.timeText}>{formatPublishedAt(report.createdAt)}</Text>
                </View>

                <View style={styles.reportMainRow}>
                  <View style={styles.mediaFrame}>
                    {report.firstPhotoUrl ? (
                      <Image source={{ uri: report.firstPhotoUrl }} style={styles.media} resizeMode="cover" />
                    ) : (
                      <View style={styles.mediaPlaceholder}>
                        <Ionicons name="document-text-outline" size={26} color={colors.textMuted} />
                        <Text style={styles.mediaPlaceholderText}>No photo</Text>
                      </View>
                    )}
                    {report.mediaCount > 0 ? (
                      <View style={styles.mediaCount}>
                        <Ionicons name="images-outline" size={12} color={colors.white} />
                        <Text style={styles.mediaCountText}>{report.mediaCount}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.reportCopy}>
                    <Text style={styles.reportTitle} numberOfLines={2}>
                      {report.title.trim() || 'Untitled report'}
                    </Text>
                    <Text style={styles.reportDescription} numberOfLines={2}>
                      {report.description.trim() || 'No description provided.'}
                    </Text>
                    <View style={styles.metaRow}>
                      <Ionicons name="location-outline" size={16} color={colors.primary} />
                      <Text style={styles.metaText} numberOfLines={2}>
                        {report.addressText || report.barangayName || 'Location unavailable'}
                      </Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Ionicons name="person-outline" size={16} color={colors.textMuted} />
                      <Text style={styles.metaText} numberOfLines={1}>{report.reporterName}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.engagementGroup}>
                    <View style={styles.engagementItem}>
                      <Ionicons name="arrow-up-outline" size={17} color={colors.textMuted} />
                      <Text style={styles.engagementText}>{report.upvoteCount}</Text>
                    </View>
                    <View style={styles.engagementItem}>
                      <Ionicons name="chatbubble-outline" size={16} color={colors.textMuted} />
                      <Text style={styles.engagementText}>{report.commentCount}</Text>
                    </View>
                  </View>
                  <View style={styles.reviewAction}>
                    <Text style={styles.reviewActionText}>Review report</Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.primary} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }) : null}
        </View>
      </ScrollView>

      <Modal visible={filterVisible} transparent animationType="slide" onRequestClose={() => setFilterVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setFilterVisible(false)} />
          <View style={[styles.filterSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Report filters</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)} accessibilityLabel="Close filters">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Status</Text>
              <View style={styles.filterChoices}>
                {([{ value: 'all', label: 'All' }, ...STATUS_STEPS.map((step) => ({ value: step.status, label: step.label }))] as { value: StatusFilter; label: string }[]).map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.filterChoice, statusFilter === option.value && styles.filterChoiceActive]}
                    onPress={() => setStatusFilter(option.value)}
                  >
                    <Text style={[styles.filterChoiceText, statusFilter === option.value && styles.filterChoiceTextActive]}>{option.label}</Text>
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
                    style={[styles.filterChoice, sort === option.value && styles.filterChoiceActive]}
                    onPress={() => setSort(option.value)}
                  >
                    <Text style={[styles.filterChoiceText, sort === option.value && styles.filterChoiceTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={styles.applyButton} onPress={() => setFilterVisible(false)}>
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
