// app/(main)/profile.tsx — placeholder tab. Content not built yet.
import { useRouter } from 'expo-router';
import NotFoundView from '../../components/ui/NotFoundView';

export default function ProfileScreen() {
  const router = useRouter();
  return <NotFoundView onGoHome={() => router.navigate('/(main)/home')} />;
}
