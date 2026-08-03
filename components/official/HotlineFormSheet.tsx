// Focused create/edit form for one hotline directory record.
import React, { useEffect, useMemo, useState } from 'react';
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
import {
  createHotline,
  hotlineCategoryLabel,
  updateHotline,
  type FacilityRecord,
  type HotlineCategory,
  type HotlineRecord,
} from '../../lib/resources';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

const CATEGORIES: HotlineCategory[] = [
  'national_emergency',
  'lgu',
  'medical',
  'fire',
  'police',
  'rescue',
  'utility',
  'other',
];

type HotlineFormSheetProps = {
  visible: boolean;
  hotline: HotlineRecord | null;
  facilities: FacilityRecord[];
  barangayId: string | null;
  canEditNational: boolean;
  onSaved: () => void;
  onClose: () => void;
};

export default function HotlineFormSheet({
  visible,
  hotline,
  facilities,
  barangayId,
  canEditNational,
  onSaved,
  onClose,
}: HotlineFormSheetProps) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [category, setCategory] = useState<HotlineCategory>('lgu');
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(hotline?.name ?? '');
    setNumber(hotline?.number ?? '');
    setCategory(hotline?.category ?? 'lgu');
    setFacilityId(hotline?.facilityId ?? null);
    setIsActive(hotline?.isActive ?? true);
    setError(null);
  }, [hotline, visible]);

  const isNational = hotline?.category === 'national_emergency';
  const hasUnsavedChanges = useMemo(() => {
    if (!hotline) {
      return Boolean(name.trim() || number.trim() || category !== 'lgu' || facilityId || !isActive);
    }
    return (
      name !== hotline.name ||
      number !== hotline.number ||
      category !== hotline.category ||
      facilityId !== hotline.facilityId ||
      isActive !== hotline.isActive
    );
  }, [category, facilityId, hotline, isActive, name, number]);

  async function saveHotline() {
    if (saving) return;
    setSaving(true);
    setError(null);

    const result = hotline
      ? await updateHotline(hotline.id, {
          name,
          number,
          category,
          facilityId,
          isActive,
        })
      : await createHotline({
          name,
          number,
          category,
          facilityId,
          barangayId,
          isActive,
        });

    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    Alert.alert('Saved', hotline ? 'Hotline updated.' : 'Hotline added to the directory.');
    onSaved();
  }

  function requestSave() {
    if (!isNational) {
      void saveHotline();
      return;
    }
    if (!canEditNational) {
      setError('Only MDRRMO may modify the seeded national emergency hotline.');
      return;
    }
    Alert.alert(
      'Modify national hotline?',
      'This seeded emergency number is used across the public directory. Confirm the details before saving.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save changes', style: 'destructive', onPress: () => void saveHotline() },
      ],
    );
  }

  return (
    <ResourceFormSheet
      visible={visible}
      title={hotline ? 'Edit hotline' : 'Add hotline'}
      hasUnsavedChanges={hasUnsavedChanges}
      onClose={onClose}
    >
      <Text style={localStyles.label}>Name</Text>
      <TextInput
        style={localStyles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. MDRRMO Operations"
        placeholderTextColor={colors.textMuted}
        maxLength={120}
        editable={!saving}
      />

      <Text style={localStyles.label}>Number</Text>
      <TextInput
        style={localStyles.input}
        value={number}
        onChangeText={setNumber}
        placeholder="911, mobile, landline, or extension"
        placeholderTextColor={colors.textMuted}
        keyboardType="phone-pad"
        maxLength={32}
        editable={!saving}
      />

      <Text style={localStyles.label}>Category</Text>
      <View style={localStyles.chipRow}>
        {CATEGORIES.filter(
          (item) => item !== 'national_emergency' || canEditNational,
        ).map((item) => {
          const active = item === category;
          return (
            <TouchableOpacity
              key={item}
              style={[localStyles.chip, active && localStyles.chipActive]}
              onPress={() => setCategory(item)}
              disabled={saving}
            >
              <Text style={[localStyles.chipText, active && localStyles.chipTextActive]}>
                {hotlineCategoryLabel(item)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={localStyles.label}>Linked facility (optional)</Text>
      <View style={localStyles.chipRow}>
        <TouchableOpacity
          style={[localStyles.chip, facilityId === null && localStyles.chipActive]}
          onPress={() => setFacilityId(null)}
          disabled={saving}
        >
          <Text style={[localStyles.chipText, facilityId === null && localStyles.chipTextActive]}>Standalone number</Text>
        </TouchableOpacity>
        {facilities.map((facility) => {
          const active = facility.id === facilityId;
          return (
            <TouchableOpacity
              key={facility.id}
              style={[localStyles.chip, active && localStyles.chipActive]}
              onPress={() => setFacilityId(facility.id)}
              disabled={saving}
            >
              <Text style={[localStyles.chipText, active && localStyles.chipTextActive]}>{facility.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={localStyles.switchRow}>
        <View style={localStyles.switchCopy}>
          <Text style={localStyles.label}>Directory status</Text>
          <Text style={localStyles.helpText}>{isActive ? 'Visible to residents' : 'Hidden from the public directory'}</Text>
        </View>
        <Switch value={isActive} onValueChange={setIsActive} disabled={saving} trackColor={{ true: colors.themeSoft }} />
      </View>

      {error ? <Text style={localStyles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={[localStyles.saveButton, saving && localStyles.disabled]}
        onPress={requestSave}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color={colors.white} /> : <Text style={localStyles.saveButtonText}>Save hotline</Text>}
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
