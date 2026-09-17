import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { getActiveSession } from './auth';
import { promptOpenSettings } from './permissions';
import { supabase } from './supabase';

const PROFILE_PHOTO_BUCKET = 'profile-photos';
const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_SIZE = 512;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

function fileExtension(value: string | null | undefined): string {
  const cleanValue = (value ?? '').split('?')[0];
  return cleanValue.includes('.') ? cleanValue.split('.').pop()!.toLocaleLowerCase() : '';
}

function isAllowedImage(asset: ImagePicker.ImagePickerAsset): boolean {
  const mimeType = asset.mimeType?.toLocaleLowerCase();
  if (mimeType) return ALLOWED_IMAGE_MIME_TYPES.has(mimeType);

  const extension = fileExtension(asset.fileName || asset.uri);
  return ALLOWED_IMAGE_EXTENSIONS.has(extension);
}

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const randomValue = (Math.random() * 16) | 0;
    const value = character === 'x' ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });
}

function safeProfilePhotoPath(path: string | null | undefined): string | null {
  const trimmedPath = path?.trim();
  if (!trimmedPath || trimmedPath.includes('..') || trimmedPath.startsWith('/')) return null;
  return trimmedPath;
}

/** Convert a stored profile-photo path into its cross-role public URL. */
export function profilePhotoUrl(path: string | null | undefined): string | null {
  const safePath = safeProfilePhotoPath(path);
  if (!safePath) return null;

  return supabase.storage.from(PROFILE_PHOTO_BUCKET).getPublicUrl(safePath).data.publicUrl;
}

async function requestPhotoLibraryAccess(): Promise<string | null> {
  const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (currentPermission.granted) return null;

  if (currentPermission.canAskAgain) {
    const requestedPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (requestedPermission.granted) return null;
  }

  promptOpenSettings(
    'Photo access needed',
    'Allow DisasterLink to access your photos so you can choose a profile picture.',
  );
  return 'Photo library permission is required to choose a profile picture.';
}

async function prepareProfilePhoto(asset: ImagePicker.ImagePickerAsset): Promise<{
  file: File | null;
  error: string | null;
}> {
  if (!isAllowedImage(asset)) {
    return { file: null, error: 'Choose a JPG, JPEG, PNG, or WebP image.' };
  }

  const sourceFile = new File(asset.uri);
  const sourceSize = asset.fileSize ?? sourceFile.size;
  if (!sourceFile.exists || sourceSize <= 0) {
    return { file: null, error: 'The selected image is no longer available.' };
  }
  if (sourceSize > PROFILE_PHOTO_MAX_BYTES) {
    return { file: null, error: 'Choose an image that is 5 MB or smaller.' };
  }

  const shortestSide = Math.min(asset.width, asset.height);
  if (!Number.isFinite(shortestSide) || shortestSide <= 0) {
    return { file: null, error: 'The selected image dimensions could not be read.' };
  }

  // Crop from the center before resizing so every stored avatar is a true square.
  const crop = {
    originX: Math.floor((asset.width - shortestSide) / 2),
    originY: Math.floor((asset.height - shortestSide) / 2),
    width: shortestSide,
    height: shortestSide,
  };
  const preparedImage = await manipulateAsync(
    asset.uri,
    [{ crop }, { resize: { width: PROFILE_PHOTO_SIZE, height: PROFILE_PHOTO_SIZE } }],
    { compress: 0.82, format: SaveFormat.JPEG },
  );
  const preparedFile = new File(preparedImage.uri);

  if (!preparedFile.exists || preparedFile.size <= 0) {
    return { file: null, error: 'The profile picture could not be prepared.' };
  }
  if (preparedFile.size > PROFILE_PHOTO_MAX_BYTES) {
    return { file: null, error: 'The prepared profile picture is still larger than 5 MB.' };
  }

  return { file: preparedFile, error: null };
}

/** Pick, crop, and prepare a local preview without uploading it. */
export async function pickMyProfilePhoto(): Promise<{
  previewUri: string | null;
  cancelled: boolean;
  error: string | null;
}> {
  const permissionError = await requestPhotoLibraryAccess();
  if (permissionError) {
    return { previewUri: null, cancelled: false, error: permissionError };
  }

  try {
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
      exif: false,
    });
    if (pickerResult.canceled || !pickerResult.assets[0]) {
      return { previewUri: null, cancelled: true, error: null };
    }

    const preparedResult = await prepareProfilePhoto(pickerResult.assets[0]);
    if (preparedResult.error || !preparedResult.file) {
      return { previewUri: null, cancelled: false, error: preparedResult.error };
    }

    return { previewUri: preparedResult.file.uri, cancelled: false, error: null };
  } catch (error) {
    return {
      previewUri: null,
      cancelled: false,
      error: error instanceof Error ? error.message : 'The profile picture could not be prepared.',
    };
  }
}

/** Upload a previously prepared local photo only after the user confirms it. */
export async function saveMyProfilePhoto(
  previewUri: string,
  previousPath: string | null,
): Promise<{
  avatarPath: string | null;
  error: string | null;
}> {
  try {
    const preparedFile = new File(previewUri);
    if (!preparedFile.exists || preparedFile.size <= 0) {
      return { avatarPath: null, error: 'The selected photo is no longer available.' };
    }
    if (preparedFile.size > PROFILE_PHOTO_MAX_BYTES) {
      return { avatarPath: null, error: 'The prepared profile picture is larger than 5 MB.' };
    }

    const session = await getActiveSession();
    const userId = session?.user?.id;
    if (!userId) {
      return { avatarPath: null, error: 'Your session has expired.' };
    }

    const avatarPath = `${userId}/avatar-${randomUuid()}.jpg`;
    const imageBytes = await preparedFile.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .upload(avatarPath, imageBytes, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) {
      return { avatarPath: null, error: uploadError.message };
    }

    const { error: updateError } = await supabase.rpc('update_my_avatar_path', {
      p_avatar_path: avatarPath,
    });
    if (updateError) {
      await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([avatarPath]);
      return { avatarPath: null, error: updateError.message };
    }

    const safePreviousPath = safeProfilePhotoPath(previousPath);
    if (safePreviousPath && safePreviousPath !== avatarPath) {
      // Old-file cleanup is best effort; the database already points at the new image.
      await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([safePreviousPath]);
    }

    return { avatarPath, error: null };
  } catch (error) {
    return {
      avatarPath: null,
      error: error instanceof Error ? error.message : 'The profile picture could not be changed.',
    };
  }
}

/** Remove the current user's photo so every avatar falls back to initials. */
export async function removeMyProfilePhoto(currentPath: string): Promise<string | null> {
  const safePath = safeProfilePhotoPath(currentPath);
  if (!safePath) return 'The current profile picture path is invalid.';

  const { error: updateError } = await supabase.rpc('update_my_avatar_path', {
    p_avatar_path: null,
  });
  if (updateError) return updateError.message;

  // The database no longer references this file, so cleanup can be best effort.
  await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([safePath]);
  return null;
}

export { PROFILE_PHOTO_MAX_BYTES, PROFILE_PHOTO_SIZE };
