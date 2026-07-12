import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';
import FieldError from './FieldError';

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  label: string;
  iconName: IconName;
  value: string | null;
  placeholder?: string;
  onPress: () => void;
  error?: string;
  /** Highlight the field border without showing its own error text. */
  hasError?: boolean;
};

// Tappable field that opens a selection modal. Shared by the birth month and
// birth year pickers so their layout stays consistent in one place.
export default function SelectField({
  label,
  iconName,
  value,
  placeholder = 'Select',
  onPress,
  error,
  hasError = false,
}: Props) {
  return (
    <View style={styles.flex1}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.input, styles.dropdownInput, (!!error || hasError) && styles.inputError]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Ionicons name={iconName} size={18} color={registerColors.textLight} />
        <Text style={[styles.selectFieldText, !value && styles.selectFieldPlaceholder]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#666" />
      </TouchableOpacity>
      <FieldError message={error ?? ''} />
    </View>
  );
}
