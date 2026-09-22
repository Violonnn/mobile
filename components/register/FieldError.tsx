import React from 'react';
import { StyleProp, Text, TextStyle, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';

type Props = {
  message: string;
  /** Center the icon + text as a group (e.g. the OTP screen). */
  centered?: boolean;
  /** Optional typography override for screens with a dedicated type scale. */
  textStyle?: StyleProp<TextStyle>;
};

export default function FieldError({ message, centered = false, textStyle }: Props) {
  if (!message) return null;

  return (
    <View style={[styles.fieldErrorRow, centered && styles.fieldErrorRowCentered]}>
      <Ionicons
        name="alert-circle-outline"
        size={14}
        color={registerColors.error}
        style={{ marginTop: 2 }}
      />
      <Text style={[styles.fieldErrorText, centered && styles.fieldErrorTextCentered, textStyle]}>
        {message}
      </Text>
    </View>
  );
}
