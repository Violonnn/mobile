/**
 * Start Expo online so manifest icons and splash assets can resolve.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(import.meta.dirname, '..');
const expoDir = path.join(projectRoot, '.expo');
const cacheDir = path.join(
  process.env.LOCALAPPDATA || process.env.TEMP || projectRoot,
  'DisasterLinkExpoCache',
);

function ensureExpoCacheJunction(): void {
  try {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    if (fs.existsSync(expoDir)) {
      const stat = fs.lstatSync(expoDir);
      if (stat.isSymbolicLink()) return;
      fs.rmSync(expoDir, { recursive: true, force: true });
    }

    fs.symlinkSync(cacheDir, expoDir, process.platform === 'win32' ? 'junction' : 'dir');
  } catch {
    // Cache redirection is optional; Expo can use its local cache instead.
  }
}

// Offline mode aborts manifest asset resolution, including Expo Go icons.
process.env.EXPO_OFFLINE = '0';

let nodeOptions = process.env.NODE_OPTIONS || '';
if (!nodeOptions.includes('--use-system-ca')) {
  nodeOptions = `${nodeOptions} --use-system-ca`.trim();
}

// Metro's web and server bundles can exceed Node's default 2 GB heap.
// Accept both Node flag spellings and preserve an explicit user heap limit.
const hasCustomHeapLimit = /--max[-_]old[-_]space[-_]size/.test(nodeOptions);
if (!hasCustomHeapLimit) {
  nodeOptions = `${nodeOptions} --max-old-space-size=4096`.trim();
}
process.env.NODE_OPTIONS = nodeOptions;

ensureExpoCacheJunction();

const expoCliPath = require.resolve('expo/bin/cli');
const args = [expoCliPath, 'start', ...process.argv.slice(2)];
const child = spawn(process.execPath, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
