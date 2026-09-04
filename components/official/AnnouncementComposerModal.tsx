// Shared official bottom-sheet composer. Closing never publishes a draft.
import React, { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSizes, radius, spacing } from '../../styles/theme';
import { MAX_ANNOUNCEMENT_PHOTOS, pickAnnouncementMedia, validateAnnouncementMedia, type AnnouncementDraftMedia } from '../../lib/announcementMedia';

type Props = {
  visible: boolean;
  displayName: string;
  initials: string;
  description: string;
  media: AnnouncementDraftMedia[];
  isPinned: boolean;
  pinLabel: string | null;
  audienceLabel?: string | null;
  submitting: boolean;
  error: string | null;
  onChangeDescription: (value: string) => void;
  onChangeMedia: (media: AnnouncementDraftMedia[]) => void;
  onChangePinned: (value: boolean) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export default function AnnouncementComposerModal(props: Props) {
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);

  const addMedia = async (type: 'photo' | 'video') => {
    const result = await pickAnnouncementMedia(type);
    if (result.error) {
      Alert.alert('Attachment unavailable', result.error);
      return;
    }
    const next = [...props.media, ...result.media];
    const error = validateAnnouncementMedia(next);
    if (error) {
      Alert.alert('Attachment limit', error);
      return;
    }
    props.onChangeMedia(next);
  };

  const requestClose = () => {
    if (!props.description.trim() && props.media.length === 0 && !props.isPinned) {
      props.onClose();
      return;
    }
    Alert.alert('Discard announcement?', 'Your unfinished announcement and attachments will be removed.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: props.onClose },
    ]);
  };

  return (
    <Modal visible={props.visible} transparent animationType="slide" presentationStyle="overFullScreen" onRequestClose={requestClose}>
      <View style={localStyles.overlay}>
        <Pressable style={localStyles.backdrop} onPress={requestClose} />
        {/* Sheet fills from below the status/notification bar to the bottom of the screen. */}
        <View style={[localStyles.sheet, { marginTop: insets.top }]}>
          <View style={localStyles.header}>
            <View style={localStyles.headerSide} />
            <Text style={localStyles.headerTitle}>{editing ? 'Add description' : 'Create Announcement'}</Text>
            <TouchableOpacity style={localStyles.headerSide} onPress={editing ? () => setEditing(false) : requestClose} accessibilityRole="button" accessibilityLabel={editing ? 'Done editing description' : 'Close announcement composer'}>
              <Text style={editing ? localStyles.doneText : localStyles.closeText}>{editing ? 'Done' : '×'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={localStyles.body} contentContainerStyle={localStyles.content} keyboardShouldPersistTaps="handled">
            <View style={localStyles.authorRow}>
              <View style={localStyles.avatar}>
                <Text style={localStyles.avatarText}>{props.initials}</Text>
              </View>
              <Text style={localStyles.authorName} numberOfLines={2}>
                {props.displayName}
              </Text>
            </View>
            {props.audienceLabel ? (
              <View style={localStyles.audienceRow} accessibilityLabel={props.audienceLabel}>
                <Ionicons name="people-outline" size={16} color={colors.themeSoft} />
                <Text style={localStyles.audienceText}>{props.audienceLabel}</Text>
              </View>
            ) : null}
            {editing ? (
              <TextInput
                style={localStyles.descriptionInput}
                value={props.description}
                onChangeText={props.onChangeDescription}
                placeholder="What would be your announcement?"
                placeholderTextColor={colors.textMuted}
                multiline
                autoFocus
                maxLength={4000}
                editable={!props.submitting}
              />
            ) : (
              // Full prompt area is tappable — not only the placeholder text.
              <Pressable
                style={localStyles.descriptionPrompt}
                onPress={() => setEditing(true)}
                disabled={props.submitting}
                accessibilityRole="button"
                accessibilityLabel="Add announcement description"
              >
                <Text style={props.description.trim() ? localStyles.descriptionText : localStyles.placeholder}>
                  {props.description.trim() || 'What would be your announcement?'}
                </Text>
              </Pressable>
            )}
            {props.media.length > 0 ? <View style={localStyles.previewRow}>{props.media.map((item) => <View key={item.id} style={localStyles.preview}>{item.type === 'photo' ? <Image source={{ uri: item.localUri }} style={localStyles.previewImage} /> : <View style={localStyles.videoPreview}><Ionicons name="videocam" size={28} color={colors.white} /><Text style={localStyles.videoPreviewText}>Video</Text></View>}<TouchableOpacity style={localStyles.remove} onPress={() => props.onChangeMedia(props.media.filter((media) => media.id !== item.id))} accessibilityLabel="Remove attachment"><Ionicons name="close" size={14} color={colors.white} /></TouchableOpacity>{item.type === 'video' ? <View style={localStyles.videoBadge}><Ionicons name="play" size={12} color={colors.white} /></View> : null}</View>)}</View> : null}
            {props.pinLabel ? (
              <View style={localStyles.pinRow}>
                <View style={localStyles.pinTextGroup}>
                  <Text style={localStyles.pinLabel}>{props.pinLabel}</Text>
                  <Text style={localStyles.pinHint}>Pinned posts appear before newer posts in the feed.</Text>
                </View>
                <Switch
                  value={props.isPinned}
                  onValueChange={props.onChangePinned}
                  disabled={props.submitting}
                  trackColor={{ true: colors.themeSoft }}
                  accessibilityLabel={props.pinLabel}
                />
              </View>
            ) : null}
            {props.error ? <Text style={localStyles.error}>{props.error}</Text> : null}
          </ScrollView>
          <View style={[localStyles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
            <View style={localStyles.attachments}>
              <TouchableOpacity
                style={localStyles.iconButton}
                onPress={() => void addMedia('photo')}
                disabled={props.submitting || props.media.filter((item) => item.type === 'photo').length >= MAX_ANNOUNCEMENT_PHOTOS}
                accessibilityLabel="Choose photo from gallery"
              >
                <Ionicons name="images-outline" size={22} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={localStyles.iconButton}
                onPress={() => void addMedia('video')}
                disabled={props.submitting}
                accessibilityLabel="Choose video from gallery"
              >
                <Ionicons name="film-outline" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[localStyles.next, (!props.description.trim() || props.submitting) && localStyles.nextDisabled]} onPress={props.onSubmit} disabled={!props.description.trim() || props.submitting} accessibilityRole="button" accessibilityLabel="Publish announcement">
              {props.submitting ? <ActivityIndicator color={colors.white} /> : <Text style={localStyles.nextText}>Publish</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  overlay: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17,24,39,0.48)' },
  sheet: {
    flex: 1,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerSide: { width: 52, minHeight: 40, justifyContent: 'center', alignItems: 'flex-end' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: fontSizes.lg,
    color: colors.text,
  },
  closeText: { fontSize: 30, lineHeight: 30, color: colors.textMuted },
  doneText: { fontFamily: fonts.semibold, color: colors.primary, fontSize: fontSizes.sm },
  body: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Match official.styles initialAvatar used on Settings / Community.
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, color: colors.primary, fontSize: fontSizes.md },
  authorName: {
    flex: 1,
    fontFamily: fonts.semibold,
    color: colors.text,
    fontSize: fontSizes.md,
  },
  audienceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
  },
  audienceText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.text,
    lineHeight: 18,
  },
  descriptionPrompt: {
    flexGrow: 1,
    minHeight: 220,
    paddingVertical: spacing.sm,
    alignSelf: 'stretch',
  },
  placeholder: { fontFamily: fonts.regular, fontSize: fontSizes.lg, color: colors.textMuted },
  descriptionText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.lg,
    color: colors.text,
    lineHeight: 24,
  },
  descriptionInput: {
    flexGrow: 1,
    minHeight: 220,
    alignSelf: 'stretch',
    fontFamily: fonts.regular,
    fontSize: fontSizes.lg,
    color: colors.text,
    textAlignVertical: 'top',
  },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preview: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  previewImage: { width: '100%', height: '100%' },
  videoPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
    gap: 2,
  },
  videoPreviewText: { fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.white },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,24,39,0.72)',
  },
  videoBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,24,39,0.72)',
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pinTextGroup: { flex: 1, gap: 2 },
  pinLabel: { fontFamily: fonts.semibold, color: colors.text, fontSize: fontSizes.sm },
  pinHint: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: fontSizes.xs },
  error: { color: colors.danger, fontFamily: fonts.regular, fontSize: fontSizes.sm },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  attachments: { flexDirection: 'row', gap: 2 },
  iconButton: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  next: {
    minWidth: 86,
    minHeight: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
    paddingHorizontal: spacing.md,
  },
  nextDisabled: { backgroundColor: colors.textMuted },
  nextText: { color: colors.white, fontFamily: fonts.semibold, fontSize: fontSizes.md },
});
