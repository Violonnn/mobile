import React, { forwardRef, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ReturnKeyTypeOptions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';
import { NUMERIC_ACCESSORY_ID } from './NumericKeyboardAccessory';
import FieldError from '../register/FieldError';

type IconName = keyof typeof Ionicons.glyphMap;

const PIN_LENGTH = 6;
const PLACEHOLDER_DOTS = '······';

type Props = {
  label: string;
  iconName: IconName;
  value: string;
  onChangeText: (value: string) => void;
  hasError?: boolean;
  errorMessage?: string;
  returnKeyType?: ReturnKeyTypeOptions;
  blurOnSubmit?: boolean;
  onSubmitEditing?: () => void;
};

// Masked numeric PIN input shared by the login and registration screens.
// Owns only its own focus/visibility UI state; all PIN values and submit
// handlers stay in the parent so behavior is unchanged.
const PinField = forwardRef<TextInput, Props>(function PinField(
  {
    label,
    iconName,
    value,
    onChangeText,
    hasError = false,
    errorMessage,
    returnKeyType = 'done',
    blurOnSubmit,
    onSubmitEditing,
  },
  ref,
) {
  const innerRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  function setRefs(node: TextInput | null) {
    innerRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }

  const displayText =
    value.length === 0 ? PLACEHOLDER_DOTS : visible ? value : '•'.repeat(value.length);

  return (
    <View style={styles.loginFieldWrap}>
      <Text style={styles.loginFieldLabel}>{label}</Text>
      <View
        style={[
          styles.phoneRow,
          focused && styles.phoneRowFocused,
          hasError && styles.inputError,
        ]}
      >
        <View style={styles.pinIconBox}>
          <Ionicons name={iconName} size={20} color={registerColors.textLight} />
        </View>
        <Pressable
          style={[styles.pinInputWrapper, styles.loginPinRow]}
          onPress={() => innerRef.current?.focus()}
        >
          <Text
            style={[styles.pinDisplayText, value.length === 0 && { color: '#9CA3AF' }]}
            pointerEvents="none"
          >
            {displayText}
          </Text>
          <TextInput
            ref={setRefs}
            style={styles.pinHiddenInput}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="number-pad"
            maxLength={PIN_LENGTH}
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            caretHidden
            inputAccessoryViewID={NUMERIC_ACCESSORY_ID}
            returnKeyType={returnKeyType}
            blurOnSubmit={blurOnSubmit}
            onSubmitEditing={onSubmitEditing}
          />
        </Pressable>
        <TouchableOpacity
          onPress={() => setVisible((prev) => !prev)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color="#9CA3AF"
          />
        </TouchableOpacity>
      </View>
      {!!errorMessage && <FieldError message={errorMessage} />}
    </View>
  );
});

export default PinField;
