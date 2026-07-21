// lib/permissions.ts — shared helper for permanently denied OS permissions.
import { Alert, Linking } from 'react-native';

/**
 * Once the user fully denies a permission ("Don't ask again" / second denial
 * on Android 11+), the OS suppresses the permission dialog entirely — any
 * further requests fail silently. The only way to grant it afterwards is
 * through the app settings, so we guide the user there.
 */
export function promptOpenSettings(title: string, message: string): void {
  Alert.alert(title, message, [
    { text: 'Not now', style: 'cancel' },
    {
      text: 'Open Settings',
      onPress: () => {
        void Linking.openSettings();
      },
    },
  ]);
}
