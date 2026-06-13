import React, { useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { registerStyles as styles } from '../../styles/screens/register.styles';
import { getOtpDimensions } from '../../lib/layout';

const OTP_LENGTH = 6;

type Props = { value: string; onChange: (v: string) => void };

export default function OTPInput({ value, onChange }: Props) {
  const hiddenInputRef = useRef<TextInput>(null);
  const { boxWidth, boxHeight, gap, fontSize } = getOtpDimensions(OTP_LENGTH);

  const handlePress = () => {
    hiddenInputRef.current?.focus();
  };

  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] || '');

  return (
    <View style={localStyles.container}>
      <Pressable onPress={handlePress} style={[styles.otpBoxRow, { gap }]}>
        {digits.map((digit, i) => {
          const isActive = value.length === i;
          return (
            <View
              key={i}
              style={[
                styles.otpBox,
                { width: boxWidth, height: boxHeight },
                !!digit && styles.otpBoxFilled,
                isActive && styles.otpBoxActive,
              ]}
            >
              <Text style={[styles.otpBoxText, { fontSize }]}>{digit}</Text>
            </View>
          );
        })}
      </Pressable>

      <TextInput
        ref={hiddenInputRef}
        value={value}
        onChangeText={(text) => {
          const numericText = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
          onChange(numericText);
        }}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        style={localStyles.hiddenTextInput}
        caretHidden
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
  },
  hiddenTextInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
    zIndex: 1,
  },
});
