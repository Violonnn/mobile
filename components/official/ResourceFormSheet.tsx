// Shared keyboard-safe shell for focused resource create/edit forms.
import React, { type ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

type ResourceFormSheetProps = {
  visible: boolean;
  title: string;
  hasUnsavedChanges: boolean;
  children: ReactNode;
  onClose: () => void;
};

export default function ResourceFormSheet({
  visible,
  title,
  hasUnsavedChanges,
  children,
  onClose,
}: ResourceFormSheetProps) {
  const insets = useSafeAreaInsets();

  function requestClose() {
    if (!hasUnsavedChanges) {
      onClose();
      return;
    }

    Alert.alert(
      'Discard changes?',
      'Your unfinished resource details will not be saved.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ],
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={requestClose}
    >
      <Pressable style={localStyles.overlay} onPress={requestClose}>
        <KeyboardAvoidingView
          style={localStyles.keyboardAvoider}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={[localStyles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
            onPress={() => {}}
          >
            <View style={localStyles.handle} />
            <View style={localStyles.header}>
              <Text style={localStyles.title}>{title}</Text>
              <TouchableOpacity
                style={localStyles.closeButton}
                onPress={requestClose}
                accessibilityRole="button"
                accessibilityLabel={`Close ${title}`}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={localStyles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17, 24, 39, 0.42)' },
  keyboardAvoider: { width: '100%', maxHeight: '94%' },
  sheet: { maxHeight: '100%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.white, overflow: 'hidden' },
  handle: { alignSelf: 'center', width: 42, height: 4, marginTop: spacing.sm, marginBottom: spacing.sm, borderRadius: radius.full, backgroundColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.text },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, gap: spacing.md },
});
