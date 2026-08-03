// Non-PII resource detail sheet for facility / evacuation-center map pins.
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MapResourceMarker } from './InteractiveMap';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={sheetStyles.handle} />
          <View style={sheetStyles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={sheetStyles.kind}>{kindLabel}</Text>
              <Text style={sheetStyles.title}>{resource.name}</Text>
              {resource.subtitle ? (
                <Text style={sheetStyles.subtitle}>{resource.subtitle}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.35)',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: spacing.sm,
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
