/** Detect an optional profile-photo field that has not reached the database yet. */
export function isProfilePhotoSchemaMissing(message: string | null | undefined): boolean {
  const normalizedMessage = (message ?? '').toLocaleLowerCase();
  return (
    normalizedMessage.includes('avatar_path') ||
    normalizedMessage.includes('reporter_avatar_path') ||
    normalizedMessage.includes('author_avatar_path') ||
    normalizedMessage.includes('update_my_avatar_path') ||
    normalizedMessage.includes('profile-photos') ||
    normalizedMessage.includes('schema cache')
  );
}
