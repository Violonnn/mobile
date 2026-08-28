import React, { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import InteractiveMap, { type MapResourceMarker } from '../map/InteractiveMap';
import { fetchBarangays } from '../../lib/barangays';
import { summarizeEvacuationCenters } from '../../lib/evacuationSummary';
import type { EvacuationCenterRecord } from '../../lib/resources';
import type { OfficialKind } from '../../lib/officialReports';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';
import { officialStyles } from '../../styles/screens/official.styles';

type EvacuationSummarySectionProps = {
  centers: EvacuationCenterRecord[];
  error: string | null;
  officialKind: OfficialKind | null;
};

function formatUpdate(value: string | null): string {
  if (!value) return 'Not updated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not updated';
  return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

export default function EvacuationSummarySection({ centers, error, officialKind }: EvacuationSummarySectionProps) {
  const router = useRouter();
  const summary = useMemo(() => summarizeEvacuationCenters(centers), [centers]);
  const [barangayNameById, setBarangayNameById] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    void fetchBarangays().then((result) => {
      if (!result.error) setBarangayNameById(new Map(result.barangays.map((barangay) => [barangay.id, barangay.name])));
    });
  }, []);

  function manageCenters() {
    router.push('/official/resources?tab=centers' as Href);
  }

  if (officialKind !== 'MDRRMO') {
    return (
      <View style={officialStyles.section}>
        <View style={officialStyles.resourceSectionHeader}>
          <Text style={officialStyles.sectionTitle}>Evacuation centers</Text>
          <TouchableOpacity style={officialStyles.evacuationManageLink} onPress={manageCenters}>
            <Text style={officialStyles.evacuationManageLinkText}>Manage centers</Text>
          </TouchableOpacity>
        </View>
        {error ? <Text style={officialStyles.stateBody}>{error}</Text> : (
          <View style={officialStyles.evacuationMetrics}>
            <View style={officialStyles.evacuationMetric}><Text style={officialStyles.evacuationMetricValue}>{summary.openCount}</Text><Text style={officialStyles.evacuationMetricLabel}>Open</Text></View>
            <View style={officialStyles.evacuationMetric}><Text style={officialStyles.evacuationMetricValue}>{summary.fullCount}</Text><Text style={officialStyles.evacuationMetricLabel}>Full</Text></View>
            <View style={officialStyles.evacuationMetric}><Text style={officialStyles.evacuationMetricValue}>{summary.totalCount}</Text><Text style={officialStyles.evacuationMetricLabel}>Total</Text></View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>EVACUATION NETWORK</Text>
        <TouchableOpacity style={styles.link} onPress={manageCenters}>
          <Text style={styles.linkText}>Manage centers</Text>
          <Ionicons name="arrow-forward" size={19} color="#1A56DB" />
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={officialStyles.stateBox}>
          <Text style={officialStyles.stateTitle}>Center summary unavailable</Text>
          <Text style={officialStyles.stateBody}>{error}</Text>
        </View>
      ) : (
        <>
          <View style={styles.readinessCard}>
            <View style={styles.readinessTop}>
              <View style={styles.capacityCopy}>
                <Text style={styles.capacityValue}>{summary.declaredCapacity.toLocaleString()}</Text>
                <Text style={styles.capacityLabel}>declared capacity</Text>
              </View>
              <View style={styles.reviewBadge}>
                <View style={[styles.alertDot, { backgroundColor: summary.attentionCount ? '#FF3B30' : '#16A34A' }]} />
                <Text style={styles.reviewBadgeText}>
                  {summary.attentionCount ? `${summary.attentionCount} need${summary.attentionCount === 1 ? 's' : ''} review` : 'Ready'}
                </Text>
              </View>
            </View>
            <View style={styles.readinessBar} />
            <View style={styles.readinessMetrics}>
              {[
                { value: summary.openCount, label: 'Open' },
                { value: summary.fullCount, label: 'Full' },
                { value: summary.priorityCount, label: 'Priority' },
              ].map((metric, index) => (
                <View key={metric.label} style={[styles.readinessMetric, index === 2 && styles.readinessMetricLast]}>
                  <Text style={styles.readinessMetricValue}>{metric.value}</Text>
                  <Text style={styles.readinessMetricLabel}>{metric.label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.capacityMeta}>
              {summary.missingCapacityCount} center{summary.missingCapacityCount === 1 ? '' : 's'} still need capacity details
            </Text>
          </View>

          {summary.attentionCenters.length > 0 ? (
            <>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewLabel}>REQUIRES REVIEW</Text>
              </View>
              {summary.attentionCenters.slice(0, 1).map((center) => {
                const marker: MapResourceMarker = {
                  id: center.id,
                  kind: 'evacuation',
                  name: center.name,
                  latitude: center.latitude,
                  longitude: center.longitude,
                  isPriority: center.isPriority,
                };
                return (
                  <View key={center.id} style={styles.reviewCard}>
                    <View style={styles.reviewAccent} />
                    <View style={styles.reviewMap} pointerEvents="none">
                      <InteractiveMap markers={[]} facilities={[]} evacuationCenters={[marker]} showZoomControls={false} tone="dark" />
                    </View>
                    <View style={styles.reviewCopy}>
                      <View style={styles.reviewIdentity}>
                        <View style={styles.reviewNameRow}>
                          <Text style={styles.reviewName} numberOfLines={2}>{center.name}</Text>
                          {center.isPriority ? <View style={styles.priorityPill}><Text style={styles.priorityPillText}>Priority</Text></View> : null}
                        </View>
                        <Text style={styles.reviewMeta} numberOfLines={2}>
                          {center.barangayId ? barangayNameById.get(center.barangayId) || 'Barangay unavailable' : 'Barangay unavailable'}
                        </Text>
                      </View>
                      <Text style={styles.reviewMeta}>
                        {center.capacity == null ? 'Capacity not set' : `Capacity ${center.capacity}`} · Updated {formatUpdate(center.lastUpdatedAt)}
                      </Text>
                      <TouchableOpacity style={styles.reviewAction} onPress={manageCenters}>
                        <Text style={styles.reviewActionText}>Review center</Text>
                        <Ionicons name="arrow-forward" size={18} color="#1A56DB" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              {summary.missingCapacityCount > 0 ? (
                <TouchableOpacity style={styles.incompleteRow} onPress={manageCenters}>
                  <Ionicons name="information-circle" size={28} color="#64748B" />
                  <Text style={styles.incompleteCopy}>Capacity information incomplete</Text>
                  <Text style={styles.linkText}>Complete details</Text>
                  <Ionicons name="arrow-forward" size={19} color="#1A56DB" />
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}
