import React from 'react';
import { Modal, View, Image, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { reportStyles as styles, reportColors } from '../../styles/screens/report.styles';
import type { CapturedMedia } from '../../lib/reportMedia';

/** Video is a child so useVideoPlayer only runs while a clip is on screen. */
function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <VideoView
      style={styles.previewVideo}
      player={player}
      nativeControls
      allowsFullscreen
      contentFit="contain"
    />
  );
}

type Props = {
  media: CapturedMedia | null;
  onClose: () => void;
};

export default function MediaPreview({ media, onClose }: Props) {
  if (!media) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.previewOverlay} onPress={onClose}>
        <Pressable style={styles.previewContent} onPress={() => {}}>
          {media.type === 'photo' ? (
            <Image
              source={{ uri: media.localUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : (
            <VideoPreview uri={media.localUri} />
          )}
        </Pressable>
        <TouchableOpacity
          style={styles.previewClose}
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close preview"
        >
          <Ionicons name="close" size={26} color={reportColors.white} />
        </TouchableOpacity>
      </Pressable>
    </Modal>
  );
}
