import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { officialStyles as styles } from '../../styles/screens/official.styles';
import { reportOperationsStyles as operationStyles } from '../../styles/components/reportOperations.styles';
import { colors, radius, spacing } from '../../styles/theme';
import { formatOperationTimestamp } from '../../lib/formatTime';
import { responseServiceLabel } from '../../lib/reportContactFlow';

type ChoiceAppearance = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tint: string;
};

// Operational cues use app colors, not agency logos or official brand colors.
const choiceAppearances: Record<string, ChoiceAppearance> = {
  local: { icon: 'home-outline', tint: colors.navigationActive },
  support: { icon: 'people-outline', tint: colors.primary },
  transfer: { icon: 'swap-horizontal-outline', tint: colors.purple },
  bfp: { icon: 'flame-outline', tint: colors.danger },
  pnp: { icon: 'shield-checkmark-outline', tint: colors.primary },
  rhu_ambulance: { icon: 'medkit-outline', tint: colors.success },
  mdrrmo_rescue: { icon: 'boat-outline', tint: colors.purple },
  bdrrmo_team: { icon: 'people-outline', tint: colors.navigationActive },
  other: { icon: 'construct-outline', tint: colors.textMuted },
  reached: { icon: 'call-outline', tint: colors.primary },
  no_answer: { icon: 'time-outline', tint: colors.escalated },
  call_failed: { icon: 'close-circle-outline', tint: colors.unverified },
  callback: { icon: 'call-outline', tint: colors.primary },
  radio: { icon: 'radio-outline', tint: colors.purple },
  in_person: { icon: 'person-outline', tint: colors.navigationActive },
  written_message: { icon: 'chatbubble-outline', tint: colors.primary },
  verify: { icon: 'checkmark-circle-outline', tint: colors.primary },
  confirm: { icon: 'checkmark-circle-outline', tint: colors.primary },
  confirmed: { icon: 'checkmark-circle-outline', tint: colors.primary },
  assess: { icon: 'search-outline', tint: colors.escalated },
  needs_assessment: { icon: 'search-outline', tint: colors.escalated },
  could_not_confirm: { icon: 'help-circle-outline', tint: colors.textMuted },
  reject: { icon: 'close-circle-outline', tint: colors.unverified },
};

export function WorkflowButton(
  { label, onPress, disabled = false, danger = false, secondary = false }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    danger?: boolean;
    secondary?: boolean;
  },
) {
  return (
    <TouchableOpacity
      accessibilityRole='button'
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        danger
          ? styles.dangerAction
          : secondary
          ? styles.secondaryAction
          : styles.primaryAction,
        disabled && styles.actionDisabled,
      ]}
    >
      <Text
        style={danger
          ? styles.dangerActionText
          : secondary
          ? styles.secondaryActionText
          : styles.primaryActionText}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function WorkflowNote(
  {
    label,
    value,
    onChange,
    disabled = false,
    maxLength = 500,
    multiline = true,
    scrollEnabled = true,
    invalid = false,
    error,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    maxLength?: number;
    multiline?: boolean;
    scrollEnabled?: boolean;
    invalid?: boolean;
    error?: string;
  },
) {
  return (
    <View>
      <Text style={styles.subtitle}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[
          styles.noteInput,
          !multiline && operationStyles.singleLineInput,
          (invalid || Boolean(error)) && operationStyles.invalidField,
        ]}
        accessibilityHint={error}
        multiline={multiline}
        scrollEnabled={scrollEnabled}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        maxLength={maxLength}
      />
      {error && (
        <Text style={operationStyles.fieldError} accessibilityRole='alert'>
          {error}
        </Text>
      )}
    </View>
  );
}

