import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import WelcomeModal from '../../components/ui/WelcomeModal';
import { isDemoAuthEnabled } from '../../lib/demoAuth';
import { residentHappyPath } from '../../lib/fixtures/demoResident';
import { colors } from '../../styles/theme';

/** Fixture wrapper for the authenticated completion modal; it creates no session. */
export default function WelcomePreviewScreen() {
  const router = useRouter();

  if (!isDemoAuthEnabled()) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.container}>
        <WelcomeModal
          visible
          firstName={residentHappyPath.firstName}
          barangay={residentHappyPath.barangay}
          onDone={() => router.back()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
