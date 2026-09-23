import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isDemoAuthEnabled } from '../../lib/demoAuth';

/** A root-level warning so demo screenshots cannot be confused with live auth. */
export default function DemoAuthBanner() {
  const insets = useSafeAreaInsets();

  if (!isDemoAuthEnabled()) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.banner, { top: insets.top + 8 }]}
      accessibilityLabel="Demo authentication is enabled"
    >
      <Text style={styles.title}>DEMO AUTH · OTP: 123456</Text>
      <Text style={styles.message}>SMS and Supabase writes are disabled</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 100,
    borderRadius: 12,
    backgroundColor: '#7C2D12',
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  title: {
    color: '#FFF7ED',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  message: {
    color: '#FFEDD5',
    fontSize: 11,
    marginTop: 1,
  },
});
