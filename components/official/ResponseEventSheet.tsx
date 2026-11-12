import React, { useRef, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  logReportContact,
  type ResponseEventType,
} from '../../lib/officialReports';
import { logIncidentEvent } from '../../lib/incidentCases';
import {
  createActivitySubmissionId,
  type ReportActivityResult,
  type ResponseEventDetails,
  type ResponseServiceEntry,
  responseServiceIdentity,
  responseServiceLabel as serviceLabel,
} from '../../lib/reportContactFlow';
import { reportOperationsStyles as operationStyles } from '../../styles/components/reportOperations.styles';
import { colors } from '../../styles/theme';
import ResourceFormSheet from './ResourceFormSheet';
import {
  WorkflowActionRow,
  WorkflowButton,
  WorkflowChoices,
  WorkflowFeedback,
  WorkflowNote,
} from './WorkflowForm';

const eventLabels: Record<ResponseEventType, string> = {
  reporter_call: 'Reporter call',
  hotline_contacted: 'Hotline contacted',
  assistance_requested: 'Assistance requested',
  dispatch_confirmed: 'Dispatch confirmed',
  responders_on_site: 'Responders on site',
  assistance_given: 'Assistance given',
  work_done: 'Work done',
  external_info: 'External information',
  internal_note: 'Internal note',
};
const eventAppearance: Record<ResponseEventType, {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tint: string;
}> = {
  reporter_call: { icon: 'call-outline', tint: colors.primary },
  hotline_contacted: { icon: 'headset-outline', tint: colors.primary },
  assistance_requested: { icon: 'hand-left-outline', tint: colors.purple },
  dispatch_confirmed: { icon: 'car-outline', tint: colors.danger },
  responders_on_site: { icon: 'location-outline', tint: colors.primary },
  assistance_given: { icon: 'medkit-outline', tint: colors.success },
  work_done: { icon: 'checkmark-done-outline', tint: colors.success },
  external_info: { icon: 'information-circle-outline', tint: colors.purple },
  internal_note: { icon: 'create-outline', tint: colors.textMuted },
};
const activityGroups = [
  {
    value: 'contact',
    label: 'Contact & requests',
    icon: 'call-outline' as const,
    types: ['reporter_call', 'hotline_contacted', 'assistance_requested'],
  },
  {
    value: 'response',
    label: 'Response actions',
    icon: 'people-outline' as const,
    types: [
      'dispatch_confirmed',
      'responders_on_site',
      'assistance_given',
      'work_done',
    ],
  },
  {
    value: 'notes',
    label: 'Notes & information',
    icon: 'document-text-outline' as const,
    types: ['external_info', 'internal_note'],
  },
];

function activityGroupFor(eventType: ResponseEventType | null): string | null {
  return activityGroups.find((group) =>
    eventType && group.types.includes(eventType)
  )?.value ?? null;
}
const fields: Record<ResponseEventType, string[]> = {
  reporter_call: ['outcome'],
  hotline_contacted: ['service', 'outcome'],
  assistance_requested: ['service', 'requested'],
  dispatch_confirmed: ['service', 'confirmed_by', 'method'],
  responders_on_site: ['service'],
  assistance_given: ['action'],
  work_done: ['action'],
  external_info: ['source'],
  internal_note: ['text'],
};
const fieldLabels: Record<string, string> = {
  requested: 'Assistance requested',
  confirmed_by: 'Who confirmed dispatch?',
  action: 'Action completed',
  source: 'Information source',
  text: 'Internal note',
  service_other: 'Other service name',
};

type ServiceActivity = {
  id: number;
  details: Record<string, string>;
  note: string;
};

type ServiceEdit = {
  id: number;
  previousDetails: Record<string, string>;
  previousNote: string;
  previousNoteOpen: boolean;
  previousChoosingService: boolean;
  previousUnitNameOpen: boolean;
};

