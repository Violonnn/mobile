import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reportStyles as styles, reportColors } from '../../styles/screens/report.styles';
import type { ReadableAddress } from '../../lib/location';

type Props = {
  title: string;
  onChangeTitle: (v: string) => void;
  description: string;
  onChangeDescription: (v: string) => void;
  locationNote: string;
  onChangeLocationNote: (v: string) => void;
  address: ReadableAddress | null;
  error: string | null;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

export default function DetailsStep({
  title,
  onChangeTitle,
  description,
  onChangeDescription,
  locationNote,
  onChangeLocationNote,
  address,
  error,
  submitting,
  onBack,
  onSubmit,
}: Props) {
  return (
    <View style={styles.stepContent}>
      <View style={styles.stepTitleRow}>
        <Text style={styles.stepTitle}>Report details</Text>
      </View>
      <Text style={styles.stepSubtitle}>
        Tell responders what is happening at this location.
      </Text>

      <View style={styles.gpsRow}>
        <Ionicons name="location-sharp" size={18} color={reportColors.primary} />
        <Text style={styles.gpsText} numberOfLines={1}>
          {address?.label ?? 'Location captured'}
        </Text>
      </View>

      <Text style={styles.label}>
        Specific location <Text style={styles.labelOptional}>(optional)</Text>
      </Text>
      <TextInput
        style={styles.input}
        value={locationNote}
        onChangeText={onChangeLocationNote}
        placeholder="e.g. near the covered court, 2nd floor"
        placeholderTextColor={reportColors.textLight}
        maxLength={160}
        editable={!submitting}
      />

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={onChangeTitle}
        placeholder="What happened?"
        placeholderTextColor={reportColors.textLight}
        maxLength={120}
        editable={!submitting}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={onChangeDescription}
        placeholder="Details of Report"
        placeholderTextColor={reportColors.textLight}
        maxLength={2000}
        multiline
        textAlignVertical="top"
        editable={!submitting}
      />

      {error ? <Text style={[styles.errorText, { marginTop: 8 }]}>{error}</Text> : null}

      <View style={styles.footerRow}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onBack}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
          onPress={onSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Submit report"
        >
          {submitting ? (
            <ActivityIndicator color={reportColors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Submit report</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
