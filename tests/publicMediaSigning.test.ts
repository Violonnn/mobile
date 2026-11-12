import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

import * as mediaPolicy from '../lib/mediaPolicy.ts';

function loadSigningRuntime(response: { data: unknown; error: { message: string } | null }) {
  const requests: { paths: string[]; lifetime: number }[] = [];
  const compiled = ts.transpileModule(readFileSync(new URL('../lib/mediaUrlCache.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const runtimeExports: Record<string, unknown> = {};
  const dependencies: Record<string, unknown> = {
    './mediaPolicy': mediaPolicy,
    './supabase': { supabase: { storage: { from: () => ({
      createSignedUrls: async (paths: string[], lifetime: number) => {
        requests.push({ paths: Array.from(paths), lifetime });
        return response;
      },
    }) } } },
  };
  runInNewContext(compiled.outputText, {
    exports: runtimeExports, module: { exports: runtimeExports },
    require(name: string) {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return { requests, runtime: runtimeExports as typeof import('../lib/mediaUrlCache') };
}

test('public photo signing matches returned paths while reporting partial Storage failures', async () => {
  const { runtime, requests } = loadSigningRuntime({
    data: [{ path: 'second', signedUrl: 'signed:second' }, { path: 'first', error: 'Access denied', signedUrl: '' }],
    error: null,
  });
  const result = await runtime.resolveSignedMediaUrls({
    bucket: 'report-media', storagePaths: ['first', 'second'], variant: 'public-photo',
  });
  assert.equal(result.urls.get('first'), undefined);
  assert.equal(result.urls.get('second'), 'signed:second');
  assert.ok(result.error);
  assert.equal(requests[0].lifetime, 60, 'Public approvals receive short-lived capabilities');
});

test('public signing rejects unidentified or unrequested response rows', async () => {
  const { runtime } = loadSigningRuntime({
    data: [{ signedUrl: 'unidentified' }, { path: 'another-report', signedUrl: 'wrong-source' }], error: null,
  });
  const result = await runtime.resolveSignedMediaUrls({
    bucket: 'report-media', storagePaths: ['requested-display', 'requested-thumbnail'], variant: 'public-photo',
  });
  assert.equal(result.urls.size, 0, 'A response must identify the exact approved requested path');
  assert.ok(result.error);
});

test('publication cache invalidation forces fresh authorization without shortening private evidence tokens', async () => {
  const { runtime, requests } = loadSigningRuntime({
    data: [{ path: 'private-original', signedUrl: 'signed:private' }], error: null,
  });
  const request = { bucket: 'report-media', storagePaths: ['private-original'], variant: 'original' };
  await runtime.resolveSignedMediaUrls(request);
  await runtime.resolveSignedMediaUrls(request);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].lifetime, 3600);
  runtime.clearSignedMediaUrlCache();
  await runtime.resolveSignedMediaUrls(request);
  assert.equal(requests.length, 2);
});
