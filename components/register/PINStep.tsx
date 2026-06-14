import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Keyboard, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';
import NumericKeyboardAccessory, { NUMERIC_ACCESSORY_ID } from '../ui/NumericKeyboardAccessory';
import FieldError from './FieldError';

type Props = {
  phoneNumber: string;
  pin: string;
  confirmPin: string;
  onChangePin: (value: string) => void;
  onChangeConfirmPin: (value: string) => void;
  onSubmit: (pin: string) => void;
  submitting?: boolean;
};

export default function PINStep({
  phoneNumber,
  pin,
  confirmPin,
  onChangePin,
  onChangeConfirmPin,
  onSubmit,
  submitting = false,
}: Props) {
  const pinRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [pinVisible, setPinVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pinFocused, setPinFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [error, setError] = useState('');

  const pinHasError = error === 'PIN must be 6 digits.';
  const confirmHasError = error === 'PINs do not match. Please try again.' || pinHasError;

  useEffect(() => {
    if (pin.length === 6 && confirmPin.length === 6) {
      Keyboard.dismiss();
    }
  }, [pin.length, confirmPin.length]);

  function handlePinChange(text: string) {
    const cleaned = text.replace(/\D/g, '').slice(0, 6);
    onChangePin(cleaned);
    if (error) setError('');
    if (cleaned.length === 6) {
      confirmRef.current?.focus();
    }
  }

  function handleConfirmPinChange(text: string) {
    const cleaned = text.replace(/\D/g, '').slice(0, 6);
    onChangeConfirmPin(cleaned);
    if (error) setError('');
    if (cleaned.length === 6) {
      Keyboard.dismiss();
    }
  }

  function handleSubmit() {
    if (pin.length < 6) {
      setError('PIN must be 6 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match. Please try again.');
      return;
    }
    Keyboard.dismiss();
    onSubmit(pin);
  }

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Almost there...</Text>
      <Text style={styles.stepSubtitle}>
        Enter your PIN for{' '}
        <Text style={styles.stepSubtitleBold}>{phoneNumber}</Text>
      </Text>

      <View style={styles.loginFieldWrap}>
        <Text style={styles.loginFieldLabel}>PIN</Text>
        <View
          style={[
            styles.phoneRow,
            pinFocused && styles.phoneRowFocused,
            pinHasError && styles.inputError,
          ]}
        >
          <View style={styles.pinIconBox}>
            <Ionicons name="keypad-outline" size={20} color={registerColors.textLight} />
          </View>
          <Pressable style={[styles.pinInputWrapper, styles.loginPinRow]} onPress={() => pinRef.current?.focus()}>
            <Text
              style={[styles.pinDisplayText, pin.length === 0 && { color: '#9CA3AF' }]}
              pointerEvents="none"
            >
              {pin.length === 0 ? '······' : pinVisible ? pin : '•'.repeat(pin.length)}
            </Text>
            <TextInput
              ref={pinRef}
              style={styles.pinHiddenInput}
              value={pin}
              onChangeText={handlePinChange}
              onFocus={() => setPinFocused(true)}
              onBlur={() => setPinFocused(false)}
              keyboardType="number-pad"
              maxLength={6}
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              caretHidden
              inputAccessoryViewID={NUMERIC_ACCESSORY_ID}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
          </Pressable>
          <TouchableOpacity
            onPress={() => setPinVisible(!pinVisible)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={pinVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.loginFieldWrap}>
        <Text style={styles.loginFieldLabel}>Confirm PIN</Text>
        <View
          style={[
            styles.phoneRow,
            confirmFocused && styles.phoneRowFocused,
            confirmHasError && styles.inputError,
          ]}
        >
          <View style={styles.pinIconBox}>
            <Ionicons name="lock-closed-outline" size={20} color={registerColors.textLight} />
          </View>
          <Pressable
            style={[styles.pinInputWrapper, styles.loginPinRow]}
            onPress={() => confirmRef.current?.focus()}
          >
            <Text
              style={[styles.pinDisplayText, confirmPin.length === 0 && { color: '#9CA3AF' }]}
              pointerEvents="none"
            >
              {confirmPin.length === 0
                ? '······'
                : confirmVisible
                  ? confirmPin
                  : '•'.repeat(confirmPin.length)}
            </Text>
            <TextInput
              ref={confirmRef}
              style={styles.pinHiddenInput}
              value={confirmPin}
              onChangeText={handleConfirmPinChange}
              onFocus={() => setConfirmFocused(true)}
              onBlur={() => setConfirmFocused(false)}
              keyboardType="number-pad"
              maxLength={6}
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              caretHidden
              inputAccessoryViewID={NUMERIC_ACCESSORY_ID}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={handleSubmit}
            />
          </Pressable>
          <TouchableOpacity
            onPress={() => setConfirmVisible(!confirmVisible)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={confirmVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#9CA3AF"
            />
          </TouchableOpacity>
        </View>
        <FieldError message={error} />
      </View>

      <View style={styles.pinHintRow}>
        <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" />
        <Text style={styles.pinHintText}>
          Choose a PIN you'll remember. You'll use this every time you log in.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color={registerColors.white} />
        ) : (
          <>
            <Text style={styles.primaryButtonText}>CREATE ACCOUNT</Text>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
          </>
        )}
      </TouchableOpacity>

      <NumericKeyboardAccessory />
    </View>
  );
}
