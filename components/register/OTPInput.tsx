import React, { useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { registerStyles as styles } from '../../styles/screens/register.styles';

const OTP_LENGTH = 6;

type Props = { value: string; onChange: (v: string) => void };

export default function OTPInput({ value, onChange }: Props) {
  const hiddenInputRef = useRef<TextInput>(null);

  // Whenever a user taps on ANY box, force focus onto the hidden input
  const handlePress = () => {
    hiddenInputRef.current?.focus();
  };

  // Create a rigid 6-element array from our single string value (e.g., "12" -> ["1", "2", "", "", "", ""])
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] || '');

  return (
    <View style={localStyles.container}>
      
      {/* 1. THE VISUAL LAYOUT (What the user sees) */}
      <Pressable onPress={handlePress} style={styles.otpBoxRow}>
        {digits.map((digit, i) => {
          // Optional enhancement: Highlight the box currently waiting for input
          const isFocused = value.length === i && hiddenInputRef.current?.isFocused();
          
          return (
            <View 
              key={i} 
              style={[
                styles.otpBox, 
                !!digit && styles.otpBoxFilled,
                isFocused && { borderColor: '#3b82f6', borderWidth: 2 } // Active box border color
              ]}
            >
              <Text style={styles.otpBoxText}>{digit}</Text>
            </View>
          );
        })}
      </Pressable>

      {/* 2. THE SECRET ENGINE (What actually processes the keyboard) */}
      <TextInput
        ref={hiddenInputRef}
        value={value}
        onChangeText={(text) => {
          // Clean input: Keep only numbers and enforce the 6-digit maximum limit
          const numericText = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
          onChange(numericText);
        }}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        style={localStyles.hiddenTextInput}
        caretHidden
        autoComplete="sms-otp" // Enables iOS/Android auto-fill suggestions from SMS messages!
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  hiddenTextInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0, // Makes it completely invisible to the user
    zIndex: 1,  // Sits cleanly on top of the custom layout to intercept taps natively
  },
});