import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mayorLabel,
  officialLabel,
  residentStageTone,
  type LifecycleSummary,
} from '../lib/reportLifecycle.ts';
import {
  newestActivityFirst,
  REPORT_ACTIVITY_ORDER_LABEL,
  scopedLifecyclePresentation,
} from '../lib/reportPresentation.ts';

test('scoped lifecycle presentation separates stage, coordination, and lead metadata', () => {
  const summary: LifecycleSummary = {
    primaryStage: 'confirmed',
    coordinationBadge: 'forwarded',
    summaryMissing: false,
  };
  const originalSummary = JSON.stringify(summary);

  const residentPresentation = scopedLifecyclePresentation(summary, {
    audience: 'resident',
    barangayName: 'Calajo-an',
  });
  assert.equal(residentPresentation.stageLabel, 'Confirmed');
  assert.equal(residentPresentation.coordinationLabel, 'Transfer awaiting MITCOM acceptance');
  assert.equal(residentPresentation.leadLabel, 'Lead: Brgy. Calajo-an');
  assert.equal(residentPresentation.note, 'No response action recorded yet');
  assert.equal(residentPresentation.tone, residentStageTone(summary));
  assert.equal(residentPresentation.reviewLabel, null);

  const mitcomPresentation = scopedLifecyclePresentation(summary, {
    audience: 'mitcom',
  });
  assert.equal(mitcomPresentation.coordinationLabel, 'Transfer awaiting MITCOM acceptance');
  assert.equal(mitcomPresentation.leadLabel, 'Lead: Barangay office');
  assert.equal(JSON.stringify(summary), originalSummary);
});

test('scoped MITCOM labels do not change legacy BDRRMO or Mayor label defaults', () => {
  const summary: LifecycleSummary = {
    primaryStage: 'confirmed',
    coordinationBadge: 'forwarded',
    summaryMissing: false,
  };

  scopedLifecyclePresentation(summary, { audience: 'mitcom' });

  assert.equal(
    officialLabel(summary, { claimedByName: null, claimedAt: null }),
    'Forwarded · awaiting MDRRMO acceptance',
  );
  assert.equal(mayorLabel(summary, { barangayName: 'Calajo-an' }), 'Forwarded to municipal');
});

test('review claim metadata is official-only and omitted without claim facts', () => {
  const summary: LifecycleSummary = {
    primaryStage: 'under_review',
    coordinationBadge: null,
    summaryMissing: false,
  };

  assert.equal(
    scopedLifecyclePresentation(summary, {
      audience: 'bdrrmo',
      claimedByName: 'A. Officer',
    }).reviewLabel,
    'Review claim: A. Officer',
  );
  assert.equal(
    scopedLifecyclePresentation(summary, {
      audience: 'bdrrmo',
    }).reviewLabel,
    null,
  );
  assert.equal(
    scopedLifecyclePresentation(summary, {
      audience: 'resident',
      claimedByName: 'A. Officer',
    }).reviewLabel,
    null,
  );
});

test('closed stages suppress stale coordination badges unless the current lead is explicit', () => {
  const summary: LifecycleSummary = {
    primaryStage: 'resolved',
    coordinationBadge: 'support_active',
    summaryMissing: false,
  };

  const inferredPresentation = scopedLifecyclePresentation(summary, {
    audience: 'mitcom',
  });
  assert.equal(inferredPresentation.coordinationLabel, null);
  assert.equal(inferredPresentation.leadLabel, null);

  const factualLeadPresentation = scopedLifecyclePresentation(summary, {
    audience: 'mitcom',
    leadOffice: 'municipal',
  });
  assert.equal(factualLeadPresentation.coordinationLabel, null);
  assert.equal(factualLeadPresentation.leadLabel, 'Lead: MITCOM');
});

test('an explicitly unknown lead office is not inferred from an active coordination badge', () => {
  const summary: LifecycleSummary = {
    primaryStage: 'confirmed',
    coordinationBadge: 'forwarded',
    summaryMissing: false,
  };

  assert.equal(scopedLifecyclePresentation(summary, {
    audience: 'resident',
    leadOffice: null,
  }).leadLabel, 'Lead: Not recorded');
});

test('resident activity ordering is newest first, stable for ties, and leaves input unchanged', () => {
  const entries = [
    { id: 'older', occurredAt: '2026-11-16T10:00:00.000Z' },
    { id: 'invalid', occurredAt: 'unknown' },
    { id: 'newest', occurredAt: '2026-11-17T12:00:00.000Z' },
    { id: 'tie-first', occurredAt: '2026-11-16T10:00:00.000Z' },
  ];
  const originalOrder = entries.map((entry) => entry.id);

  const orderedEntries = newestActivityFirst(entries);

  assert.deepEqual(orderedEntries.map((entry) => entry.id), [
    'newest',
    'older',
    'tie-first',
    'invalid',
  ]);
  assert.deepEqual(entries.map((entry) => entry.id), originalOrder);
  assert.equal(REPORT_ACTIVITY_ORDER_LABEL, 'Newest activity first');
});
