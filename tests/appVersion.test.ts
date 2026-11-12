import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

import {
  canEnforceNativeUpdate,
  compareAppVersions,
  evaluateUpdateRequirement,
  parseReleasePolicy,
  withReleaseTimeout,
} from '../lib/appVersionPolicy.ts';
import type { ReleasePolicy } from '../lib/appVersionPolicy.ts';
import * as policyHelpers from '../lib/appVersionPolicy.ts';

const policy: ReleasePolicy = {
  platform: 'ios',
  minimumSupportedVersion: '1.2.0',
  latestVersion: '1.3.0',
  downloadUrl: 'https://example.test/disasterlink',
  enforce: true,
  updateMessage: null,
  emergencyNumbers: [{ label: 'Emergency', number: '911' }],
};

test('versions compare numerically across all three parts without precision loss', () => {
  for (const [left, right, result] of [
    ['1.10.0', '1.9.9', 1], ['2.0.0', '1.99.99', 1],
    ['1.0.10', '1.0.2', 1], ['1.0.0', '1.0.1', -1],
    ['01.002.03', '1.2.3', 0], ['1.2.3', '1.2.3', 0],
    ['9007199254740993.0.0', '9007199254740992.0.0', 1],
  ] as const) {
    assert.equal(compareAppVersions(left, right), result);
    assert.equal(compareAppVersions(right, left), result === 0 ? 0 : -result);
  }
});

test('invalid and oversized versions cannot be compared or block the app', () => {
  for (const version of ['', '1.2', 'v1.2.3', '1.2.3-beta', '1.2.3\n', '1.2.-1', '1.2.3.4', '1234567890123456.0.0.0']) {
    assert.throws(() => compareAppVersions(version, '1.0.0'));
    assert.equal(evaluateUpdateRequirement(version, policy), 'ok');
  }
});

test('only enforce plus a usable download, supported latest, and an older install requires update', () => {
  assert.equal(evaluateUpdateRequirement('1.1.9', policy), 'required');
  assert.equal(evaluateUpdateRequirement('1.2.0', policy), 'recommended');
  assert.equal(evaluateUpdateRequirement('1.3.0', policy), 'ok');
  assert.equal(evaluateUpdateRequirement('2.0.0', policy), 'ok');
  assert.equal(evaluateUpdateRequirement('1.1.9', { ...policy, enforce: false }), 'recommended');
  assert.equal(evaluateUpdateRequirement('1.1.9', { ...policy, downloadUrl: null }), 'recommended');
  assert.equal(evaluateUpdateRequirement('1.1.9', { ...policy, latestVersion: '1.1.9' }), 'ok');
});

test('missing, offline, unknown-version, and malformed policy results fail open', () => {
  assert.equal(evaluateUpdateRequirement('1.0.0', null), 'ok');
  assert.equal(evaluateUpdateRequirement(null, policy), 'ok');
  assert.equal(evaluateUpdateRequirement('1.0.0', { ...policy, latestVersion: 'broken' }), 'ok');
  assert.equal(evaluateUpdateRequirement('1.0.0', { ...policy, minimumSupportedVersion: 'broken' }), 'ok');
  for (const downloadUrl of ['javascript:alert(1)', 'http://example.test/app', 'https://user:pass@example.test', 'not a url', '']) {
    assert.notEqual(evaluateUpdateRequirement('1.0.0', { ...policy, downloadUrl }), 'required');
  }
});

test('Expo Go, development store clients, web, and unknown runtimes are exempt', () => {
  for (const platform of ['ios', 'android']) {
    assert.equal(canEnforceNativeUpdate(platform, 'storeClient'), false);
    assert.equal(canEnforceNativeUpdate(platform, 'unknown'), false);
    assert.equal(canEnforceNativeUpdate(platform, 'standalone'), true);
    assert.equal(canEnforceNativeUpdate(platform, 'bare'), true);
  }
  assert.equal(canEnforceNativeUpdate('web', 'standalone'), false);
  assert.equal(canEnforceNativeUpdate('windows', 'bare'), false);
});

const row = {
  platform: 'ios', minimum_supported_version: '1.2.0', latest_version: '1.3.0',
  download_url: 'https://example.test/disasterlink', enforce: true, update_message: null,
  emergency_numbers: [{ label: 'Emergency', number: '911' }],
};

test('release policy maps only validated public fields', () => {
  assert.deepEqual(parseReleasePolicy({ ...row, updated_by: 'private audit value' }), policy);
  assert.deepEqual(parseReleasePolicy({ ...row, download_url: null, enforce: false }), {
    ...policy, downloadUrl: null, enforce: false,
  });
  assert.equal(parseReleasePolicy(null), null);
  for (const invalid of [
    { platform: 'web' }, { latest_version: 'next' }, { minimum_supported_version: '1.0' },
    { enforce: 'true' }, { download_url: 'tel:911' }, { update_message: {} },
    { emergency_numbers: [] }, { emergency_numbers: [{ label: '', number: '911' }] },
    { emergency_numbers: [{ label: 'Emergency', number: '911;123' }] },
    { emergency_numbers: [{ label: 'Emergency', number: 'tel:911' }] },
    { emergency_numbers: Array(13).fill({ label: 'Emergency', number: '911' }) },
  ]) {
    assert.equal(parseReleasePolicy({ ...row, ...invalid }), null);
  }
});