function activityFieldErrors(
  eventType: ResponseEventType,
  details: Record<string, string>,
  note: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of fields[eventType]) {
    if (!details[key]?.trim()) {
      errors[key] = key === 'service'
        ? 'Choose a service.'
        : key === 'method'
        ? 'Choose how dispatch was confirmed.'
        : key === 'outcome'
        ? 'Choose the call outcome.'
        : 'Enter this detail.';
    }
  }
  if (details.service === 'other' && !details.service_other?.trim()) {
    errors.service_other = 'Name the service.';
  }
  // Match the server's privacy rule before submission so the offending field
  // can be marked, rather than leaving a phone-number rejection unexplained.
  const phonePattern = /[+]?[0-9][0-9 ()-]{6,}[0-9]/;
  for (const [key, value] of Object.entries({ ...details, note })) {
    if (phonePattern.test(value)) {
      errors[key] = 'Remove phone numbers from this field.';
    }
  }
  return errors;
}

function serviceSummary(activity: ServiceActivity): string {
  return [
    activity.details.confirmed_by
      ? 'Confirmed by ' + activity.details.confirmed_by
      : null,
    activity.details.method?.replace(/_/g, ' '),
    activity.details.outcome?.replace(/_/g, ' '),
    activity.details.requested,
  ].filter(Boolean).join(' · ');
}

