// app/(main)/feed.tsx — placeholder tab. Content not built yet.
import { useRouter } from 'expo-router';
import NotFoundView from '../../components/ui/NotFoundView';

export default function FeedScreen() {
  const router = useRouter();
  return <NotFoundView onGoHome={() => router.navigate('/(main)/home')} />;
}