test('release requests time out and abort even when the operation never settles', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let requestSignal: AbortSignal | null = null;
  const request = withReleaseTimeout((signal) => {
    requestSignal = signal;
    return new Promise<never>(() => undefined);
  });
  const timedOut = assert.rejects(request, /Release check timed out/);
  context.mock.timers.tick(4000);
  await timedOut;
  assert.equal(requestSignal!.aborted, true);
});

test('release requests preserve successful results and network errors', async () => {
  assert.equal(await withReleaseTimeout(async () => 'policy loaded'), 'policy loaded');
  await assert.rejects(withReleaseTimeout(async () => { throw new Error('Offline'); }), /Offline/);
});

function loadVersionRuntime(options: { platform?: string; version?: string; signedIn?: boolean; rpcError?: string } = {}) {
  const warnings: unknown[][] = [];
  const rpcCalls: { name: string; parameters: Record<string, string> }[] = [];
  const deprecatedGetterReads: string[] = [];
  const nativeExports = { Platform: { OS: options.platform ?? 'ios' } };
  for (const name of ['ImageBackground', 'InputAccessoryView', 'ProgressBarAndroid', 'SafeAreaView', 'Clipboard', 'PushNotificationIOS']) {
    Object.defineProperty(nativeExports, name, {
      enumerable: true,
      get() {
        deprecatedGetterReads.push(name);
        if (name === 'PushNotificationIOS') {
          throw new Error('Native module PushNotificationIOS is unavailable in Expo Go.');
        }
        return {};
      },
    });
  }

  const dependencies: Record<string, unknown> = {
    'react-native': nativeExports,
    'expo-constants': { __esModule: true, default: { expoConfig: { version: options.version ?? '1.0.1' } } },
    './appVersionPolicy': policyHelpers,
    './supabase': {
      supabase: {
        auth: { getSession: async () => ({ data: { session: options.signedIn === false ? null : { user: { id: 'test-user' } } } }) },
        rpc(name: string, parameters: Record<string, string>) {
          rpcCalls.push({ name, parameters: { ...parameters } });
          return { abortSignal: async () => ({ error: options.rpcError ? { message: options.rpcError } : null }) };
        },
      },
    },
  };

  // Use the installed Metro importAll implementation: copying native getters
  // caused the crash, which Node's normal import interop does not reproduce.
  type MetroModule = { exports: unknown };
  type MetroRequire = ((id: number) => unknown) & { importAll: (id: number) => unknown };
  const metroGlobal: {
    __r?: MetroRequire;
    __d?: (factory: (runtimeGlobal: unknown, require: unknown, importDefault: unknown, importAll: unknown, module: MetroModule) => void, id: number) => void;
  } = {};
  const nodeRequire = createRequire(import.meta.url);
  runInNewContext(readFileSync(nodeRequire.resolve('metro-runtime/polyfills/require'), 'utf8'), {
    global: metroGlobal, __DEV__: false, __METRO_GLOBAL_PREFIX__: '',
  });
  const dependencyIds = new Map<unknown, number>();
  Object.values(dependencies).forEach((dependency, index) => {
    dependencyIds.set(dependency, index);
    metroGlobal.__d!((_runtimeGlobal, _require, _importDefault, _importAll, module) => {
      module.exports = dependency;
    }, index);
  });

  const source = readFileSync(new URL('../lib/appVersion.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, noEmitHelpers: true },
  });
  const runtimeExports: Record<string, unknown> = {};
  runInNewContext(compiled.outputText, {
    exports: runtimeExports,
    module: { exports: runtimeExports },
    require(name: string) {
      assert.ok(name in dependencies, `Unexpected runtime dependency: ${name}`);
      return dependencies[name];
    },
    __importDefault: (dependency: { __esModule?: boolean }) => dependency.__esModule ? dependency : { default: dependency },
    __importStar: (dependency: unknown) => metroGlobal.__r!.importAll(dependencyIds.get(dependency)!),
    console: { warn: (...args: unknown[]) => warnings.push(args) },
    __DEV__: true, AbortController, URL, setTimeout, clearTimeout,
  });
  const runtime = runtimeExports as unknown as {
    getInstalledAppVersion: () => string | null;
    recordAppVersion: () => Promise<void>;
  };
  return { runtime, warnings, rpcCalls, deprecatedGetterReads };
}

test('native version check-in avoids deprecated getters with Metro import interop', async () => {
  const fixture = loadVersionRuntime();
  assert.equal(fixture.runtime.getInstalledAppVersion(), '1.0.1');
  await fixture.runtime.recordAppVersion();
  assert.deepEqual(fixture.deprecatedGetterReads, []);
  assert.deepEqual(fixture.warnings, []);
  assert.deepEqual(fixture.rpcCalls, [{
    name: 'record_app_version', parameters: { p_platform: 'ios', p_app_version: '1.0.1' },
  }]);
});

test('web, signed-out users, and unknown versions do not submit check-ins', async () => {
  for (const options of [{ platform: 'web' }, { signedIn: false }, { version: 'unknown' }]) {
    const fixture = loadVersionRuntime(options);
    await fixture.runtime.recordAppVersion();
    assert.deepEqual(fixture.rpcCalls, []);
    assert.deepEqual(fixture.deprecatedGetterReads, []);
    assert.deepEqual(fixture.warnings, []);
  }
});

test('version check-in errors stay non-fatal', async () => {
  const fixture = loadVersionRuntime({ rpcError: 'Network unavailable' });
  await assert.doesNotReject(fixture.runtime.recordAppVersion());
  assert.equal(fixture.rpcCalls.length, 1);
  assert.equal(fixture.warnings.length, 1);
  assert.deepEqual(fixture.deprecatedGetterReads, []);
});
