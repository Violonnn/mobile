import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { isDemoAuthEnabled } from '../../lib/demoAuth';
import type { ForgotPasswordPreviewName, RegistrationPreviewName } from '../../lib/authPreview';
import { colors } from '../../styles/theme';

type PreviewItem = {
  label: string;
  route: Href;
};

function registrationRoute(preview: RegistrationPreviewName): Href {
  return `/(auth)/register?preview=${preview}` as Href;
}

function forgotPasswordRoute(preview: ForgotPasswordPreviewName): Href {
  return `/(auth)/forgot-password?preview=${preview}` as Href;
}

const previewItems: PreviewItem[] = [
  { label: 'Registration · Phone empty', route: registrationRoute('phone-empty') },
  { label: 'Registration · Phone valid', route: registrationRoute('phone-valid') },
  { label: 'Registration · OTP empty', route: registrationRoute('otp-empty') },
  { label: 'Registration · OTP incorrect', route: registrationRoute('otp-invalid') },
  { label: 'Registration · OTP cooldown', route: registrationRoute('otp-cooldown') },
  { label: 'Registration · Details empty', route: registrationRoute('details-empty') },
  { label: 'Registration · Details invalid name', route: registrationRoute('details-invalid-name') },
  { label: 'Registration · Details underage', route: registrationRoute('details-underage') },
  { label: 'Registration · Details happy path', route: registrationRoute('details-happy') },
  { label: 'Registration · PIN short', route: registrationRoute('pin-short') },
  { label: 'Registration · PIN mismatch', route: registrationRoute('pin-mismatch') },
  { label: 'Registration · PIN submitting', route: registrationRoute('pin-submitting') },
  { label: 'Registration · Welcome modal', route: '/dev/welcome-preview' as Href },
  { label: 'Forgot PIN · Phone valid', route: forgotPasswordRoute('phone-valid') },
  { label: 'Forgot PIN · OTP incorrect', route: forgotPasswordRoute('otp-invalid') },
  { label: 'Forgot PIN · OTP valid', route: forgotPasswordRoute('otp-valid') },
  { label: 'Forgot PIN · PIN mismatch', route: forgotPasswordRoute('pin-mismatch') },
  { label: 'Forgot PIN · PIN submitting', route: forgotPasswordRoute('pin-submitting') },
  { label: 'Forgot PIN · PIN updated action', route: forgotPasswordRoute('pin-ready') },
];

/** Development-only launcher for the real auth components and their local fixtures. */
export default function AuthUiPreviewScreen() {
  const router = useRouter();

  // This route deliberately exposes no UI in release builds or without the local flag.
  if (!isDemoAuthEnabled()) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Resident Auth Preview</Text>
        <Text style={styles.subtitle}>
          Local fixtures only. SMS and Supabase writes remain disabled.
        </Text>
        <View style={styles.list}>
          {previewItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.item}
              onPress={() => router.push(item.route)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.label}`}
            >
              <Text style={styles.itemText}>{item.label}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 72, paddingBottom: 36 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  list: { gap: 10, marginTop: 24 },
  item: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  itemText: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '600' },
  chevron: { color: colors.primary, fontSize: 26, marginLeft: 12 },
});
