import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  formatIncidentType,
  incidentTypeTone,
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
  const tone = incidentTypeTone(incidentType);
  return (
    <View style={[styles.badge, { backgroundColor: tone.softColor }]}>
      <Ionicons name={tone.icon} size={13} color={tone.color} />
      <Text style={[styles.label, { color: tone.color }]} numberOfLines={1}>
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
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  label: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    color: colors.text,
  },
});
