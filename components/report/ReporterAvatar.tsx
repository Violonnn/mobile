// components/report/ReporterAvatar.tsx
// Initial-based avatar for a report/comment author (no profile photos yet).
// Lives in its own file so both the report detail card and the comments
// section can use it without importing each other.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, fontSizes, radius } from '../../styles/theme';
import { reporterInitial, type MapReportReporter } from '../../lib/reports';

export function ReporterAvatar({
  reporter,
  size = 44,
}: {
  reporter: MapReportReporter;
  size?: number;
}) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, size < 40 && styles.avatarTextSmall]}>
        {reporterInitial(reporter)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.primary,
  },
  avatarTextSmall: {
    fontSize: fontSizes.md,
  },
});
