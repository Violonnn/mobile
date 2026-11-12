import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { postProgressUpdate } from '../../lib/incidentCases';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { WorkflowButton, WorkflowFeedback, WorkflowNote } from './WorkflowForm';

export default function ProgressUpdateComposer(
  { incidentCaseId, disabledReason, onPosted }: {
    incidentCaseId: string;
    disabledReason: string | null;
    onPosted: () => void;
  },
) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function post() {
    if (!text.trim() || busy || disabledReason) return;
    setBusy(true);
    setError(null);
    try {
      const result = await postProgressUpdate({ incidentCaseId, text });
      if (result.error) {
        setError(
          result.retryAfterMinutes != null
            ? `${result.error} Try again in ${result.retryAfterMinutes} minutes.`
            : result.error,
        );
        return;
      }
      setText('');
      onPosted();
    } catch {
      setError('Could not post the update.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.actionColumn}>
      <Text style={styles.subtitle}>
        Share a brief factual update.
      </Text>
      {disabledReason && <Text style={styles.subtitle}>{disabledReason}</Text>}
      <WorkflowNote
        label='Update (280 characters)'
        value={text}
        onChange={setText}
        maxLength={280}
        disabled={busy || !!disabledReason}
      />
      <WorkflowFeedback busy={busy} error={error} />
      <WorkflowButton
        label='Post update'
        onPress={() => void post()}
        disabled={busy || !!disabledReason || !text.trim()}
      />
    </View>
  );
}
