import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { resolveSessionDestination } from '../lib/portalAccess';
import { colors } from '../styles/theme';

/** Routes directly to sign-in while keeping existing sessions in their portal. */
export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function routeFromIndex() {
      const destination = await resolveSessionDestination();

      if (!isMounted) return;
      router.replace(destination ?? '/(auth)/login');
    }

    void routeFromIndex();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLabel="Checking sign-in status"
    >
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
