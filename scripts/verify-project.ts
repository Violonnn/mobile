import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type JsonObject = Record<string, unknown>;

type PackageManifest = {
  dependencies?: Record<string, string>;
  version?: string;
};

type PackageLock = {
  packages?: Record<string, PackageManifest>;
};

const projectRoot = path.resolve(import.meta.dirname, '..');
const minimumNodeVersion = [22, 13, 0];
const packagesToVerify = [
  'expo',
  'expo-location',
  'expo-router',
  'react',
  'react-native',
];

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function parseVersion(version: string): number[] {
  return version
    .replace(/^v/, '')
    .split('.')
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10));
}

function compareVersions(left: number[], right: number[]): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}

function versionMatches(actualVersion: string, requestedVersion: string): boolean {
  const normalizedRequest = requestedVersion.replace(/^[~^]/, '');
  const actualParts = parseVersion(actualVersion);
  const requestedParts = parseVersion(normalizedRequest);

  if (requestedVersion.startsWith('~')) {
    return (
      actualParts[0] === requestedParts[0] &&
      actualParts[1] === requestedParts[1] &&
      compareVersions(actualParts, requestedParts) >= 0
    );
  }

  if (requestedVersion.startsWith('^')) {
    return (
      actualParts[0] === requestedParts[0] &&
      compareVersions(actualParts, requestedParts) >= 0
    );
  }

  return actualVersion === requestedVersion;
}

function collectAssetPaths(value: unknown, assetPaths: Set<string>): void {
  if (typeof value === 'string' && value.startsWith('./assets/')) {
    assetPaths.add(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectAssetPaths(item, assetPaths));
    return;
  }

  if (!value || typeof value !== 'object') return;

  Object.values(value as JsonObject).forEach((item) => {
    collectAssetPaths(item, assetPaths);
  });
}

function fail(errors: string[]): never {
  console.error('\nProject environment check failed:\n');
  errors.forEach((error) => console.error(`- ${error}`));
  console.error('\nRun "npm run setup" from a complete clone, then try again.');
  process.exit(1);
}

const errors: string[] = [];
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageLockPath = path.join(projectRoot, 'package-lock.json');
const appJsonPath = path.join(projectRoot, 'app.json');

const packageJson = readJsonFile<PackageManifest>(packageJsonPath);
const packageLock = readJsonFile<PackageLock>(packageLockPath);
const appJson = readJsonFile<JsonObject>(appJsonPath);
const dependencies = packageJson.dependencies ?? {};
const lockedDependencies = packageLock.packages?.['']?.dependencies ?? {};

if (compareVersions(parseVersion(process.version), minimumNodeVersion) < 0) {
  errors.push(
    `Node ${process.version} is unsupported. Install Node 22.13 or newer.`,
  );
}

// The manifest and lockfile must agree so every clone gets the same SDK.
Object.entries(dependencies).forEach(([packageName, requestedVersion]) => {
  if (lockedDependencies[packageName] !== requestedVersion) {
    errors.push(
      `${packageName} differs between package.json and package-lock.json.`,
    );
  }
});

packagesToVerify.forEach((packageName) => {
  const requestedVersion = dependencies[packageName];
  const installedManifestPath = path.join(
    projectRoot,
    'node_modules',
    ...packageName.split('/'),
    'package.json',
  );

  if (!requestedVersion) {
    errors.push(`${packageName} is missing from package.json.`);
    return;
  }

  if (!existsSync(installedManifestPath)) {
    errors.push(`${packageName} is not installed.`);
    return;
  }

  const installedManifest = readJsonFile<PackageManifest>(installedManifestPath);
  const installedVersion = installedManifest.version;

  if (!installedVersion || !versionMatches(installedVersion, requestedVersion)) {
    errors.push(
      `${packageName}@${installedVersion ?? 'unknown'} does not satisfy ${requestedVersion}.`,
    );
  }
});

const configuredAssetPaths = new Set<string>();
collectAssetPaths(appJson, configuredAssetPaths);
configuredAssetPaths.forEach((assetPath) => {
  if (!existsSync(path.resolve(projectRoot, assetPath))) {
    errors.push(`Configured asset is missing: ${assetPath}`);
  }
});

const jsxRuntimePath = path.join(
  projectRoot,
  'node_modules',
  'react',
  'jsx-runtime.js',
);
if (!existsSync(jsxRuntimePath)) {
  errors.push('React JSX runtime is missing from node_modules.');
}

if (errors.length > 0) fail(errors);

console.log('Project environment check passed.');
console.log(`Node: ${process.version}`);
packagesToVerify.forEach((packageName) => {
  const installedManifestPath = path.join(
    projectRoot,
    'node_modules',
    ...packageName.split('/'),
    'package.json',
  );
  const installedManifest = readJsonFile<PackageManifest>(installedManifestPath);
  console.log(`${packageName}: ${installedManifest.version}`);
});
