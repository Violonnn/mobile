import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export const INCIDENT_TYPE_VALUES = [
  'fire',
  'flood',
  'road_crash',
  'medical',
  'other',
] as const;

export type IncidentType = (typeof INCIDENT_TYPE_VALUES)[number];

export type IncidentTypeOption = {
  value: IncidentType;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
};

export const INCIDENT_TYPE_OPTIONS: IncidentTypeOption[] = [
  { value: 'fire', label: 'Fire', icon: 'flame' },
  { value: 'flood', label: 'Flood', icon: 'water' },
  { value: 'road_crash', label: 'Road crash', icon: 'car' },
  { value: 'medical', label: 'Medical', icon: 'medkit' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle' },
];

export function isIncidentType(value: unknown): value is IncidentType {
  return INCIDENT_TYPE_VALUES.includes(value as IncidentType);
}

/** Safe label for both new typed reports and legacy rows with no category. */
export function formatIncidentType(
  incidentType: IncidentType | null | undefined,
  otherDescription?: string | null,
): string {
  if (!incidentType) return 'Incident type not specified';

  if (incidentType === 'other') {
    const detail = otherDescription?.trim();
    return detail ? `Other · ${detail}` : 'Other incident';
  }

  return (
    INCIDENT_TYPE_OPTIONS.find((option) => option.value === incidentType)?.label ??
    'Incident type not specified'
  );
}
