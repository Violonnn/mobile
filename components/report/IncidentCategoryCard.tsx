import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatIncidentType, incidentTypeTone, type IncidentType } from '../../lib/incidentTypes';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

/**
 * Washed incident-type banner shown in the media area when a post has no
 * shareable photo. The category color matches the map marker and type tag.
 */
export default function IncidentCategoryCard({
  incidentType,
  incidentTypeOther,
  label,
  note,
  compact = false,
}: {
  incidentType: IncidentType | null;
  incidentTypeOther: string | null;
  /** Overrides the formatted type, e.g. the public type label of an incident. */
  label?: string;
  note?: string;
  compact?: boolean;
}): React.JSX.Element {
  const tone = incidentTypeTone(incidentType);
  const typeLabel = label ?? formatIncidentType(incidentType, incidentTypeOther);

  // Compact tiles sit where a 64px media thumbnail would, so they show the glyph only.
  if (compact) {
    return (
      <View
        style={[styles.compactTile, { backgroundColor: tone.softColor, borderColor: tone.color }]}
        accessible
        accessibilityLabel={`${typeLabel} report`}
      >
        <Ionicons name={tone.icon} size={26} color={tone.color} />
      </View>
    );
  }

  return (
    <View
      style={[styles.card, { backgroundColor: tone.softColor }]}
      accessible
      accessibilityLabel={`${typeLabel} report`}
    >
      {/* Large faded glyph gives the banner depth without implying a real photo. */}
      <Ionicons name={tone.icon} size={132} color={tone.color} style={styles.watermark} />
      <View style={styles.iconBubble}>
        <Ionicons name={tone.icon} size={26} color={tone.color} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, { color: tone.color }]} numberOfLines={2}>
          {typeLabel}
        </Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 2.4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  compactTile: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  watermark: {
    position: 'absolute',
    right: -18,
    bottom: -26,
    opacity: 0.1,
  },
  iconBubble: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.white,
    shadowColor: '#0F2044',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    lineHeight: 16,
    color: colors.textMuted,
  },
});
