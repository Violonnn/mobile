import { Tabs } from 'expo-router';
import BottomNav from '../../components/navigation/BottomNav';

// Tab order defines left→right layout in the custom bar:
// home | feed | (report action button) | map | profile
export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
      tabBar={(props) => <BottomNav {...props} />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
