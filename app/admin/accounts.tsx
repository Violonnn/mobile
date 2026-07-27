// app/admin/accounts.tsx — UI-only placeholder for future account management.
// Intentionally performs no Supabase fetches and exposes no account data.

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { adminStyles as styles } from '../../styles/screens/admin.styles';
import { colors } from '../../styles/theme';

const CAPABILITIES = [
  {
    title: 'Official accounts',
    icon: 'people-outline' as const,
  },
  {
    title: 'Access status',
    icon: 'shield-checkmark-outline' as const,
  },
  {
    title: 'Role & barangay scope',
    icon: 'map-outline' as const,
  },
];

export default function AdminAccountsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerTextGroup}>
          <Text style={styles.title}>Accounts</Text>
          <Text style={styles.subtitle}>Official access management</Text>
        </View>

        <View style={styles.emptyStateCard}>
          <View style={styles.emptyStateIcon}>
            <Ionicons
              name="shield-outline"
              size={32}
              color={colors.themeSoft}
            />
          </View>

          <View style={styles.capabilityList}>
            {CAPABILITIES.map((item) => (
              <View key={item.title} style={styles.capabilityRow}>
                <View style={styles.capabilityIcon}>
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={colors.textMuted}
                  />
                </View>
                <View style={styles.capabilityTextGroup}>
                  <Text style={styles.capabilityTitle}>{item.title}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
