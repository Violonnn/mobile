// Non-PII resource detail sheet for facility / evacuation-center map pins.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MapResourceMarker } from './InteractiveMap';
import { colors, fonts, fontSizes, spacing } from '../../styles/theme';
import ResidentBottomSheet from '../ui/ResidentBottomSheet';

type Props = {
  visible: boolean;
  resource: MapResourceMarker | null;
  onClose: () => void;
};

export default function ResourceMapDetailSheet({
  visible,
  resource,
  onClose,
}: Props) {
  if (!resource) return null;

  const kindLabel =
    resource.kind === 'facility' ? 'Facility' : 'Evacuation center';

  return (
    <ResidentBottomSheet
      visible={visible}
      onClose={onClose}
      initialHeightRatio={0.34}
      minimumHeight={220}
      sheetStyle={sheetStyles.sheet}
      handleAccessibilityLabel={`Resize ${kindLabel.toLocaleLowerCase()} details`}
    >
          <View style={sheetStyles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={sheetStyles.kind}>{kindLabel}</Text>
              <Text style={sheetStyles.title}>{resource.name}</Text>
              {resource.subtitle ? (
                <Text style={sheetStyles.subtitle}>{resource.subtitle}</Text>
              ) : null}
            </View>
          </View>
    </ResidentBottomSheet>
  );
}

const sheetStyles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  kind: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.lg,
    color: colors.text,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
});