function ResponseEventSheetForm({
  visible,
  target,
  initialType = null,
  initialDetails = {},
  onClose,
  onLogged,
  saveActivity,
}: {
  visible: boolean;
  target: { reportId: string } | { incidentCaseId: string };
  initialType?: ResponseEventType | null;
  initialDetails?: Record<string, string>;
  onClose: () => void;
  saveActivity?: (
    input: {
      eventType: ResponseEventType;
      details: ResponseEventDetails;
      note: string;
    },
  ) => Promise<{ error: string | null }>;
  onLogged: (result: ReportActivityResult) => void;
}) {
  const saving = useRef(false);
  const [type, setType] = useState(initialType);
  const [details, setDetails] = useState<Record<string, string>>({
    ...initialDetails,
  });
  const [noteOpen, setNoteOpen] = useState(false);
  const [unitNameOpen, setUnitNameOpen] = useState(
    Boolean(initialDetails.service_name),
  );
  const [choosingType, setChoosingType] = useState(!initialType);
  const [activityGroup, setActivityGroup] = useState(
    activityGroupFor(initialType),
  );
  const [choosingService, setChoosingService] = useState(
    !initialDetails.service,
  );
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editingService, setEditingService] = useState<ServiceEdit | null>(
    null,
  );
  const [serviceActivities, setServiceActivities] = useState<ServiceActivity[]>(
    [],
  );
  const nextServiceId = useRef(1);
  const submission = useRef<string | null>(null);
  const [submissionStarted, setSubmissionStarted] = useState(false);

  // A native call follow-up stays tied to the actual contact that was called.
  const canAddServices = Boolean(
    type && fields[type].includes('service') &&
      initialType !== 'hotline_contacted',
  );
  const hasDraft = Object.keys(details).length > 0 || Boolean(note.trim());

  function validateDraft(
    eventType: ResponseEventType,
    draftDetails = details,
    draftNote = note,
  ): boolean {
    const errors = activityFieldErrors(eventType, draftDetails, draftNote);
    if (
      fields[eventType].includes('service') &&
      initialType !== 'hotline_contacted'
    ) {
      if (!draftDetails.municipality?.trim()) {
        errors.municipality = 'Enter the service’s municipality or city.';
      }
      if (
        draftDetails.municipality?.trim() &&
        serviceActivities.some((activity) =>
          activity.id !== editingService?.id &&
          responseServiceIdentity(activity.details) ===
            responseServiceIdentity(draftDetails)
        )
      ) {
        errors.service_name =
          'This service is already listed for that municipality. Edit that entry, or specify a different unit.';
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) return true;
    if (errors.service || errors.service_other) setChoosingService(true);
    if (errors.service_name) setUnitNameOpen(true);
    if (errors.note) setNoteOpen(true);
    setError('Complete the highlighted details.');
    return false;
  }

  function clearFieldError(key: string) {
    setFieldErrors((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  function beginServiceEdit(activity: ServiceActivity) {
    if (saving.current || editingService) return;
    setEditingService({
      id: activity.id,
      previousDetails: { ...details },
      previousNote: note,
      previousNoteOpen: noteOpen,
      previousChoosingService: choosingService,
      previousUnitNameOpen: unitNameOpen,
    });
    setDetails({ ...activity.details });
    setNote(activity.note);
    setNoteOpen(Boolean(activity.note));
    setUnitNameOpen(Boolean(activity.details.service_name));
    setChoosingService(activity.details.service === 'other');
    setFieldErrors({});
    setError(null);
  }

  function finishServiceEdit(apply: boolean) {
    if (!editingService || saving.current || !type) return;
    if (apply && !validateDraft(type)) return;
    if (apply) {
      setServiceActivities((previous) =>
        previous.map((activity) =>
          activity.id === editingService.id
            ? { ...activity, details: { ...details }, note }
            : activity
        )
      );
    }
    setDetails(editingService.previousDetails);
    setNote(editingService.previousNote);
    setNoteOpen(editingService.previousNoteOpen);
    setChoosingService(editingService.previousChoosingService);
    setUnitNameOpen(editingService.previousUnitNameOpen);
    setEditingService(null);
    setFieldErrors({});
    setError(null);
  }

  function requestRemoveService(activity: ServiceActivity) {
    if (
      saving.current ||
      (editingService && editingService.id !== activity.id)
    ) return;
    Alert.alert(
      'Remove service draft?',
      'Remove ' + serviceLabel(activity.details) +
        ' from this form? Saved history will remain unchanged.',
      [
        { text: 'Keep draft', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            if (saving.current) return;
            // Removing the entry being edited also restores the separate draft.
            if (editingService?.id === activity.id) finishServiceEdit(false);
            setServiceActivities((previous) =>
              previous.filter((entry) => entry.id !== activity.id)
            );
            setError(null);
          },
        },
      ],
    );
  }

  function addService() {
    if (saving.current || editingService || !type || !validateDraft(type)) {
      return;
    }
    if (serviceActivities.length >= 20) {
      setError('An activity can include up to 20 services.');
      return;
    }
    setServiceActivities((previous) => [...previous, {
      id: nextServiceId.current++,
      details: { ...details },
      note,
    }]);
    setDetails({});
    setNote('');
    setNoteOpen(false);
    setUnitNameOpen(false);
    setChoosingService(true);
    setError(null);
    setFieldErrors({});
  }

  const reportTarget = 'reportId' in target;
  const types = (Object.keys(eventLabels) as ResponseEventType[]).filter((
    value,
  ) =>
    (initialType === 'reporter_call' || initialType === 'hotline_contacted')
      ? value === initialType
      : !reportTarget ||
        [
          'reporter_call',
          'hotline_contacted',
          'assistance_requested',
          'dispatch_confirmed',
          'external_info',
        ].includes(value)
  );
  function fieldValue(key: string, value: string) {
    if (value.trim() || key === 'service_name') clearFieldError(key);
    if (key === 'service' && value !== 'other') {
      clearFieldError('service_other');
    }
    if (key === 'service') setChoosingService(value === 'other');
    setDetails((previous) => {
      const next = { ...previous, [key]: value };
      // A custom name belongs only to Other, never to a newly selected agency.
      if (key === 'service' && value !== 'other') delete next.service_other;
      if (key === 'service_name' && !value.trim()) delete next.service_name;
      return next;
    });
  }
  async function save(dismissed = false) {
    if (saving.current) return;
    if (editingService && !dismissed) {
      finishServiceEdit(true);
      return;
    }
    const submittedType = dismissed ? 'reporter_call' : type;
    if (!submittedType) return;
    const submittedDetails = dismissed ? { outcome: 'not_recorded' } : details;
    if (
      (!serviceActivities.length || hasDraft || dismissed) &&
      !validateDraft(submittedType, submittedDetails, dismissed ? '' : note)
    ) {
      return;
    }
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      const writeActivity = (
        activityDetails: ResponseEventDetails,
        activityNote: string,
      ) =>
        saveActivity
          ? saveActivity({
            eventType: submittedType,
            details: activityDetails,
            note: activityNote,
          })
          : 'reportId' in target
          ? logReportContact({
            reportId: target.reportId,
            eventType: submittedType,
            details: activityDetails,
            note: activityNote,
          })
          : logIncidentEvent({
            incidentCaseId: target.incidentCaseId,
            eventType: submittedType,
            details: activityDetails,
            note: activityNote,
          });

      if (serviceActivities.length > 0 || submission.current) {
        const services: ResponseServiceEntry[] = serviceActivities.map((
          activity,
        ) => ({
          details: { ...activity.details },
          note: activity.note || null,
        }));
        if (hasDraft) {
          services.push({ details: { ...details }, note: note || null });
        }
        if (services.length > 20) {
          setError('An activity can include up to 20 services.');
          return;
        }
        // Preserve the key after edits: a lost success response must not silently
        // become a second activity. The server detects conflicting retries.
        if (!submission.current) {
          submission.current = createActivitySubmissionId();
          setSubmissionStarted(true);
        }
        const result = await writeActivity({
          submission_id: submission.current,
          services,
        }, '');
        if (result.error) {
          setError(result.error);
          return;
        }
        onLogged({ eventType: submittedType, serviceCount: services.length });
        onClose();
        return;
      }

      const result = await writeActivity(
        submittedDetails,
        dismissed ? '' : note,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      onLogged({
        eventType: submittedType,
        outcome: submittedDetails.outcome,
        dismissed,
      });
      onClose();
    } catch {
      setError('Could not record this event. Please try again.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function close() {
    if (saving.current) return;
    if (initialType === 'reporter_call') {
      void save(true);
      return;
    }
    onClose();
  }
  return (
    <ResourceFormSheet
      visible={visible}
      stableHeight
      title={initialType === 'reporter_call' ||
          initialType === 'hotline_contacted'
        ? 'Record call outcome'
        : 'Record activity'}
      hasUnsavedChanges={initialType !== 'reporter_call' &&
        Boolean(
          note.trim() ||
            JSON.stringify(details) !== JSON.stringify(initialDetails) ||
            serviceActivities.length > 0,
        )}
      discardMessage='Your unfinished activity and service drafts will not be saved.'
      onClose={close}
    >
      {choosingType
        ? (
          <>
            <Text style={operationStyles.eyebrow}>
              {type ? 'CHANGE ACTIVITY' : 'CHOOSE ACTIVITY'}
            </Text>
            {type && (
              <WorkflowActionRow
                title='Keep current activity'
                icon='arrow-back-outline'
                showChevron={false}
                onPress={() => setChoosingType(false)}
                disabled={busy}
              />
            )}
            <WorkflowChoices
              compact
              label='Activity group'
              selected={activityGroup}
              disabled={busy}
              onSelect={setActivityGroup}
              values={activityGroups.filter((group) =>
                group.types.some((value) =>
                  types.includes(value as ResponseEventType)
                )
              ).map((group) => ({
                value: group.value,
                label: group.label,
                icon: group.icon,
              }))}
            />
            {types.filter((value) =>
              activityGroups.find((group) => group.value === activityGroup)
                ?.types.includes(value)
            ).map((value) => (
              <WorkflowActionRow
                key={value}
                title={eventLabels[value]}
                description={value === type ? 'Current activity' : undefined}
                icon={eventAppearance[value].icon}
                tint={eventAppearance[value].tint}
                disabled={busy}
                onPress={() => {
                  if (value === type) {
                    setChoosingType(false);
                    return;
                  }
                  setType(value);
                  setDetails({});
                  setNote('');
                  setNoteOpen(false);
                  setUnitNameOpen(false);
                  setChoosingType(false);
                  setChoosingService(true);
                  setFieldErrors({});
                  setError(null);
                }}
              />
            ))}
          </>
        )
        : type && (
          <View style={operationStyles.section}>
            <View style={operationStyles.row}>
              <Ionicons
                name={eventAppearance[type].icon}
                size={24}
                color={eventAppearance[type].tint}
              />
              <Text style={operationStyles.rowTitle}>{eventLabels[type]}</Text>
            </View>
            {initialType === 'reporter_call' && (
              <Text style={operationStyles.caption}>
                Closing without saving records the outcome as not recorded.
              </Text>
            )}
            {initialType !== 'reporter_call' &&
              initialType !== 'hotline_contacted' &&
              serviceActivities.length === 0 && !editingService &&
              !submissionStarted && (
              <WorkflowActionRow
                title='Change activity'
                icon='swap-horizontal-outline'
                showChevron={false}
                disabled={busy}
                onPress={() => {
                  setActivityGroup(activityGroupFor(type));
                  setChoosingType(true);
                }}
              />
            )}
          </View>
        )}
      {type && !choosingType && (
        <>
          {serviceActivities.length > 0 && (
            <View style={operationStyles.section}>
              <Text style={operationStyles.eyebrow}>
                SERVICES IN THIS ACTIVITY
              </Text>
              {serviceActivities.map((activity) => (
                <View
                  key={activity.id}
                  style={operationStyles.serviceEntry}
                >
                  <View style={operationStyles.serviceEntryCopy}>
                    <WorkflowActionRow
                      title={(editingService?.id === activity.id
                        ? 'Editing '
                        : 'Edit ') + serviceLabel(activity.details)}
                      description={serviceSummary(activity) || undefined}
                      icon='create-outline'
                      tint={colors.primary}
                      disabled={busy || editingService !== null}
                      onPress={() => beginServiceEdit(activity)}
                    />
                  </View>
                  <TouchableOpacity
                    style={operationStyles.serviceRemove}
                    accessibilityRole='button'
                    accessibilityLabel={'Remove ' +
                      serviceLabel(activity.details) + ' draft'}
                    disabled={busy ||
                      (editingService !== null &&
                        editingService.id !== activity.id)}
                    onPress={() =>
                      requestRemoveService(activity)}
                  >
                    <Ionicons
                      name='trash-outline'
                      size={21}
                      color={colors.unverified}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {editingService && (
            <View style={operationStyles.section}>
              <View style={operationStyles.editingBanner}>
                <Ionicons
                  name='create-outline'
                  size={22}
                  color={colors.primary}
                />
                <Text style={operationStyles.editingTitle}>
                  Editing {serviceLabel(
                    serviceActivities.find((activity) =>
                      activity.id === editingService.id
                    )?.details ?? details,
                  )}
                </Text>
              </View>
              <WorkflowButton
                secondary
                label='Cancel edit'
                disabled={busy}
                onPress={() => finishServiceEdit(false)}
              />
            </View>
          )}
          {fields[type].includes('service') && !choosingService && (
            <WorkflowActionRow
              title={serviceLabel(details)}
              description='Service contacted - tap to change'
              icon='call-outline'
              showChevron={false}
              disabled={busy}
              error={fieldErrors.service}
              onPress={() => setChoosingService(true)}
            />
          )}
          {fields[type].includes('service') && choosingService && (
            <WorkflowChoices
              compact
              label='Service'
              error={fieldErrors.service}
              selected={details.service ?? null}
              onSelect={(value) => fieldValue('service', value)}
              disabled={busy}
              values={[
                { value: 'bfp', label: 'BFP' },
                { value: 'pnp', label: 'PNP' },
                { value: 'rhu_ambulance', label: 'RHU / ambulance' },
                { value: 'mdrrmo_rescue', label: 'MDRRMO rescue' },
                { value: 'bdrrmo_team', label: 'BDRRMO team' },
                { value: 'other', label: 'Other / road service' },
              ]}
            />
          )}
          {details.service === 'other' && choosingService && (
            <WorkflowNote
              label='Other service name'
              error={fieldErrors.service_other}
              value={details.service_other ?? ''}
              onChange={(value) => fieldValue('service_other', value)}
              disabled={busy}
            />
          )}
          {fields[type].includes('service') &&
            initialType !== 'hotline_contacted' && (
            <>
              {!unitNameOpen && (
                <WorkflowActionRow
                  title='Add specific unit (optional)'
                  icon='business-outline'
                  showChevron={false}
                  disabled={busy}
                  onPress={() => setUnitNameOpen(true)}
                />
              )}
              {unitNameOpen && (
                <WorkflowNote
                  label='Specific station, office, or unit (optional)'
                  multiline={false}
                  value={details.service_name ?? ''}
                  onChange={(value) => fieldValue('service_name', value)}
                  error={fieldErrors.service_name}
                  maxLength={120}
                  disabled={busy}
                />
              )}
              <WorkflowNote
                label='Municipality / city of the service'
                multiline={false}
                value={details.municipality ?? ''}
                onChange={(value) => fieldValue('municipality', value)}
                error={fieldErrors.municipality}
                maxLength={120}
                disabled={busy}
              />
            </>
          )}
          {fields[type].includes('outcome') && (
            <WorkflowChoices
              compact
              label='Did you reach them?'
              error={fieldErrors.outcome}
              selected={details.outcome ?? null}
              onSelect={(value) => fieldValue('outcome', value)}
              disabled={busy}
              values={[{ value: 'reached', label: 'Reached' }, {
                value: 'no_answer',
                label: 'No answer',
              }, { value: 'call_failed', label: 'Call failed' }]}
            />
          )}
          {fields[type].includes('method') && (
            <WorkflowChoices
              compact
              label='How was dispatch confirmed?'
              error={fieldErrors.method}
              selected={details.method ?? null}
              onSelect={(value) => fieldValue('method', value)}
              disabled={busy}
              values={[
                { value: 'callback', label: 'Callback' },
                { value: 'radio', label: 'Radio' },
                { value: 'in_person', label: 'In person' },
                { value: 'written_message', label: 'Written message' },
              ]}
            />
          )}
          {fields[type].filter((key) =>
            !['service', 'outcome', 'method'].includes(key)
          ).map((key) => (
            <WorkflowNote
              key={key}
              label={fieldLabels[key]}
              multiline={key !== 'confirmed_by'}
              error={fieldErrors[key]}
              value={details[key] ?? ''}
              onChange={(value) => fieldValue(key, value)}
              disabled={busy}
              maxLength={key === 'confirmed_by' ? 80 : 500}
            />
          ))}
          {type === 'dispatch_confirmed' && (
            <WorkflowNote
              label='Dispatch reference (optional)'
              multiline={false}
              error={fieldErrors.reference}
              value={details.reference ?? ''}
              onChange={(value) => {
                clearFieldError('reference');
                // An omitted reference is valid; an empty supplied detail is not.
                setDetails((previous) => {
                  const next = { ...previous };
                  if (value.trim()) next.reference = value;
                  else delete next.reference;
                  return next;
                });
              }}
              disabled={busy}
              maxLength={500}
            />
          )}
          {!noteOpen && (
            <WorkflowActionRow
              title='Add a note (optional)'
              icon='add-outline'
              showChevron={false}
              onPress={() => setNoteOpen(true)}
              disabled={busy}
            />
          )}
          {noteOpen && (
            <WorkflowNote
              label='Additional note (no phone numbers)'
              error={fieldErrors.note}
              value={note}
              onChange={(value) => {
                setNote(value);
                clearFieldError('note');
              }}
              disabled={busy}
            />
          )}
          <WorkflowFeedback busy={busy} error={error} />
          {serviceActivities.length > 0 && hasDraft && !editingService && (
            <WorkflowActionRow
              title='Discard current service draft'
              description='The other listed services will stay'
              icon='trash-outline'
              showChevron={false}
              disabled={busy}
              onPress={() => {
                setDetails({});
                setNote('');
                setNoteOpen(false);
                setUnitNameOpen(false);
                setChoosingService(true);
                setError(null);
                setFieldErrors({});
              }}
            />
          )}
          {canAddServices && hasDraft && !editingService && (
            <WorkflowButton
              secondary
              label='Add another service'
              disabled={busy}
              onPress={addService}
            />
          )}
          <WorkflowButton
            label={editingService
              ? 'Apply service changes'
              : fields[type].includes('outcome')
              ? 'Save call outcome'
              : 'Save activity'}
            disabled={busy}
            onPress={() => void save()}
          />
        </>
      )}
    </ResourceFormSheet>
  );
}

export default function ResponseEventSheet(
  props: React.ComponentProps<typeof ResponseEventSheetForm>,
) {
  return props.visible ? <ResponseEventSheetForm {...props} /> : null;
}
