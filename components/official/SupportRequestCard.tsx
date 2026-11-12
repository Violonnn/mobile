import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import {
  cancelSupportRequest,
  respondSupportRequest,
  type SupportRequest,
} from '../../lib/incidentCases';
import type { OfficialKind } from '../../lib/officialReports';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { WorkflowButton, WorkflowFeedback, WorkflowNote } from './WorkflowForm';

export default function SupportRequestCard(
  { request, viewerKind, onChanged, canAct = true }: {
    request: SupportRequest;
    canAct?: boolean;
    viewerKind: OfficialKind;
    onChanged: () => void;
  },
) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(decision: 'accept' | 'return' | 'cancel') {
    if (busy) return;
    if (decision === 'return' && !note.trim()) {
      setError('Explain why the request is being returned.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = decision === 'cancel'
        ? await cancelSupportRequest({ requestId: request.id, note })
        : await respondSupportRequest({
          requestId: request.id,
          decision,
          note,
        });
      if (result.error) {
        setError(result.error);
        return;
      }
      onChanged();
    } catch {
      setError('Could not update the request.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>
        {request.kind === 'transfer'
          ? 'Transfer municipal lead'
          : 'MDRRMO support'} · {request.status}
      </Text>
      {request.isLegacy && (
        <Text style={styles.subtitle}>
          {request.legacyLabel ??
            'Legacy escalation — MDRRMO acceptance not recorded'}
        </Text>
      )}
      <Text style={styles.subtitle}>{request.requestNote}</Text>
      {request.responseNote && (
        <Text style={styles.subtitle}>{request.responseNote}</Text>
      )}
      <Text style={styles.subtitle}>
        {request.kind === 'support'
          ? 'Support does not change the lead office.'
          : 'The barangay remains responsible until MDRRMO accepts the transfer.'}
      </Text>
      {canAct && request.status === 'requested' && viewerKind !== 'Mayor' && (
        <>
          <WorkflowNote
            label='Response / cancellation reason'
            value={note}
            onChange={setNote}
            disabled={busy}
          />
          {(viewerKind === 'MDRRMO'
            ? ['accept', 'return'] as const
            : ['cancel'] as const).map((decision) => (
              <WorkflowButton
                key={decision}
                label={decision === 'accept'
                  ? 'Accept request'
                  : decision === 'return'
                  ? 'Return request'
                  : 'Cancel request'}
                disabled={busy}
                onPress={() =>
                  Alert.alert(
                    'Update request?',
                    `${
                      decision === 'accept'
                        ? 'Accept'
                        : decision === 'return'
                        ? 'Return'
                        : 'Cancel'
                    } this ${request.kind} request?`,
                    [{ text: 'Keep request', style: 'cancel' }, {
                      text: 'Continue',
                      onPress: () => void act(decision),
                    }],
                  )}
              />
            ))}
        </>
      )}
      <WorkflowFeedback busy={busy} error={error} />
    </View>
  );
}
