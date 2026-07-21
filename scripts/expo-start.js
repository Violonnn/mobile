/**
 * Start Expo in a known-good network mode.
 *
 * Root cause of:
 *   Warning: Unable to resolve manifest assets... This operation was aborted
 * is EXPO_OFFLINE=1. When offline, Expo aborts the schema API call that tells
 * it which icon/splash fields to resolve — so icons never get URLs for Expo Go.
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const expoDir = path.join(projectRoot, '.expo');
const cacheDir = path.join(
  process.env.LOCALAPPDATA || process.env.TEMP || projectRoot,
  'DisasterLinkExpoCache',
);

function ensureExpoCacheJunction() {
  try {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    if (fs.existsSync(expoDir)) {
      const stat = fs.lstatSync(expoDir);
      if (stat.isSymbolicLink()) return;
      try {
        fs.rmSync(expoDir, { recursive: true, force: true });
      } catch {
        execSync(`rmdir /s /q "${expoDir}"`, { stdio: 'ignore', shell: true });
      }
    }

    execSync(`mklink /J "${expoDir}" "${cacheDir}"`, {
      stdio: 'ignore',
      shell: true,
    });
  } catch {
    // Non-fatal
  }
}

// Force online — offline mode aborts manifest asset resolution.
delete process.env.EXPO_OFFLINE;
process.env.EXPO_OFFLINE = '0';

const existing = process.env.NODE_OPTIONS || '';
if (!existing.includes('--use-system-ca')) {
  process.env.NODE_OPTIONS = `${existing} --use-system-ca`.trim();
}

ensureExpoCacheJunction();

const args = ['expo', 'start', ...process.argv.slice(2)];
const child = spawn('npx', args, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
