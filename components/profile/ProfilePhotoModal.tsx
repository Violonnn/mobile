import React, { type RefObject, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import {
  pickMyProfilePhoto,
  removeMyProfilePhoto,
  saveMyProfilePhoto,
} from '../../lib/profilePhoto';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
import ProfileAvatar from './ProfileAvatar';

type ProfilePhotoModalProps = {
  visible: boolean;
  firstName: string;
  lastName: string;
  avatarPath: string | null;
  blurTarget?: RefObject<View | null>;
  onClose: () => void;
  onChanged: (avatarPath: string | null) => void;
};

export default function ProfilePhotoModal({
  visible,
  firstName,
  lastName,
  avatarPath,
  blurTarget,
  onClose,
  onChanged,
}: ProfilePhotoModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [removalPending, setRemovalPending] = useState(false);
  const [previousVisible, setPreviousVisible] = useState(visible);

  if (visible !== previousVisible) {
    setPreviousVisible(visible);
    if (visible) {
      setPendingPhotoUri(null);
      setRemovalPending(false);
    }
  }

  const busy = submitting || picking;
  const hasUnsavedChanges = pendingPhotoUri !== null || removalPending;
  const previewAvatarPath = removalPending ? null : avatarPath;

  function closeModal() {
    if (busy) return;
    if (!hasUnsavedChanges) {
      onClose();
      return;
    }

    const warningTitle = pendingPhotoUri ? 'Discard changes?' : 'Discard removal?';
    const warningMessage = pendingPhotoUri
      ? 'Your selected photo has not been saved yet.'
      : 'Your profile picture removal has not been saved yet.';
    Alert.alert(warningTitle, warningMessage, [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard changes',
        style: 'destructive',
        onPress: () => {
          setPendingPhotoUri(null);
          setRemovalPending(false);
          onClose();
        },
      },
    ]);
  }

  async function choosePhoto() {
    if (busy) return;

    setPicking(true);
    const result = await pickMyProfilePhoto();
    setPicking(false);

    if (result.cancelled) return;
    if (result.error || !result.previewUri) {
      Alert.alert('Photo not selected', result.error || 'Please try again.');
      return;
    }

    setPendingPhotoUri(result.previewUri);
    setRemovalPending(false);
  }

  async function savePhoto() {
    if (!pendingPhotoUri || busy) return;

    setSubmitting(true);
    const result = await saveMyProfilePhoto(pendingPhotoUri, avatarPath);
    setSubmitting(false);

    if (result.error || !result.avatarPath) {
      Alert.alert('Photo not saved', result.error || 'Please try again.');
      return;
    }

    setPendingPhotoUri(null);
    onChanged(result.avatarPath);
    onClose();
    Alert.alert('Profile picture updated');
  }

  function confirmRemovePhoto() {
    if ((!avatarPath && !pendingPhotoUri) || busy) return;

    // Removing an unsaved first photo simply returns to the empty state.
    if (!avatarPath) {
      setPendingPhotoUri(null);
      setRemovalPending(false);
      return;
    }

    Alert.alert(
      'Remove profile picture?',
      'Your initials will be shown instead. The removal will not take effect until you save it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setPendingPhotoUri(null);
            setRemovalPending(true);
          },
        },
      ],
    );
  }

  async function saveRemoval() {
    if (!avatarPath || !removalPending || busy) return;

    setSubmitting(true);
    const error = await removeMyProfilePhoto(avatarPath);
    setSubmitting(false);

    if (error) {
      Alert.alert('Photo not removed', error);
      return;
    }

    setRemovalPending(false);
    onChanged(null);
    Alert.alert('Profile picture removed', 'Your initials will now be shown across DisasterLink.');
  }

  function handlePrimaryAction() {
    if (pendingPhotoUri) {
      void savePhoto();
      return;
    }
    if (removalPending) {
      void saveRemoval();
      return;
    }
    void choosePhoto();
  }

  const primaryLabel = pendingPhotoUri
    ? 'Save photo'
    : removalPending
      ? 'Save removal'
      : avatarPath
        ? 'Change photo'
        : 'Add photo';
  const primaryIcon = pendingPhotoUri
    ? 'checkmark-circle-outline'
    : removalPending
      ? 'trash-outline'
      : 'image';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={closeModal}
    >
      <View style={styles.overlay}>
        <BlurView
          blurTarget={blurTarget}
          blurMethod={blurTarget ? 'dimezisBlurView' : 'none'}
          blurReductionFactor={1}
          intensity={32}
          tint="regular"
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          style={styles.backdrop}
          onPress={busy ? undefined : closeModal}
          accessibilityLabel="Close profile picture"
        />

        <View style={styles.cardShadow}>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeModal}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Close profile picture"
            >
              <Ionicons name="close" size={23} color={colors.text} />
            </TouchableOpacity>

            <Text style={styles.title}>Profile picture</Text>
            <Text style={styles.hint}>JPG, JPEG, PNG, or WebP · Up to 5 MB</Text>
            <ProfileAvatar
              avatarPath={previewAvatarPath}
              imageUri={pendingPhotoUri}
              firstName={firstName}
              lastName={lastName}
              size={188}
              style={styles.photo}
              accessibilityLabel={`${firstName} ${lastName} profile picture`}
            />

            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.disabledButton]}
              onPress={handlePrimaryAction}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name={primaryIcon} size={21} color={colors.white} />
                  <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
                </>
              )}
            </TouchableOpacity>

            {pendingPhotoUri ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => void choosePhoto()}
                disabled={busy}
                accessibilityRole="button"
              >
                <Ionicons name="images-outline" size={19} color={colors.navigationActive} />
                <Text style={styles.secondaryButtonText}>Change photo</Text>
              </TouchableOpacity>
            ) : removalPending ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setRemovalPending(false)}
                disabled={busy}
                accessibilityRole="button"
              >
                <Ionicons name="arrow-undo-outline" size={19} color={colors.navigationActive} />
                <Text style={styles.secondaryButtonText}>Keep current photo</Text>
              </TouchableOpacity>
            ) : null}

            {(avatarPath || pendingPhotoUri) && !removalPending ? (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={confirmRemovePhoto}
                disabled={busy}
                accessibilityRole="button"
              >
                <Ionicons name="trash-outline" size={19} color={colors.unverified} />
                <Text style={styles.removeButtonText}>Remove photo</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.1)',
  },
  cardShadow: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.xl,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 14,
  },
  card: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  title: {
    paddingHorizontal: spacing.xl,
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: colors.text,
    textAlign: 'center',
  },
  hint: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  photo: {
    marginBottom: spacing.lg,
    borderWidth: 4,
    borderColor: colors.white,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButton: {
    width: '100%',
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.navigationActive,
  },
  primaryButtonText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.md,
    color: colors.white,
  },
  secondaryButton: {
    width: '100%',
    minHeight: 46,
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
  },
  secondaryButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.navigationActive,
  },
  removeButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  removeButtonText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.md,
    color: colors.unverified,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