export function WorkflowChoices<T extends string>(
  {
    label,
    values,
    selected,
    onSelect,
    disabled = false,
    compact = false,
    error,
  }: {
    label: string;
    values: {
      value: T;
      label: string;
      icon?: React.ComponentProps<typeof Ionicons>['name'];
      tint?: string;
    }[];
    selected: T | null;
    onSelect: (value: T) => void;
    disabled?: boolean;
    compact?: boolean;
    error?: string;
  },
) {
  const displayedOptions = values.map((option) => ({
    ...choiceAppearances[option.value],
    ...option,
  }));
  return (
    <View style={styles.actionColumn}>
      <Text style={styles.subtitle}>{label}</Text>
      <View style={compact ? operationStyles.chips : styles.actionColumn}>
        {displayedOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            accessibilityRole='radio'
            accessibilityLabel={option.label}
            accessibilityState={{
              selected: selected === option.value,
              checked: selected === option.value,
              disabled,
            }}
            disabled={disabled}
            onPress={() => onSelect(option.value)}
            style={[
              compact
                ? [
                  operationStyles.chip,
                  selected === option.value && operationStyles.chipSelected,
                ]
                : selected === option.value
                ? styles.primaryAction
                : styles.secondaryAction,
              operationStyles.choiceContent,
              selected === option.value && option.tint &&
              { borderColor: option.tint },
              Boolean(error) && operationStyles.invalidField,
            ]}
          >
            {option.icon && (
              <Ionicons
                name={option.icon}
                size={18}
                color={!compact && selected === option.value
                  ? colors.white
                  : option.tint ?? colors.navigationActive}
              />
            )}
            <Text
              style={compact
                ? [
                  operationStyles.chipText,
                  selected === option.value && operationStyles.chipTextSelected,
                ]
                : selected === option.value
                ? styles.primaryActionText
                : styles.secondaryActionText}
            >
              {option.label}
            </Text>
            {selected === option.value && (
              <Ionicons
                name='checkmark-circle'
                size={17}
                color={compact ? colors.navigationActive : colors.white}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>
      {error && (
        <Text style={operationStyles.fieldError} accessibilityRole='alert'>
          {error}
        </Text>
      )}
    </View>
  );
}

export function WorkflowActionRow(
  {
    title,
    description,
    icon,
    onPress,
    disabled = false,
    tint = colors.navigationActive,
    error,
    showChevron = true,
  }: {
    title: string;
    description?: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    tint?: string;
    error?: string;
    onPress: () => void;
    disabled?: boolean;
    showChevron?: boolean;
  },
) {
  return (
    <TouchableOpacity
      style={[
        operationStyles.row,
        disabled && styles.actionDisabled,
        Boolean(error) && operationStyles.invalidField,
        Boolean(error) &&
        { borderRadius: radius.md, paddingHorizontal: spacing.sm },
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole='button'
      accessibilityState={{ disabled }}
    >
      <Ionicons name={icon} size={21} color={tint} />
      <View style={operationStyles.rowCopy}>
        <Text style={operationStyles.rowTitle}>{title}</Text>
        {description && (
          <Text style={operationStyles.caption}>{description}</Text>
        )}
        {error && (
          <Text style={operationStyles.fieldError} accessibilityRole='alert'>
            {error}
          </Text>
        )}
      </View>
      {showChevron && (
        <Ionicons name='chevron-forward' size={18} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

export function WorkflowSuccess(
  { message, onDismiss }: { message: string | null; onDismiss?: () => void },
) {
  if (!message) return null;
  return (
    <View
      style={[operationStyles.banner, onDismiss && { paddingRight: 0 }]}
      accessibilityLiveRegion='polite'
    >
      <Ionicons name='checkmark-circle' size={21} color={colors.success} />
      <Text style={operationStyles.bannerText}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity
          style={operationStyles.toastClose}
          onPress={onDismiss}
          accessibilityRole='button'
          accessibilityLabel='Dismiss confirmation'
        >
          <Ionicons name='close' size={20} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export function WorkflowFeedback(
  { busy, error }: { busy: boolean; error: string | null },
) {
  return (
    <>
      {busy && <ActivityIndicator accessibilityLabel='Saving' />}
      {error && (
        <Text accessibilityRole='alert' style={operationStyles.fieldError}>
          {error}
        </Text>
      )}
    </>
  );
}

/** Only descriptive event fields belong in the timeline; database IDs do not. */
export function WorkflowEventDetails(
  { details, compact = false }: {
    details: Record<string, unknown>;
    compact?: boolean;
  },
) {
  const labels: Record<string, string> = {
    service: 'Service',
    service_other: 'Other service',
    service_name: 'Office / team',
    municipality: 'Municipality / city',
    outcome: 'Outcome',
    requested: 'Assistance requested',
    confirmed_by: 'Confirmed by',
    method: 'Confirmation method',
    action: 'Action',
    source: 'Source',
    text: 'Update',
    reference: 'Reference',
    decision: 'Decision',
    reason_code: 'Reason',
    public_summary: 'Outcome summary',
    public_correction: 'Public correction',
    event_type: 'Activity',
  };
  const nestedDetails = details.details;
  const fields = nestedDetails && typeof nestedDetails === 'object' &&
      !Array.isArray(nestedDetails)
    ? { ...details, ...nestedDetails as Record<string, unknown> }
    : details;
  return (
    <>
      {Object.entries(fields).map(([field, value]) => {
        if (
          field === 'service_other' && value === fields.service_name
        ) return null;
        if (
          !labels[field] ||
          (typeof value !== 'string' && typeof value !== 'number')
        ) return null;
        const displayedValue = [
            'service',
            'outcome',
            'method',
            'decision',
            'reason_code',
            'event_type',
          ].includes(field)
          ? String(value).replace(/_/g, ' ')
          : String(value);
        return (
          <Text
            key={field}
            style={compact
              ? operationStyles.historyDetail
              : styles.timelineNote}
          >
            <Text style={compact && operationStyles.historyDetailLabel}>
              {labels[field]}:
            </Text>{' '}
            {displayedValue}
          </Text>
        );
      })}
      {Array.isArray(fields.services) && (
        <View style={operationStyles.historyDetails}>
          <Text style={operationStyles.historyDetail}>
            <Text style={operationStyles.historyDetailLabel}>
              {fields.services.length} services
            </Text>
          </Text>
          {fields.services.map((entry, index) => {
            if (
              !entry || typeof entry !== 'object' || Array.isArray(entry) ||
              !entry.details || typeof entry.details !== 'object' ||
              Array.isArray(entry.details)
            ) {
              return null;
            }
            const serviceDetails = entry.details as Record<string, unknown>;
            const visibleDetails = Object.fromEntries(
              Object.entries(serviceDetails)
                .filter(([field, value]) =>
                  !['service', 'service_name', 'municipality'].includes(field) &&
                  !(field === 'service_other' && value === serviceDetails.service_name)
                ),
            );
            return (
              <View key={index} style={operationStyles.groupedService}>
                <Text
                  style={[
                    operationStyles.historyDetail,
                    operationStyles.historyDetailLabel,
                  ]}
                >
                  {responseServiceLabel(serviceDetails)}
                </Text>
                <WorkflowEventDetails
                  details={visibleDetails}
                  compact={compact}
                />
                {typeof entry.note === 'string' && entry.note && (
                  <Text style={operationStyles.historyNote}>{entry.note}</Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

export function WorkflowHistoryRow(
  {
    title,
    timestamp,
    actorName,
    officeLabel,
    details,
    note,
    publicText,
    eventType,
  }: {
    eventType?: string;
    title: string;
    timestamp: string | null;
    actorName?: string | null;
    officeLabel?: string | null;
    details?: Record<string, unknown>;
    note?: string | null;
    publicText?: string | null;
  },
) {
  // Activity icons describe what was recorded, not whether it was successful.
  const eventIcons: Record<
    string,
    React.ComponentProps<typeof Ionicons>['name']
  > = {
    review_claimed: 'clipboard-outline',
    review_taken_over: 'clipboard-outline',
    review_decided: 'document-text-outline',
    reporter_call: 'call-outline',
    hotline_contacted: 'call-outline',
    contact_logged: 'chatbubbles-outline',
    dispatch_confirmed: 'navigate-outline',
    responders_on_site: 'location-outline',
    assistance_given: 'people-outline',
    work_done: 'construct-outline',
    progress_update: 'chatbubble-outline',
    finding_recorded: 'search-outline',
    transfer_requested: 'swap-horizontal-outline',
    transfer_accepted: 'swap-horizontal-outline',
    routing_changed: 'git-branch-outline',
    location_change: 'location-outline',
    barangay_change: 'location-outline',
    jurisdiction_checked: 'map-outline',
    resolved: 'archive-outline',
    closed: 'archive-outline',
    reopened: 'refresh-outline',
  };
  const coordinationEvents = [
    'transfer_requested',
    'transfer_accepted',
    'routing_changed',
  ];
  const responseEvents = [
    'dispatch_confirmed',
    'responders_on_site',
    'assistance_given',
    'work_done',
  ];
  const isCoordination = coordinationEvents.includes(eventType ?? '');
  const isResponse = responseEvents.includes(eventType ?? '');
  const markerStyle = isCoordination
    ? operationStyles.historyCoordinationMarker
    : isResponse
    ? operationStyles.historyResponseMarker
    : undefined;
  const iconColor = isCoordination
    ? colors.purple
    : isResponse
    ? colors.escalated
    : colors.navigationActive;
  return (
    <View style={operationStyles.historyRow}>
      <View style={operationStyles.historyHeading}>
        <View
          style={[operationStyles.historyMarker, markerStyle]}
          accessible={false}
        >
          <Ionicons
            name={eventIcons[eventType ?? ''] ?? 'time-outline'}
            size={18}
            color={iconColor}
          />
        </View>
        <Text style={operationStyles.historyTitle}>
          {title.charAt(0).toUpperCase() + title.slice(1)}
        </Text>
      </View>
      <View style={operationStyles.historyMetadata}>
        <Ionicons
          name='person-outline'
          size={14}
          color={colors.textMuted}
          accessible={false}
        />
        <Text style={operationStyles.historyMetaText}>
          {actorName ?? 'System'}
          {officeLabel ? ' · ' + officeLabel : ''}
        </Text>
      </View>
      <View style={operationStyles.historyMetadata}>
        <Ionicons
          name='time-outline'
          size={14}
          color={colors.textMuted}
          accessible={false}
        />
        <Text style={operationStyles.historyMetaText}>
          {formatOperationTimestamp(timestamp)}
        </Text>
      </View>
      {details && (
        <View style={operationStyles.historyDetails}>
          <WorkflowEventDetails details={details} compact />
        </View>
      )}
      {publicText && (
        <Text style={operationStyles.historyNote}>{publicText}</Text>
      )}
      {note && note !== publicText && (
        <Text style={operationStyles.historyNote}>{note}</Text>
      )}
    </View>
  );
}
