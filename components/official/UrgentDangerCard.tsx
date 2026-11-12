import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';
import { fetchOfficialHotlines, type HotlineRecord } from '../../lib/resources';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { reportOperationsStyles as operationStyles } from '../../styles/components/reportOperations.styles';
import { colors } from '../../styles/theme';
import {
  WorkflowActionRow,
  WorkflowButton,
  WorkflowFeedback,
} from './WorkflowForm';

export default function UrgentDangerCard(
  {
    onCallHotline,
    onLogActivity,
    calling = false,
    barangayId,
    hideActivityEntry = false,
  }: {
    onCallHotline: (hotline: HotlineRecord) => void;
    onLogActivity: () => void;
    calling?: boolean;
    hideActivityEntry?: boolean;
    barangayId?: string | null;
  },
) {
  const [open, setOpen] = useState(false);
  const [hotlines, setHotlines] = useState<HotlineRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setBusy(true);
    setError(null);
    try {
      const result = await fetchOfficialHotlines({ barangayId });
      setHotlines(result.hotlines.filter((hotline) => hotline.isActive));
      setError(result.error);
    } catch {
      setError('Could not load hotlines.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={operationStyles.urgentHelp}>
      <TouchableOpacity
        style={operationStyles.urgentHelpTrigger}
        accessibilityRole='button'
        accessibilityLabel='Urgent help: response service hotlines'
        accessibilityState={{ expanded: open, disabled: calling }}
        disabled={calling}
        onPress={() => {
          setOpen(!open);
          if (!open) void load();
        }}
      >
        <View style={operationStyles.urgentHelpMarker} accessible={false}>
          <Ionicons name='call-outline' size={20} color={colors.navigationActive} />
        </View>
        <View style={operationStyles.rowCopy}>
          <Text style={operationStyles.rowTitle}>Urgent help</Text>
          <Text style={operationStyles.caption}>Response service hotlines</Text>
        </View>
      </TouchableOpacity>
      {!hideActivityEntry && (
        <>
          <View style={operationStyles.divider} />
          <WorkflowActionRow
            title='Record activity'
            description='Assistance, dispatch, or other response updates'
            icon='create-outline'
            onPress={onLogActivity}
          />
        </>
      )}
      {open && (
        <View style={operationStyles.section}>
          <Text style={operationStyles.caption}>
            Choose a service to open your phone. Record the outcome after you
            return.
          </Text>
          <WorkflowFeedback busy={busy} error={error} />
          {error && (
            <WorkflowButton
              secondary
              label='Try again'
              onPress={() => void load()}
              disabled={busy}
            />
          )}
          {!busy && !error && hotlines.length === 0 && (
            <Text style={styles.subtitle}>
              No active hotlines are listed for this office.
            </Text>
          )}
          {hotlines.map((hotline) => (
            <WorkflowActionRow
              key={hotline.id}
              title={hotline.name}
              description={hotline.number}
              icon='call-outline'
              disabled={calling}
              onPress={() => {
                setOpen(false);
                onCallHotline(hotline);
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
