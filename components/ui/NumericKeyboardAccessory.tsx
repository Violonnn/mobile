import React from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { registerColors } from '../../styles/screens/register.styles';

export const NUMERIC_ACCESSORY_ID = 'numeric-keyboard-done';

export default function NumericKeyboardAccessory() {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={NUMERIC_ACCESSORY_ID}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={Keyboard.dismiss} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CFCFCF',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  doneText: {
    color: registerColors.primary,
    fontSize: 17,
    fontWeight: '600',
  },
});
