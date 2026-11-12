import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { type IncidentCaseDetail, PUBLIC_POST_LIMITS, setIncidentPublicPost } from '../../lib/incidentCases';
import { supabase } from '../../lib/supabase';
import { colors, fonts, spacing } from '../../styles/theme';
import { WorkflowButton, WorkflowFeedback, WorkflowNote } from './WorkflowForm';

const SCREENING_CHECKLIST =
  'Confirm the post has no names, phone numbers, house numbers, plate numbers, health details, or accusations. Residents will see it in Community, on Home, and on the map.';

/** The resident form folds the optional landmark into address_text as "Label (landmark)". */
function landmarkFromAddress(addressText: string | null | undefined): string {
  const match = addressText?.trim().match(/\(([^()]+)\)$/);
  return match?.[1]?.trim() ?? '';
}

type Props = { incident: IncidentCaseDetail; onChanged: () => void };

export default function IncidentPublicPostEditor({ incident, onChanged }: Props) {
  const isPublished = Boolean(incident.publicTitle && incident.publicCaption);
  const [title, setTitle] = useState(incident.publicTitle ?? '');
  const [caption, setCaption] = useState(incident.publicCaption ?? '');
  const [landmark, setLandmark] = useState(incident.publicLandmark ?? '');
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Unpublished posts start from the source report so the official only has to screen and trim it.
  useEffect(() => {
    if (isPublished || !incident.sourceReportId) return;
    let active = true;
    void (async () => {
      const { data, error: loadError } = await supabase
        .from('reports')
        .select('title, description, address_text')
        .eq('id', incident.sourceReportId)
        .maybeSingle();
      if (!active || loadError || !data) return;
      setTitle((current) => current || String(data.title ?? '').slice(0, PUBLIC_POST_LIMITS.title));
      setCaption((current) => current || String(data.description ?? '').slice(0, PUBLIC_POST_LIMITS.caption));
      setLandmark((current) => current || landmarkFromAddress(data.address_text).slice(0, PUBLIC_POST_LIMITS.landmark));
      setDraftNotice('Drafted from the resident report. Edit it before publishing; nothing is public yet.');
    })();
    return () => {
      active = false;
    };
  }, [incident.sourceReportId, isPublished]);

  async function save(next: { title: string | null; caption: string | null; landmark: string | null }, message: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await setIncidentPublicPost({ incidentCaseId: incident.id, ...next });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(message);
      setDraftNotice(null);
      onChanged();
    } catch {
      setError('Could not save the public post. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function publish() {
    if (!title.trim() || !caption.trim()) {
      setError('Enter both a public title and a caption.');
      return;
    }
    Alert.alert(isPublished ? 'Update the public post?' : 'Publish this post to residents?', SCREENING_CHECKLIST, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Screened — publish',
        onPress: () => void save(
          { title: title.trim(), caption: caption.trim(), landmark: landmark.trim() || null },
          'Public post saved.',
        ),
      },
    ]);
  }

  function clearPost() {
    Alert.alert('Remove the public post?', 'Residents will see only the incident category, status, and official updates.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove post',
        style: 'destructive',
        onPress: () => void save({ title: null, caption: null, landmark: null }, 'Public post removed.'),
      },
    ]);
  }

  return (
    <View style={styles.editor}>
      <Text style={styles.heading}>Public post</Text>
      <Text style={styles.body}>
        Residents see this as the report post in Community and on Home. The resident who reported stays anonymous.
      </Text>
      {draftNotice ? <Text style={styles.notice}>{draftNotice}</Text> : null}
      <WorkflowNote
        label={`Short title (${title.trim().length}/${PUBLIC_POST_LIMITS.title})`}
        value={title}
        onChange={setTitle}
        multiline={false}
        maxLength={PUBLIC_POST_LIMITS.title}
        disabled={busy}
      />
      <WorkflowNote
        label={`Caption (${caption.trim().length}/${PUBLIC_POST_LIMITS.caption})`}
        value={caption}
        onChange={setCaption}
        maxLength={PUBLIC_POST_LIMITS.caption}
        disabled={busy}
      />
      <WorkflowNote
        label='Nearby landmark (optional)'
        value={landmark}
        onChange={setLandmark}
        multiline={false}
        maxLength={PUBLIC_POST_LIMITS.landmark}
        disabled={busy}
      />
      {incident.isSensitive || incident.publicLocationMode === 'barangay_only' ? (
        <Text style={styles.body}>The landmark stays hidden while the public location is barangay-only or the case is sensitive.</Text>
      ) : null}
      <WorkflowButton label={isPublished ? 'Update public post' : 'Publish public post'} onPress={publish} disabled={busy} />
      {isPublished ? <WorkflowButton secondary label='Remove public post' onPress={clearPost} disabled={busy} /> : null}
      {success ? <Text accessibilityLiveRegion='polite' style={styles.body}>{success}</Text> : null}
      <WorkflowFeedback busy={busy} error={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: spacing.md },
  heading: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  notice: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary },
});
