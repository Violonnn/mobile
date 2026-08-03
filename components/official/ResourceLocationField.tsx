// Map-first location field shared by facility and evacuation-center forms.
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LocationPickerModal, {
  isValidMapPickerCoordinate,
  type MapPickerCoordinate,
} from '../map/LocationPickerModal';
import { getCurrentGps } from '../../lib/location';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

const MINGLANILLA_CENTER: MapPickerCoordinate = {
  latitude: 10.2447,
  longitude: 123.7967,
};

type ResourceLocationFieldProps = {
  coordinate: MapPickerCoordinate | null;
  title: string;
  hint: string;
  disabled?: boolean;
  onChange: (coordinate: MapPickerCoordinate) => void;
};

function usableCoordinate(
  coordinate: MapPickerCoordinate | null,
): MapPickerCoordinate | null {
  if (!coordinate) return null;
  return isValidMapPickerCoordinate(coordinate.latitude, coordinate.longitude)
    ? coordinate
    : null;
}

export default function ResourceLocationField({
  coordinate,
  title,
  hint,
  disabled = false,
  onChange,
}: ResourceLocationFieldProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [pickerStart, setPickerStart] = useState<MapPickerCoordinate>(
    usableCoordinate(coordinate) ?? MINGLANILLA_CENTER,
  );

  async function openPicker() {
    const existing = usableCoordinate(coordinate);
    if (existing) {
      setPickerStart(existing);
      setLocationNotice(null);
      setPickerVisible(true);
      return;
    }

    setRequestingLocation(true);
    setLocationNotice(null);
    const result = await getCurrentGps();
    setRequestingLocation(false);

    if (
      result.position &&
      isValidMapPickerCoordinate(
        result.position.latitude,
        result.position.longitude,
      )
    ) {
      setPickerStart(result.position);
    } else {
      // Missing, denied, or out-of-area GPS still leaves a usable municipality map.
      setPickerStart(MINGLANILLA_CENTER);
      setLocationNotice(
        `${result.error || 'Current location is outside the supported map area.'} The map starts at Minglanilla instead.`,
      );
    }
    setPickerVisible(true);
  }

  const selected = usableCoordinate(coordinate);

  return (
    <View style={localStyles.container}>
      <Text style={localStyles.label}>Map location</Text>
      <TouchableOpacity
        style={[localStyles.locationButton, disabled && localStyles.disabled]}
        onPress={() => void openPicker()}
        disabled={disabled || requestingLocation}
        accessibilityRole="button"
        accessibilityLabel={selected ? 'Change map location' : 'Choose map location'}
      >
        <Ionicons name="location-outline" size={20} color={colors.themeSoft} />
        <View style={localStyles.locationCopy}>
          <Text style={localStyles.locationTitle}>
            {selected ? 'Location selected' : 'Choose on map'}
          </Text>
          <Text style={localStyles.locationSummary} numberOfLines={1}>
            {selected
              ? `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`
              : 'Tap to place a pin'}
          </Text>
        </View>
        {requestingLocation ? (
          <ActivityIndicator color={colors.themeSoft} />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        )}
      </TouchableOpacity>
      {locationNotice ? <Text style={localStyles.notice}>{locationNotice}</Text> : null}

      <LocationPickerModal
        visible={pickerVisible}
        initialCoordinate={pickerStart}
        title={title}
        hint={hint}
        confirmLabel="Confirm location"
        onConfirm={(next) => {
          onChange(next);
          setPickerVisible(false);
          setLocationNotice(null);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  locationButton: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, backgroundColor: colors.white },
  locationCopy: { flex: 1, gap: 2 },
  locationTitle: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.text },
  locationSummary: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted },
  notice: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.textMuted, lineHeight: 18 },
  disabled: { opacity: 0.55 },
});
