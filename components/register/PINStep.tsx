import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerStyles as styles } from '../../styles/screens/register.styles';
import NumericKeyboardAccessory, { NUMERIC_ACCESSORY_ID } from '../ui/NumericKeyboardAccessory';

type Props = {
  phoneNumber: string;
  pin: string;
  confirmPin: string;
  onChangePin: (value: string) => void;
  onChangeConfirmPin: (value: string) => void;
  onSubmit: (pin: string) => void;
};

export default function PINStep({
  phoneNumber,
  pin,
  confirmPin,
  onChangePin,
  onChangeConfirmPin,
  onSubmit,
}: Props) {
  const pinRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [pinVisible, setPinVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pinFocused, setPinFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [error, setError] = useState('');

  const isComplete = pin.length === 6 && confirmPin.length === 6;

  useEffect(() => {
    if (isComplete) {
      Keyboard.dismiss();
    }
  }, [isComplete]);

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

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>PIN</Text>
        <View style={[styles.input, styles.dropdownInput, pinFocused && styles.inputFocused]}>
          <TextInput
            ref={pinRef}
            style={styles.pinInputInner}
            value={pin}
            onChangeText={handlePinChange}
            onFocus={() => setPinFocused(true)}
            onBlur={() => setPinFocused(false)}
            placeholder="······"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            secureTextEntry={!pinVisible}
            maxLength={6}
            autoCorrect={false}
            autoComplete="off"
            textContentType="oneTimeCode"
            inputAccessoryViewID={NUMERIC_ACCESSORY_ID}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
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

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Confirm PIN</Text>
        <View
          style={[
            styles.input,
            styles.dropdownInput,
            confirmFocused && styles.inputFocused,
            error !== '' && styles.inputError,
          ]}
        >
          <TextInput
            ref={confirmRef}
            style={styles.pinInputInner}
            value={confirmPin}
            onChangeText={handleConfirmPinChange}
            onFocus={() => setConfirmFocused(true)}
            onBlur={() => setConfirmFocused(false)}
            placeholder="······"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            secureTextEntry={!confirmVisible}
            maxLength={6}
            autoCorrect={false}
            autoComplete="off"
            textContentType="oneTimeCode"
            inputAccessoryViewID={NUMERIC_ACCESSORY_ID}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
          />
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
        {error !== '' && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <View style={styles.pinHintRow}>
        <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" />
        <Text style={styles.pinHintText}>
          Choose a PIN you'll remember. You'll use this every time you log in.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !isComplete && styles.primaryButtonDisabled]}
        onPress={handleSubmit}
        disabled={!isComplete}
        activeOpacity={0.8}
      >
        <Text style={[styles.primaryButtonText, !isComplete && styles.primaryButtonTextDisabled]}>
          CREATE ACCOUNT
        </Text>
        {isComplete && (
          <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
        )}
      </TouchableOpacity>

      <NumericKeyboardAccessory />
    </View>
  );
}
