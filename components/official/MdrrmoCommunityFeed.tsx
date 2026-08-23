import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnnouncementEngagementProvider } from './AnnouncementEngagementProvider';
import MdrrmoHeader from './MdrrmoHeader';
import OfficialAnnouncementPostCard from './OfficialAnnouncementPostCard';
import OfficialReportPostCard, { officialQueueItemToPost } from './OfficialReportPostCard';
import { ReportEngagementProvider } from '../report/ReportEngagementProvider';
import type { AnnouncementRecord, AnnouncementScope } from '../../lib/announcements';
import type { OfficialReportQueueItem } from '../../lib/officialReports';
import type { OfficialPublicProfile } from '../../lib/profile';
import { mdrrmoCommunityStyles as styles } from '../../styles/screens/mdrrmoCommunity.styles';
import { colors } from '../../styles/theme';

type AnnouncementScopeFilter = 'all' | AnnouncementScope;
type FeedSort = 'newest' | 'oldest';
type ReportStatusFilter = 'all' | 'active' | 'resolved';

type Props = {
  announcements: AnnouncementRecord[];
  announcementError: string | null;
  announcementsLoading: boolean;
  reports: OfficialReportQueueItem[];
  reportsError: string | null;
  reportsLoading: boolean;
  officialProfile: OfficialPublicProfile | null;
  visibleReportCount: number;
  onCompose: () => void;
  onLoadMoreReports: () => void;
  onRetryAnnouncements: () => void;
  onRetryReports: () => void;
  roleVariant?: 'mdrrmo' | 'mayor';
};

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function matchesSearch(value: string, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return normalizeSearchText(value).includes(normalizedQuery);
}

