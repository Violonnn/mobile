import React, { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

import { profilePhotoUrl } from '../../lib/profilePhoto';
import { colors, fonts } from '../../styles/theme';

type ProfileAvatarProps = {
  avatarPath?: string | null;
  imageUri?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  size?: number;
  fallback?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

function initials(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const value = `${firstName?.trim().charAt(0) ?? ''}${lastName?.trim().charAt(0) ?? ''}`
    .toLocaleUpperCase();
  return value || 'U';
}

/** Shared photo avatar used by every role, with initials as a safe fallback. */
export default function ProfileAvatar({
  avatarPath,
  imageUri,
  firstName,
  lastName,
  size = 44,
  fallback,
  style,
  textStyle,
  accessibilityLabel,
}: ProfileAvatarProps) {
  const imageUrl = imageUri ?? profilePhotoUrl(avatarPath);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  return (
    <View
      style={[styles.avatar, style, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel || 'Profile picture'}
    >
      <Text style={[styles.initials, { fontSize: Math.max(12, size * 0.32) }, textStyle]}>
        {fallback || initials(firstName, lastName)}
      </Text>
      {imageUrl && failedImageUrl !== imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          onError={() => setFailedImageUrl(imageUrl)}
          accessibilityLabel={accessibilityLabel || 'Profile picture'}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: '#D8E3FF',
  },
  initials: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
});
