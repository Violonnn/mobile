import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { homeStyles as styles, homeColors } from '../../styles/screens/home.styles';
import { colors } from '../../styles/theme';
import AppHeader from '../../components/navigation/AppHeader';
import WelcomeModal from '../../components/ui/WelcomeModal';
import HomeMapPreview from '../../components/home/HomeMapPreview';
import { getActiveSession } from '../../lib/auth';
import { fetchMyProfile } from '../../lib/profile';

// UI-only placeholders. Real feeds arrive later; keep these empty so the
// screen renders its soft empty states.
const ANNOUNCEMENTS: unknown[] = [];
const HAPPENING_NEAR_YOU: unknown[] = [];

export default function HomeScreen() {
  const router = useRouter();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();

  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [barangay, setBarangay] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);

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

  if (loading || !isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.themeSoft} />
        </View>
      </SafeAreaView>
    );
  }

  const locationValue = barangay ? `${barangay}, Minglanilla` : 'Minglanilla, Cebu';
  const goToFeed = () => router.push('/(main)/feed');
  const goToMap = () => router.push('/(main)/map');

  return (
    <View style={styles.container}>
      {/* Light status bar icons — matches the white text on the themed header. */}
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AppHeader
          greetingName={firstName}
          locationLabel={locationValue}
          searchPlaceholder="Search announcement and report"
        >
          <View style={styles.headerSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.announcementTitleRow}>
                <Text style={styles.sectionTitle}>Announcement</Text>
              </View>
              <TouchableOpacity
                style={styles.seeAllButton}
                activeOpacity={0.8}
                onPress={goToFeed}
                accessibilityRole="button"
                accessibilityLabel="Show all announcements"
              >
                <Text style={styles.seeAllText}>Show All</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.white} />
              </TouchableOpacity>
            </View>

            {ANNOUNCEMENTS.length === 0 && (
              <View style={styles.emptyCard}>
                <Ionicons name="megaphone-outline" size={18} color={homeColors.headerMuted} />
                <Text style={styles.emptyTitle}>No announcements yet</Text>
              </View>
            )}
          </View>
        </AppHeader>

        <View style={styles.bodySection}>
          <View style={styles.happeningSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleDark}>Happening near you</Text>
              <TouchableOpacity
                style={styles.seeAllButton}
                activeOpacity={0.8}
                onPress={goToFeed}
                accessibilityRole="button"
                accessibilityLabel="Show all nearby activity"
              >
                <Text style={styles.seeAllTextDark}>Show All</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.text} />
              </TouchableOpacity>
            </View>

            {HAPPENING_NEAR_YOU.length === 0 && (
              <View style={styles.emptyCardDark}>
                <Ionicons name="pulse-outline" size={18} color={colors.textMuted} />
                <Text style={styles.emptyTitleDark}>Nothing nearby right now</Text>
              </View>
            )}

            <HomeMapPreview />
          </View>

          <View style={styles.happeningSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleDark}>Hotlines</Text>
              <TouchableOpacity
                style={styles.seeAllButton}
                activeOpacity={0.8}
                onPress={goToMap}
                accessibilityRole="button"
                accessibilityLabel="View hotlines in map"
              >
                <Text style={styles.seeAllTextDark}>View in map</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.emptyCardDark}>
              <Ionicons name="call-outline" size={18} color={colors.textMuted} />
              <Text style={styles.emptyTitleDark}>No hotlines added yet</Text>
            </View>
          </View>

          <View style={styles.happeningSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitleDark}>Facilities</Text>
              <TouchableOpacity
                style={styles.seeAllButton}
                activeOpacity={0.8}
                onPress={goToMap}
                accessibilityRole="button"
                accessibilityLabel="View facilities in map"
              >
                <Text style={styles.seeAllTextDark}>View in map</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.emptyCardDark}>
              <Ionicons name="business-outline" size={18} color={colors.textMuted} />
              <Text style={styles.emptyTitleDark}>No facilities added yet</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <WelcomeModal
        visible={showWelcome}
        firstName={firstName}
        barangay={barangay}
        onDone={() => setShowWelcome(false)}
      />
    </View>
  );
}
