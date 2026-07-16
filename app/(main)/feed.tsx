// app/(main)/feed.tsx — feed tab. Shares the search bar with home; shows the
// Announcement and Report feeds (empty placeholders for now).
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../../components/navigation/AppHeader';
import { tabStyles as styles } from '../../styles/screens/tab.styles';
import { colors } from '../../styles/theme';

export default function FeedScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <AppHeader title="Feed" searchPlaceholder="Search announcement, and report" />
      <ScrollView
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Announcement</Text>
          <View style={styles.emptyBlock}>
            <Ionicons name="megaphone-outline" size={18} color={colors.textMuted} />
            <Text style={styles.emptyLine}>No announcements yet</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Report</Text>
          <View style={styles.emptyBlock}>
            <Ionicons name="newspaper-outline" size={18} color={colors.textMuted} />
            <Text style={styles.emptyLine}>No reports yet</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
