// Focused MDRRMO create/edit form for one evacuation center.
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ResourceFormSheet from './ResourceFormSheet';
import ResourceLocationField from './ResourceLocationField';
import {
  createEvacuationCenter,
  evacuationStatusLabel,
  updateEvacuationCenter,
  type EvacuationCenterRecord,
  type EvacuationStatus,
} from '../../lib/resources';
import type { BarangayOption } from '../../lib/barangays';
import {
  isValidMapPickerCoordinate,
  type MapPickerCoordinate,
} from '../map/LocationPickerModal';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

const CENTER_STATUSES: EvacuationStatus[] = ['open', 'full', 'closed_temporarily'];

type EvacuationCenterFormSheetProps = {
  visible: boolean;
  center: EvacuationCenterRecord | null;
  barangays: BarangayOption[];
  onSaved: () => void;
  onClose: () => void;
};

function recordCoordinate(center: EvacuationCenterRecord | null): MapPickerCoordinate | null {
  if (!center) return null;
  return { latitude: center.latitude, longitude: center.longitude };
}

export default function EvacuationCenterFormSheet({
  visible,
  center,
  barangays,
  onSaved,
  onClose,
}: EvacuationCenterFormSheetProps) {
  const [name, setName] = useState(center?.name ?? '');
  const [barangayId, setBarangayId] = useState<string | null>(center?.barangayId ?? null);
  const [coordinate, setCoordinate] = useState<MapPickerCoordinate | null>(
    recordCoordinate(center),
  );
  const [capacity, setCapacity] = useState(
    center?.capacity == null ? '' : String(center.capacity),
  );
  const [status, setStatus] = useState<EvacuationStatus>(
    center?.status ?? 'closed_temporarily',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousVisible, setPreviousVisible] = useState(visible);
  const [previousCenter, setPreviousCenter] = useState(center);

  if (visible !== previousVisible || center !== previousCenter) {
    setPreviousVisible(visible);
    setPreviousCenter(center);
    if (visible) {
      setName(center?.name ?? '');
      setBarangayId(center?.barangayId ?? null);
      setCoordinate(recordCoordinate(center));
      setCapacity(center?.capacity == null ? '' : String(center.capacity));
      setStatus(center?.status ?? 'closed_temporarily');
      setError(null);
    }
  }

  const hasUnsavedChanges = useMemo(() => {
    const original = recordCoordinate(center);
    if (!center) {
      return Boolean(name.trim() || barangayId || coordinate || capacity || status !== 'closed_temporarily');
    }
    return (
      name !== center.name ||
      barangayId !== center.barangayId ||
      coordinate?.latitude !== original?.latitude ||
      coordinate?.longitude !== original?.longitude ||
      capacity !== (center.capacity == null ? '' : String(center.capacity)) ||
      status !== center.status
    );
  }, [barangayId, capacity, center, coordinate, name, status]);

  async function saveCenter() {
    if (saving) return;
    if (!barangayId) {
      setError('Choose the barangay responsible for this evacuation center.');
      return;
    }
    if (
      !coordinate ||
      !isValidMapPickerCoordinate(coordinate.latitude, coordinate.longitude)
    ) {
      setError('Choose the evacuation-center location on the map before saving.');
      return;
    }

    const trimmedCapacity = capacity.trim();
    const capacityValue = trimmedCapacity ? Number(trimmedCapacity) : null;
    if (
      capacityValue !== null &&
      (!Number.isInteger(capacityValue) || capacityValue < 0)
    ) {
      setError('Capacity must be a whole number of zero or more.');
      return;
    }

    setSaving(true);
    setError(null);
    const result = center
      ? await updateEvacuationCenter(center.id, {
          name,
          barangayId,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          capacity: capacityValue,
          status,
        })
      : await createEvacuationCenter({
          name,
          barangayId,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          capacity: capacityValue,
          // New centers remain closed until the responsible officer updates them.
          status,
        });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    Alert.alert('Saved', center ? 'Evacuation center updated.' : 'Evacuation center added.');
    onSaved();
  }

  return (
    <ResourceFormSheet
      visible={visible}
      title={center ? 'Edit evacuation center' : 'Add evacuation center'}
      hasUnsavedChanges={hasUnsavedChanges}
      onClose={onClose}
    >
      <Text style={localStyles.label}>Name</Text>
      <TextInput style={localStyles.input} value={name} onChangeText={setName} placeholder="Center name" placeholderTextColor={colors.textMuted} maxLength={120} editable={!saving} />

      <Text style={localStyles.label}>Responsible barangay</Text>
      <Text style={localStyles.helpText}>The selected barangay’s BDRRMO can later update this center’s status.</Text>
      <View style={localStyles.chipRow}>
        {barangays.map((barangay) => {
          const active = barangay.id === barangayId;
          return <TouchableOpacity key={barangay.id} style={[localStyles.chip, active && localStyles.chipActive]} onPress={() => setBarangayId(barangay.id)} disabled={saving}><Text style={[localStyles.chipText, active && localStyles.chipTextActive]}>{barangay.name}</Text></TouchableOpacity>;
        })}
      </View>
      {barangays.length === 0 ? <Text style={localStyles.error}>Barangays are unavailable. Retry the resource screen before saving.</Text> : null}

      <ResourceLocationField
        coordinate={coordinate}
        title="Place evacuation-center pin"
        hint="Place the pin at the evacuation-center entrance. Tap to place it, or drag the pin to adjust."
        disabled={saving}
        onChange={setCoordinate}
      />

      <Text style={localStyles.label}>Declared capacity (optional)</Text>
      <TextInput style={localStyles.input} value={capacity} onChangeText={setCapacity} placeholder="Number of people" placeholderTextColor={colors.textMuted} keyboardType="number-pad" maxLength={7} editable={!saving} />

      <Text style={localStyles.label}>Current status</Text>
      <View style={localStyles.chipRow}>
        {CENTER_STATUSES.map((item) => {
          const active = item === status;
          return <TouchableOpacity key={item} style={[localStyles.chip, active && localStyles.chipActive]} onPress={() => setStatus(item)} disabled={saving}><Text style={[localStyles.chipText, active && localStyles.chipTextActive]}>{evacuationStatusLabel(item)}</Text></TouchableOpacity>;
        })}
      </View>

      {error ? <Text style={localStyles.error}>{error}</Text> : null}
      <TouchableOpacity style={[localStyles.saveButton, saving && localStyles.disabled]} onPress={() => void saveCenter()} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.white} /> : <Text style={localStyles.saveButtonText}>Save center</Text>}
      </TouchableOpacity>
    </ResourceFormSheet>
  );
}

const localStyles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, fontFamily: fonts.regular, fontSize: fontSizes.md, color: colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.white },
  chipActive: { backgroundColor: 'rgba(170, 192, 220, 0.25)', borderColor: colors.themeSoft },
  chipText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.textMuted },
  chipTextActive: { fontFamily: fonts.semibold, color: colors.themeSoft },
  helpText: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted, lineHeight: 18 },
  error: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: '#B42318', lineHeight: 20 },
  saveButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.text, paddingHorizontal: spacing.lg },
  saveButtonText: { fontFamily: fonts.semibold, fontSize: fontSizes.md, color: colors.white },
  disabled: { opacity: 0.55 },
});
