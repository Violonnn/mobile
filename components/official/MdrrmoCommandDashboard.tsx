import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import MdrrmoHeader from './MdrrmoHeader';
import CommandEscalationMap from './CommandEscalationMap';
import CommandPipeline from './CommandPipeline';
import CommandResourceDirectory from './CommandResourceDirectory';
import EvacuationSummarySection from './EvacuationSummarySection';
import { useResources } from '../../hooks/useResources';
import type { EvacuationCenterRecord } from '../../lib/resources';
import type { OfficialReportQueueItem, OfficialStatusCounts } from '../../lib/officialReports';
import { colors } from '../../styles/theme';
import { officialStyles } from '../../styles/screens/official.styles';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';

type MdrrmoCommandDashboardProps = {
  reports: OfficialReportQueueItem[];
  counts: OfficialStatusCounts;
  reportsError: string | null;
  reportsLoading: boolean;
  reportsRefreshing: boolean;
  reloadReports: () => Promise<void>;
  refreshReports: () => Promise<void>;
  centers: EvacuationCenterRecord[];
  centersError: string | null;
  refreshCenters: () => Promise<void>;
};

export default function MdrrmoCommandDashboard({
  reports,
  counts,
  reportsError,
  reportsLoading,
  reportsRefreshing,
  reloadReports,
  refreshReports,
  centers,
  centersError,
  refreshCenters,
}: MdrrmoCommandDashboardProps) {
  const {
    hotlines,
    facilities,
    error: resourcesError,
    loading: resourcesLoading,
    refreshing: resourcesRefreshing,
    refresh: refreshResources,
    reload: reloadResources,
  } = useResources({ mode: 'official' });
  const scrollRef = useRef<ScrollView>(null);
  const mapUnlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (mapUnlockTimer.current) clearTimeout(mapUnlockTimer.current);
    };
  }, []);

  const handleMapGestureActiveChange = useCallback((active: boolean) => {
    if (mapUnlockTimer.current) {
      clearTimeout(mapUnlockTimer.current);
      mapUnlockTimer.current = null;
    }

    // Toggle native scroll only — do not re-render, or the map remounts and
    // the selected escalation resets to the first report.
    if (active) {
      scrollRef.current?.setNativeProps({ scrollEnabled: false });
      return;
    }

    mapUnlockTimer.current = setTimeout(() => {
      scrollRef.current?.setNativeProps({ scrollEnabled: true });
      mapUnlockTimer.current = null;
    }, 80);
  }, []);

  async function refreshDashboard() {
    await Promise.all([refreshReports(), refreshCenters(), refreshResources()]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        overScrollMode="never"
        refreshControl={
          <RefreshControl
            refreshing={reportsRefreshing || resourcesRefreshing}
            onRefresh={() => void refreshDashboard()}
          />
        }
      >
        <View style={styles.padded}>
          <MdrrmoHeader title="Command" showDefaultControls />
        </View>

        {reportsLoading ? (
          <View style={officialStyles.stateBoxBorderless}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : reportsError ? (
          <View style={[officialStyles.stateBox, styles.padded]}>
            <Text style={officialStyles.stateTitle}>Could not load the report pipeline</Text>
            <Text style={officialStyles.stateBody}>{reportsError}</Text>
            <TouchableOpacity style={officialStyles.retryButton} onPress={() => void reloadReports()}>
              <Text style={officialStyles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CommandEscalationMap
              reports={reports}
              onGestureActiveChange={handleMapGestureActiveChange}
            />
            <CommandPipeline counts={counts} />
          </>
        )}

        <View style={styles.stackedSections}>
          <View style={styles.sectionDivider} />

          {resourcesLoading ? (
            <View style={officialStyles.stateBoxBorderless}><ActivityIndicator color={colors.primary} /></View>
          ) : resourcesError ? (
            <View style={styles.section}>
              <View style={officialStyles.stateBox}>
                <Text style={officialStyles.stateTitle}>Resource directory unavailable</Text>
                <Text style={officialStyles.stateBody}>{resourcesError}</Text>
                <TouchableOpacity style={officialStyles.retryButton} onPress={() => void reloadResources()}>
                  <Text style={officialStyles.retryButtonText}>Try again</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <CommandResourceDirectory hotlines={hotlines} facilities={facilities} centers={centers} />
          )}

          <EvacuationSummarySection centers={centers} error={centersError} officialKind="MDRRMO" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
