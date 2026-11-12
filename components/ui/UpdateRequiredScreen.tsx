import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ReleasePolicy } from '../../lib/appVersion';
import { openHotlineDialer } from '../../lib/resources';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

type Props = {
  policy: ReleasePolicy;
  onRetry: () => void;
  isChecking?: boolean;
};

export default function UpdateRequiredScreen({ policy, onRetry, isChecking = false }: Props): React.JSX.Element {
  const [openingDownload, setOpeningDownload] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadUpdate() {
    if (!policy.downloadUrl || openingDownload) return;
    setOpeningDownload(true);
    setError(null);
    try {
      await Linking.openURL(policy.downloadUrl);
    } catch {
      setError('Could not open the update link. Try again or check for updates again.');
    } finally {
      setOpeningDownload(false);
    }
  }

  async function callEmergency(number: string) {
    const result = await openHotlineDialer(number);
    setError(result.error);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="cloud-download-outline" size={36} color={colors.primary} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>Update required</Text>
          <Text style={styles.body}>
            {policy.updateMessage || 'Install the latest DisasterLink update to continue.'}
          </Text>
          <Text style={styles.body}>Latest version: {policy.latestVersion}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: openingDownload, busy: openingDownload }}
            disabled={openingDownload}
            onPress={() => void downloadUpdate()}
            style={[styles.primaryButton, openingDownload && styles.disabled]}
          >
            {openingDownload && <ActivityIndicator color={colors.white} />}
            <Text style={styles.primaryText}>Download update</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isChecking, busy: isChecking }}
            disabled={isChecking}
            onPress={() => { setError(null); onRetry(); }}
            style={[styles.secondaryButton, isChecking && styles.disabled]}
          >
            {isChecking && <ActivityIndicator color={colors.primary} />}
            <Text style={styles.secondaryText}>{isChecking ? 'Checking…' : 'Check again'}</Text>
          </Pressable>
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </View>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.subtitle}>Need emergency help?</Text>
          <Text style={styles.body}>These numbers remain available while you update.</Text>
          {policy.emergencyNumbers.map((hotline, index) => (
            <Pressable
              key={`${hotline.number}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`Call ${hotline.label}, ${hotline.number}`}
              onPress={() => void callEmergency(hotline.number)}
              style={styles.hotline}
            >
              <Ionicons name="call-outline" size={22} color={colors.primary} />
              <View style={styles.hotlineText}>
                <Text style={styles.secondaryText}>{hotline.label}</Text>
                <Text style={styles.body}>{hotline.number}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primaryLight },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  card: { width: '100%', maxWidth: 520, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.card, gap: spacing.md },
  icon: { alignSelf: 'flex-start', padding: spacing.md, borderRadius: radius.full, backgroundColor: colors.primaryLight },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.xxl, color: colors.text },
  subtitle: { fontFamily: fonts.semibold, fontSize: fontSizes.xl, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.lg, color: colors.textMuted },
  primaryButton: { minHeight: 48, padding: spacing.md, borderRadius: radius.full, backgroundColor: colors.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  primaryText: { fontFamily: fonts.semibold, fontSize: fontSizes.lg, color: colors.white, textAlign: 'center' },
  secondaryButton: { minHeight: 48, padding: spacing.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  secondaryText: { fontFamily: fonts.semibold, fontSize: fontSizes.lg, color: colors.primary },
  disabled: { opacity: 0.6 },
  hotline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  hotlineText: { flex: 1, gap: spacing.xs },
  error: { fontFamily: fonts.medium, fontSize: fontSizes.md, color: colors.unverified },
});
