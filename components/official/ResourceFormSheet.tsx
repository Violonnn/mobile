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
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';

type ResourceFormSheetProps = {
  visible: boolean;
  title: string;
  hasUnsavedChanges: boolean;
  discardMessage?: string;
  children: ReactNode;
  onClose: () => void;
  stableHeight?: boolean;
};

export default function ResourceFormSheet({
  visible,
  title,
  hasUnsavedChanges,
  discardMessage = 'Your unfinished resource details will not be saved.',
  children,
  onClose,
  stableHeight = false,
}: ResourceFormSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const stableSheetHeight = Math.min(
    (viewportHeight - insets.top) * 0.9,
    viewportHeight - insets.top - spacing.md,
  );

  function requestClose() {
    if (!hasUnsavedChanges) {
      onClose();
      return;
    }

    Alert.alert(
      'Discard changes?',
      discardMessage,
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
      animationType='slide'
      presentationStyle='overFullScreen'
      onRequestClose={requestClose}
    >
      <View style={localStyles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
          accessibilityRole="button"
          accessibilityLabel={`Dismiss ${title}`}
        />
        <KeyboardAvoidingView
          style={[
            localStyles.keyboardAvoider,
            stableHeight && { height: stableSheetHeight },
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={[localStyles.sheet, stableHeight && { flex: 1 }, {
              paddingBottom: Math.max(insets.bottom, spacing.md),
            }]}
          >
            <View style={localStyles.header}>
              <Text style={localStyles.title}>{title}</Text>
              <TouchableOpacity
                style={localStyles.closeButton}
                onPress={requestClose}
                accessibilityRole='button'
                accessibilityLabel={`Close ${title}`}
              >
                <Ionicons name='close' size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={[
                localStyles.scroll,
                stableHeight && localStyles.stableScroll,
              ]}
              contentContainerStyle={localStyles.content}
              keyboardShouldPersistTaps='handled'
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.42)',
  },
  keyboardAvoider: { width: '100%', maxHeight: '94%', flexShrink: 1, minHeight: 0 },
  sheet: {
    maxHeight: '100%',
    minHeight: 0,
    flexShrink: 1,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.white,
    overflow: 'hidden',
    paddingTop: spacing.md,
  },
  scroll: { flexShrink: 1, minHeight: 0 },
  stableScroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingBottom: spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  closeButton: {
    width: 44,
    height: 44,
    marginLeft: spacing.sm,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
});
