import React, { useState } from 'react';
import { Alert } from 'react-native';
import { resolveIncident } from '../../lib/incidentCases';
import ResourceFormSheet from './ResourceFormSheet';
import { WorkflowButton, WorkflowFeedback, WorkflowNote } from './WorkflowForm';

function ResolveIncidentSheetForm(
  { visible, incidentCaseId, onClose, onResolved }: {
    visible: boolean;
    incidentCaseId: string;
    onClose: () => void;
    onResolved: () => void;
  },
) {
  const [note, setNote] = useState('');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy || !note.trim() || !summary.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await resolveIncident({
        incidentCaseId,
        outcomeNote: note,
        publicSummary: summary,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onResolved();
      onClose();
    } catch {
      setError('Could not resolve the incident.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <ResourceFormSheet
      visible={visible}
      title='Resolve incident'
      hasUnsavedChanges={Boolean(note.trim() || summary.trim())}
      discardMessage='Your unfinished outcome notes will not be saved.'
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <WorkflowNote
        label='Internal outcome note (required)'
        value={note}
        onChange={setNote}
        disabled={busy}
      />
      <WorkflowNote
        label='Public outcome summary (required, no personal details)'
        maxLength={280}
        value={summary}
        onChange={setSummary}
        disabled={busy}
      />
      <WorkflowFeedback busy={busy} error={error} />
      <WorkflowButton
        label='Resolve incident'
        disabled={busy || !note.trim() || !summary.trim()}
        onPress={() =>
          Alert.alert(
            'Resolve incident?',
            'The public outcome summary will be shared with reporters.',
            [{ text: 'Cancel', style: 'cancel' }, {
              text: 'Resolve',
              onPress: () => void save(),
            }],
          )}
      />
    </ResourceFormSheet>
  );
}

export default function ResolveIncidentSheet(
  props: React.ComponentProps<typeof ResolveIncidentSheetForm>,
) {
  return props.visible ? <ResolveIncidentSheetForm {...props} /> : null;
}
