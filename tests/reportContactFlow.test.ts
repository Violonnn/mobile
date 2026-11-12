import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

import { formatOperationTimestamp } from '../lib/formatTime.ts';
import {
  callOutcomeFeedback,
  hotlineEventDetails,
} from '../lib/reportContactFlow.ts';
import type { HotlineRecord } from '../lib/resources';
import type { useReportCallFlow } from '../hooks/useReportCallFlow';

const reportId = 'a1000000-0000-4000-8000-000000000001';
const hotline: HotlineRecord = {
  id: 'a2000000-0000-4000-8000-000000000001',
  name: 'Municipal rescue desk',
  number: '032 123 4567',
  category: 'rescue',
  barangayId: null,
  facilityId: null,
  isActive: true,
  lastVerifiedAt: null,
  lastVerifiedBy: null,
  createdBy: null,
  createdAt: '',
  updatedAt: '',
};

function loadCallFlow(
  options: {
    contactError?: string;
    dialerError?: string;
    delayContact?: boolean;
  } = {},
) {
  const hookSlots: unknown[] = [];
  let hookCursor = 0;
  let effectStarted = false;
  let cleanup: (() => void) | undefined;
  let contactRequests = 0;
  const reporterDialerNumbers: string[] = [];
  const hotlineDialerNumbers: string[] = [];
  let resolveContact: (() => void) | undefined;
  const contactDelay = options.delayContact
    ? new Promise<void>((resolve) => {
      resolveContact = resolve;
    })
    : Promise.resolve();
  const dependencies: Record<string, unknown> = {
    react: {
      useState(initialValue: unknown) {
        const index = hookCursor++;
        if (!(index in hookSlots)) hookSlots[index] = initialValue;
        return [hookSlots[index], (next: unknown) => {
          hookSlots[index] = next;
        }];
      },
      useRef(initialValue: unknown) {
        const index = hookCursor++;
        if (!(index in hookSlots)) hookSlots[index] = { current: initialValue };
        return hookSlots[index];
      },
      useCallback(callback: unknown) {
        return callback;
      },
      useEffect(effect: () => () => void) {
        if (effectStarted) return;
        cleanup = effect();
        effectStarted = true;
      },
    },
    '../lib/officialReports': {
      isValidReportId: (value: string) => value === reportId,
      requestReporterContact: async () => {
        contactRequests += 1;
        await contactDelay;
        return {
          phone: options.contactError ? null : '+639171234567',
          error: options.contactError ?? null,
        };
      },
      openReporterDialer: async (number: string) => {
        reporterDialerNumbers.push(number);
        return { error: options.dialerError ?? null };
      },
      logReportContact() {
        throw new Error(
          'Opening or cancelling a native dialer must not invent a call-outcome event.',
        );
      },
    },
    '../lib/resources': {
      openHotlineDialer: async (number: string) => {
        hotlineDialerNumbers.push(number);
        return { error: options.dialerError ?? null };
      },
    },
  };
  const compiled = ts.transpileModule(
    readFileSync(
      new URL('../hooks/useReportCallFlow.ts', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  const runtimeExports: Record<string, unknown> = {};
  // Execute the real handoff logic with native/network boundaries replaced.
  // State slots let the assertions observe the next render without a device.
  runInNewContext(compiled.outputText, {
    exports: runtimeExports,
    module: { exports: runtimeExports },
    require(name: string) {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  const runtime = runtimeExports as unknown as {
    useReportCallFlow: typeof useReportCallFlow;
  };
  function render() {
    hookCursor = 0;
    return runtime.useReportCallFlow();
  }
  return {
    render,
    contactRequests: () => contactRequests,
    reporterDialerNumbers,
    hotlineDialerNumbers,
    releaseContact: () => resolveContact?.(),
    unmount: () => cleanup?.(),
  };
}

test('reporter handoff audits number access once and waits for an explicit outcome action', async () => {
  const fixture = loadCallFlow();
  await fixture.render().startReporterCall(reportId);
  const flow = fixture.render();
  assert.equal(fixture.contactRequests(), 1);
  assert.deepEqual(fixture.reporterDialerNumbers, ['+639171234567']);
  assert.equal(flow.pendingCall?.kind, 'reporter');
  assert.equal(flow.pendingCall?.reportId, reportId);
  assert.equal(flow.calling, false);
  assert.equal(flow.error, null);
  assert.doesNotMatch(JSON.stringify(flow.pendingCall), /639171234567/);
});

test('No call made clears follow-up without writing a fabricated outcome', async () => {
  const fixture = loadCallFlow();
  await fixture.render().startReporterCall(reportId);
  fixture.render().clearPendingCall();
  assert.equal(fixture.render().pendingCall, null);
  assert.equal(fixture.contactRequests(), 1);
});

test('dialer failure keeps the access audit but creates no pending or completed call', async () => {
  const fixture = loadCallFlow({
    dialerError: 'Could not open the phone dialer.',
  });
  await fixture.render().startReporterCall(reportId);
  assert.equal(fixture.contactRequests(), 1);
  assert.equal(fixture.render().pendingCall, null);
  assert.match(fixture.render().error ?? '', /Could not open/);
});

test('contact denial never opens the native dialer', async () => {
  const fixture = loadCallFlow({
    contactError: 'Reporter contact is unavailable.',
  });
  await fixture.render().startReporterCall(reportId);
  assert.equal(fixture.reporterDialerNumbers.length, 0);
  assert.equal(fixture.render().pendingCall, null);
  assert.match(fixture.render().error ?? '', /unavailable/);
});

test('hotline handoff uses the existing saved number and skips reporter contact access', async () => {
  const fixture = loadCallFlow();
  await fixture.render().startHotlineCall(hotline, reportId);
  assert.deepEqual(fixture.hotlineDialerNumbers, [hotline.number]);
  assert.equal(fixture.contactRequests(), 0);
  assert.equal(fixture.render().pendingCall?.hotline?.id, hotline.id);
});

test('inactive hotlines cannot open the dialer', async () => {
  const fixture = loadCallFlow();
  await fixture.render().startHotlineCall(
    { ...hotline, isActive: false },
    reportId,
  );
  assert.equal(fixture.hotlineDialerNumbers.length, 0);
  assert.equal(fixture.render().pendingCall, null);
});

test('rapid duplicate taps reveal the number and open the dialer only once', async () => {
  const fixture = loadCallFlow({ delayContact: true });
  const firstCall = fixture.render().startReporterCall(reportId);
  const duplicateCall = fixture.render().startReporterCall(reportId);
  assert.equal(fixture.contactRequests(), 1);
  assert.equal(fixture.render().calling, true);
  fixture.releaseContact();
  await Promise.all([firstCall, duplicateCall]);
  assert.equal(fixture.reporterDialerNumbers.length, 1);
});

test('an unresolved follow-up cannot be overwritten by another contact', async () => {
  const fixture = loadCallFlow();
  await fixture.render().startReporterCall(reportId);
  await fixture.render().startHotlineCall(hotline, reportId);
  assert.equal(fixture.hotlineDialerNumbers.length, 0);
  assert.equal(fixture.render().pendingCall?.kind, 'reporter');
  assert.match(fixture.render().error ?? '', /previous call/);
});

test('leaving during contact retrieval prevents a delayed native dialer from opening', async () => {
  const fixture = loadCallFlow({ delayContact: true });
  const pending = fixture.render().startReporterCall(reportId);
  fixture.unmount();
  fixture.releaseContact();
  await pending;
  assert.equal(fixture.reporterDialerNumbers.length, 0);
});

test('call-outcome feedback distinguishes unknown, reached, no answer, and failure', () => {
  assert.match(
    callOutcomeFeedback({
      eventType: 'reporter_call',
      outcome: 'not_recorded',
      dismissed: true,
    }),
    /does not confirm that a call took place/,
  );
  assert.match(
    callOutcomeFeedback({ eventType: 'reporter_call', outcome: 'reached' }),
    /reporter reached/,
  );
  assert.match(
    callOutcomeFeedback({ eventType: 'hotline_contacted', outcome: 'reached' }),
    /does not verify.*or confirm dispatch/,
  );
  assert.match(
    callOutcomeFeedback({ eventType: 'reporter_call', outcome: 'no_answer' }),
    /no answer/,
  );
  assert.match(
    callOutcomeFeedback({ eventType: 'reporter_call', outcome: 'call_failed' }),
    /call failed/,
  );
});

test('hotline prefill names the actual directory contact without copying its phone into event details', () => {
  assert.deepEqual(hotlineEventDetails(hotline), {
    service: 'other',
    service_other: hotline.name,
  });
  assert.doesNotMatch(
    JSON.stringify(hotlineEventDetails(hotline)),
    /032|123 4567/,
  );
});

test('official timestamps use local calendar words and a readable clock', () => {
  const now = new Date(2026, 9, 31, 12, 0);
  assert.equal(
    formatOperationTimestamp(new Date(2026, 9, 31, 11, 5).toISOString(), now),
    'Today at 11:05am',
  );
  assert.equal(
    formatOperationTimestamp(new Date(2026, 9, 30, 23, 45).toISOString(), now),
    'Yesterday at 11:45pm',
  );
  assert.equal(
    formatOperationTimestamp(new Date(2026, 9, 28, 9, 0).toISOString(), now),
    'Oct 28 at 9:00am',
  );
  assert.equal(
    formatOperationTimestamp(new Date(2025, 9, 28, 9, 0).toISOString(), now),
    'Oct 28, 2025 at 9:00am',
  );
  assert.equal(formatOperationTimestamp(null, now), 'Time unavailable');
  assert.equal(formatOperationTimestamp('not-a-date', now), 'Time unavailable');
});
