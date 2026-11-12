import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

import { isOutsideCoverageError, readEdgeFunctionErrorCode, readEdgeFunctionErrorMessage } from '../lib/edgeFunctionErrors.ts';
import type { QueuedReport } from '../lib/reportQueue';

function loadQueueRuntime(failWithCoverage = true) {
  const position = { latitude: 10.25, longitude: 123.8, accuracyMeters: null };
  const reports = new Map<string, QueuedReport>([
    ['outside', { id: 'outside', title: '', description: 'Outside report', position, media: [], status: 'pending', createdAt: '2026-10-30T08:00:00Z' }],
    ['valid', { id: 'valid', title: '', description: 'Valid report', position, media: [], status: 'pending', createdAt: '2026-10-30T08:01:00Z' }],
  ]);
  const submittedIds: string[] = [];
  const submittedBodies: Record<string, unknown>[] = [];
  const timerCallbacks = new Map<number, () => void>();
  let nextTimerId = 0;
  const dependencies: Record<string, unknown> = {
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    '@react-native-community/netinfo': { __esModule: true, default: { fetch: async () => ({ isConnected: true, isInternetReachable: true }) } },
    './supabase': { supabase: { functions: { invoke: async (_name: string, input: { body: { reportId: string } }) => {
      const id = input.body.reportId;
      submittedIds.push(id);
      submittedBodies.push(input.body as Record<string, unknown>);
      if (id === 'outside') return {
        error: new Error(failWithCoverage ? 'Rejected' : 'Network request failed'),
        response: failWithCoverage ? new Response(JSON.stringify({ code: 'outside_coverage', error: 'Outside coverage. Not sent to any office.' }), { status: 422 }) : undefined,
      };
      return { error: null };
    } } } },
    './auth': { getActiveSession: async () => ({ user: { id: 'reporter' } }) },
    './edgeFunctionErrors': { isOutsideCoverageError, readEdgeFunctionErrorCode, readEdgeFunctionErrorMessage },
    './reportMedia': {
      deletePersistedReportMedia() {},
      isTransientMediaUploadError: (message: string) => message.includes('Network'),
      uploadReportMedia: () => { throw new Error('No media uploads expected in this fixture.'); },
    },
    './reportQueue': {
      getPendingReports: async () => [...reports.values()].filter((report) => report.status === 'pending'),
      updateQueuedReport: async (id: string, update: Partial<QueuedReport>) => { reports.set(id, { ...reports.get(id)!, ...update }); },
      markQueuedReportSynced: async (id: string, syncedAt: string) => { reports.set(id, { ...reports.get(id)!, status: 'synced', syncedAt }); },
      markQueuedReportDeliveryDelayed: async () => true,
      pruneSyncedReportHistory: async () => {}, markMediaUploaded: async () => {},
    },
  };
  const compiled = ts.transpileModule(readFileSync(new URL('../lib/reportQueueFlush.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const runtimeExports: Record<string, unknown> = {};
  // Native storage/network modules are replaced at the boundary; this executes
  // the actual flush loop, persistence decisions, and retry scheduling.
  runInNewContext(compiled.outputText, {
    exports: runtimeExports, module: { exports: runtimeExports },
    require(name: string) { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; },
    setTimeout(callback: () => void) { const id = ++nextTimerId; timerCallbacks.set(id, callback); return id; },
    clearTimeout(id: number) { timerCallbacks.delete(id); },
    Date, console,
  });
  return { reports, submittedIds, submittedBodies, timerCallbacks, runtime: runtimeExports as unknown as { flushReportQueue: () => Promise<void> } };
}

test('offline submission carries optional sharing choices while old rows stay private', async () => {
  const fixture = loadQueueRuntime();
  fixture.reports.set('valid', { ...fixture.reports.get('valid')!, showReporterName: true, showReporterAvatar: false, allowExactLocation: true });
  await fixture.runtime.flushReportQueue();
  const sentPreferences = fixture.submittedBodies.find((body) => body.reportId === 'valid');
  assert.equal(sentPreferences?.showReporterName, true);
  assert.equal(sentPreferences?.showReporterAvatar, false);
  assert.equal(sentPreferences?.allowExactLocation, true);
  const oldQueueRow = fixture.submittedBodies.find((body) => body.reportId === 'outside');
  assert.equal(oldQueueRow?.showReporterName, false);
  assert.equal(oldQueueRow?.showReporterAvatar, false);
  assert.equal(oldQueueRow?.allowExactLocation, false);
});

test('outside coverage is final across reconnect-style flushes and does not block the next report', async () => {
  const fixture = loadQueueRuntime();
  await fixture.runtime.flushReportQueue();
  assert.deepEqual(fixture.submittedIds, ['outside', 'valid']);
  assert.equal(fixture.reports.get('outside')?.terminalErrorCode, 'outside_coverage');
  assert.equal(fixture.reports.get('outside')?.status, 'pending');
  assert.match(fixture.reports.get('outside')?.lastError ?? '', /Not sent to any office/);
  assert.equal(fixture.reports.get('valid')?.status, 'synced');
  await fixture.runtime.flushReportQueue();
  await fixture.runtime.flushReportQueue();
  assert.deepEqual(fixture.submittedIds, ['outside', 'valid']);
  assert.equal(fixture.timerCallbacks.size, 0);
});

test('transient delivery failures stay retryable and never acquire a terminal rejection', async () => {
  const fixture = loadQueueRuntime(false);
  await fixture.runtime.flushReportQueue();
  assert.equal(fixture.reports.get('outside')?.terminalErrorCode, undefined);
  assert.equal(fixture.timerCallbacks.size, 1);
  await fixture.runtime.flushReportQueue();
  assert.deepEqual(fixture.submittedIds, ['outside', 'valid', 'outside']);
});
