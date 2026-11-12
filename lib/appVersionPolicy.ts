export type ReleasePolicy = {
  platform: 'android' | 'ios';
  minimumSupportedVersion: string;
  latestVersion: string;
  downloadUrl: string | null;
  enforce: boolean;
  updateMessage: string | null;
  emergencyNumbers: { label: string; number: string }[];
};

export type UpdateRequirement = 'ok' | 'recommended' | 'required';

const RELEASE_TIMEOUT_MS = 4000;

export function isAppVersion(version: unknown): version is string {
  // Release policies use exactly three numeric parts, without prerelease labels.
  return typeof version === 'string' && version.length <= 20
    && version.trim() === version && /^\d+\.\d+\.\d+$/.test(version);
}

function isDownloadUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function canEnforceNativeUpdate(platform: string, executionEnvironment: string): boolean {
  // Store clients (including Expo Go) cannot install a project update from a store URL.
  return (platform === 'android' || platform === 'ios')
    && (executionEnvironment === 'standalone' || executionEnvironment === 'bare');
}

export function compareAppVersions(left: string, right: string): number {
  if (!isAppVersion(left) || !isAppVersion(right)) {
    throw new Error('App versions must use major.minor.patch (at most 20 characters).');
  }

  const leftParts = left.split('.');
  const rightParts = right.split('.');
  for (let index = 0; index < 3; index += 1) {
    // Compare digit strings to avoid precision loss for a valid 20-character version.
    const leftPart = leftParts[index].replace(/^0+(?=\d)/, '');
    const rightPart = rightParts[index].replace(/^0+(?=\d)/, '');
    if (leftPart === rightPart) continue;
    if (leftPart.length !== rightPart.length) return leftPart.length > rightPart.length ? 1 : -1;
    return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}

export function parseReleasePolicy(value: unknown): ReleasePolicy | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (row.platform !== 'android' && row.platform !== 'ios') return null;
  if (!isAppVersion(row.minimum_supported_version) || !isAppVersion(row.latest_version)) return null;
  if (typeof row.enforce !== 'boolean') return null;
  if (row.download_url !== null && !isDownloadUrl(row.download_url)) return null;
  if (row.update_message !== null && typeof row.update_message !== 'string') return null;
  if (!Array.isArray(row.emergency_numbers) || row.emergency_numbers.length === 0 || row.emergency_numbers.length > 12) return null;

  const emergencyNumbers: ReleasePolicy['emergencyNumbers'] = [];
  for (const entry of row.emergency_numbers) {
    if (!entry || typeof entry !== 'object') return null;
    const { label, number } = entry as Record<string, unknown>;
    if (typeof label !== 'string' || !label.trim() || label.length > 100) return null;
    // Policy numbers are plain dialable numbers; URL schemes and dial commands are refused.
    if (typeof number !== 'string' || number.trim() !== number || !/^\+?\d{3,15}$/.test(number)) return null;
    emergencyNumbers.push({ label: label.trim(), number });
  }

  return {
    platform: row.platform,
    minimumSupportedVersion: row.minimum_supported_version,
    latestVersion: row.latest_version,
    downloadUrl: row.download_url as string | null,
    enforce: row.enforce,
    updateMessage: typeof row.update_message === 'string' ? row.update_message.trim().slice(0, 1000) || null : null,
    emergencyNumbers,
  };
}

export function evaluateUpdateRequirement(
  installedVersion: string | null,
  policy: ReleasePolicy | null,
): UpdateRequirement {
  if (!isAppVersion(installedVersion) || !policy) return 'ok';
  if (!isAppVersion(policy.minimumSupportedVersion) || !isAppVersion(policy.latestVersion)) return 'ok';
  if (compareAppVersions(policy.latestVersion, policy.minimumSupportedVersion) < 0) return 'ok';

  if (policy.enforce && isDownloadUrl(policy.downloadUrl)
      && compareAppVersions(installedVersion, policy.minimumSupportedVersion) < 0) {
    return 'required';
  }
  return compareAppVersions(installedVersion, policy.latestVersion) < 0 ? 'recommended' : 'ok';
}

export async function withReleaseTimeout<Result>(operation: (signal: AbortSignal) => PromiseLike<Result>): Promise<Result> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error('Release check timed out.'));
      controller.abort();
    }, RELEASE_TIMEOUT_MS);
  });
  try {
    // Race as well as abort: session restoration may not support cancellation.
    return await Promise.race([operation(controller.signal), deadline]);
  } finally {
    clearTimeout(timeout);
  }
}
