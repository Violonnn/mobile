import React from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  StyleProp,
  TextStyle,
} from 'react-native';
import { registerColors } from '../../styles/screens/register.styles';

export const NUMERIC_ACCESSORY_ID = 'numeric-keyboard-done';
export const LOGIN_NUMERIC_ACCESSORY_ID = 'login-numeric-keyboard-done';

type NumericKeyboardAccessoryProps = {
  doneTextStyle?: StyleProp<TextStyle>;
  accessoryID?: string;
};

export default function NumericKeyboardAccessory({
  doneTextStyle,
  accessoryID = NUMERIC_ACCESSORY_ID,
}: NumericKeyboardAccessoryProps) {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={accessoryID}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={Keyboard.dismiss} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
          <Text style={[styles.doneText, doneTextStyle]}>Done</Text>
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
