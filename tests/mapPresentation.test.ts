import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

import { officialReportMapMarker } from '../components/map/officialMapReports.ts';
import type { OfficialReportQueueItem } from '../lib/officialReports';
import {
  deriveLifecycle,
  lifecycleColor,
  publicDiscussionIncidentId,
  residentLabel,
  residentStageTone,
  RESIDENT_STAGE_TONES,
  type LifecycleSummary,
} from '../lib/reportLifecycle.ts';
import type { MapReportMarker, ReportStatusPresentation } from '../lib/reports';
import { colors } from '../styles/theme.ts';

function loadMapPresentation() {
  const source = ts.createSourceFile('reports.ts', readFileSync(
    new URL('../lib/reports.ts', import.meta.url), 'utf8',
  ), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = new Set(['getMapReportPresentation', 'getLifecyclePresentation', 'getReportStatusPresentation']);
  const declarations = source.statements.filter((statement) =>
    ts.isFunctionDeclaration(statement) && names.has(statement.name?.text ?? ''),
  ).map((statement) => statement.getText(source)).join('\n');
  const compiled = ts.transpileModule(`${declarations}\nexports.getMapReportPresentation=getMapReportPresentation;`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const runtimeExports: Record<string, unknown> = {};
  // Execute the actual pure presentation functions without importing Auth,
  // Storage, media signing or native modules used elsewhere in reports.ts.
  runInNewContext(compiled.outputText, {
    exports: runtimeExports, deriveLifecycle, lifecycleColor, residentLabel, residentStageTone, colors,
  });
  return runtimeExports.getMapReportPresentation as (
    report: Pick<MapReportMarker, 'status' | 'lifecycle'>,
  ) => ReportStatusPresentation;
}

const lifecycle = (primaryStage: LifecycleSummary['primaryStage']): LifecycleSummary =>
  ({ primaryStage, coordinationBadge: null, summaryMissing: false });

test('map status colors follow recorded milestones even when the legacy status is identical', () => {
  const present = loadMapPresentation();
  const cases = [
    ['under_review', RESIDENT_STAGE_TONES.received],
    ['being_assessed', RESIDENT_STAGE_TONES.assessing],
    ['confirmed', RESIDENT_STAGE_TONES.confirmed],
    ['response_ongoing', RESIDENT_STAGE_TONES.responding],
    ['resolved', RESIDENT_STAGE_TONES.resolved],
    ['withdrawn', RESIDENT_STAGE_TONES.correction],
    ['rejected', RESIDENT_STAGE_TONES.closed],
  ] as const;
  for (const [stage, tone] of cases) {
    const presentation = present({ status: 'verified', lifecycle: lifecycle(stage) });
    assert.equal(presentation.color, tone.color, `Marker/badge color for ${stage}`);
    assert.equal(presentation.backgroundColor, tone.softColor, `Matching soft fill for ${stage}`);
  }
});

test('limited legacy map records do not invent a recorded response or leave resolved pins gray', () => {
  const present = loadMapPresentation();
  assert.equal(present({ status: 'unverified' }).color, RESIDENT_STAGE_TONES.received.color);
  for (const status of ['verified', 'escalated']) {
    const presentation = present({ status });
    assert.equal(presentation.color, RESIDENT_STAGE_TONES.confirmed.color);
    assert.notEqual(presentation.color, RESIDENT_STAGE_TONES.responding.color);
    assert.doesNotMatch(presentation.label, /response ongoing/i);
  }
  assert.equal(present({ status: 'resolved' }).color, RESIDENT_STAGE_TONES.resolved.color);
  assert.equal(present({ status: 'closed' }).color, RESIDENT_STAGE_TONES.closed.color);
});

test('official marker conversion retains lifecycle and category detail without changing the source', () => {
  const report = {
    id: 'map-source', title: 'Original statement', description: 'Source evidence',
    status: 'verified', lifecycle: lifecycle('response_ongoing'),
    incidentCaseId: 'shared-case', incidentType: 'other', incidentTypeOther: 'Fallen tree',
    latitude: 10.25, longitude: 123.8, addressText: 'Fixture area', barangayId: 'barangay',
    createdAt: '2026-11-09T00:00:00Z', reporter: { id: 'owner' }, media: [],
    mediaError: null, upvoteCount: 0, commentCount: 0,
  } as unknown as OfficialReportQueueItem;
  const before = JSON.stringify(report);
  const marker = officialReportMapMarker(report);
  assert.ok(marker);
  assert.equal(marker.lifecycle, report.lifecycle);
  assert.equal(marker.incidentTypeOther, 'Fallen tree');
  assert.equal(marker.title, report.title);
  assert.equal(marker.description, report.description);
  assert.equal(marker.media, report.media);
  assert.equal(publicDiscussionIncidentId(marker.incidentCaseId, marker.lifecycle), null,
    'A styling conversion must not change the existing official discussion target');
  assert.equal(JSON.stringify(report), before);
  assert.equal(loadMapPresentation()(marker).color, RESIDENT_STAGE_TONES.responding.color);
});

test('official map styling does not turn absent or invalid geometry into a point', () => {
  for (const latitude of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
    const report = { latitude, longitude: 123.8 } as unknown as OfficialReportQueueItem;
    assert.equal(officialReportMapMarker(report), null);
  }
  assert.equal(officialReportMapMarker({ latitude: 10.25, longitude: null } as unknown as OfficialReportQueueItem), null);
});
