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

export type IncidentTypeTone = {
  color: string;
  softColor: string;
  icon: IncidentTypeOption['icon'];
};

/** Washed-out category colors shared by resident posts, tags and map markers. */
const INCIDENT_TYPE_TONES: Record<IncidentType, IncidentTypeTone> = {
  fire: { color: '#A64B3A', softColor: '#FCEEEA', icon: 'flame' },
  flood: { color: '#3B6797', softColor: '#EAF1F9', icon: 'water' },
  road_crash: { color: '#82601F', softColor: '#FBF3E2', icon: 'car' },
  medical: { color: '#6E5499', softColor: '#F2EEF9', icon: 'medkit' },
  other: { color: '#5A6679', softColor: '#EFF2F6', icon: 'ellipsis-horizontal-circle' },
};

export function incidentTypeTone(incidentType: IncidentType | string | null | undefined): IncidentTypeTone {
  return isIncidentType(incidentType) ? INCIDENT_TYPE_TONES[incidentType] : INCIDENT_TYPE_TONES.other;
}

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