export default function MdrrmoCommunityFeed({
  announcements,
  announcementError,
  announcementsLoading,
  reports,
  reportsError,
  reportsLoading,
  officialProfile,
  visibleReportCount,
  onCompose,
  onLoadMoreReports,
  onRetryAnnouncements,
  onRetryReports,
  roleVariant = 'mdrrmo',
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<AnnouncementScopeFilter>('all');
  const [feedSort, setFeedSort] = useState<FeedSort>('newest');
  const [reportStatusFilter, setReportStatusFilter] = useState<ReportStatusFilter>('all');

  const normalizedQuery = normalizeSearchText(searchQuery);
  // The settings destination remains in bottom navigation on narrow devices,
  // so the header avatar can yield space to the title and core feed actions.
  const compactHeader = windowWidth < 360;
  const initials = [officialProfile?.first_name, officialProfile?.last_name]
    .filter((part) => part?.trim())
    .map((part) => part!.trim().charAt(0).toUpperCase())
    .join('') || 'M';

  const filteredAnnouncements = useMemo(() => {
    const scoped = announcements.filter((announcement) => {
      if (scopeFilter !== 'all' && announcement.scope !== scopeFilter) return false;
      return matchesSearch(
        `${announcement.title} ${announcement.body} ${announcement.author.firstName} ${announcement.author.lastName} ${announcement.author.roleLabel}`,
        normalizedQuery,
      );
    });

    return [...scoped].sort((first, second) => {
      const difference = new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      return feedSort === 'newest' ? difference : -difference;
    });
  }, [announcements, feedSort, normalizedQuery, scopeFilter]);

  const pinnedAnnouncements = filteredAnnouncements.filter((announcement) => announcement.isPinned);
  const regularAnnouncements = filteredAnnouncements.filter((announcement) => !announcement.isPinned);

  const filteredReports = useMemo(() => {
    return reports
      .filter((report) => {
        if (reportStatusFilter === 'active' && report.status === 'resolved') return false;
        if (reportStatusFilter === 'resolved' && report.status !== 'resolved') return false;
        return matchesSearch(
          `${report.title} ${report.description} ${report.addressText ?? ''} ${report.barangayName ?? ''} ${report.reporterName}`,
          normalizedQuery,
        );
      })
      .sort((first, second) => {
        const difference = new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
        return feedSort === 'newest' ? difference : -difference;
      });
  }, [feedSort, normalizedQuery, reportStatusFilter, reports]);

  const visibleReports = filteredReports.slice(0, visibleReportCount);
  const hasMoreReports = visibleReports.length < filteredReports.length;
  const reportsNeedingAction = reports.filter(
    (report) => report.status === 'unverified' || report.status === 'escalated',
  ).length;
  const isMayor = roleVariant === 'mayor';

  const openReport = (reportId: string, focusComments = false) => {
    const suffix = focusComments ? '?focus=comments' : '';
    router.push(`/official/${reportId}${suffix}` as Href);
  };

  return (
    <>
      <MdrrmoHeader
        title="Community"
        right={
          <>
            <TouchableOpacity
              style={styles.headerAction}
              onPress={() => setSearchVisible((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={searchVisible ? 'Close search' : 'Search community feed'}
            >
              <Ionicons name={searchVisible ? 'close' : 'search'} size={25} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerAction}
              onPress={() => setFiltersVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Filter community feed"
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
                <Text style={styles.avatarText}>{initials}</Text>
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
            placeholder="Search announcements and reports"
            placeholderTextColor={colors.textMuted}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {isMayor ? (
        <View style={styles.publishPanel} accessibilityLabel="Mayor's municipal communication workspace">
          <View style={styles.publishCopy}>
            <Text style={styles.eyebrow}>{"MAYOR'S OFFICE"}</Text>
            <Text style={styles.publishTitle}>Municipality-wide communication</Text>
          </View>
          <View style={styles.countPill}>
            <Ionicons name="eye-outline" size={16} color={colors.primary} />
            <Text style={styles.countPillText}>Executive view</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.publishPanel}>
        <View style={styles.publishCopy}>
          <Text style={styles.eyebrow}>PUBLISH</Text>
          <Text style={styles.publishTitle}>
            {isMayor ? 'Share a municipal message' : 'Share an official update'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.publishAction}
          onPress={onCompose}
          accessibilityRole="button"
          accessibilityLabel="Create a new announcement"
        >
          <Text style={styles.publishActionText} numberOfLines={1}>
            {compactHeader ? 'New' : isMayor ? 'New message' : 'New announcement'}
          </Text>
          <Ionicons name="add" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.scopeTabs} accessibilityRole="tablist">
        {([
          ['all', 'All'],
          ['municipal', isMayor ? 'Municipal' : 'MDRRMO'],
          ['barangay', 'Barangays'],
        ] as const).map(([value, label]) => {
          const selected = scopeFilter === value;
          return (
            <TouchableOpacity
              key={value}
              style={styles.scopeTab}
              onPress={() => setScopeFilter(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.scopeTabText, selected && styles.scopeTabTextActive]}>{label}</Text>
              {selected ? <View style={styles.scopeTabIndicator} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <AnnouncementEngagementProvider announcements={announcements}>
        {pinnedAnnouncements.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionTitleGroup}>
              <View style={styles.pinnedTitleRow}>
                <Ionicons name="pin-outline" size={20} color={colors.textMuted} />
                <Text style={styles.sectionTitle}>
                  {pinnedAnnouncements.length === 1 ? 'PINNED ADVISORY' : 'PINNED ADVISORIES'}
                </Text>
              </View>
              <Text style={styles.sectionSubtitle}>Visible above newer posts until unpinned</Text>
            </View>
            {pinnedAnnouncements.map((announcement) => (
              <OfficialAnnouncementPostCard
                key={announcement.id}
                announcement={announcement}
                moderationMode="scoped"
                variant="officialCommunity"
                cardStyle={styles.card}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleGroup}>
              <Text style={styles.sectionTitle}>ALL ANNOUNCEMENTS</Text>
              {normalizedQuery ? (
                <Text style={styles.sectionSubtitle}>{filteredAnnouncements.length} matching updates</Text>
              ) : null}
            </View>
            <Text style={styles.sortLabel}>{feedSort === 'newest' ? 'Newest first' : 'Oldest first'}</Text>
          </View>

          {announcementsLoading ? (
            <View style={styles.stateBox}><ActivityIndicator color={colors.primary} /></View>
          ) : null}
          {!announcementsLoading && announcementError ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>Could not load announcements</Text>
              <Text style={styles.stateBody}>{announcementError}</Text>
              <TouchableOpacity onPress={onRetryAnnouncements}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
            </View>
          ) : null}
          {!announcementsLoading && !announcementError && regularAnnouncements.length === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>{normalizedQuery ? 'No matching announcements' : 'No announcements in this scope'}</Text>
              <Text style={styles.stateBody}>Published official updates will appear here.</Text>
            </View>
          ) : null}
          {!announcementsLoading && !announcementError ? regularAnnouncements.map((announcement) => (
            <OfficialAnnouncementPostCard
              key={announcement.id}
              announcement={announcement}
              moderationMode="scoped"
              variant="officialCommunity"
              cardStyle={styles.card}
            />
          )) : null}
        </View>
      </AnnouncementEngagementProvider>

      <View style={styles.divider} />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleGroup}>
            <Text style={styles.sectionTitle}>COMMUNITY REPORTS</Text>
            <Text style={styles.sectionSubtitle}>Resident submissions in your municipal scope</Text>
          </View>
          <View style={styles.countPill}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.countPillText}>{reportsNeedingAction} need action</Text>
          </View>
        </View>

        {reportsLoading ? (
          <View style={styles.stateBox}><ActivityIndicator color={colors.primary} /></View>
        ) : null}
        {!reportsLoading && reportsError ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>Could not load reports</Text>
            <Text style={styles.stateBody}>{reportsError}</Text>
            <TouchableOpacity onPress={onRetryReports}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
          </View>
        ) : null}
        {!reportsLoading && !reportsError && visibleReports.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>{normalizedQuery ? 'No matching reports' : 'No reports in your scope'}</Text>
          </View>
        ) : null}
        {!reportsLoading && !reportsError && visibleReports.length > 0 ? (
          <ReportEngagementProvider reports={reports.map(officialQueueItemToPost)}>
            {visibleReports.map((report) => (
              <OfficialReportPostCard
                key={report.id}
                report={report}
                onPress={() => openReport(report.id)}
                onCommentPress={() => openReport(report.id, true)}
              />
            ))}
          </ReportEngagementProvider>
        ) : null}
        {hasMoreReports ? (
          <TouchableOpacity style={styles.doneButton} onPress={onLoadMoreReports}>
            <Text style={styles.doneButtonText}>Show more reports</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal visible={filtersVisible} transparent animationType="slide" onRequestClose={() => setFiltersVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setFiltersVisible(false)} />
          <View style={[styles.filterSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Feed filters</Text>
              <TouchableOpacity onPress={() => setFiltersVisible(false)} accessibilityLabel="Close filters">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Order</Text>
              <View style={styles.filterChoices}>
                {([
                  ['newest', 'Newest first'],
                  ['oldest', 'Oldest first'],
                ] as const).map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.filterChoice, feedSort === value && styles.filterChoiceActive]}
                    onPress={() => setFeedSort(value)}
                  >
                    <Text style={[styles.filterChoiceText, feedSort === value && styles.filterChoiceTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Community report status</Text>
              <View style={styles.filterChoices}>
                {([
                  ['all', 'All reports'],
                  ['active', 'Needs attention'],
                  ['resolved', 'Resolved'],
                ] as const).map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.filterChoice, reportStatusFilter === value && styles.filterChoiceActive]}
                    onPress={() => setReportStatusFilter(value)}
                  >
                    <Text style={[styles.filterChoiceText, reportStatusFilter === value && styles.filterChoiceTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={styles.doneButton} onPress={() => setFiltersVisible(false)}>
              <Text style={styles.doneButtonText}>Apply filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
