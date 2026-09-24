import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { resolveSessionDestination } from '../lib/portalAccess';
import { prepareResidentLoginIntroForLaunch } from '../lib/residentLoginIntro';

/** Routes directly to sign-in while keeping existing sessions in their portal. */
export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function routeFromIndex() {
      const destination = await resolveSessionDestination();

      if (!isMounted) return;
      if (!destination) prepareResidentLoginIntroForLaunch();
      router.replace(destination ?? '/(auth)/login');
    }

    void routeFromIndex();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // The native splash remains visible while this route resolves the session.
  return <View style={{ flex: 1 }} accessibilityLabel="Checking sign-in status" />;
}
