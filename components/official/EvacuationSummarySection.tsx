// Compact Command evacuation summary based only on declared center data.
import React, { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { summarizeEvacuationCenters } from '../../lib/evacuationSummary';
import { evacuationStatusLabel, type EvacuationCenterRecord } from '../../lib/resources';
import type { OfficialKind } from '../../lib/officialReports';
import { fetchBarangays } from '../../lib/barangays';

type EvacuationSummarySectionProps = {
  centers: EvacuationCenterRecord[];
  error: string | null;
  officialKind: OfficialKind | null;
};

function formatLastUpdate(value: string | null): string {
  if (!value) return 'Not updated yet';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Not updated yet';
}

export default function EvacuationSummarySection({
  centers,
  error,
  officialKind,
}: EvacuationSummarySectionProps) {
  const router = useRouter();
  const summary = useMemo(() => summarizeEvacuationCenters(centers), [centers]);
  const [barangayNameById, setBarangayNameById] = useState<Map<string, string>>(
    new Map(),
  );

  useEffect(() => {
    void fetchBarangays().then((result) => {
      if (result.error) return;
      setBarangayNameById(
        new Map(result.barangays.map((barangay) => [barangay.id, barangay.name])),
      );
    });
  }, []);

  function manageCenters() {
    if (officialKind === 'MDRRMO') {
      router.push('/official/community?section=resources&tab=centers' as Href);
      return;
    }
    router.push('/official/resources?tab=centers' as Href);
  }

  return (
    <View style={styles.section}>
      <View style={styles.resourceSectionHeader}>
        <Text style={styles.sectionTitle}>Evacuation centers</Text>
        <TouchableOpacity style={styles.evacuationManageLink} onPress={manageCenters}>
          <Text style={styles.evacuationManageLinkText}>Manage centers</Text>
        </TouchableOpacity>
      </View>

      {error ? <View style={styles.stateBox}><Text style={styles.stateTitle}>Center summary unavailable</Text><Text style={styles.stateBody}>{error}</Text></View> : (
        <>
          <View style={styles.evacuationMetrics}>
            <View style={styles.evacuationMetric}><Text style={styles.evacuationMetricValue}>{summary.openCount}</Text><Text style={styles.evacuationMetricLabel}>Open</Text></View>
            <View style={styles.evacuationMetric}><Text style={styles.evacuationMetricValue}>{summary.fullCount}</Text><Text style={styles.evacuationMetricLabel}>Full</Text></View>
            <View style={styles.evacuationMetric}><Text style={styles.evacuationMetricValue}>{summary.priorityCount}</Text><Text style={styles.evacuationMetricLabel}>Priority</Text></View>
            <View style={styles.evacuationMetric}><Text style={styles.evacuationMetricValue}>{summary.totalCount}</Text><Text style={styles.evacuationMetricLabel}>Total</Text></View>
          </View>
          <View style={styles.evacuationCapacityCard}>
            <Text style={styles.evacuationCapacityValue}>{summary.declaredCapacity.toLocaleString()}</Text>
            <Text style={styles.evacuationCapacityLabel}>Total declared capacity</Text>
            <Text style={styles.evacuationCapacityMeta}>{summary.missingCapacityCount} center{summary.missingCapacityCount === 1 ? '' : 's'} without declared capacity</Text>
          </View>

          {summary.attentionCenters.length > 0 ? <View style={styles.evacuationAttentionList}>
            <Text style={styles.evacuationAttentionTitle}>Needs attention</Text>
            {summary.attentionCenters.map((center) => <View key={center.id} style={styles.evacuationAttentionCard}>
              <View style={styles.queueCardHeader}>
                <Text style={styles.queueTitle}>{center.name}</Text>
                <Text style={styles.evacuationAttentionStatus}>{evacuationStatusLabel(center.status)}</Text>
              </View>
              <Text style={styles.queueMeta}>{center.capacity == null ? 'Capacity not declared' : `Declared capacity ${center.capacity}`}{center.isPriority ? ' · Priority' : ''}</Text>
              {center.barangayId && barangayNameById.get(center.barangayId) ? <Text style={styles.queueMeta}>Barangay: {barangayNameById.get(center.barangayId)}</Text> : null}
              <Text style={styles.queueMeta}>{formatLastUpdate(center.lastUpdatedAt)}</Text>
            </View>)}
          </View> : null}
        </>
      )}
    </View>
  );
}
