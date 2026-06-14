import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { homeStyles as styles } from '../../styles/screens/home.styles';
import { colors } from '../../styles/theme';
import WelcomeModal from '../../components/ui/WelcomeModal';
import { getActiveSession, logout } from '../../lib/auth';
import { fetchMyProfile } from '../../lib/profile';

const PLACEHOLDER_FEATURES = [
  {
    icon: 'warning-outline' as const,
    title: 'Report an Emergency',
    subtitle: 'Quickly alert your barangay when help is needed.',
  },
  {
    icon: 'notifications-outline' as const,
    title: 'Safety Alerts',
    subtitle: 'Get updates on weather and local hazards.',
  },
  {
    icon: 'people-outline' as const,
    title: 'Community Hub',
    subtitle: 'Connect with neighbors and responders.',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();

  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [barangay, setBarangay] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const session = await getActiveSession();
      if (!session) {
        setIsAuthenticated(false);
        setFirstName('');
        setBarangay('');
        return;
      }

      setIsAuthenticated(true);
      const { profile } = await fetchMyProfile();
      if (profile) {
        setFirstName(profile.first_name);
        setBarangay(profile.barangay);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (welcome === '1' && isAuthenticated && !loading) {
      setShowWelcome(true);
    }
  }, [welcome, isAuthenticated, loading]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const { error } = await logout();
      if (error) throw new Error(error);
      router.replace('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not log out. Please try again.';
      Alert.alert('Logout failed', message);
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading || !isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={[styles.scrollContent, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const greetingName = firstName.trim() || 'there';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Image source={require('../../assets/images/AppLogo.png')} style={styles.headerLogo} />
          <View>
            <Text style={styles.headerTitle}>DisasterLink</Text>
            <Text style={styles.headerSubtitle}>Minglanilla, Cebu</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroGreeting}>Welcome, {greetingName}!</Text>
          <Text style={styles.heroText}>
            {barangay
              ? `You're signed in and linked to ${barangay}`
              : "You're signed in. Home features are being prepared for you."}
          </Text>
        </View>

        <View style={styles.placeholderGrid}>
          {PLACEHOLDER_FEATURES.map((feature) => (
            <View key={feature.title} style={styles.placeholderCard} pointerEvents="none">
              <View style={styles.placeholderIconWrap}>
                <Ionicons name={feature.icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.placeholderBody}>
                <Text style={styles.placeholderTitle}>{feature.title}</Text>
                <Text style={styles.placeholderSubtitle}>{feature.subtitle}</Text>
                <View style={styles.comingSoonPill}>
                </View>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          {loggingOut ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.logoutButtonText}>Log Out</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <WelcomeModal
        visible={showWelcome}
        firstName={firstName}
        barangay={barangay}
        onDone={() => setShowWelcome(false)}
      />
    </SafeAreaView>
  );
}
