import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { registerStyles as styles, registerColors } from '../../styles/screens/register.styles';

type Props = {
  message: string;
};

export default function FieldError({ message }: Props) {
  if (!message) return null;

  return (
    <View style={styles.fieldErrorRow}>
      <Ionicons
        name="alert-circle-outline"
        size={14}
        color={registerColors.error}
        style={{ marginTop: 2 }}
      />
      <Text style={styles.fieldErrorText}>{message}</Text>
    </View>
  );
}
