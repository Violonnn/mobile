export type PublicPhotoUrlPair = {
  identity: string;
  displayUrl: string | null;
  thumbnailUrl: string | null;
};

/** Keep a display and thumbnail with their photo even when one signing call fails. */
export function mapPublicPhotoUrlPairs(
  displayPathValue: unknown,
  thumbnailPathValue: unknown,
  signedUrls: ReadonlyMap<string, string>,
): PublicPhotoUrlPair[] {
  const displayPaths = Array.isArray(displayPathValue) ? displayPathValue : [];
  const thumbnailPaths = Array.isArray(thumbnailPathValue) ? thumbnailPathValue : [];
  const photoCount = Math.max(displayPaths.length, thumbnailPaths.length);

  return Array.from({ length: photoCount }, (_, index) => {
    const displayPath = typeof displayPaths[index] === 'string' ? displayPaths[index] as string : null;
    const thumbnailPath = typeof thumbnailPaths[index] === 'string' ? thumbnailPaths[index] as string : null;
    return {
      identity: displayPath ?? thumbnailPath ?? `public-photo-${index}`,
      displayUrl: displayPath ? signedUrls.get(displayPath) ?? null : null,
      thumbnailUrl: thumbnailPath ? signedUrls.get(thumbnailPath) ?? null : null,
    };
  });
}
