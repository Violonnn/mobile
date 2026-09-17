// Compact secondary-detail sheet for resource cards.
import React, { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

type ResourceDetailSheetProps = {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export default function ResourceDetailSheet({ visible, title, children, onClose }: ResourceDetailSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={localStyles.overlay} onPress={onClose}>
        <Pressable style={localStyles.sheet} onPress={() => {}}>
          <View style={localStyles.header}>
            <Text style={localStyles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close details">
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={localStyles.content} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function ResourceDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={localStyles.row}>
      <Text style={localStyles.label}>{label}</Text>
      <Text style={localStyles.value}>{value}</Text>
    </View>
  );
}

export function ResourceAuditRow({
  label,
  name,
  dateTime,
}: {
  label: string;
  name: string;
  dateTime: string;
}) {
  return (
    <View style={localStyles.row}>
      <Text style={localStyles.label}>{label}</Text>
      <View style={localStyles.auditValueRow}>
        <Text style={localStyles.value}>{name}</Text>
        <Text style={localStyles.auditDate}>· {dateTime}</Text>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17, 24, 39, 0.42)' },
  sheet: { maxHeight: '76%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.white, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingBottom: spacing.sm },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.text },
  content: { paddingTop: spacing.sm, gap: spacing.md },
  row: { gap: spacing.xs },
  label: { fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  value: { fontFamily: fonts.regular, fontSize: fontSizes.md, color: colors.text, lineHeight: 22 },
  auditValueRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: spacing.xs },
  auditDate: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.textMuted },
});
