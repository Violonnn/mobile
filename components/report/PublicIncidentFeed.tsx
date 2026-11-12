import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useIncidentSupport } from '../../hooks/useIncidentSupport';
import type { CommunityReportSort } from '../../lib/communityReportFeed';
import type { IncidentEngagement, PublicIncident, PublicIncidentStatusFilter } from '../../lib/publicIncidents';
import { feedStyles as styles } from '../../styles/screens/feed.styles';
import { colors } from '../../styles/theme';
import { FeedScreenSkeleton } from '../ui/ResidentScreenSkeletons';
import PublicIncidentCard from './PublicIncidentCard';
import PublicIncidentDetail from './PublicIncidentDetail';

export type PublicReportStatusFilter = PublicIncidentStatusFilter;

type Props = {
  incidents: PublicIncident[];
  loading: boolean;
  error: string | null;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  searchQuery: string;
  statusFilter: PublicReportStatusFilter;
  sort: CommunityReportSort;
  title: string;
  subtitle: string;
  onChangeScope: () => void;
  bottomPadding: number;
  requestedIncidentId?: string;
  requestedOpenKey?: string;
  /** Opens the requested post with its comment composer in view. */
  requestedFocusComments?: boolean;
  onEngagementChange: (incidentCaseId: string, engagement: IncidentEngagement) => void;
  onViewOnMap: (incidentCaseId: string, reportId?: string) => void;
};

/** Community reports in the social-post layout, backed by the limited public projection. */
export default function PublicIncidentFeed(props: Props) {
  const [selected, setSelected] = useState<{ id: string; reportId?: string; focusComments: boolean } | null>(null);
  const { requestedIncidentId, requestedOpenKey, requestedFocusComments = false, onEngagementChange, onViewOnMap } = props;
  const { toggleSupport, busyId } = useIncidentSupport(onEngagementChange);
  useEffect(() => {
    if (!requestedIncidentId) return;
    // Open after navigation has mounted the list and its bottom sheet.
    const timer = setTimeout(() => setSelected({ id: requestedIncidentId, focusComments: requestedFocusComments }), 0);
    return () => clearTimeout(timer);
  }, [requestedFocusComments, requestedIncidentId, requestedOpenKey]);

  const visible = useMemo(() => {
    const query = props.searchQuery.trim().toLocaleLowerCase();
    const matches = props.incidents.filter((incident) => {
      if (props.statusFilter !== 'all' && incident.publicStatus !== props.statusFilter) return false;
      const searchableText = `${incident.publicTitle ?? ''} ${incident.publicCaption ?? ''} ${incident.publicLandmark ?? ''} ${incident.publicTypeLabel} ${incident.barangayName} ${incident.latestPublicUpdate ?? ''} ${incident.publicSummary ?? ''} ${incident.publicCorrection ?? ''}`;
      return !query || searchableText.toLocaleLowerCase().includes(query);
    });
    return matches.sort((first, second) => {
        const firstTime = Date.parse((props.sort === 'activity' ? first.lastPublicUpdateAt : null) ?? first.confirmedAt ?? '');
        const secondTime = Date.parse((props.sort === 'activity' ? second.lastPublicUpdateAt : null) ?? second.confirmedAt ?? '');
        const order = (Number.isFinite(secondTime) ? secondTime : 0) - (Number.isFinite(firstTime) ? firstTime : 0);
        return props.sort === 'oldest' ? -order : order;
    });
  }, [props.incidents, props.searchQuery, props.sort, props.statusFilter]);

  return <>
    <FlatList
      data={visible}
      keyExtractor={(incident) => incident.reportId ?? incident.incidentCaseId}
      style={styles.scrollView}
      contentContainerStyle={[styles.communityListContent, { paddingBottom: props.bottomPadding }]}
      refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor={colors.primary} />}
      ListHeaderComponent={<View style={styles.reportSectionHeader}>
        <View style={styles.reportSectionTitleRow}>
          <Text style={styles.reportSectionTitle}>{props.title}</Text>
          <TouchableOpacity style={styles.feedScopeSwitch} accessibilityRole="button" accessibilityLabel="Switch between my barangay and municipality reports" onPress={props.onChangeScope}>
            <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.reportSectionSubtitle}>{props.subtitle}</Text>
        {props.error && visible.length > 0 ? <Text accessibilityRole="alert" style={styles.stateText}>{props.error}</Text> : null}
      </View>}
      ListEmptyComponent={props.loading ? <FeedScreenSkeleton variant="community" /> : <View style={styles.stateBlockCompact}>
        <Ionicons name={props.error ? 'cloud-offline-outline' : 'documents-outline'} size={28} color={colors.textMuted} />
        <Text style={styles.stateTitle}>{props.error ? 'Community reports unavailable' : 'No community reports found'}</Text>
        <Text style={styles.stateText}>{props.error ?? 'Pull down to refresh or adjust the feed filters.'}</Text>
        {props.error ? <TouchableOpacity style={styles.retryButton} accessibilityRole="button" onPress={props.onRefresh}><Text style={styles.retryText}>Try again</Text></TouchableOpacity> : null}
      </View>}
      ListFooterComponent={props.hasMore ? <TouchableOpacity style={styles.seeMoreButton} accessibilityRole="button" accessibilityLabel="See more community reports" disabled={props.loadingMore} onPress={props.onLoadMore}>
        {props.loadingMore ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="add" size={21} color={colors.text} />}
      </TouchableOpacity> : undefined}
      renderItem={({ item, index }) => (
        <PublicIncidentCard
          incident={item}
          isLast={index === visible.length - 1}
          supportBusy={busyId === item.incidentCaseId}
          onPress={() => setSelected({ id: item.incidentCaseId, reportId: item.reportId, focusComments: false })}
          onRequestComments={() => setSelected({ id: item.incidentCaseId, reportId: item.reportId, focusComments: true })}
          onToggleSupport={() => void toggleSupport(item.incidentCaseId)}
          onViewOnMap={() => onViewOnMap(item.incidentCaseId, item.reportId)}
          showMapAction={false}
        />
      )}
    />
    {selected ? (
      <PublicIncidentDetail
        key={`${selected.reportId ?? selected.id}-${selected.focusComments ? 'comments' : 'post'}`}
        incidentCaseId={selected.id}
        reportId={selected.reportId}
        context="community"
        focusComments={selected.focusComments}
        onClose={() => setSelected(null)}
        onEngagementChange={onEngagementChange}
        onViewOnMap={(incidentCaseId) => {
          setSelected(null);
          onViewOnMap(incidentCaseId);
        }}
      />
    ) : null}
  </>;
}
