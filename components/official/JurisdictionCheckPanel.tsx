import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { type BarangayOption, fetchBarangays } from '../../lib/barangays';
import {
  rerouteReportBarangay,
  resolveReportJurisdiction,
} from '../../lib/officialReports';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import ResourceFormSheet from './ResourceFormSheet';
import { reportOperationsStyles as operationStyles } from '../../styles/components/reportOperations.styles';
import ReportBarangayPicker from '../report/ReportBarangayPicker';
import {
  WorkflowActionRow,
  WorkflowButton,
  WorkflowFeedback,
  WorkflowNote,
} from './WorkflowForm';

// Routing and jurisdiction share the same barangay selector and required reason.
export function ReportRoutingPanel(
  { reportId, jurisdiction = false, onDone, barangayName }: {
    reportId: string;
    barangayName?: string | null;
    jurisdiction?: boolean;
    onDone: (barangayName?: string) => void;
  },
) {
  const [open, setOpen] = useState(false);
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [barangayId, setBarangayId] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setLoading(true);
    try {
      const result = await fetchBarangays();
      setBarangays(result.barangays);
      setLoadError(result.error);
    } catch {
      setLoadError('Could not load barangays.');
    } finally {
      setLoading(false);
    }
  }
  async function save(outside = false) {
    if (busy) return;
    if (!note.trim() || (!outside && !barangayId)) {
      setError(
        'Choose a barangay and enter a reason. An outside-coverage decision requires a reason only.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = jurisdiction
        ? await resolveReportJurisdiction({
          reportId,
          decision: outside ? 'outside_coverage' : 'in_coverage',
          barangayId: outside ? null : barangayId,
          note,
        })
        : await rerouteReportBarangay({
          reportId,
          targetBarangayId: barangayId!,
          reason: note,
        });
      if (result.error) {
        setError(result.error);
        return;
      }
      setNote('');
      setOpen(false);
      onDone(barangays.find((barangay) => barangay.id === barangayId)?.name);
    } catch {
      setError('Could not update routing. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={operationStyles.section}>
      {jurisdiction
        ? (
          <>
            <Text style={styles.sectionTitle}>Check jurisdiction</Text>
            <Text style={operationStyles.caption}>
              Confirm coverage and the receiving office before review.
            </Text>
            <WorkflowButton
              label='Check coverage'
              onPress={() => setOpen(true)}
            />
          </>
        )
        : (
          <WorkflowActionRow
            title={barangayName
              ? 'Assigned to ' + barangayName
              : 'Assigned response office'}
            description='Wrong barangay? Change routing'
            icon='location-outline'
            onPress={() => setOpen(true)}
          />
        )}
      <ResourceFormSheet
        visible={open}
        title={jurisdiction ? 'Jurisdiction check' : 'Change routing'}
        hasUnsavedChanges={Boolean(note.trim())}
        discardMessage='Your routing changes will not be saved.'
        onClose={() => {
          if (!busy) {
            setOpen(false);
            setNote('');
            setError(null);
          }
        }}
      >
        <Text style={styles.sectionTitle}>
          {jurisdiction ? 'Jurisdiction check' : 'Wrong barangay?'}
        </Text>
        <Text style={styles.subtitle}>
          {jurisdiction
            ? 'Check jurisdiction only. This does not verify the report.'
            : 'Move this report to the correct response office. The reporter will see the routing change.'}
        </Text>
        <WorkflowButton
          label={barangays.find((item) => item.id === barangayId)?.name ??
            'Choose barangay'}
          onPress={() => {
            setPicker(true);
            void load();
          }}
          disabled={busy}
        />
        <WorkflowNote
          label='Reason'
          value={note}
          onChange={setNote}
          disabled={busy}
        />
        <WorkflowFeedback busy={busy} error={error} />
        <WorkflowButton
          label={jurisdiction
            ? 'In coverage — route to barangay'
            : 'Reroute report'}
          disabled={busy}
          onPress={() => void save()}
        />
        {jurisdiction && (
          <WorkflowButton
            label='Outside coverage'
            danger
            disabled={busy}
            onPress={() =>
              Alert.alert(
                'Outside coverage?',
                'The report will be closed with an outside-coverage notice.',
                [{ text: 'Cancel', style: 'cancel' }, {
                  text: 'Confirm',
                  style: 'destructive',
                  onPress: () => void save(true),
                }],
              )}
          />
        )}
        <ReportBarangayPicker
          visible={picker}
          barangays={barangays}
          selectedBarangayId={barangayId}
          loading={loading}
          error={loadError}
          onSelect={setBarangayId}
          onRetry={() => void load()}
          onClose={() => setPicker(false)}
        />
      </ResourceFormSheet>
    </View>
  );
}

export default function JurisdictionCheckPanel(
  { reportId, onDone }: { reportId: string; onDone: () => void },
) {
  return (
    <ReportRoutingPanel
      reportId={reportId}
      jurisdiction
      onDone={onDone}
    />
  );
}
