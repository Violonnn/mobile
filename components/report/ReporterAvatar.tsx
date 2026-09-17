// components/report/ReporterAvatar.tsx
// Shared profile-photo avatar for a report/comment author.
// Lives in its own file so both the report detail card and the comments
// section can use it without importing each other.
import React from 'react';
import { StyleSheet } from 'react-native';
import { colors } from '../../styles/theme';
import { type MapReportReporter } from '../../lib/reports';
import ProfileAvatar from '../profile/ProfileAvatar';

export function ReporterAvatar({
  reporter,
  size = 44,
}: {
  reporter: MapReportReporter;
  size?: number;
}) {
  return (
    <ProfileAvatar
      avatarPath={reporter.avatarPath}
      firstName={reporter.firstName}
      lastName={reporter.lastName}
      size={size}
      style={styles.avatar}
      accessibilityLabel={`${reporter.firstName} ${reporter.lastName} profile picture`}
    />
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
});
