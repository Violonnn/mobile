import React, { forwardRef, useState } from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';
import FieldError from './FieldError';

type IconName = keyof typeof Ionicons.glyphMap;

type Props = TextInputProps & {
  label: string;
  error?: string;
  required?: boolean;
  /** Ionicons glyph shown in the leading slot (e.g. mail-outline). */
  leadingIcon?: IconName;
  /** Text shown instead of an icon (e.g. "+63" for PH mobile). */
  leadingPrefix?: string;
};

const LabeledInput = forwardRef<TextInput, Props>(function LabeledInput(
  { label, error, required, leadingIcon, leadingPrefix, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const hasLeading = !!leadingIcon || !!leadingPrefix;

  const inputBody = (
    <TextInput
      ref={ref}
      style={[hasLeading ? styles.inputWithIconField : styles.input, style]}
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
      {hasLeading ? (
        <View
          style={[
            styles.inputWithIconRow,
            focused && styles.inputWithIconRowFocused,
            !!error && styles.inputWithIconRowError,
          ]}
        >
          <View style={styles.fieldLeadingIconBox}>
            {leadingPrefix ? (
              <Text style={styles.fieldLeadingPrefixText}>{leadingPrefix}</Text>
            ) : (
              <Ionicons
                name={leadingIcon!}
                size={18}
                color={registerColors.textLight}
              />
            )}
          </View>
          {inputBody}
        </View>
      ) : (
        <TextInput
          ref={ref}
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
});

export default LabeledInput;
