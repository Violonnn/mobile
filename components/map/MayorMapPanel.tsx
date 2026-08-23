// Mayor-only municipal awareness panel for the full-screen map.

import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type GestureResponderHandlers,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { MapReportMarker } from '../../lib/reports';
import type { EvacuationCenterRecord } from '../../lib/resources';
import { formatPublishedAt } from '../../lib/formatTime';
import { mayorMapStyles as styles } from '../../styles/screens/mayorMap.styles';
import { colors } from '../../styles/theme';

type Props = {
  reports: MapReportMarker[];
  centers: EvacuationCenterRecord[];
  loading: boolean;
  error: string | null;
  collapsed: boolean;
  bottomInset: number;
  dragHandlePanHandlers: GestureResponderHandlers;
  onToggleCollapsed: () => void;
  onLocateReport: (report: MapReportMarker) => void;
  onRetry: () => void;
};

function Metric({ color, value, label }: { color: string; value: number; label: string }) {
  return (
    <View style={styles.metric}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function MayorMapPanel({
  reports,
  centers,
  loading,
  error,
  collapsed,
  bottomInset,
  dragHandlePanHandlers,
  onToggleCollapsed,
  onLocateReport,
  onRetry,
}: Props) {
  const attentionReports = reports
    .filter((report) => report.status === 'unverified' || report.status === 'escalated')
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const unverified = reports.filter((report) => report.status === 'unverified').length;
  const escalated = reports.filter((report) => report.status === 'escalated').length;
  const priorityCenters = centers.filter((center) => center.isPriority).length;

  const handle = (
    <View style={styles.handleArea} {...dragHandlePanHandlers}>
      <View style={styles.handle} />
    </View>
  ) as ReactNode;

  return (
    <View style={styles.panel}>
      {handle}
      <TouchableOpacity
        style={styles.header}
        onPress={onToggleCollapsed}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={collapsed ? 'Expand municipal situation panel' : 'Collapse municipal situation panel'}
      >
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{"MAYOR'S MUNICIPAL VIEW"}</Text>
          <Text style={styles.title}>Situation overview</Text>
        </View>
        <View style={styles.attentionBadge}>
          <View style={styles.badgeDot} />
          <Text style={styles.attentionText}>{attentionReports.length} need attention</Text>
        </View>
        <Ionicons name={collapsed ? 'chevron-up' : 'chevron-down'} size={23} color={colors.textMuted} />
      </TouchableOpacity>

      {!collapsed ? (
        <ScrollView
          style={styles.body}
          contentContainerStyle={[styles.bodyContent, { paddingBottom: bottomInset }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.metrics}>
            <Metric color={colors.unverified} value={unverified} label="Unverified" />
            <Metric color={colors.danger} value={escalated} label="Escalated" />
            <Metric color={colors.danger} value={priorityCenters} label="Priority centers" />
          </View>

          {loading ? (
            <View style={styles.state}><ActivityIndicator color={colors.primary} /></View>
          ) : null}
          {!loading && error ? (
            <View style={styles.state}>
              <Text style={styles.stateText}>Map figures could not fully refresh.</Text>
              <TouchableOpacity onPress={onRetry}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
            </View>
          ) : null}
          {!loading && !error && attentionReports.length === 0 ? (
            <View style={styles.state}>
              <Ionicons name="checkmark-circle-outline" size={30} color={colors.success} />
              <Text style={styles.stateTitle}>No reports need a decision</Text>
              <Text style={styles.stateText}>Municipal report pins remain available on the map.</Text>
            </View>
          ) : null}
          {!loading && attentionReports.slice(0, 4).map((report) => (
            <TouchableOpacity
              key={report.id}
              style={styles.reportRow}
              onPress={() => onLocateReport(report)}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel={`Locate ${report.title || 'report'} on map`}
            >
              <View style={[styles.reportAccent, report.status === 'escalated' && styles.reportAccentEscalated]} />
              <View style={styles.reportCopy}>
                <Text style={styles.reportStatus}>{report.status.toUpperCase()}</Text>
                <Text style={styles.reportTitle} numberOfLines={1}>{report.title.trim() || 'Untitled report'}</Text>
                <Text style={styles.reportMeta} numberOfLines={1}>
                  {report.addressText || 'Location on map'} · {formatPublishedAt(report.created_at)}
                </Text>
              </View>
              <View style={styles.locateButton}>
                <Ionicons name="locate-outline" size={21} color={colors.primary} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
