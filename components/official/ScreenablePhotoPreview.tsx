import React, { useState } from 'react';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View, type ImageStyle, type StyleProp } from 'react-native';

import type { ReportMediaAttachment } from '../../lib/reports';
import { colors, fonts, spacing } from '../../styles/theme';
import { ReportMediaPreviewModal } from '../report/ReportDetailCard';

export default function ScreenablePhotoPreview({
  uri,
  fullSizeUri = uri,
  accessibilityLabel,
  thumbnailStyle,
  contentFit = 'cover',
  disabled = false,
  onFullSizeLoad,
  onFullSizeError,
}: {
  uri: string | null;
  fullSizeUri?: string | null;
  accessibilityLabel: string;
  thumbnailStyle: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
  disabled?: boolean;
  onFullSizeLoad?: () => void;
  onFullSizeError?: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewAttempt, setPreviewAttempt] = useState(0);

  if (!uri) return null;

  const preview: ReportMediaAttachment | null = previewOpen && fullSizeUri
    ? {
      id: `screening-photo-${previewAttempt}`,
      type: 'photo',
      url: fullSizeUri,
      durationSeconds: null,
    }
    : null;

  function openPreview() {
    if (!fullSizeUri) return;
    setPreviewError(false);
    setPreviewLoading(true);
    setPreviewOpen(true);
  }

  function retryPreview() {
    setPreviewAttempt((attempt) => attempt + 1);
    setPreviewError(false);
    setPreviewLoading(true);
  }

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Opens the full-size photo and public screening checklist."
        accessibilityState={{ disabled: disabled || !fullSizeUri }}
        disabled={disabled || !fullSizeUri}
        onPress={openPreview}
        activeOpacity={0.85}
      >
        <Image source={{ uri }} contentFit={contentFit} style={thumbnailStyle} />
      </TouchableOpacity>
      <ReportMediaPreviewModal
        preview={preview}
        onClose={() => setPreviewOpen(false)}
        onImageError={() => {
          setPreviewLoading(false);
          setPreviewError(true);
          onFullSizeError?.();
        }}
        onImageLoad={() => {
          setPreviewError(false);
          onFullSizeLoad?.();
        }}
        onImageLoadEnd={() => setPreviewLoading(false)}
        footer={(
          <View style={previewStyles.footer}>
            <Text style={previewStyles.heading}>Photo safety checklist</Text>
            <Text style={previewStyles.body}>
              Exclude these items from public photos:
            </Text>
            <View style={previewStyles.rules}>
              {photoSafetyRules.map((rule) => (
                <View
                  key={rule.label}
                  accessible
                  accessibilityLabel={`Do not publish photos with ${rule.label.toLowerCase()}`}
                  style={previewStyles.ruleChip}
                >
                  <Ionicons name={rule.icon} size={14} color={colors.danger} />
                  <Text style={previewStyles.ruleText}>{rule.label}</Text>
                </View>
              ))}
            </View>
            <Text style={previewStyles.body}>
              Original evidence stays private.
            </Text>
            {previewLoading ? <Text accessibilityLiveRegion="polite" style={previewStyles.status}>Loading full-size photo…</Text> : null}
            {previewError ? (
              <View style={previewStyles.errorRow}>
                <Text accessibilityLiveRegion="polite" style={previewStyles.error}>Could not load the full-size photo.</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry loading the full-size photo" onPress={retryPreview}>
                  <Text style={previewStyles.retry}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      />
    </>
  );
}

const photoSafetyRules: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { label: 'Injured faces', icon: 'body-outline' },
  { label: 'Children', icon: 'people-outline' },
  { label: 'House numbers', icon: 'home-outline' },
  { label: 'Vehicle plates', icon: 'car-outline' },
  { label: 'Contact details', icon: 'call-outline' },
  { label: 'Private notes', icon: 'document-text-outline' },
];

const previewStyles = {
  footer: { gap: spacing.xs } as const,
  heading: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 } as const,
  body: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 } as const,
  rules: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.xs } as const,
  ruleChip: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, paddingHorizontal: spacing.xs, paddingVertical: 3, borderRadius: 9999, backgroundColor: colors.offWhite } as const,
  ruleText: { color: colors.text, fontFamily: fonts.medium, fontSize: 11 } as const,
  status: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 } as const,
  errorRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: spacing.sm },
  error: { color: colors.danger, fontFamily: fonts.regular, fontSize: 13, flexShrink: 1 } as const,
  retry: { color: colors.navigationActive, fontFamily: fonts.semibold, fontSize: 14 } as const,
};
