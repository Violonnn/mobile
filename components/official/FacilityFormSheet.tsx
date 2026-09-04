// Focused create/edit form for one facility directory record.
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ResourceFormSheet from './ResourceFormSheet';
import ResourceLocationField from './ResourceLocationField';
import {
  createFacility,
  facilityTypeLabel,
  updateFacility,
  type FacilityRecord,
  type FacilityType,
} from '../../lib/resources';
import {
  isValidMapPickerCoordinate,
  type MapPickerCoordinate,
} from '../map/LocationPickerModal';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

const FACILITY_TYPES: FacilityType[] = [
  'rhu',
  'hospital',
  'fire_station',
  'police_station',
  'barangay_hall',
  'municipal_hall',
  'other',
];

type FacilityFormSheetProps = {
  visible: boolean;
  facility: FacilityRecord | null;
  barangayId: string | null;
  onSaved: () => void;
  onClose: () => void;
};

function recordCoordinate(facility: FacilityRecord | null): MapPickerCoordinate | null {
  if (!facility) return null;
  return { latitude: facility.latitude, longitude: facility.longitude };
}

export default function FacilityFormSheet({
  visible,
  facility,
  barangayId,
  onSaved,
  onClose,
}: FacilityFormSheetProps) {
  const [name, setName] = useState(facility?.name ?? '');
  const [type, setType] = useState<FacilityType>(facility?.type ?? 'other');
  const [coordinate, setCoordinate] = useState<MapPickerCoordinate | null>(
    recordCoordinate(facility),
  );
  const [address, setAddress] = useState(facility?.address ?? '');
  const [contact, setContact] = useState(facility?.contact ?? '');
  const [isActive, setIsActive] = useState(facility?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousVisible, setPreviousVisible] = useState(visible);
  const [previousFacility, setPreviousFacility] = useState(facility);

  if (visible !== previousVisible || facility !== previousFacility) {
    setPreviousVisible(visible);
    setPreviousFacility(facility);
    if (visible) {
      setName(facility?.name ?? '');
      setType(facility?.type ?? 'other');
      setCoordinate(recordCoordinate(facility));
      setAddress(facility?.address ?? '');
      setContact(facility?.contact ?? '');
      setIsActive(facility?.isActive ?? true);
      setError(null);
    }
  }

  const hasUnsavedChanges = useMemo(() => {
    const original = recordCoordinate(facility);
    if (!facility) {
      return Boolean(name.trim() || type !== 'other' || coordinate || address.trim() || contact.trim() || !isActive);
    }
    return (
      name !== facility.name ||
      type !== facility.type ||
      coordinate?.latitude !== original?.latitude ||
      coordinate?.longitude !== original?.longitude ||
      address !== (facility.address ?? '') ||
      contact !== (facility.contact ?? '') ||
      isActive !== facility.isActive
    );
  }, [address, contact, coordinate, facility, isActive, name, type]);

  async function saveFacility() {
    if (saving) return;
    if (
      !coordinate ||
      !isValidMapPickerCoordinate(coordinate.latitude, coordinate.longitude)
    ) {
      setError('Choose the facility location on the map before saving.');
      return;
    }

    setSaving(true);
    setError(null);
    const result = facility
      ? await updateFacility(facility.id, {
          name,
          type,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          address,
          contact,
          isActive,
        })
      : await createFacility({
          name,
          type,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          address,
          contact,
          barangayId,
          isActive,
        });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    Alert.alert('Saved', facility ? 'Facility updated.' : 'Facility added to the directory.');
    onSaved();
  }

  return (
    <ResourceFormSheet
      visible={visible}
      title={facility ? 'Edit facility' : 'Add facility'}
      hasUnsavedChanges={hasUnsavedChanges}
      onClose={onClose}
    >
      <Text style={localStyles.label}>Name</Text>
      <TextInput style={localStyles.input} value={name} onChangeText={setName} placeholder="e.g. Minglanilla RHU" placeholderTextColor={colors.textMuted} maxLength={120} editable={!saving} />

      <Text style={localStyles.label}>Type</Text>
      <View style={localStyles.chipRow}>
        {FACILITY_TYPES.map((item) => {
          const active = item === type;
          return <TouchableOpacity key={item} style={[localStyles.chip, active && localStyles.chipActive]} onPress={() => setType(item)} disabled={saving}><Text style={[localStyles.chipText, active && localStyles.chipTextActive]}>{facilityTypeLabel(item)}</Text></TouchableOpacity>;
        })}
      </View>

      <ResourceLocationField
        coordinate={coordinate}
        title="Place facility pin"
        hint="Place the pin at the facility entrance or main building. Tap to place it, or drag the pin to adjust."
        disabled={saving}
        onChange={setCoordinate}
      />

      <Text style={localStyles.label}>Address or landmark (optional)</Text>
      <TextInput style={localStyles.input} value={address} onChangeText={setAddress} placeholder="Street, landmark, or building name" placeholderTextColor={colors.textMuted} maxLength={300} editable={!saving} />

      <Text style={localStyles.label}>Contact (optional)</Text>
      <TextInput style={localStyles.input} value={contact} onChangeText={setContact} placeholder="Public contact number" placeholderTextColor={colors.textMuted} maxLength={64} keyboardType="phone-pad" editable={!saving} />

      <View style={localStyles.switchRow}>
        <View style={localStyles.switchCopy}>
          <Text style={localStyles.label}>Directory status</Text>
          <Text style={localStyles.helpText}>{isActive ? 'Visible to residents' : 'Hidden from the public directory'}</Text>
        </View>
        <Switch value={isActive} onValueChange={setIsActive} disabled={saving} trackColor={{ true: colors.themeSoft }} />
      </View>

      {error ? <Text style={localStyles.error}>{error}</Text> : null}
      <TouchableOpacity style={[localStyles.saveButton, saving && localStyles.disabled]} onPress={() => void saveFacility()} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.white} /> : <Text style={localStyles.saveButtonText}>Save facility</Text>}
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
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm },
  switchCopy: { flex: 1, gap: 3 },
  helpText: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted, lineHeight: 18 },
  error: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: '#B42318', lineHeight: 20 },
  saveButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.text, paddingHorizontal: spacing.lg },
  saveButtonText: { fontFamily: fonts.semibold, fontSize: fontSizes.md, color: colors.white },
  disabled: { opacity: 0.55 },
});
