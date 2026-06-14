import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';
import FieldError from './FieldError';

type IconName = keyof typeof Ionicons.glyphMap;

type Props = TextInputProps & {
  label: string;
  error?: string;
  required?: boolean;
  leadingIcon?: IconName;
};

export default function LabeledInput({
  label,
  error,
  required,
  leadingIcon,
  style,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);

  const inputBody = (
    <TextInput
      style={[leadingIcon ? styles.inputWithIconField : styles.input, style]}
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
  );

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      {leadingIcon ? (
        <View
          style={[
            styles.inputWithIconRow,
            focused && styles.inputWithIconRowFocused,
            !!error && styles.inputWithIconRowError,
          ]}
        >
          <View style={styles.fieldLeadingIconBox}>
            <Ionicons name={leadingIcon} size={18} color={registerColors.textLight} />
          </View>
          {inputBody}
        </View>
      ) : (
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
      )}
      <FieldError message={error ?? ''} />
    </View>
  );
}
