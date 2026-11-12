import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { type IncidentCaseDetail, setIncidentPublicLocation, setIncidentSensitive, setReportMediaPublic } from '../../lib/incidentCases';
import { processPublicReportPhoto } from '../../lib/reportPublication';
import { colors, fonts, radius, spacing } from '../../styles/theme';
import { WorkflowButton, WorkflowChoices, WorkflowFeedback, WorkflowNote } from './WorkflowForm';
import IncidentPublicPostEditor from './IncidentPublicPostEditor';
import LegacyIncidentDiscussion from './LegacyIncidentDiscussion';
import IncidentReportPublicationReview from './IncidentReportPublicationReview';
import ScreenablePhotoPreview from './ScreenablePhotoPreview';

export default function IncidentPublicationPanel({ incident, currentReportId, onChanged }: { incident: IncidentCaseDetail; currentReportId?: string; onChanged: () => void }) {
  const [mode, setMode] = useState(incident.publicLocationMode);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  async function save(operation: () => Promise<{ error: string | null }>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await operation();
      if (result.error) { setError(result.error); return; }
      setSuccess('Public visibility updated.');
      setReason('');
      onChanged();
    } catch { setError('Could not save public visibility. Please try again.'); }
    finally { setBusy(false); }
  }
  function changeSensitive() {
    if (!reason.trim()) { setError('Add a reason for changing case sensitivity.'); return; }
    Alert.alert(incident.isSensitive ? 'Remove sensitive status?' : 'Mark this case sensitive?', incident.isSensitive ? 'This allows the lead office to review location and photo publication again. Photos still need individual approval.' : 'Public location becomes barangay-only and approved photos are withdrawn.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => void save(() => setIncidentSensitive({ incidentCaseId: incident.id, isSensitive: !incident.isSensitive, reason: reason.trim() })) },
    ]);
  }
  function saveLocation() {
    if (mode === 'exact_for_safety' && !reason.trim()) { setError('Explain the safety message that requires an exact public location.'); return; }
    const commit = () => void save(() => setIncidentPublicLocation({ incidentCaseId: incident.id, mode, reason: reason.trim() || null }));
    if (mode !== 'exact_for_safety') { commit(); return; }
    Alert.alert('Publish the exact incident location?', `Residents will see the exact operational pin and this safety reason:\n\n${reason.trim()}`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Publish location', onPress: commit }]);
  }
  function togglePhoto(mediaId: string, makePublic: boolean) {
    const photo = incident.media.find((item) => item.id === mediaId);
    if (!photo) {
      setError('This photo is no longer available for review. Reload the incident and try again.');
      return;
    }
    Alert.alert(
      makePublic ? 'Show this photo publicly?' : 'Remove this public photo?',
      makePublic
        ? 'Review the full-size image and confirm it contains no injured faces, children, house numbers, vehicle plates, contact details, private notes, or unnecessary personal information. Only the processed display and thumbnail are published.'
        : 'Other residents will no longer receive this photo in the public incident record.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: makePublic ? 'Screen and publish' : 'Remove photo',
          onPress: () => void savePhotoPublication(photo, makePublic),
        },
      ],
    );
  }

  async function savePhotoPublication(
    photo: IncidentCaseDetail['media'][number],
    makePublic: boolean,
  ) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (makePublic) {
        const processed = await processPublicReportPhoto(photo.reportId, photo.id);
        if (processed.error) {
          setError(processed.error);
          return;
        }
      }
      const result = await setReportMediaPublic({
        mediaId: photo.id,
        makePublic,
        reason: makePublic
          ? 'Official reviewed the full-size photo against the G1 checklist.'
          : 'Official withdrew public photo approval.',
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(makePublic ? 'Safe photo approved for public display.' : 'Public photo approval removed.');
      onChanged();
    } catch {
      setError('Could not update this photo. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return <View style={styles.panel}>
    <Text style={styles.body}>Public records contain the incident category, the screened public post, location area, public updates, and individually approved photos.</Text>
    {incident.verification === 'confirmed' && !incident.withdrawnAt
      ? <IncidentPublicPostEditor key={incident.id} incident={incident} onChanged={onChanged} />
      : null}
    {currentReportId ? (
      <>
        <Text style={styles.heading}>Resident report publication</Text>
        <IncidentReportPublicationReview
          key={currentReportId}
          reportId={currentReportId}
          onChanged={onChanged}
        />
      </>
    ) : (
      <Text style={styles.body}>Open a specific report in this incident to review its public post.</Text>
    )}
    <Text style={styles.heading}>{incident.isSensitive ? 'Sensitive case' : 'Standard public visibility'}</Text>
    <WorkflowNote label='Reason / public safety message' value={reason} onChange={setReason} disabled={busy} />
    <WorkflowButton secondary label={incident.isSensitive ? 'Remove sensitive status' : 'Mark as sensitive'} onPress={changeSensitive} disabled={busy} />
    {incident.isSensitive ? <Text style={styles.body}>Evidence is not published because this case is marked sensitive. The public location is barangay-only.</Text> : <>
      <WorkflowChoices label='Public location' selected={mode} onSelect={setMode} disabled={busy} values={[
        { value: 'approximate_area', label: 'Approximate area' },
        { value: 'barangay_only', label: 'Barangay only' },
        { value: 'exact_for_safety', label: 'Exact location for a safety message' },
      ]} />
      {incident.publicLocationReason && <Text style={styles.body}>Current safety message: {incident.publicLocationReason}</Text>}
      <WorkflowButton label='Save public location' onPress={saveLocation} disabled={busy} />
      <Text style={styles.heading}>Photo publication</Text>
      <Text style={styles.body}>Review each private display image at full size and check it for injured faces, children, house numbers, vehicle plates, contact details, and private notes. Videos remain private.</Text>
      {(incident.media ?? []).filter((media) => media.type === 'photo').map((media) => <View key={media.id} style={styles.photoCard}>
        {media.url ? <ScreenablePhotoPreview uri={media.thumbnailUrl || media.url} fullSizeUri={media.url} contentFit='contain' accessibilityLabel='Open private evidence photo full-size for screening' thumbnailStyle={styles.photo} disabled={busy} /> : <Text accessibilityRole='alert' style={styles.body}>Photo preview is unavailable. Reload this incident before changing its publication.</Text>}
        <View style={styles.toggle}><Text style={styles.heading}>Show publicly</Text><Switch accessibilityRole='switch' accessibilityLabel='Show photo publicly' accessibilityHint='Inspect the full-size photo and confirm it passes the G1 screening checklist before approval.' value={media.isPublic} disabled={busy || (!media.isPublic && (!media.url || incident.verification !== 'confirmed' || Boolean(incident.withdrawnAt) || incident.isSensitive))} onValueChange={(value) => togglePhoto(media.id, value)} /></View>
        {!media.publicDisplaySafe && !media.isPublic && <Text style={styles.body}>A verified safe copy will be prepared after the full-size image passes review.</Text>}
      </View>)}
      {!(incident.media ?? []).some((media) => media.type === 'photo') && <Text style={styles.body}>No photos available for publication.</Text>}
    </>}
    {success && <Text accessibilityLiveRegion='polite' style={styles.body}>{success}</Text>}
    <WorkflowFeedback busy={busy} error={error} />
    {incident.verification === 'confirmed' && !incident.withdrawnAt && <LegacyIncidentDiscussion key={incident.id} incidentCaseId={incident.id} />}
  </View>;
}
const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  heading: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  photoCard: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  photo: { width: '100%', aspectRatio: 4 / 3 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
