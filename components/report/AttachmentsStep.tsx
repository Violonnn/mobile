import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reportStyles as styles, reportColors } from '../../styles/screens/report.styles';
import MediaPreview from './MediaPreview';
import type { CapturedMedia } from '../../lib/reportMedia';

type Props = {
  media: CapturedMedia[];
  usedPhotoSlots: number;
  usedVideoSeconds: number;
  maxPhotos: number;
  maxVideoSeconds: number;
  canProceed: boolean;
  error: string | null;
  onAddPhoto: () => void;
  onAddVideo: () => void;
  onRemove: (id: string) => void;
  onBack?: () => void;
  onNext: () => void;
  residentLayout?: boolean;
};

export default function AttachmentsStep({
  media,
  usedPhotoSlots,
  usedVideoSeconds,
  maxPhotos,
  maxVideoSeconds,
  canProceed,
  error,
  onAddPhoto,
  onAddVideo,
  onRemove,
  onBack,
  onNext,
  residentLayout = false,
}: Props) {
  const [preview, setPreview] = useState<CapturedMedia | null>(null);

  const photosFull = usedPhotoSlots >= maxPhotos;
  const videoFull = usedVideoSeconds >= maxVideoSeconds;
  const videoOver = usedVideoSeconds > maxVideoSeconds;

  if (residentLayout) {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.residentStepTitle}>Add what you can{`\n`}safely capture</Text>
        <Text style={styles.residentStepSubtitle}>
          One clear photo or video is enough.
        </Text>

        <TouchableOpacity
          style={[styles.residentPhotoAction, photosFull && styles.mediaButtonDisabled]}
          onPress={onAddPhoto}
          disabled={photosFull}
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
        >
          <View style={styles.residentCameraCircle}>
            <Ionicons name="camera" size={29} color={reportColors.white} />
          </View>
          <Text style={styles.residentCaptureLabel}>Take a photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.residentVideoAction, videoFull && styles.mediaButtonDisabled]}
          onPress={onAddVideo}
          disabled={videoFull}
          accessibilityRole="button"
          accessibilityLabel="Record video"
        >
          <Ionicons name="videocam" size={23} color={reportColors.primary} />
          <Text style={styles.residentVideoActionText}>Record video</Text>
        </TouchableOpacity>

        <View style={styles.residentEvidenceHeader}>
          <Text style={styles.residentEvidenceTitle}>Your evidence</Text>
          <Text style={styles.residentEvidenceCount}>
            {media.length} {media.length === 1 ? 'file' : 'files'} ready
          </Text>
        </View>

        {media.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.residentEvidenceRow}
          >
            {media.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.residentEvidenceCard}
                onPress={() => setPreview(item)}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={item.type === 'photo' ? 'View photo' : 'Play video'}
              >
                {item.type === 'photo' ? (
                  <Image source={{ uri: item.localUri }} style={styles.residentEvidenceImage} />
                ) : (
                  <View style={styles.residentEvidenceVideo}>
                    <Ionicons name="play-circle" size={46} color={reportColors.white} />
                    <Text style={styles.residentVideoDuration}>
                      {(item.durationSeconds ?? 0).toFixed(0)}s
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.residentRemoveEvidence}
                  onPress={(event) => {
                    event.stopPropagation();
                    onRemove(item.id);
                  }}
                  hitSlop={5}
                  accessibilityRole="button"
                  accessibilityLabel="Remove attachment"
                >
                  <Ionicons name="close" size={18} color={reportColors.primary} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.residentEvidenceEmpty}>
            <Ionicons name="images-outline" size={23} color={reportColors.textLight} />
            <Text style={styles.residentEvidenceEmptyText}>Captured evidence appears here</Text>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            styles.residentPrimaryButton,
            !canProceed && styles.primaryButtonDisabled,
          ]}
          onPress={onNext}
          disabled={!canProceed}
          accessibilityRole="button"
          accessibilityLabel="Continue to report details"
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>

        <MediaPreview media={preview} onClose={() => setPreview(null)} />
      </View>
    );
  }

  return (
    <View style={styles.stepContent}>
      <View style={styles.stepTitleRow}>
        <Ionicons name="eye-outline" size={18} color={reportColors.text} />
        <Text style={styles.stepTitle}>What are you seeing?</Text>
      </View>
      <Text style={styles.stepSubtitle}>
        Capture live photos and video from your camera. Add up to {maxPhotos}{' '}
        photos and at least one clip. Total video must stay within{' '}
        {maxVideoSeconds}s.
      </Text>

      <View style={styles.counterRow}>
        <Text style={styles.counterText}>
          Photos {usedPhotoSlots}/{maxPhotos}
        </Text>
        <Text style={[styles.counterText, videoOver && styles.counterOver]}>
          {usedVideoSeconds.toFixed(1)}s / {maxVideoSeconds}s
        </Text>
      </View>

      <View style={styles.mediaActions}>
        <TouchableOpacity
          style={[styles.mediaButton, photosFull && styles.mediaButtonDisabled]}
          onPress={onAddPhoto}
          disabled={photosFull}
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
        >
          <Ionicons name="camera-outline" size={18} color={reportColors.primary} />
          <Text style={styles.mediaButtonText}>Take photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mediaButton, videoFull && styles.mediaButtonDisabled]}
          onPress={onAddVideo}
          disabled={videoFull}
          accessibilityRole="button"
          accessibilityLabel="Record a video"
        >
          <Ionicons name="videocam-outline" size={18} color={reportColors.primary} />
          <Text style={styles.mediaButtonText}>Record video</Text>
        </TouchableOpacity>
      </View>

      {media.length > 0 ? (
        <View style={styles.mediaList}>
          {media.map((item) => (
            <View key={item.id} style={styles.mediaChip}>
              <TouchableOpacity
                style={styles.chipPreview}
                onPress={() => setPreview(item)}
                accessibilityRole="button"
                accessibilityLabel={
                  item.type === 'photo' ? 'View photo' : 'Play video'
                }
              >
                {item.type === 'photo' ? (
                  <Image source={{ uri: item.localUri }} style={styles.thumb} />
                ) : (
                  <View style={styles.videoThumb}>
                    <Ionicons name="play" size={16} color={reportColors.white} />
                  </View>
                )}
                <Text style={styles.mediaChipLabel} numberOfLines={1}>
                  {item.type === 'photo'
                    ? 'Photo · tap to view'
                    : `Video · ${(item.durationSeconds ?? 0).toFixed(1)}s`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onRemove(item.id)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Remove attachment"
              >
                <Ionicons name="trash-outline" size={18} color={reportColors.accent} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.footerRow}>
        {onBack ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to location"
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.primaryButton, !canProceed && styles.primaryButtonDisabled]}
          onPress={onNext}
          disabled={!canProceed}
          accessibilityRole="button"
          accessibilityLabel="Continue to report details"
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      <MediaPreview media={preview} onClose={() => setPreview(null)} />
    </View>
  );
}
