import React, { useState } from 'react';
import { StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { buildMediaCacheKey } from '../../lib/mediaPolicy';
import { colors } from '../../styles/theme';

type Props = {
  bucket: string;
  storagePath: string;
  uri: string;
  variant: string;
  recyclingKey?: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
};

/** Cached private-media image with a stable identity independent of its token. */
export default function RemoteMediaImage({
  bucket,
  storagePath,
  uri,
  variant,
  recyclingKey,
  style,
  contentFit = 'cover',
}: Props) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const failed = failedUri === uri;

  if (failed || !uri) {
    return (
      <View style={[styles.fallback, style]}>
        <Ionicons name="image-outline" size={24} color={colors.textMuted} />
      </View>
    );
  }

  return (
    <Image
      source={{
        uri,
        cacheKey: buildMediaCacheKey(bucket, storagePath, variant),
      }}
      style={style}
      contentFit={contentFit}
      cachePolicy="disk"
      recyclingKey={recyclingKey ?? storagePath}
      transition={120}
      onError={() => setFailedUri(uri)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
