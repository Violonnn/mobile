import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import type { OfficialStatusCounts, ReportStatus } from '../../lib/officialReports';
import { mdrrmoCommandStyles as styles } from '../../styles/screens/mdrrmoCommand.styles';

const STEPS: { status: ReportStatus; label: string; color: string }[] = [
  { status: 'unverified', label: 'Unverified', color: '#D92D20' },
  { status: 'verified', label: 'Verified', color: '#169B55' },
  { status: 'escalated', label: 'Escalated', color: '#F04424' },
  { status: 'resolved', label: 'Resolved', color: '#64748B' },
];

export default function CommandPipeline({ counts }: { counts: OfficialStatusCounts }) {
  const router = useRouter();

  return (
    <View style={styles.section}>
      <View style={styles.pipelineRow}>
        {STEPS.map((step, index) => (
          <React.Fragment key={step.status}>
            <TouchableOpacity
              style={styles.pipelineStep}
              onPress={() => router.push(`/official/incidents?status=${step.status}` as Href)}
              accessibilityRole="button"
              accessibilityLabel={`View ${step.label.toLowerCase()} reports`}
            >
              <Text style={[styles.pipelineValue, { color: step.color }]}>{counts[step.status]}</Text>
              <Text style={styles.pipelineLabel}>{step.label}</Text>
            </TouchableOpacity>
            {index < STEPS.length - 1 ? (
              <View style={styles.pipelineArrow}>
                <Ionicons name="chevron-forward" size={18} color="#62708A" />
              </View>
            ) : null}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}
