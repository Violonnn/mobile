import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { fetchLegacyIncidentComments, publishLegacyIncidentComment, type LegacyIncidentComment } from '../../lib/incidentCases';
import { colors, fonts, radius, spacing } from '../../styles/theme';
import { WorkflowButton, WorkflowFeedback } from './WorkflowForm';

/** Private source comments need individual screening before joining public discussion. */
export default function LegacyIncidentDiscussion({ incidentCaseId }: { incidentCaseId: string }) {
  const [comments, setComments] = useState<LegacyIncidentComment[]>([]);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  async function load() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await fetchLegacyIncidentComments(incidentCaseId, comments.length);
      if (result.error) { setError(result.error); return; }
      setOpened(true);
      setHasMore(result.comments.length === 20);
      setComments((current) => [...current, ...result.comments]);
    } finally { setBusy(false); }
  }
  async function publish(commentId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await publishLegacyIncidentComment(commentId);
      if (result.error) { setError(result.error); return; }
      setComments((current) => current.map((comment) => comment.id === commentId ? { ...comment, alreadyPublic: true } : comment));
    } finally { setBusy(false); }
  }
  function screen(comment: LegacyIncidentComment) {
    Alert.alert('Add this comment to public discussion?', 'Confirm that the body has no private report details, exact addresses, contact information, reporter identity, or identifying evidence. The existing author name is shown in the incident discussion.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Screened — add comment', onPress: () => void publish(comment.id) },
    ]);
  }
  return <View style={styles.section}>
    <Text style={styles.heading}>Earlier source discussion</Text>
    <Text style={styles.body}>Source comments stay private. Review each eligible top-level comment before adding it to the shared incident discussion.</Text>
    {!opened ? <WorkflowButton secondary label='Review earlier comments' disabled={busy} onPress={() => void load()} /> : <>
      {comments.length === 0 && <Text style={styles.body}>No earlier top-level comments to review.</Text>}
      {comments.map((comment) => <View key={comment.id} style={styles.comment}>
        <Text style={styles.body}>{comment.body}</Text>
        <WorkflowButton secondary label={comment.alreadyPublic ? 'Added to public discussion' : 'Screen for public discussion'} disabled={busy || comment.alreadyPublic} onPress={() => screen(comment)} />
      </View>)}
      {hasMore && <WorkflowButton secondary label='Load more comments' disabled={busy} onPress={() => void load()} />}
    </>}
    <WorkflowFeedback busy={busy} error={error} />
    {error && <WorkflowButton secondary label='Retry comments' disabled={busy} onPress={() => void load()} />}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: spacing.md }, heading: { fontFamily: fonts.semibold, color: colors.text, fontSize: 15 },
  body: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 14 },
  comment: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
});
