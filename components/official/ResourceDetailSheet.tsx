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
          <View style={localStyles.handle} />
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

const localStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17, 24, 39, 0.42)' },
  sheet: { maxHeight: '76%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.white, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  handle: { alignSelf: 'center', width: 42, height: 4, marginVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.text },
  content: { paddingTop: spacing.md, gap: spacing.md },
  row: { gap: spacing.xs },
  label: { fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  value: { fontFamily: fonts.regular, fontSize: fontSizes.md, color: colors.text, lineHeight: 22 },
});
