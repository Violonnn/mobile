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
import { useAccessibilityLayout } from '../../hooks/useAccessibilityLayout';
import type { ReadableAddress } from '../../lib/location';
import type { BarangayOption } from '../../lib/barangays';
import {
  INCIDENT_TYPE_OPTIONS,
  type IncidentType,
} from '../../lib/incidentTypes';

type Props = {
  title: string;
  onChangeTitle: (v: string) => void;
  description: string;
  onChangeDescription: (v: string) => void;
  locationNote: string;
  onChangeLocationNote: (v: string) => void;
  incidentType: IncidentType | null;
  onChangeIncidentType: (value: IncidentType) => void;
  incidentTypeOther: string;
  onChangeIncidentTypeOther: (value: string) => void;
  address: ReadableAddress | null;
  barangays: BarangayOption[];
  barangaysLoading: boolean;
  barangaysError: string | null;
  selectedBarangayId: string | null;
  onSelectBarangay: (id: string) => void;
  /** Officials with a barangay assignment cannot change the report scope. */
  barangaySelectionLocked?: boolean;
  barangayLockMessage?: string;
  onRetryBarangays: () => void;
  locationConfirmed: boolean;
  error: string | null;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  residentLayout?: boolean;
};

export default function DetailsStep({
  title,
  onChangeTitle,
  description,
  onChangeDescription,
  locationNote,
  onChangeLocationNote,
  incidentType,
  onChangeIncidentType,
  incidentTypeOther,
  onChangeIncidentTypeOther,
  address,
  barangays,
  barangaysLoading,
  barangaysError,
  selectedBarangayId,
  onSelectBarangay,
  barangaySelectionLocked = false,
  barangayLockMessage,
  onRetryBarangays,
  locationConfirmed,
  error,
  submitting,
  onBack,
  onSubmit,
  submitLabel = 'Review report',
  residentLayout = false,
}: Props) {
  const { isLargeText } = useAccessibilityLayout();

  if (residentLayout) {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.residentStepTitle}>Tell responders what{`\n`}happened</Text>
        <Text style={styles.residentStepSubtitle}>
          Short, clear details are easier to act on.
        </Text>

        <Text style={styles.residentFieldLabel}>Incident type</Text>
        <View
          style={[
            styles.residentIncidentTypeGrid,
            isLargeText && styles.residentIncidentTypeGridLargeText,
          ]}
        >
          {INCIDENT_TYPE_OPTIONS.map((option) => {
            const selected = incidentType === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.residentIncidentTypeOption,
                  selected && styles.residentIncidentTypeOptionSelected,
                  isLargeText && styles.residentIncidentTypeOptionLargeText,
                ]}
                onPress={() => onChangeIncidentType(option.value)}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: submitting }}
                accessibilityLabel={`Incident type ${option.label}`}
              >
                <Ionicons
                  name={option.icon}
                  size={21}
                  color={selected ? reportColors.white : reportColors.primary}
                />
                <Text
                  style={[
                    styles.residentIncidentTypeText,
                    selected && styles.residentIncidentTypeTextSelected,
                    isLargeText && styles.residentIncidentTypeTextLargeText,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {incidentType === 'other' ? (
          <>
            <Text style={styles.residentFieldLabel}>Specify incident type</Text>
            <TextInput
              style={styles.residentInput}
              value={incidentTypeOther}
              onChangeText={onChangeIncidentTypeOther}
              placeholder="e.g. fallen electrical post"
              placeholderTextColor={reportColors.textLight}
              maxLength={80}
              editable={!submitting}
            />
          </>
        ) : null}

        <Text style={styles.residentFieldLabel}>Short title</Text>
        <TextInput
          style={styles.residentInput}
          value={title}
          onChangeText={onChangeTitle}
          placeholder="What happened?"
          placeholderTextColor={reportColors.textLight}
          maxLength={120}
          editable={!submitting}
        />

        <Text style={styles.residentFieldLabel}>Description</Text>
        <TextInput
          style={[styles.residentInput, styles.residentTextArea]}
          value={description}
          onChangeText={onChangeDescription}
          placeholder="Describe what responders should know"
          placeholderTextColor={reportColors.textLight}
          maxLength={2000}
          multiline
          textAlignVertical="top"
          editable={!submitting}
        />

        <Text style={styles.residentFieldLabel}>
          Nearby landmark <Text style={styles.residentOptionalText}>· optional</Text>
        </Text>
        <TextInput
          style={styles.residentInput}
          value={locationNote}
          onChangeText={onChangeLocationNote}
          placeholder="e.g. Shell Mobility, National Highway"
          placeholderTextColor={reportColors.textLight}
          maxLength={160}
          editable={!submitting}
        />

        {!selectedBarangayId || barangaysLoading || barangaysError ? (
          <View style={styles.residentBarangayState}>
            {barangaysLoading ? (
              <ActivityIndicator size="small" color={reportColors.primary} />
            ) : (
              <Ionicons name="alert-circle-outline" size={18} color={reportColors.accent} />
            )}
            <Text style={styles.residentBarangayStateText}>
              {barangaysLoading
                ? 'Confirming the response area…'
                : barangaysError ?? 'A response area could not be confirmed.'}
            </Text>
            {!barangaysLoading ? (
              <TouchableOpacity onPress={onRetryBarangays} accessibilityRole="button">
                <Text style={styles.residentRetryText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            styles.residentPrimaryButton,
            submitting && styles.primaryButtonDisabled,
          ]}
          onPress={onSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
        >
          {submitting ? (
            <ActivityIndicator color={reportColors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>{submitLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.stepContent}>
      <View style={styles.stepTitleRow}>
        <Text style={styles.stepTitle}>Report details</Text>
      </View>
      <Text style={styles.stepSubtitle}>
        Tell responders what is happening at this location.
      </Text>

      <Text style={styles.label}>Incident type</Text>
      <View style={styles.incidentTypeGrid}>
        {INCIDENT_TYPE_OPTIONS.map((option) => {
          const selected = incidentType === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.incidentTypeOption,
                selected && styles.incidentTypeOptionSelected,
              ]}
              onPress={() => onChangeIncidentType(option.value)}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: submitting }}
              accessibilityLabel={`Incident type ${option.label}`}
            >
              <Ionicons
                name={option.icon}
                size={22}
                color={selected ? reportColors.white : reportColors.primary}
              />
              <Text
                style={[
                  styles.incidentTypeOptionText,
                  selected && styles.incidentTypeOptionTextSelected,
                ]}
                numberOfLines={2}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {incidentType === 'other' ? (
        <>
          <Text style={styles.label}>Specify incident type</Text>
          <TextInput
            style={styles.input}
            value={incidentTypeOther}
            onChangeText={onChangeIncidentTypeOther}
            placeholder="e.g. fallen electrical post"
            placeholderTextColor={reportColors.textLight}
            maxLength={80}
            editable={!submitting}
          />
        </>
      ) : null}

      <View style={styles.gpsRow}>
        <Ionicons name="location-sharp" size={18} color={reportColors.primary} />
        <Text style={styles.gpsText} numberOfLines={1}>
          {address?.label ?? 'Location captured'}
        </Text>
      </View>

      {locationConfirmed ? (
        <Text style={styles.pinConfirmedText}>
          Location pin confirmed on map
        </Text>
      ) : null}

      <Text style={styles.label}>Barangay</Text>
      {barangaySelectionLocked && barangayLockMessage ? (
        <Text style={styles.barangayHelperText}>{barangayLockMessage}</Text>
      ) : null}
      {barangaysLoading ? (
        <View style={styles.barangayLoadingRow}>
          <ActivityIndicator color={reportColors.primary} />
          <Text style={styles.barangayHelperText}>Loading barangays…</Text>
        </View>
      ) : barangaysError ? (
        <View style={styles.barangayErrorBlock}>
          <Text style={styles.errorText}>{barangaysError}</Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onRetryBarangays}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Retry loading barangays"
          >
            <Text style={styles.secondaryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.barangaySelectBox}>
          {barangays.map((barangay) => {
            const selected = selectedBarangayId === barangay.id;
            return (
              <TouchableOpacity
                key={barangay.id}
                style={[
                  styles.barangayOption,
                  selected && styles.barangayOptionSelected,
                ]}
                onPress={() => onSelectBarangay(barangay.id)}
                disabled={submitting || barangaySelectionLocked}
                activeOpacity={barangaySelectionLocked ? 1 : 0.8}
                accessibilityRole="button"
                accessibilityState={{
                  selected,
                  disabled: submitting || barangaySelectionLocked,
                }}
                accessibilityLabel={
                  barangaySelectionLocked
                    ? `${barangay.name}, assigned barangay`
                    : barangay.name
                }
              >
                <Text
                  style={[
                    styles.barangayOptionText,
                    selected && styles.barangayOptionTextSelected,
                  ]}
                >
                  {barangay.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

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

      <Text style={styles.privacyNotice}>
        Your registered contact number may be accessed only by authorized
        BDRRMO/MDRRMO personnel handling this incident, solely for verification
        and coordination. It is not public, not shown in feeds/maps/exports, and
        not available to the Mayor&apos;s read-only incident view.
      </Text>

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
          accessibilityLabel={submitLabel}
        >
          {submitting ? (
            <ActivityIndicator color={reportColors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>{submitLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
