// components/register/LabeledInput.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { registerStyles as styles } from '../../styles/screens/register.styles';

type Props = TextInputProps & {
  label: string;
  error?: string;
  required?: boolean;
};

export default function LabeledInput({ label, error, required, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          !!error && styles.inputError,
          style,
        ]}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        placeholderTextColor="#9CA3AF"
        {...rest}
      />
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}
