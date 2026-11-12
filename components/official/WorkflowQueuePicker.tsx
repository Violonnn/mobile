import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import type { OfficialWorkflowQueue } from '../../lib/officialReports';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { spacing } from '../../styles/theme';

export const barangayWorkflowQueues: {
  value: OfficialWorkflowQueue;
  label: string;
}[] = [
  { value: 'all', label: 'All reports' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'under_review', label: 'Under review · office' },
  { value: 'mine', label: 'Under review · mine' },
  { value: 'being_assessed', label: 'Being assessed' },
  { value: 'awaiting_mdrrmo', label: 'Awaiting MDRRMO' },
  { value: 'mayor_requests', label: 'Mayor requests' },
];

export const municipalWorkflowQueues: {
  value: OfficialWorkflowQueue;
  label: string;
}[] = [
  { value: 'all', label: 'All reports' },
  { value: 'jurisdiction_check', label: 'Jurisdiction check' },
  { value: 'incoming_requests', label: 'Incoming requests' },
  { value: 'legacy_escalations', label: 'Legacy escalations' },
  { value: 'municipal_review', label: 'Municipal review' },
  { value: 'municipal_lead', label: 'Municipal lead' },
  { value: 'mayor_requests', label: 'Mayor requests' },
];

export default function WorkflowQueuePicker(
  { municipal, selected, onSelect }: {
    municipal: boolean;
    selected: OfficialWorkflowQueue;
    onSelect: (queue: OfficialWorkflowQueue) => void;
  },
) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}
    >
      {(municipal ? municipalWorkflowQueues : barangayWorkflowQueues).map((
        queue,
      ) => (
        <TouchableOpacity
          key={queue.value}
          accessibilityRole='button'
          accessibilityState={{ selected: selected === queue.value }}
          onPress={() => onSelect(queue.value)}
          style={[
            selected === queue.value
              ? styles.primaryAction
              : styles.secondaryAction,
            { paddingHorizontal: spacing.md },
          ]}
        >
          <Text
            style={selected === queue.value
              ? styles.primaryActionText
              : styles.secondaryActionText}
          >
            {queue.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
