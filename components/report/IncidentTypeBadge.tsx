import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  formatIncidentType,
  type IncidentType,
} from '../../lib/incidentTypes';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

export default function IncidentTypeBadge({
  incidentType,
  incidentTypeOther,
}: {
  incidentType: IncidentType | null | undefined;
  incidentTypeOther?: string | null;
}) {
  return (
    <View style={styles.badge}>
      <Ionicons name="warning-outline" size={13} color={colors.navigationActive} />
      <Text style={styles.label} numberOfLines={1}>
        {formatIncidentType(incidentType, incidentTypeOther)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  label: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: colors.navigationActive,
  },
});
