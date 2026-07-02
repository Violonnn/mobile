import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Keyboard, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';
import NumericKeyboardAccessory from '../ui/NumericKeyboardAccessory';
import PinField from '../ui/PinField';

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

      <PinField
        ref={pinRef}
        label="PIN"
        iconName="keypad-outline"
        value={pin}
        onChangeText={handlePinChange}
        hasError={pinHasError}
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => confirmRef.current?.focus()}
      />

      <PinField
        ref={confirmRef}
        label="Confirm PIN"
        iconName="lock-closed-outline"
        value={confirmPin}
        onChangeText={handleConfirmPinChange}
        hasError={confirmHasError}
        errorMessage={error}
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={handleSubmit}
      />

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
